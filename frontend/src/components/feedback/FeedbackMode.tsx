import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api/client';
import { ApiError } from '../../lib/api/types';
import { cn, formatDate } from '../../lib/utils';

/*
 * Temporary Feedback Mode: beta testers click anywhere to pin a comment to that place on the page.
 * On in development; on a built site only with VITE_FEEDBACK_MODE=true (the backend also needs FEEDBACK_MODE=true).
 * To remove the feature: delete this folder and <FeedbackMode /> in App.tsx, then see backend/app/routers/feedback.py.
 */

export const feedbackEnabled = import.meta.env.DEV || import.meta.env.VITE_FEEDBACK_MODE === 'true';

interface Comment {
  id: string;
  text: string;
  path: string;
  /** Page position when it was made, so it stays put when scrolling. */
  x: number;
  y: number;
  viewportWidth: number;
  by: string;
  at: string;
  canChange: boolean;
}

/** Addresses ending in a secret token aren't sent or stored (the backend also removes them). */
const safePath = (path: string) => {
  const secret = path.match(/^\/(upload|staff\/setup)\/.+/);
  return secret ? `/${secret[1]}/(private link)` : path;
};

const BOX_WIDTH = 288;

/** Keeps a box near the click, but inside the page. */
const boxPosition = (pageX: number, pageY: number) => ({
  left: Math.max(8, Math.min(pageX, window.scrollX + document.documentElement.clientWidth - BOX_WIDTH - 8)),
  top: pageY + 8,
});

export function FeedbackMode({ pathname }: { pathname: string }) {
  const path = safePath(pathname);
  const [active, setActive] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPin, setOpenPin] = useState<string | null>(null);
  // The open comment: being edited (its new text), or asking before deleting it.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    setDraft(null);
    openComment(null);
    api
      .get<Comment[]>(`/feedback?path=${encodeURIComponent(path)}`)
      .then((found) => current && setComments(found))
      .catch(() => current && setError('Comments could not be loaded.'));
    return () => {
      current = false;
    };
  }, [active, path]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (draft || openPin) {
        setDraft(null);
        openComment(null);
      } else setActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, draft, openPin]);

  const startComment = (e: MouseEvent) => {
    openComment(null);
    setText('');
    setDraft({ x: e.pageX, y: e.pageY });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.post<Comment>('/feedback', { text: text.trim(), path, x: draft.x, y: draft.y, viewportWidth: document.documentElement.clientWidth });
      setComments((c) => [...c, saved]);
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The comment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const openComment = (id: string | null) => {
    setOpenPin(id);
    setEditing(null);
    setDeleting(false);
    setError(null);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!openPin || !editing?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.put<Comment>(`/feedback/${openPin}`, { text: editing.trim() });
      setComments((list) => list.map((c) => (c.id === saved.id ? saved : c)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The comment could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!openPin) return;
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/feedback/${openPin}`);
      setComments((list) => list.filter((c) => c.id !== openPin));
      openComment(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The comment could not be deleted.');
    } finally {
      setSaving(false);
    }
  };

  const shown = comments.find((c) => c.id === openPin);
  const left = (c: Comment) => `${(c.x / c.viewportWidth) * 100}%`;

  return createPortal(
    <div data-feedback-mode>
      {active && (
        <>
          {/* Takes every click while on, so testers comment instead of using the page. */}
          <div className="fixed inset-0 z-[80] cursor-crosshair bg-gold-500/5 ring-4 ring-inset ring-gold-500" onClick={startComment} data-feedback-overlay />

          <div className="absolute left-0 top-0 z-[81] w-full" data-feedback-pins>
            {comments.map((c, i) => (
              <button
                key={c.id}
                type="button"
                style={{ left: left(c), top: c.y }}
                onClick={() => {
                  setDraft(null);
                  openComment(openPin === c.id ? null : c.id);
                }}
                className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none bg-navy-900 text-xs font-bold text-gold-300 shadow-lift ring-2 ring-white"
                aria-label={`Comment ${i + 1} by ${c.by}`}
                data-feedback-pin={c.id}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {shown && (
            <div style={{ ...boxPosition((shown.x / shown.viewportWidth) * document.documentElement.clientWidth, shown.y), width: BOX_WIDTH }} className="absolute z-[82] rounded-xl bg-white p-3 text-sm text-navy-800 shadow-lift ring-1 ring-navy-100" data-feedback-comment>
              {editing !== null ? (
                <form onSubmit={saveEdit} data-feedback-edit>
                  <textarea autoFocus rows={3} maxLength={1000} value={editing} onChange={(e) => setEditing(e.target.value)} className="input resize-none text-sm" aria-label="Edit your comment" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving || !editing.trim()} className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words">{shown.text}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs text-navy-400">
                      {shown.by} · {formatDate(shown.at)}
                    </p>
                    {shown.canChange &&
                      (deleting ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => setDeleting(false)} className="rounded-full px-2 py-1 text-xs font-semibold text-navy-600 hover:bg-navy-50">
                            Keep
                          </button>
                          <button type="button" disabled={saving} onClick={() => void remove()} className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50" data-feedback-confirm-delete>
                            Delete
                          </button>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <button type="button" onClick={() => setEditing(shown.text)} className="grid h-7 w-7 place-items-center rounded-full text-navy-500 transition hover:bg-navy-50 hover:text-navy-900" aria-label="Edit comment" title="Edit">
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button type="button" onClick={() => setDeleting(true)} className="grid h-7 w-7 place-items-center rounded-full text-navy-500 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete comment" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      ))}
                  </div>
                </>
              )}
              {error && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}
            </div>
          )}

          {draft && (
            <form onSubmit={save} style={{ ...boxPosition(draft.x, draft.y), width: BOX_WIDTH }} className="absolute z-[82] rounded-xl bg-white p-3 shadow-lift ring-1 ring-navy-100" data-feedback-form>
              <textarea
                autoFocus
                rows={3}
                maxLength={1000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input resize-none text-sm"
                placeholder="What should change here?"
                aria-label="Your comment"
              />
              {error && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {error}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !text.trim()} className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setActive((a) => !a)}
        aria-pressed={active}
        className={cn(
          'fixed bottom-24 right-4 z-[83] inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lift transition lg:bottom-5',
          active ? 'bg-gold-500 text-navy-950' : 'bg-navy-900 text-white hover:bg-navy-700',
        )}
        data-feedback-toggle
      >
        {active ? <X className="h-4 w-4" aria-hidden /> : <MessageSquarePlus className="h-4 w-4" aria-hidden />}
        {active ? `Exit feedback (${comments.length})` : 'Feedback'}
      </button>
    </div>,
    document.body,
  );
}
