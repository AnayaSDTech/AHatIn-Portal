import { useState } from 'react';
import { Building2, CalendarDays, CalendarPlus, Video } from 'lucide-react';
import type { Counsellor } from '../../data/staff';
import { useSessions } from '../../hooks/useStaffData';
import type { Session } from '../../lib/scheduling';
import { daysUntil, formatDate } from '../../lib/utils';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { BookSessionModal } from './BookSessionModal';

interface Props {
  studentId: string;
  studentName: string;
  counsellor: Counsellor;
}

const statusTone = { completed: 'green', no_show: 'red', cancelled: 'grey', booked: 'blue' } as const;
const statusText = { completed: 'Completed', no_show: 'Missed', cancelled: 'Cancelled', booked: 'Booked' } as const;

export function SessionsCard({ studentId, studentName, counsellor }: Props) {
  const [sessions, setSessions] = useSessions();
  const [booking, setBooking] = useState(false);
  const [toCancel, setToCancel] = useState<Session | null>(null);
  const [showPast, setShowPast] = useState(false);

  const mine = sessions.filter((s) => s.studentId === studentId);
  const upcoming = mine
    .filter((s) => s.status === 'booked' && daysUntil(s.date) >= 0)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const past = mine
    .filter((s) => !upcoming.includes(s))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  const cancel = (s: Session) => {
    setSessions((all) =>
      all.map((x) =>
        x.id === s.id
          ? { ...x, status: 'cancelled' as const, cancelReason: 'Cancelled by the student', history: [...x.history, { at: new Date().toISOString(), by: studentName, text: 'Cancelled by the student.' }] }
          : x,
      ),
    );
    setToCancel(null);
  };

  return (
    <Panel id="sessions" title="My sessions" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
      {upcoming.length === 0 ? (
        <p className="rounded-xl bg-ivory p-5 text-center text-sm text-navy-500">No upcoming sessions. Book one with {counsellor.name.split(' ')[0]}.</p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((s) => {
            const Icon = s.mode === 'online' ? Video : Building2;
            const d = daysUntil(s.date);
            return (
              <li key={s.id} className="rounded-2xl border border-navy-100 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{s.type}</p>
                    <p className="text-xs text-navy-500">
                      {formatDate(s.date)} · {s.time} IST · {s.mode === 'online' ? 'Online' : 'Office'}
                    </p>
                    {s.bookedBy === 'counsellor' && <p className="text-xs text-navy-400">Booked by your counsellor</p>}
                    {d <= 1 && <p className="mt-1 text-xs font-semibold text-emerald-700">{d === 0 ? 'Today' : 'Tomorrow'}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {s.mode === 'online' && (
                    <a
                      href={counsellor.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Demo: on the day, this opens ${counsellor.name.split(' ')[0]}'s meeting link.`);
                      }}
                      className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700"
                    >
                      Join link
                    </a>
                  )}
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

      <Button variant="gold" className="mt-4 w-full" onClick={() => setBooking(true)}>
        <CalendarPlus className="h-4 w-4" aria-hidden /> Book a session
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

      <BookSessionModal open={booking} onClose={() => setBooking(false)} studentId={studentId} studentName={studentName} counsellor={counsellor} />

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
        <p className="text-sm text-navy-600">{counsellor.name.split(' ')[0]} will be told, and the slot will be freed for other students.</p>
      </Modal>
    </Panel>
  );
}
