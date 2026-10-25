import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CheckCheck, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessages } from '../../hooks/useStaffData';
import { uid } from '../../lib/crypto';
import { cn, formatDateTime } from '../../lib/utils';

const MAX = 1000;

/**
 * The chat between one student and their counsellor. The same thread shows on the student's dashboard
 * (viewer "student") and on the student's record for staff (viewer "staff"). Opening it marks the
 * other side's messages as read. DEMO ONLY: messages live in the shared demo store in this browser.
 */
export function ChatThread({ studentId, viewer, emptyText }: { studentId: string; viewer: 'student' | 'staff'; emptyText: string }) {
  const { user } = useAuth();
  const [all, setAll] = useMessages();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const thread = useMemo(() => all.filter((m) => m.studentId === studentId).sort((a, b) => a.at.localeCompare(b.at)), [all, studentId]);
  const other = viewer === 'student' ? 'staff' : 'student';
  const unreadFromOther = thread.some((m) => m.from === other && !m.readAt);

  // Messages count as read only once the thread is actually on screen.
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setOnScreen(true);
    const io = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!unreadFromOther || !onScreen || document.visibilityState === 'hidden') return;
    const at = new Date().toISOString();
    setAll((ms) => ms.map((m) => (m.studentId === studentId && m.from === other && !m.readAt ? { ...m, readAt: at } : m)));
  }, [unreadFromOther, onScreen, studentId, other, setAll]);

  // Keep the latest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || !user) return;
    setAll((ms) => [...ms, { id: uid(), studentId, from: viewer, by: user.name, text: t.slice(0, MAX), at: new Date().toISOString() }]);
    setText('');
  };

  // Enter sends; Shift+Enter adds a new line.
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div>
      <ol ref={listRef} className="max-h-80 space-y-2 overflow-y-auto rounded-2xl bg-ivory p-3" aria-label="Messages" aria-live="polite">
        {thread.length === 0 && <li className="py-6 text-center text-sm text-navy-400">{emptyText}</li>}
        {thread.map((m) => {
          const mine = m.from === viewer;
          return (
            <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')} data-message={m.from}>
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-md bg-navy-900 text-white' : 'rounded-bl-md bg-white text-navy-900 ring-1 ring-navy-100')}>
                {!mine && <p className="mb-0.5 text-[11px] font-semibold text-gold-700">{m.by}</p>}
                <p className="whitespace-pre-line break-words">{m.text}</p>
                <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-navy-300' : 'text-navy-400')}>
                  {formatDateTime(m.at)}
                  {mine && m.readAt && (
                    <span className="inline-flex items-center gap-0.5" title={`Read ${formatDateTime(m.readAt)}`}>
                      · <CheckCheck className="h-3 w-3" aria-hidden /> Read
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <label htmlFor={`chat-${viewer}-${studentId}`} className="sr-only">Write a message</label>
        <textarea
          id={`chat-${viewer}-${studentId}`}
          rows={1}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          className="input max-h-32 min-h-[44px] resize-none py-2.5 text-sm"
          placeholder={viewer === 'student' ? 'Ask your counsellor…' : 'Reply to the student…'}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
      <p className="mt-2 text-[11px] text-navy-400">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
