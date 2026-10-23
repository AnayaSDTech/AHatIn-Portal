import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarClock, CalendarDays, CalendarOff, CalendarPlus, ChevronLeft, ChevronRight, Clock3, List, Plus, Trash2 } from 'lucide-react';
import { useAvailability, useSessions, useStaffScope, useStaffStudents, useTimeOff } from '../../hooks/useStaffData';
import { PageHeader, FilterChips, EmptyState } from '../../components/staff/StaffUi';
import { Panel, Pill } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/FormField';
import { SessionRow, StaffBookModal, sessionStatusTone } from '../../components/scheduling/SessionManage';
import { counsellorName, counsellors } from '../../data/staff';
import {
  DAY_NAMES,
  isoDate,
  slotsFor,
  toMinutes,
  validateWeekly,
  workingDates,
  type Availability,
  type BlockMode,
  type TimeBlock,
} from '../../lib/scheduling';
import { uid } from '../../lib/crypto';
import { cn, daysUntil, formatDate } from '../../lib/utils';

type Tab = 'sessions' | 'availability' | 'timeoff';
type ListFilter = 'upcoming' | 'past' | 'cancelled';
const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0'];

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function SchedulePage() {
  const scope = useStaffScope();
  const [tab, setTab] = useState<Tab>('sessions');
  const [counsellorId, setCounsellorId] = useState<string>(scope.myId ?? 'c1');

  return (
    <>
      <PageHeader
        title="Schedule"
        description={scope.isAdmin ? 'Sessions and availability for any counsellor.' : 'Your sessions with students, and when students can book you.'}
        action={
          scope.isAdmin ? (
            <div className="w-full sm:w-56">
              <SelectField label="Counsellor" options={counsellors.map((c) => ({ value: c.id, label: c.name }))} value={counsellorId} onChange={(e) => setCounsellorId(e.target.value)} />
            </div>
          ) : undefined
        }
      />
      <div className="mb-6">
        <FilterChips<Tab>
          label="Schedule sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sessions', label: 'Sessions' },
            { value: 'availability', label: 'Availability' },
            { value: 'timeoff', label: 'Time off' },
          ]}
        />
      </div>
      {tab === 'sessions' && <SessionsTab counsellorId={counsellorId} />}
      {tab === 'availability' && <AvailabilityTab key={counsellorId} counsellorId={counsellorId} />}
      {tab === 'timeoff' && <TimeOffTab counsellorId={counsellorId} />}
    </>
  );
}

/* ------------------------------ Sessions ------------------------------ */

function SessionsTab({ counsellorId }: { counsellorId: string }) {
  const [sessions] = useSessions();
  const [students] = useStaffStudents();
  const [timeOff] = useTimeOff();
  const [availabilityList] = useAvailability();
  const [view, setView] = useState<'list' | 'week'>('list');
  const [filter, setFilter] = useState<ListFilter>('upcoming');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [booking, setBooking] = useState(false);

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? 'Student';
  const mine = sessions.filter((s) => s.counsellorId === counsellorId);
  const todayIso = isoDate(new Date());
  const availability = availabilityList.find((a) => a.counsellorId === counsellorId);

  const listed = useMemo(() => {
    const isPast = (s: (typeof mine)[number]) => s.date < todayIso || s.status === 'completed' || s.status === 'no_show';
    const items = mine.filter((s) =>
      filter === 'cancelled' ? s.status === 'cancelled' : filter === 'past' ? s.status !== 'cancelled' && isPast(s) && s.status !== 'booked' : s.status === 'booked',
    );
    items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) * (filter === 'upcoming' ? 1 : -1));
    const groups = new Map<string, typeof items>();
    items.forEach((s) => groups.set(s.date, [...(groups.get(s.date) ?? []), s]));
    return [...groups.entries()];
  }, [mine, filter, todayIso]);

  const counts = {
    upcoming: mine.filter((s) => s.status === 'booked').length,
    past: mine.filter((s) => s.status === 'completed' || s.status === 'no_show').length,
    cancelled: mine.filter((s) => s.status === 'cancelled').length,
  };
  const needsAction = mine.filter((s) => s.status === 'booked' && new Date(`${s.date}T${s.time}:00`).getTime() <= Date.now()).length;
  const freeSlots = availability
    ? workingDates(availability).reduce((n, d) => n + slotsFor(availability, d, sessions, timeOff).filter((x) => x.status === 'free').length, 0)
    : 0;

  const dayLabel = (d: string) => {
    const n = daysUntil(d);
    return `${n === 0 ? 'Today · ' : n === 1 ? 'Tomorrow · ' : ''}${new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`;
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return isoDate(d);
  });

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <CalendarDays className="h-5 w-5 text-sky-600" aria-hidden />
          <p className="text-sm text-navy-600"><span className="font-display text-2xl text-navy-900">{counts.upcoming}</span> upcoming</p>
        </div>
        <div className={cn('card flex items-center gap-3 p-4', needsAction > 0 && 'ring-1 ring-amber-300')}>
          <Clock3 className={cn('h-5 w-5', needsAction ? 'text-amber-600' : 'text-emerald-600')} aria-hidden />
          <p className="text-sm text-navy-600"><span className="font-display text-2xl text-navy-900">{needsAction}</span> to mark completed or no-show</p>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <CalendarClock className="h-5 w-5 text-gold-600" aria-hidden />
          <p className="text-sm text-navy-600"><span className="font-display text-2xl text-navy-900">{freeSlots}</span> free slots students can book</p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold', view === 'list' ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100')}>
            <List className="h-3.5 w-3.5" aria-hidden /> List
          </button>
          <button type="button" onClick={() => setView('week')} aria-pressed={view === 'week'} className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold', view === 'week' ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100')}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Week
          </button>
        </div>
        <Button variant="gold" size="sm" onClick={() => setBooking(true)}>
          <CalendarPlus className="h-4 w-4" aria-hidden /> Book for a student
        </Button>
      </div>

      {view === 'list' ? (
        <>
          <div className="mb-4">
            <FilterChips<ListFilter>
              label="Filter sessions"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'upcoming', label: 'Booked', count: counts.upcoming },
                { value: 'past', label: 'Past', count: counts.past },
                { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
              ]}
            />
          </div>
          {listed.length === 0 ? (
            <EmptyState>No sessions here.</EmptyState>
          ) : (
            <div className="space-y-6">
              {listed.map(([date, items]) => (
                <section key={date} aria-label={dayLabel(date)}>
                  <h2 className="mb-2 font-sans text-sm font-semibold text-navy-700">{dayLabel(date)}</h2>
                  <div className="space-y-2">
                    {items.map((s) => (
                      <SessionRow key={s.id} session={s} studentName={nameOf(s.studentId)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <Panel
          title={`Week of ${formatDate(isoDate(weekStart))}`}
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          action={
            <div className="flex gap-1">
              <button type="button" aria-label="Previous week" onClick={() => setWeekStart((w) => new Date(w.getTime() - 7 * 86_400_000))} className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-navy-100 hover:bg-navy-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setWeekStart(mondayOf(new Date()))} className="rounded-full px-3 text-xs font-semibold ring-1 ring-navy-100 hover:bg-navy-50">
                This week
              </button>
              <button type="button" aria-label="Next week" onClick={() => setWeekStart((w) => new Date(w.getTime() + 7 * 86_400_000))} className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-navy-100 hover:bg-navy-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-7">
            {week.map((d) => {
              const blocks = availability?.weekly[String(new Date(`${d}T00:00:00`).getDay())] ?? [];
              const off = timeOff.filter((t) => t.counsellorId === counsellorId && t.date === d);
              const daySessions = mine.filter((s) => s.date === d && s.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
              const isToday = d === todayIso;
              return (
                <div key={d} className={cn('min-w-0 rounded-2xl border p-3', isToday ? 'border-gold-400 bg-gold-50/40' : 'border-navy-100')}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-navy-500">{new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                  <p className="font-display text-xl text-navy-900">{new Date(`${d}T00:00:00`).getDate()}</p>
                  <p className="mt-1 text-[11px] text-navy-400">{blocks.length ? blocks.map((b) => `${b.start}–${b.end}`).join(', ') : 'Not working'}</p>
                  {off.map((o) => (
                    <p key={o.id} className="mt-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                      Off {o.start ? `${o.start}–${o.end}` : 'all day'}
                    </p>
                  ))}
                  <ul className="mt-2 space-y-1.5">
                    {daySessions.map((s) => (
                      <li key={s.id} title={`${nameOf(s.studentId)} · ${s.type}`} className={cn('rounded-lg px-2 py-1.5 text-[11px] leading-tight ring-1', s.status === 'booked' ? 'bg-sky-50 text-sky-900 ring-sky-100' : s.status === 'completed' ? 'bg-emerald-50 text-emerald-900 ring-emerald-100' : 'bg-red-50 text-red-900 ring-red-100')}>
                        <span className="font-semibold">{s.time}</span> {nameOf(s.studentId).split(' ')[0]}
                        <span className="block truncate opacity-75">{s.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex flex-wrap gap-4 text-xs text-navy-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-200" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" /> No-show / time off</span>
            <span>Use the list view to manage a session.</span>
          </p>
        </Panel>
      )}

      <StaffBookModal open={booking} onClose={() => setBooking(false)} counsellorId={counsellorId} students={students.filter((s) => s.counsellorId === counsellorId)} />
    </>
  );
}

/* ------------------------------ Availability ------------------------------ */

const modeOptions: { value: BlockMode; label: string }[] = [
  { value: 'both', label: 'Online or office' },
  { value: 'online', label: 'Online only' },
  { value: 'office', label: 'Office only' },
];

function AvailabilityTab({ counsellorId }: { counsellorId: string }) {
  const [list, setList] = useAvailability();
  const [sessions] = useSessions();
  const [timeOff] = useTimeOff();
  const saved = list.find((a) => a.counsellorId === counsellorId);
  const blank: Availability = { counsellorId, weekly: {}, slotMinutes: 45, bufferMinutes: 15, minNoticeHours: 12, horizonDays: 14 };
  const [draft, setDraft] = useState<Availability>(saved ?? blank);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setDraft(saved ?? blank), [saved]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when the saved copy changes

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? blank);
  const preview = workingDates(draft).reduce((n, d) => n + slotsFor(draft, d, sessions, timeOff).filter((s) => s.status === 'free').length, 0);

  const setDay = (day: string, blocks: TimeBlock[]) => {
    setMessage(null);
    setDraft((d) => {
      const weekly = { ...d.weekly };
      if (blocks.length) weekly[day] = blocks;
      else delete weekly[day];
      return { ...d, weekly };
    });
  };

  const save = () => {
    const err = validateWeekly(draft.weekly);
    if (err) return setError(err);
    setError(null);
    setList((all) => [...all.filter((a) => a.counsellorId !== counsellorId), draft]);
    setMessage('Availability saved. Students now see these times when they book.');
  };

  const num = (v: string) => Number(v);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="Weekly hours" icon={<CalendarClock className="h-4 w-4" aria-hidden />} className="min-w-0 xl:col-span-8">
        <ul className="divide-y divide-navy-100">
          {DAY_ORDER.map((day) => {
            const blocks = draft.weekly[day] ?? [];
            const working = blocks.length > 0;
            return (
              <li key={day} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-start">
                <label className="flex w-36 shrink-0 items-center gap-2.5 pt-2 text-sm font-semibold text-navy-900">
                  <input
                    type="checkbox"
                    checked={working}
                    onChange={(e) => setDay(day, e.target.checked ? [{ start: '10:00', end: '17:00', mode: 'both' }] : [])}
                    className="h-4 w-4 accent-navy-900"
                  />
                  {DAY_NAMES[Number(day)]}
                </label>
                {working ? (
                  <div className="flex-1 space-y-2">
                    {blocks.map((b, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input type="time" aria-label={`${DAY_NAMES[Number(day)]} block ${i + 1} start`} value={b.start} step={900} onChange={(e) => setDay(day, blocks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="input w-32 py-2" />
                        <span className="text-navy-400">to</span>
                        <input type="time" aria-label={`${DAY_NAMES[Number(day)]} block ${i + 1} end`} value={b.end} step={900} onChange={(e) => setDay(day, blocks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="input w-32 py-2" />
                        <select aria-label={`${DAY_NAMES[Number(day)]} block ${i + 1} meeting type`} value={b.mode} onChange={(e) => setDay(day, blocks.map((x, j) => (j === i ? { ...x, mode: e.target.value as BlockMode } : x)))} className="input w-auto py-2">
                          {modeOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <button type="button" onClick={() => setDay(day, blocks.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-full text-navy-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove time block">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const last = blocks[blocks.length - 1];
                        const start = last ? Math.min(toMinutes(last.end) + 60, 22 * 60) : 600;
                        const s = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
                        const e = `${String(Math.min(Math.floor(start / 60) + 2, 23)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
                        setDay(day, [...blocks, { start: s, end: e, mode: 'both' }]);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-gold-700"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Add time block
                    </button>
                  </div>
                ) : (
                  <p className="pt-2 text-sm text-navy-400">Not available</p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="min-w-0 space-y-6 xl:col-span-4">
        <Panel title="Booking rules" icon={<Clock3 className="h-4 w-4" aria-hidden />}>
          <div className="space-y-4">
            <SelectField label="Session length" options={[30, 45, 60].map((n) => ({ value: String(n), label: `${n} minutes` }))} value={String(draft.slotMinutes)} onChange={(e) => setDraft({ ...draft, slotMinutes: num(e.target.value) })} />
            <SelectField label="Break between sessions" options={[0, 10, 15, 30].map((n) => ({ value: String(n), label: n ? `${n} minutes` : 'None' }))} value={String(draft.bufferMinutes)} onChange={(e) => setDraft({ ...draft, bufferMinutes: num(e.target.value) })} />
            <SelectField label="Minimum notice for students" options={[0, 4, 12, 24, 48].map((n) => ({ value: String(n), label: n ? `${n} hours` : 'None' }))} value={String(draft.minNoticeHours)} onChange={(e) => setDraft({ ...draft, minNoticeHours: num(e.target.value) })} />
            <SelectField label="Students can book up to" options={[7, 14, 21, 30].map((n) => ({ value: String(n), label: `${n} days ahead` }))} value={String(draft.horizonDays)} onChange={(e) => setDraft({ ...draft, horizonDays: num(e.target.value) })} />
          </div>
        </Panel>
        <div className="card p-5">
          <p className="text-sm text-navy-600">
            With these settings, students can book <span className="font-semibold text-navy-900">{preview} free slots</span> in the next {draft.horizonDays} days.
          </p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={!dirty}>Save availability</Button>
            <Button variant="outline" onClick={() => { setDraft(saved ?? blank); setError(null); }} disabled={!dirty}>Undo changes</Button>
          </div>
          <p className="mt-3 text-xs text-navy-400">Existing bookings are kept if you change your hours.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Time off ------------------------------ */

function TimeOffTab({ counsellorId }: { counsellorId: string }) {
  const [timeOff, setTimeOff] = useTimeOff();
  const [sessions] = useSessions();
  const [students] = useStaffStudents();
  const [form, setForm] = useState({ date: '', allDay: true, start: '10:00', end: '13:00', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const todayIso = isoDate(new Date());

  const mine = timeOff.filter((t) => t.counsellorId === counsellorId && t.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const clashes = (t: { date: string; start?: string; end?: string }) =>
    sessions.filter(
      (s) =>
        s.counsellorId === counsellorId &&
        s.status === 'booked' &&
        s.date === t.date &&
        (!t.start || (toMinutes(s.time) < toMinutes(t.end!) && toMinutes(s.time) + s.durationMinutes > toMinutes(t.start))),
    );
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? 'Student';

  const add = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!form.date) err.date = 'Choose a date.';
    else if (form.date < todayIso) err.date = 'Choose today or a future date.';
    if (!form.allDay && toMinutes(form.end) <= toMinutes(form.start)) err.time = 'End time must be after start time.';
    if (form.reason.trim().length < 3) err.reason = 'Add a short reason (only staff see it).';
    setErrors(err);
    if (Object.keys(err).length) return;
    const entry = { id: uid(), counsellorId, date: form.date, ...(form.allDay ? {} : { start: form.start, end: form.end }), reason: form.reason.trim() };
    setTimeOff((all) => [...all, entry]);
    const c = clashes(entry);
    setMessage(c.length ? `Time off added. ${c.length} booked ${c.length === 1 ? 'session needs' : 'sessions need'} to be rescheduled (see below).` : 'Time off added. Those times are no longer bookable.');
    setForm({ date: '', allDay: true, start: '10:00', end: '13:00', reason: '' });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel title="Add time off" icon={<CalendarOff className="h-4 w-4" aria-hidden />} className="min-w-0 xl:col-span-5">
        <form onSubmit={add} noValidate className="space-y-4">
          <TextField label="Date" type="date" min={todayIso} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
          <label className="flex items-center gap-2.5 text-sm font-medium text-navy-800">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="h-4 w-4 accent-navy-900" /> All day
          </label>
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="From" type="time" step={900} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              <TextField label="To" type="time" step={900} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} error={errors.time} />
            </div>
          )}
          <TextField label="Reason" placeholder="e.g. Annual leave, education fair" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errors.reason} />
          <Button type="submit">Add time off</Button>
          {message && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        </form>
      </Panel>

      <Panel title="Upcoming time off" icon={<CalendarDays className="h-4 w-4" aria-hidden />} className="min-w-0 xl:col-span-7">
        {mine.length === 0 ? (
          <p className="text-sm text-navy-400">No time off planned.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {mine.map((t) => {
              const c = clashes(t);
              return (
                <li key={t.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">
                        {formatDate(t.date)} · {t.start ? `${t.start}–${t.end}` : 'All day'}
                      </p>
                      <p className="text-xs text-navy-500">{t.reason}</p>
                    </div>
                    <button type="button" onClick={() => setTimeOff((all) => all.filter((x) => x.id !== t.id))} className="grid h-8 w-8 place-items-center rounded-full text-navy-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove time off">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {c.length > 0 && (
                    <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Booked during this time, reschedule from Sessions:</p>
                      <ul className="mt-1 space-y-0.5">
                        {c.map((s) => (
                          <li key={s.id} className="flex items-center gap-2">
                            {s.time} · {nameOf(s.studentId)} · {s.type} <Pill tone={sessionStatusTone[s.status]}>Booked</Pill>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-navy-400">Students can't book slots during time off. Time off for {counsellorName(counsellorId)}.</p>
      </Panel>
    </div>
  );
}
