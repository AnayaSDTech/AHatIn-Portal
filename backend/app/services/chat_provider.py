"""The AI provider behind "Ask AHat": any OpenAI-compatible chat completions API (Groq, Google Gemini, and others).

Switching provider is a settings change (CHAT_BASE_URL, CHAT_MODEL, CHAT_API_KEY), not a code change.
Only this module talks to the provider, so tests replace `stream_reply`.
"""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)


class ProviderError(Exception):
    """The provider could not answer (down, out of free quota, bad key)."""


async def stream_reply(messages: list[dict], tools: list[dict]) -> AsyncIterator[dict[str, Any]]:
    """Streams one reply. Yields {"text": "..."} pieces as they arrive, then one
    {"tool_calls": [{"id", "name", "arguments"}]} (possibly empty) when the reply ends."""
    s = get_settings()
    payload = {
        "model": s.chat_model,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
        "stream": True,
        "temperature": 0.3,
        "max_tokens": s.chat_max_reply_tokens,
    }
    if s.chat_reasoning_effort:
        payload["reasoning_effort"] = s.chat_reasoning_effort
    calls: dict[int, dict] = {}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60, connect=10)) as client:
            async with client.stream(
                "POST", f"{s.chat_base_url.rstrip('/')}/chat/completions", json=payload, headers={"Authorization": f"Bearer {s.chat_api_key}"}
            ) as r:
                if r.status_code != 200:
                    body = (await r.aread())[:500]
                    log.warning("chat provider answered %s: %s", r.status_code, body)
                    raise ProviderError(f"provider status {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except ValueError:
                        continue
                    for choice in chunk.get("choices") or []:
                        delta = choice.get("delta") or {}
                        if delta.get("content"):
                            yield {"text": delta["content"]}
                        for tc in delta.get("tool_calls") or []:
                            slot = calls.setdefault(tc.get("index", len(calls)), {"id": "", "name": "", "arguments": ""})
                            fn = tc.get("function") or {}
                            slot["id"] = tc.get("id") or slot["id"]
                            slot["name"] += fn.get("name") or ""
                            slot["arguments"] += fn.get("arguments") or ""
    except httpx.HTTPError as e:
        log.warning("chat provider unreachable: %s", e)
        raise ProviderError("provider unreachable") from e
    yield {"tool_calls": [{**c, "id": c["id"] or f"call_{i}"} for i, c in sorted(calls.items()) if c["name"]]}
