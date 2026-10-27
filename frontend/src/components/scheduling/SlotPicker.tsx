import { useMemo } from 'react';
import { CalendarX2 } from 'lucide-react';
import { slotsFor, workingDates, type Availability, type Session, type Slot, type TimeOff } from '../../lib/scheduling';
import { cn } from '../../lib/utils';

interface Props {
  availability: Availability;
  sessions: Session[];
  timeOff: TimeOff[];
  date: string;
  time: string;
  onChange: (value: { date: string; time: string; slot?: Slot }) => void;
  /** A session being rescheduled doesn't block its own slot. */
  ignoreSessionId?: string;
  /** Staff may book inside the student notice period (but never in the past). */
  ignoreNotice?: boolean;
  error?: string;
}

const statusLabel: Record<Slot['status'], string> = {
  free: 'Available',
  booked: 'Already booked',
  too_soon: 'Too soon to book',
  off: 'Counsellor unavailable',
};

/** Date chips and time slots generated from a counsellor's availability, time off and existing bookings. */
export function SlotPicker({ availability, sessions, timeOff, date, time, onChange, ignoreSessionId, ignoreNotice, error }: Props) {
  const dates = useMemo(() => workingDates(availability), [availability]);
  const slots = useMemo(
    () => (date ? slotsFor(availability, date, sessions, timeOff, { ignoreSessionId, ignoreNotice }) : []),
    [availability, date, sessions, timeOff, ignoreSessionId, ignoreNotice],
  );
  const freeCount = (d: string) => slotsFor(availability, d, sessions, timeOff, { ignoreSessionId, ignoreNotice }).filter((s) => s.status === 'free').length;

  if (dates.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <CalendarX2 className="h-4 w-4" aria-hidden /> No availability has been set for the coming days.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-navy-800">Date</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Date">
          {dates.map((d) => {
            const dt = new Date(`${d}T00:00:00`);
            const free = freeCount(d);
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={free === 0}
                onClick={() => onChange({ date: d, time: '' })}
                className={cn(
                  'flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition disabled:cursor-not-allowed disabled:opacity-40',
                  active ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-100 bg-white text-navy-800 hover:border-gold-400',
                )}
                title={free === 0 ? 'Fully booked or unavailable' : `${free} free`}
              >
                <span className="text-[11px] uppercase tracking-wider opacity-70">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="font-display text-xl">{dt.getDate()}</span>
                <span className="text-[11px] opacity-70">{dt.toLocaleDateString('en-GB', { month: 'short' })}</span>
              </button>
            );
          })}
        </div>
      </div>

      {date && (
        <div>
          <p className="mb-2 text-sm font-medium text-navy-800">Time (IST) · {availability.slotMinutes} minutes</p>
          {slots.length === 0 ? (
            <p className="text-sm text-navy-500">No slots on this day.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Time">
              {slots.map((s) => {
                const unavailable = s.status !== 'free';
                const active = s.time === time;
                return (
                  <button
                    key={s.time}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={unavailable}
                    title={statusLabel[s.status]}
                    onClick={() => onChange({ date, time: s.time, slot: s })}
                    className={cn(
                      'rounded-xl border py-2.5 text-sm font-semibold transition',
                      unavailable && 'cursor-not-allowed border-navy-50 bg-navy-50 text-navy-300 line-through',
                      !unavailable && (active ? 'border-gold-500 bg-gold-500 text-navy-950' : 'border-navy-100 bg-white text-navy-800 hover:border-gold-400'),
                    )}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}
