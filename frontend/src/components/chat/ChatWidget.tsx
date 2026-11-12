import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUp, Award, Bot, CheckCircle2, MessageCircle, PhoneCall, RotateCcw, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { askAhat, chatFeedback, chatStatus, type ChatScholarship } from '../../lib/api/chat';
import { api } from '../../lib/api/client';
import { ApiError } from '../../lib/api/types';
import type { EnquiryResult } from '../../lib/enquiry';
import { chatCallBackSchema, type ChatCallBackForm } from '../../lib/validation';
import { contact } from '../../data/site';
import { cn } from '../../lib/utils';

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  cards?: ChatScholarship[];
  /** Show the call-back form under this answer. */
  callback?: boolean;
  /** The answer's position in the saved chat, for thumbs up/down (only answers from the AI have one). */
  index?: number;
  helpful?: boolean;
}

const STORE = 'ahat-chat';
const GREETING = "Hi! I'm AHat's AI assistant. I can answer questions about studying in the UK and Europe, scholarships and our services.";
const QUICK = ['Is AHat free?', 'Which countries do you help with?', 'Scholarships for me', 'Talk to a counsellor'];

/** The chat is kept for this browser tab only, so it survives moving between pages. */
function load(): { chatId: string; messages: Msg[] } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    if (saved && Array.isArray(saved.messages)) return saved;
  } catch {
    /* storage unavailable */
  }
  return { chatId: '', messages: [] };
}

function save(chatId: string, messages: Msg[]) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ chatId, messages }));
  } catch {
    /* storage unavailable */
  }
}

/** **bold** and web addresses inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(part)) {
      const url = part.replace(/[.,]$/, '');
      return (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="break-all font-medium text-navy-900 underline underline-offset-2">
          {url}
        </a>
      );
    }
    return part;
  });
}

/** The assistant's text: paragraphs and simple lists (no HTML is ever inserted). */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">
          {items.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    // A table row (the assistant is told not to use tables): shown as a list item, without the divider rows.
    if (line.startsWith('|')) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      line = `- ${line
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .join(' · ')}`;
    }
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      list.push(item[1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ''))}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function ScholarshipCards({ items, to }: { items: ChatScholarship[]; to: string }) {
  return (
    <ul className="mt-2 space-y-2" aria-label="Scholarships">
      {items.map((s) => (
        <li key={s.id} className="rounded-xl border border-navy-100 bg-white p-3 text-xs text-navy-700">
          <p className="flex items-start gap-2 text-sm font-semibold leading-snug text-navy-900">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden /> {s.name}
          </p>
          <p className="mt-1 text-navy-500">{s.offeredBy}</p>
          <p className="mt-1.5">
            {s.state} · {s.levels.join(', ')}
          </p>
          {s.maxAmount && (
            <p className="mt-1.5 rounded-lg bg-gold-50 px-2 py-1 text-navy-800">
              <span className="font-semibold">{s.supportType}:</span> {s.maxAmount}
            </p>
          )}
        </li>
      ))}
      <li>
        <Link to={to} className="text-xs font-semibold text-navy-900 underline decoration-gold-500 underline-offset-4 hover:text-gold-700">
          {to === '/register' ? 'Register free for eligibility and how to apply' : 'See full details'}
        </Link>
      </li>
    </ul>
  );
}

const BLANK: ChatCallBackForm = { name: '', email: '', mobile: '', consent: false, website: '' };

/** The short call-back form: goes to AHat as a website enquiry labelled "Chat". Personal details never reach the AI. */
function CallBackForm({ lastQuestion }: { lastQuestion: string }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<EnquiryResult | null>(null);

  if (done) {
    const text =
      done.kind === 'student'
        ? 'You already have an account, so we have passed this to your AHat team. Log in to see your progress.'
        : done.kind === 'lead'
          ? `Added to your earlier enquiry. ${done.counsellor ?? 'The AHat team'} will call you.`
          : `Thank you. We'll call you within working hours (${contact.hours}).`;
    return (
      <p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {text}
      </p>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = chatCallBackSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const message = lastQuestion ? `Asked in the website chat: ${lastQuestion}`.slice(0, 500) : 'Call-back request from the website chat.';
      setDone(await api.post<EnquiryResult>('/enquiries', { ...parsed.data, destination: 'undecided', intake: 'unsure', course: '', callTime: '', message, fromChat: true }));
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const field = (name: 'name' | 'mobile' | 'email', label: string, type: string, autoComplete: string) => (
    <label className="block text-xs font-medium text-navy-700">
      {label}
      <input
        type={type}
        autoComplete={autoComplete}
        inputMode={name === 'mobile' ? 'numeric' : undefined}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        aria-invalid={!!errors[name]}
        className="input mt-1 w-full py-2 text-sm"
      />
      {errors[name] && <span className="mt-0.5 block text-[11px] text-red-600">{errors[name]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="mt-2 space-y-2.5 rounded-xl border border-navy-100 bg-white p-3" data-chat-callback>
      <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <PhoneCall className="h-4 w-4 text-gold-600" aria-hidden /> Request a call back
      </p>
      {field('name', 'Your name', 'text', 'name')}
      {field('mobile', 'Mobile (10-digit Indian)', 'tel', 'tel-national')}
      {field('email', 'Email', 'email', 'email')}
      {/* Spam trap: hidden from people. */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      <label className="flex items-start gap-2 text-[11px] leading-snug text-navy-600">
        <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-navy-900" />
        <span>
          I agree that AHat may contact me about studying abroad, as described in the{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
            Privacy notice
          </a>
          .
        </span>
      </label>
      {errors.consent && <p className="text-[11px] text-red-600">{errors.consent}</p>}
      {errors.form && <p className="text-[11px] text-red-600">{errors.form}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-navy-900 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60">
        {saving ? 'Sending…' : 'Call me back'}
      </button>
    </form>
  );
}

/**
 * "Ask AHat": the AI chat assistant, a button at the bottom right of the public pages. Shown only when the backend
 * says it is switched on (always for staff trying it out). Full screen on phones.
 */
export function ChatWidget() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [{ chatId, messages }, setChat] = useState(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    chatStatus()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
  }, [user?.id]);

  useEffect(() => save(chatId, messages), [chatId, messages]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);
  // Closing puts the keyboard focus back on the "Ask AHat" button (once it is shown again).
  const close = () => {
    setOpen(false);
    setTimeout(() => buttonRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const update = useCallback((id: number, change: (m: Msg) => Msg) => {
    setChat((c) => ({ ...c, messages: c.messages.map((m) => (m.id === id ? change(m) : m)) }));
  }, []);

  const add = (m: Omit<Msg, 'id'>) => {
    const id = ++nextId.current;
    setChat((c) => ({ ...c, messages: [...c.messages, { ...m, id }] }));
    return id;
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    add({ role: 'user', text: message });
    // Asking for a person needs no AI: show the form straight away.
    if (message === 'Talk to a counsellor') {
      add({ role: 'assistant', text: 'Of course. Leave your details and a counsellor will call you back.', callback: true });
      return;
    }
    setBusy(true);
    const answer = add({ role: 'assistant', text: '' });
    try {
      await askAhat({ chatId, message, website: '' }, (e) => {
        if (e.type === 'chat') setChat((c) => ({ ...c, chatId: e.chatId }));
        else if (e.type === 'text') update(answer, (m) => ({ ...m, text: m.text + e.text }));
        else if (e.type === 'scholarships') update(answer, (m) => ({ ...m, cards: e.items }));
        else if (e.type === 'callback') update(answer, (m) => ({ ...m, callback: true }));
        else if (e.type === 'done') update(answer, (m) => ({ ...m, index: e.index }));
      });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "Sorry, I couldn't connect. Please try again, or leave your details for a call back.";
      update(answer, (m) => ({ ...m, text, callback: !(err instanceof ApiError && err.status === 400) }));
    } finally {
      setBusy(false);
    }
  };

  const rate = (m: Msg, helpful: boolean) => {
    if (m.index === undefined || !chatId) return;
    update(m.id, (x) => ({ ...x, helpful }));
    chatFeedback(chatId, m.index, helpful).catch(() => undefined);
  };

  const restart = () => setChat({ chatId: '', messages: [] });

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  // Public pages only: not inside the student or referrer dashboards.
  if (!enabled || pathname.startsWith('/dashboard') || pathname.startsWith('/referrer')) return null;

  const fullDetails = user?.role === 'student' || user?.role === 'parent' ? '/dashboard/scholarships' : '/register';
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user' && m.text !== 'Talk to a counsellor')?.text ?? '';

  return (
    <>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-950 shadow-lift transition hover:-translate-y-0.5 hover:bg-gold-400"
          data-chat-open
        >
          <MessageCircle className="h-5 w-5" aria-hidden /> Ask AHat
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Ask AHat, AI assistant"
          className="fixed inset-0 z-[55] flex flex-col bg-ivory sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100vh-2.5rem))] sm:w-[400px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-navy-100 sm:shadow-lift"
          data-chat
        >
          <header className="flex items-center gap-3 bg-navy-950 px-4 py-3 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 text-navy-950">
              <Bot className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">Ask AHat</p>
              <p className="text-xs text-navy-200">AI assistant</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={restart} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Start a new chat" title="New chat">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <p className="border-b border-navy-100 bg-gold-50 px-4 py-2 text-[11px] leading-snug text-navy-700">
            You're chatting with AHat's AI assistant. Please don't share passport or bank details here.{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium underline">
              Privacy notice
            </a>
          </p>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-navy-800 shadow-sm">{GREETING}</div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => void send(q)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 ring-1 ring-navy-200 transition hover:bg-navy-50">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-navy-900 px-3.5 py-2.5 text-sm text-white">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%]">
                  <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-navy-800 shadow-sm">
                    {m.text ? (
                      <RichText text={m.text} />
                    ) : (
                      <span className="inline-flex gap-1 py-1" aria-label="Writing an answer">
                        {[0, 150, 300].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-navy-300" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </span>
                    )}
                  </div>
                  {m.cards && m.cards.length > 0 && <ScholarshipCards items={m.cards} to={fullDetails} />}
                  {m.callback && <CallBackForm lastQuestion={lastQuestion} />}
                  {m.index !== undefined && (
                    <div className="mt-1 flex gap-1" aria-label="Was this helpful?">
                      {[true, false].map((good) => {
                        const Icon = good ? ThumbsUp : ThumbsDown;
                        return (
                          <button
                            key={String(good)}
                            type="button"
                            onClick={() => rate(m, good)}
                            aria-pressed={m.helpful === good}
                            aria-label={good ? 'Helpful' : 'Not helpful'}
                            className={cn('grid h-7 w-7 place-items-center rounded-full transition hover:bg-navy-100', m.helpful === good ? 'text-gold-700' : 'text-navy-300')}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 border-t border-navy-100 bg-white p-3"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about courses, countries, scholarships…"
              aria-label="Your message"
              className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-navy-200 px-3.5 py-2.5 text-sm text-navy-900 outline-none focus:border-navy-400"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-gold-500 text-navy-950 transition hover:bg-gold-400 disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
