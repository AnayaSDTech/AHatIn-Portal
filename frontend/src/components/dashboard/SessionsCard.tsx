import { useState } from 'react';
import { Building2, CalendarDays, CalendarPlus, Video } from 'lucide-react';
import { sessionArea, teamTitle, type StudentTeam, type TeamArea } from '../../data/staff';
import { useSessions } from '../../hooks/useStaffData';
import type { Session } from '../../lib/scheduling';
import { cn, daysUntil, formatDate } from '../../lib/utils';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { BookSessionModal } from './BookSessionModal';
import { canJoin } from '../scheduling/SessionManage';
import { api } from '../../lib/api/client';
import { act } from '../../lib/api/store';

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
}

const statusTone = { completed: 'green', no_show: 'red', cancelled: 'grey', booked: 'blue' } as const;
const statusText = { completed: 'Completed', no_show: 'Missed', cancelled: 'Cancelled', booked: 'Booked' } as const;

/** The student's sessions, one tab for each person looking after them (like the chats on the Messages page). */
export function SessionsCard({ studentId, studentName, team, initial = 'counsellor', onTab, suggestedType }: Props) {
  const areas = (['counsellor', 'finance', 'visa'] as const).filter((k) => team[k]);
  const [open, setOpen] = useState<TeamArea>(areas.includes(initial) ? initial : 'counsellor');
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

  const switchTo = (k: TeamArea) => {
    setOpen(k);
    setShowPast(false);
    onTab?.(k);
  };
  const cancel = (s: Session) => {
    act(() => api.post(`/sessions/${s.id}/cancel`, {}));
    setToCancel(null);
  };

  return (
    <Panel
      id="sessions"
      title="My sessions"
      icon={<CalendarDays className="h-4 w-4" aria-hidden />}
      action={total > 0 ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">{total} upcoming</span> : undefined}
    >
      {areas.length > 1 && (
        <div className="-mt-1 mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Sessions with">
          {areas.map((k) => {
            const count = upcomingFor(k).length;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={open === k}
                onClick={() => switchTo(k)}
                data-sessions-tab={k}
                className={cn(
                  'flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2 text-left transition',
                  open === k ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100 hover:bg-navy-50',
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  {team[k]!.name}
                  {count > 0 && (
                    <span className={cn('grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold', open === k ? 'bg-gold-500 text-navy-950' : 'bg-sky-100 text-sky-800')}>{count}</span>
                  )}
                </span>
                <span className={cn('text-[11px]', open === k ? 'text-navy-200' : 'text-navy-400')}>{teamTitle[k]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div role={areas.length > 1 ? 'tabpanel' : undefined} data-sessions-panel={open}>
        {upcoming.length === 0 ? (
          <p className="rounded-xl bg-ivory p-5 text-center text-sm text-navy-500">No upcoming sessions with {first}.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((s) => {
              const Icon = s.mode === 'online' ? Video : Building2;
              const d = daysUntil(s.date);
              return (
                <li key={s.id} className="rounded-2xl border border-navy-100 p-4" data-session={s.id}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy-900">{s.type}</p>
                      <p className="text-xs text-navy-500">
                        {formatDate(s.date)} · {s.time} IST · {s.mode === 'online' ? 'Online' : 'Office'}
                      </p>
                      {s.bookedBy === 'counsellor' && <p className="text-xs text-navy-400">Booked by {first}</p>}
                      {d <= 1 && <p className="mt-1 text-xs font-semibold text-emerald-700">{d === 0 ? 'Today' : 'Tomorrow'}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canJoin(s) && (
                      <a
                        href={person.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700"
                      >
                        <Video className="h-3.5 w-3.5" aria-hidden /> Join meeting
                      </a>
                    )}
                    {s.mode === 'office' && <span className="text-xs text-navy-500">Meet at the AHat office</span>}
                    <button
                      type="button"
                      onClick={() => setToCancel(s)}
                      className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-red-300 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Button variant="gold" className="mt-4 w-full" onClick={() => setBooking(true)} data-book-session>
          <CalendarPlus className="h-4 w-4" aria-hidden /> {areas.length > 1 ? `Book a session with ${first}` : 'Book a session'}
        </Button>

        {past.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setShowPast((v) => !v)} className="text-sm font-semibold text-navy-600 hover:text-gold-700">
              {showPast ? 'Hide past sessions' : `Show past sessions (${past.length})`}
            </button>
            {showPast && (
              <ul className="mt-3 space-y-2">
                {past.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-ivory px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-navy-800">{s.type}</span>
                      <span className="text-xs text-navy-500">{formatDate(s.date)} · {s.time}</span>
                    </span>
                    <Pill tone={statusTone[s.status]}>{statusText[s.status]}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
    </Panel>
  );
}
