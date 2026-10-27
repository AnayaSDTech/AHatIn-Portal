/** Session availability and slot calculation (demo version of the portal's booking rules). */

export type SessionMode = 'online' | 'office';
export type BlockMode = 'both' | SessionMode;

export interface TimeBlock {
  start: string; // "HH:MM"
  end: string;
  mode: BlockMode;
}

export interface Availability {
  counsellorId: string;
  /** Weekly hours, keyed by day of week (0 = Sunday … 6 = Saturday). */
  weekly: Record<string, TimeBlock[]>;
  slotMinutes: number;
  bufferMinutes: number;
  /** Students can't book closer than this to the start time. */
  minNoticeHours: number;
  /** How many days ahead students can book. */
  horizonDays: number;
}

export interface TimeOff {
  id: string;
  counsellorId: string;
  date: string; // YYYY-MM-DD
  start?: string; // omit for the whole day
  end?: string;
  reason: string;
}

export type SessionStatus = 'booked' | 'completed' | 'no_show' | 'cancelled';

export interface Session {
  id: string;
  studentId: string;
  counsellorId: string;
  type: string;
  date: string;
  time: string;
  durationMinutes: number;
  mode: SessionMode;
  studentNote?: string;
  status: SessionStatus;
  bookedBy: 'student' | 'counsellor';
  outcomeNotes?: string;
  cancelReason?: string;
  history: { at: string; by: string; text: string }[];
}

export type SlotStatus = 'free' | 'booked' | 'too_soon' | 'off';

export interface Slot {
  time: string;
  modes: SessionMode[];
  status: SlotStatus;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
export const fromMinutes = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dayOfWeek = (date: string) => new Date(`${date}T00:00:00`).getDay();

const modesFor = (m: BlockMode): SessionMode[] => (m === 'both' ? ['online', 'office'] : [m]);

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/**
 * Every slot a counsellor offers on a date, with its status.
 * `ignoreSessionId` lets a session being rescheduled ignore its own current slot.
 */
export function slotsFor(
  av: Availability,
  date: string,
  sessions: Session[],
  timeOff: TimeOff[],
  options: { now?: Date; ignoreSessionId?: string; ignoreNotice?: boolean } = {},
): Slot[] {
  const now = options.now ?? new Date();
  const blocks = av.weekly[String(dayOfWeek(date))] ?? [];
  const taken = sessions.filter(
    (s) => s.counsellorId === av.counsellorId && s.date === date && s.status === 'booked' && s.id !== options.ignoreSessionId,
  );
  const off = timeOff.filter((t) => t.counsellorId === av.counsellorId && t.date === date);
  const slots: Slot[] = [];

  for (const block of blocks) {
    const end = toMinutes(block.end);
    for (let t = toMinutes(block.start); t + av.slotMinutes <= end; t += av.slotMinutes + av.bufferMinutes) {
      const slotEnd = t + av.slotMinutes;
      const startsAt = new Date(`${date}T${fromMinutes(t)}:00`);
      let status: SlotStatus = 'free';
      if (off.some((o) => !o.start || overlaps(t, slotEnd, toMinutes(o.start), toMinutes(o.end ?? '23:59')))) status = 'off';
      else if (taken.some((s) => overlaps(t, slotEnd, toMinutes(s.time), toMinutes(s.time) + s.durationMinutes))) status = 'booked';
      else if (startsAt.getTime() < now.getTime() + (options.ignoreNotice ? 0 : av.minNoticeHours * 3_600_000)) status = 'too_soon';
      slots.push({ time: fromMinutes(t), modes: modesFor(block.mode), status });
    }
  }
  return slots;
}

/** Dates within the booking horizon on which the counsellor works (from today). */
export function workingDates(av: Availability, from = new Date()) {
  const dates: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i <= av.horizonDays; i++) {
    if ((av.weekly[String(d.getDay())] ?? []).length) dates.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** Validates weekly blocks: end after start, no overlaps within a day. Returns an error message or null. */
export function validateWeekly(weekly: Record<string, TimeBlock[]>): string | null {
  for (const [day, blocks] of Object.entries(weekly)) {
    const sorted = [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i]!;
      if (toMinutes(b.end) <= toMinutes(b.start)) return `${DAY_NAMES[Number(day)]}: each block must end after it starts.`;
      const next = sorted[i + 1];
      if (next && toMinutes(next.start) < toMinutes(b.end)) return `${DAY_NAMES[Number(day)]}: time blocks overlap.`;
    }
  }
  return null;
}
