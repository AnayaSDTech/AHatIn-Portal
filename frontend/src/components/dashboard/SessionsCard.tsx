import { useState } from 'react';
import { Building2, CalendarDays, CalendarPlus, ChevronDown, Mail, MessageSquare, Video } from 'lucide-react';
import { sessionArea, teamTitle, type StudentTeam, type TeamArea } from '../../data/staff';
import { useSessions } from '../../hooks/useStaffData';
import type { Session } from '../../lib/scheduling';
import { cn, daysUntil, formatDate } from '../../lib/utils';
import { Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { BookSessionModal } from './BookSessionModal';
import { canJoin } from '../scheduling/SessionManage';
import { api } from '../../lib/api/client';
import { act } from '../../lib/api/store';
import { TEAM_AREAS, TeamAvatar, TeamSwitcher } from './TeamSwitcher';

interface Props {
  studentId: string;
  studentName: string;
  /** Counsellor and officers; sessions are with one of them. */
  team: StudentTeam;
  /** The tab to open first. */
  initial?: TeamArea;
  /** Called when the student switches tab (e.g. to keep it in the address). */
  onTab?: (area: TeamArea) => void;
  /** The kind of session to suggest when booking with each person. */
  suggestedType?: (area: TeamArea) => string | undefined;
  /** Opens the chat with this person. */
  onMessage?: (area: TeamArea) => void;
}

const statusTone = { completed: 'green', no_show: 'red', cancelled: 'grey', booked: 'blue' } as const;
const statusText = { completed: 'Completed', no_show: 'Missed', cancelled: 'Cancelled', booked: 'Booked' } as const;

/** "12" and "Nov" for a calendar tile. */
function DateTile({ date, highlight }: { date: string; highlight: boolean }) {
  const d = new Date(`${date}T00:00:00`);
  return (
    <span className={cn('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl', highlight ? 'bg-navy-900 text-white' : 'bg-gold-50 text-navy-900')}>
      <span className={cn('text-[10px] font-semibold uppercase tracking-wider', highlight ? 'text-gold-400' : 'text-gold-700')}>{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
      <span className="font-display text-xl leading-none">{d.getDate()}</span>
    </span>
  );
}

/** The student's sessions: the people looking after them down the side, and the sessions with the chosen person. */
export function SessionsCard({ studentId, studentName, team, initial = 'counsellor', onTab, suggestedType, onMessage }: Props) {
  const areas = TEAM_AREAS.filter((k) => team[k]);
  const [open, setOpen] = useState<TeamArea>(areas.includes(initial as never) ? initial : 'counsellor');
  const [sessions] = useSessions();
  const [booking, setBooking] = useState(false);
  const [toCancel, setToCancel] = useState<Session | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Whose session it is: the person hosting it, or (for someone no longer on the team) the kind of session.
  const areaOf = (s: Session): TeamArea => areas.find((k) => team[k]!.id === s.counsellorId) ?? (team[sessionArea(s.type)] ? sessionArea(s.type) : 'counsellor');
  const mine = sessions.filter((s) => s.studentId === studentId);
  const isUpcoming = (s: Session) => s.status === 'booked' && daysUntil(s.date) >= 0;
  const upcomingFor = (k: TeamArea) => mine.filter((s) => areaOf(s) === k && isUpcoming(s));

  const person = team[open]!;
  const first = person.name.split(' ')[0];
  const upcoming = upcomingFor(open).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const past = mine
    .filter((s) => areaOf(s) === open && !isUpcoming(s))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const total = mine.filter(isUpcoming).length;
  const many = areas.length > 1;

  const switchTo = (k: TeamArea) => {
    setOpen(k);
    setShowPast(false);
    onTab?.(k);
  };
  const cancel = (s: Session) => {
    act(() => api.post(`/sessions/${s.id}/cancel`, {}));
    setToCancel(null);
  };
  const chip = 'inline-flex items-center gap-1.5 rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs font-semibold text-navy-800 transition hover:border-navy-200 hover:bg-ivory';

  return (
    <section id="sessions" tabIndex={-1} className="card scroll-mt-28 overflow-hidden outline-none" aria-labelledby="sessions-title">
      <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
        <h2 id="sessions-title" className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          My sessions
        </h2>
        {total > 0 && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">{total} upcoming</span>}
      </header>

      <div className={cn(many && 'lg:grid lg:grid-cols-[16rem_1fr]')}>
        {many && (
          <div className="border-b border-navy-100 bg-ivory/60 lg:border-b-0 lg:border-r">
            <p className="hidden px-5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-navy-400 lg:block">Sessions with</p>
            <TeamSwitcher team={team} active={open} onSelect={switchTo} label="Sessions with" dataAttr="data-sessions-tab" badge={(k) => ({ count: upcomingFor(k).length, tone: 'blue' })} />
          </div>
        )}

        <div className="min-w-0 p-5" role={many ? 'tabpanel' : undefined} data-sessions-panel={open}>
          {/* Who the sessions are with, and ways to reach them. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <TeamAvatar area={open} name={person.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-900">{person.name}</p>
                <p className="text-xs text-navy-500">{teamTitle[open]}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {onMessage && (
                <button type="button" onClick={() => onMessage(open)} className={chip}>
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Message
                </button>
              )}
              <a href={`mailto:${person.email}`} className={chip}>
                <Mail className="h-3.5 w-3.5" aria-hidden /> Email
              </a>
              <Button size="sm" variant="gold" onClick={() => setBooking(true)} data-book-session>
                <CalendarPlus className="h-4 w-4" aria-hidden /> {many ? `Book with ${first}` : 'Book a session'}
              </Button>
            </div>
          </div>

          <h3 className="mt-6 font-sans text-[11px] font-semibold uppercase tracking-wider text-navy-400">Upcoming</h3>
          {upcoming.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-navy-200 bg-ivory/50 px-5 py-8 text-center">
              <p className="text-sm font-medium text-navy-700">No upcoming sessions with {first}</p>
              <p className="mt-1 text-xs text-navy-500">Book one whenever you'd like to talk things through.</p>
            </div>
          ) : (
            <ul className="mt-2 space-y-3">
              {upcoming.map((s) => {
                const Icon = s.mode === 'online' ? Video : Building2;
                const d = daysUntil(s.date);
                return (
                  <li key={s.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border p-4 sm:flex-nowrap', d <= 1 ? 'border-sky-200 bg-sky-50/40' : 'border-navy-100')} data-session={s.id}>
                    <DateTile date={s.date} highlight={d <= 1} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-900">
                        {s.type}
                        {d <= 1 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{d === 0 ? 'Today' : 'Tomorrow'}</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-navy-500">
                        <span>{formatDate(s.date)}</span>
                        <span aria-hidden>·</span>
                        <span>{s.time} IST</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Icon className="h-3.5 w-3.5" aria-hidden /> {s.mode === 'online' ? 'Online' : 'At the AHat office'}
                        </span>
                      </p>
                      {s.bookedBy === 'counsellor' && <p className="mt-0.5 text-xs text-navy-400">Booked by {first}</p>}
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                      {canJoin(s) && (
                        <a
                          href={person.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-navy-700"
                        >
                          <Video className="h-3.5 w-3.5" aria-hidden /> Join meeting
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setToCancel(s)}
                        className="rounded-full border border-navy-100 bg-white px-3.5 py-2 text-xs font-semibold text-navy-700 transition hover:border-red-300 hover:text-red-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {past.length > 0 && (
            <div className="mt-6 border-t border-navy-100 pt-4">
              <button type="button" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-950">
                {showPast ? 'Hide past sessions' : `Past sessions (${past.length})`}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showPast && 'rotate-180')} aria-hidden />
              </button>
              {showPast && (
                <ul className="mt-3 divide-y divide-navy-100 rounded-xl border border-navy-100">
                  {past.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-navy-800">{s.type}</span>
                        <span className="text-xs text-navy-500">
                          {formatDate(s.date)} · {s.time}
                        </span>
                      </span>
                      <Pill tone={statusTone[s.status]}>{statusText[s.status]}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <BookSessionModal open={booking} onClose={() => setBooking(false)} studentId={studentId} studentName={studentName} team={team} initialType={suggestedType?.(open)} />

      <Modal
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title="Cancel this session?"
        description={toCancel ? `${toCancel.type} on ${formatDate(toCancel.date)} at ${toCancel.time} IST` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setToCancel(null)}>
              Keep session
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => toCancel && cancel(toCancel)}>
              Yes, cancel it
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">{toCancel ? team[areaOf(toCancel)]!.name.split(' ')[0] : first} will be told, and the slot will be freed for other students.</p>
      </Modal>
    </section>
  );
}
