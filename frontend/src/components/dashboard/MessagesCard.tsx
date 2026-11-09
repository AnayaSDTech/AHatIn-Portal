import { CalendarPlus, Clock, Mail, MessageSquare } from 'lucide-react';
import { ChatThread } from '../messages/ChatThread';
import { teamTitle, type Message, type StudentTeam, type TeamArea } from '../../data/staff';
import { cn } from '../../lib/utils';
import { TEAM_AREAS, TeamAvatar, TeamSwitcher } from './TeamSwitcher';

const emptyText = (area: TeamArea, first: string) =>
  area === 'counsellor'
    ? `No messages yet. Ask ${first} anything about your plans.`
    : area === 'finance'
      ? `No messages yet. Ask ${first} about scholarships, loans or proof of funds.`
      : `No messages yet. Ask ${first} about your visa, travel or settling in.`;

/**
 * The student's chats, laid out like a messaging app: the people looking after them down the side (each with an unread
 * count), and the open chat with that person's details, email and booking beside it.
 */
export function MessagesCard({
  studentId,
  team,
  messages,
  active,
  onSelect,
  onBook,
}: {
  studentId: string;
  team: StudentTeam;
  messages: Message[];
  /** Whose chat is open. */
  active: TeamArea;
  onSelect: (area: TeamArea) => void;
  /** Opens the booking window for a session with this person. */
  onBook: (area: TeamArea) => void;
}) {
  const chats = TEAM_AREAS.filter((k) => team[k]);
  const open = chats.includes(active as never) ? active : 'counsellor';
  const unread = (k: TeamArea) => messages.filter((m) => m.studentId === studentId && (m.thread ?? 'counsellor') === k && m.from === 'staff' && !m.readAt).length;
  const person = team[open]!;
  const first = person.name.split(' ')[0]!;
  const total = chats.reduce((n, k) => n + unread(k), 0);
  const many = chats.length > 1;
  const chip = 'inline-flex items-center gap-1.5 rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs font-semibold text-navy-800 transition hover:border-navy-200 hover:bg-ivory';

  return (
    <section id="messages" tabIndex={-1} className="card scroll-mt-28 overflow-hidden outline-none" aria-labelledby="messages-title">
      <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
        <h2 id="messages-title" className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <MessageSquare className="h-4 w-4" aria-hidden />
          </span>
          Messages
        </h2>
        {total > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">{total} new</span>}
      </header>

      <div className={cn(many && 'lg:grid lg:grid-cols-[16rem_1fr]')}>
        {many && (
          <div className="border-b border-navy-100 bg-ivory/60 lg:border-b-0 lg:border-r">
            <p className="hidden px-5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-navy-400 lg:block">Your team</p>
            <TeamSwitcher team={team} active={open} onSelect={onSelect} label="Chats" dataAttr="data-chat" badge={(k) => ({ count: unread(k), tone: 'red' })} />
          </div>
        )}

        <div className="min-w-0 p-5" role={many ? 'tabpanel' : undefined}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <TeamAvatar area={open} name={person.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-900">{person.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-navy-500">
                  {teamTitle[open]}
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden /> Replies within 1 working day
                  </span>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <a href={`mailto:${person.email}`} className={chip}>
                <Mail className="h-3.5 w-3.5" aria-hidden /> Email
              </a>
              <button type="button" onClick={() => onBook(open)} className={chip} data-book-with={`Your ${teamTitle[open].toLowerCase()}`}>
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Book a session
              </button>
            </div>
          </div>

          <ChatThread
            key={open}
            studentId={studentId}
            viewer="student"
            thread={open}
            placeholder={`Write to ${first}…`}
            emptyText={emptyText(open, first)}
            listClassName="h-[22rem] sm:h-[26rem]"
          />
        </div>
      </div>
    </section>
  );
}
