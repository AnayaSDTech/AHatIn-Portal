import { api, apiFetch } from './client';

/** A scholarship as the chat shows it: the public basics only (full details need a free account). */
export interface ChatScholarship {
  id: string;
  name: string;
  offeredBy: string;
  type: string;
  state: string;
  levels: string[];
  supportType: string;
  maxAmount: string | null;
  targetGroupText: string;
}

/** What the server streams while it answers. */
export type ChatEvent =
  | { type: 'chat'; chatId: string }
  | { type: 'text'; text: string }
  | { type: 'scholarships'; items: ChatScholarship[]; total: number }
  | { type: 'callback' }
  | { type: 'done'; index: number };

export const chatStatus = () => api.get<{ enabled: boolean }>('/chat/status');

export const chatFeedback = (chatId: string, index: number, helpful: boolean) => api.post<void>(`/chat/${chatId}/feedback`, { index, helpful });

/** Sends a message and calls `onEvent` for each piece of the answer as it arrives. Throws ApiError (e.g. 429). */
export async function askAhat(body: { chatId: string; message: string; website: string }, onEvent: (e: ChatEvent) => void) {
  const response = await apiFetch('/chat', { method: 'POST', body: JSON.stringify(body) });
  if (response.status === 204 || !response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Server-sent events are separated by a blank line.
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(line.slice(5)) as ChatEvent);
        } catch {
          /* a malformed piece: skip it */
        }
      }
      end = buffer.indexOf('\n\n');
    }
  }
}
