""""Ask AHat": the AI chat assistant on the public website.

Shown to everyone only when CHAT_ENABLED is on (the instant on/off switch); staff can always try it once CHAT_API_KEY
is set. Answers stream as server-sent events. Chats are kept for CHAT_RETENTION_DAYS, then deleted automatically.
"""

import json
from datetime import timedelta

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.core.auth import current_user_or_none, is_staff
from app.core.clock import now
from app.core.errors import ApiError, not_found
from app.core.ratelimit import hit
from app.core.security import random_token
from app.db import get_db
from app.schemas import ChatBody, ChatFeedbackBody
from app.services import chat as assistant

router = APIRouter(prefix="/chat", tags=["chat"])

# Questions in one chat before the visitor is asked to start a new one (keeps each request small).
MAX_QUESTIONS = 30


def _available(user: dict | None) -> bool:
    s = get_settings()
    return bool(s.chat_api_key) and (s.chat_enabled or bool(user and is_staff(user["role"])))


@router.get("/status")
async def chat_status(request: Request):
    """Whether the website shows the chat button to this visitor."""
    return {"enabled": _available(await current_user_or_none(request))}


@router.post("")
async def ask(body: ChatBody, request: Request):
    user = await current_user_or_none(request)
    if not _available(user):
        raise not_found()
    # Spam trap filled in: answer nothing.
    if body.website.strip():
        return Response(status_code=204)
    who = f"user:{user['_id']}" if user else f"ip:{request.client.host if request.client else 'unknown'}"
    await hit(f"chat:{who}", 40 if user else 20, 600, "You've sent a lot of messages in a short time. Please wait a few minutes, or ask for a call back.")
    # Daily cap for everyone together, so costs can't run away.
    await hit("chat:day", get_settings().chat_daily_limit, 86400, assistant.RESTING)

    db = get_db()
    chat = await db.chats.find_one({"_id": body.chatId}) if body.chatId else None
    if chat and sum(1 for m in chat.get("messages", []) if m["role"] == "user") >= MAX_QUESTIONS:
        raise ApiError(400, "This chat is getting long. Please start a new chat to keep going.")
    if not chat:
        t = now()
        chat = {
            "_id": random_token(18), "userId": user["_id"] if user else None, "messages": [], "flagged": False,
            "createdAt": t, "updatedAt": t, "expiresAt": t + timedelta(days=get_settings().chat_retention_days),
        }
        await db.chats.insert_one(chat)

    async def events():
        yield _sse({"type": "chat", "chatId": chat["_id"]})
        async for event in assistant.run_turn(chat, body.message):
            yield _sse(event)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


@router.post("/{chat_id}/feedback", status_code=204)
async def feedback(chat_id: str, body: ChatFeedbackBody):
    """Thumbs up or down on one of the assistant's answers."""
    db = get_db()
    chat = await db.chats.find_one({"_id": chat_id}, {"messages": 1})
    messages = (chat or {}).get("messages", [])
    if not chat or body.index >= len(messages) or messages[body.index]["role"] != "assistant":
        raise not_found("Answer not found.")
    await db.chats.update_one({"_id": chat_id}, {"$set": {f"messages.{body.index}.helpful": body.helpful}})
