import { useEffect, useState } from 'react';
import { Building2, CalendarCheck2, Video } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/FormField';
import { SlotPicker } from '../scheduling/SlotPicker';
import { sessionTypes } from '../../data/dashboard';
import { sessionArea, teamTitle, type StudentTeam } from '../../data/staff';
import { useAvailability, useSessions, useTimeOff } from '../../hooks/useStaffData';
import { type Session, type SessionMode, type Slot } from '../../lib/scheduling';
import { api } from '../../lib/api/client';
import { mutate } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { cn, formatDate } from '../../lib/utils';

const MAX_UPCOMING = 3;

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  /** The student's counsellor and, once assigned, their officers: each session type is with one of them. */
  team: StudentTeam;
  /** Topic chosen when the form opens (e.g. from the progress tracker). */
  initialType?: string;
}

/**
 * Student books a session in the free slots of the person who looks after that topic: funding sessions with their
 * Financial Aid Officer, visa and travel sessions with their Visa Officer, everything else with their counsellor.
 */
export function BookSessionModal({ open, onClose, studentId, team, initialType }: Props) {
  const [sessions] = useSessions();
  const [availabilityList] = useAvailability();
  const [timeOff] = useTimeOff();

  const [type, setType] = useState('');
  const area = sessionArea(type);
  // Opened for one person (from their tab or card): only the topics that person covers.
  const forArea = initialType ? sessionArea(initialType) : null;
  const topics = forArea ? sessionTypes.filter((t) => sessionArea(t) === forArea) : [...sessionTypes];
  // Until a topic is chosen, show the counsellor's times.
  const host = team[area];
  const counsellor = host ?? team.counsellor!;
  const availability = host ? availabilityList.find((a) => a.counsellorId === host.id) : undefined;
  const role = area === 'counsellor' ? 'your counsellor' : `your ${teamTitle[area]}`;
  const [pick, setPick] = useState<{ date: string; time: string; slot?: Slot }>({ date: '', time: '' });
  const [mode, setMode] = useState<SessionMode>('online');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [booked, setBooked] = useState<Session | null>(null);

  useEffect(() => {
    if (open) {
      setType(initialType ?? '');
      setPick({ date: '', time: '' });
      setMode('online');
      setNotes('');
      setErrors({});
      setBooked(null);
    }
  }, [open, initialType]);

  const allowedModes: SessionMode[] = pick.slot?.modes ?? ['online', 'office'];
  useEffect(() => {
    if (!allowedModes.includes(mode)) setMode(allowedModes[0]!);
  }, [allowedModes, mode]);

  const upcoming = sessions.filter((s) => s.studentId === studentId && s.status === 'booked').length;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!type) e.type = 'Choose what the session is about.';
    if (!host) e.type = `You can book this once ${role} is assigned.`;
    else if (!pick.date || !pick.time) e.time = 'Choose a date and a free time slot.';
    if (upcoming >= MAX_UPCOMING) e.form = `You can have up to ${MAX_UPCOMING} upcoming sessions. Cancel one to book another.`;
    setErrors(e);
    if (Object.keys(e).length || !availability) return;
    setSaving(true);
    try {
      const session = await mutate(
        () => api.post<Session>('/sessions', { type, date: pick.date, time: pick.time, mode, studentNote: notes.trim() || undefined }),
        { silent: true },
      );
      setBooked(session);
    } catch (err) {
      const fe = err instanceof ApiError ? err.fieldErrors : {};
      setErrors({ ...fe, ...(fe.time || fe.type ? {} : { form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' }) });
      if (fe.time) setPick({ date: pick.date, time: '' });
    }
    setSaving(false);
  };

  if (booked) {
    return (
      <Modal open={open} onClose={onClose} title="Session booked" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CalendarCheck2 className="h-8 w-8" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold text-navy-900">{booked.type}</p>
          <p className="mt-1 text-navy-600">
            {formatDate(booked.date)} at {booked.time} IST · {booked.mode === 'online' ? 'Online meeting' : 'At the AHat office'}
          </p>
          <p className="mt-1 text-sm text-navy-500">with {counsellor.name}</p>
          <p className="mt-5 rounded-xl bg-ivory px-4 py-3 text-sm text-navy-600">
            A calendar invitation{booked.mode === 'online' ? ' with the meeting link' : ''} has been emailed to you and {counsellor.name.split(' ')[0]}.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={forArea && host ? `Book a session with ${host.name.split(' ')[0]}` : 'Book a session'}
      description={availability ? `Free times with ${counsellor.name}, ${role}. Sessions last ${availability.slotMinutes} minutes.` : undefined}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="gold" onClick={submit} loading={saving} disabled={!availability || !host}>
            Confirm booking
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {errors.form && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.form}
          </p>
        )}

        {topics.length === 1 ? (
          <div data-session-topic>
            <p className="mb-1.5 text-sm font-medium text-navy-800">Topic</p>
            <p className="rounded-xl bg-ivory px-4 py-3 text-sm font-semibold text-navy-900">{topics[0]}</p>
          </div>
        ) : (
          <SelectField
            label="What would you like to discuss?"
            placeholder="Choose a topic"
            options={topics.map((t) => {
              const who = team[sessionArea(t)];
              // All with the same person when opened for one of them, so the name is in the title instead.
              if (forArea) return { value: t, label: t };
              return { value: t, label: who ? `${t} · with ${who.name}` : `${t} · once your ${teamTitle[sessionArea(t)]} is assigned` };
            })}
            value={type}
            onChange={(e) => {
              // A different person has different free times.
              if (sessionArea(e.target.value) !== area) setPick({ date: '', time: '' });
              setType(e.target.value);
              setErrors(({ type: _cleared, ...rest }) => rest);
            }}
            error={errors.type}
          />
        )}

        {!host ? (
          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900" data-not-assigned>
            {type} sessions are with {role}. We'll email you when they're assigned, and you can book then.
          </p>
        ) : availability ? (
          <SlotPicker
            availability={availability}
            sessions={sessions}
            timeOff={timeOff}
            date={pick.date}
            time={pick.time}
            onChange={(v) => {
              setPick(v);
              if (v.time) setErrors(({ time: _cleared, ...rest }) => rest);
            }}
            error={errors.time}
          />
        ) : (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{counsellor.name} hasn't set their availability yet.</p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-navy-800">How would you like to meet?</p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Meeting type">
            {(
              [
                ['online', 'Online meeting', 'Link sent with your invite', Video],
                ['office', 'At our office', 'Demo Office, MG Road, Pune', Building2],
              ] as const
            ).map(([value, label, hint, Icon]) => {
              const allowed = allowedModes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  disabled={!allowed}
                  onClick={() => setMode(value)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                    mode === value ? 'border-navy-900 ring-2 ring-navy-900/10' : 'border-navy-100 hover:border-gold-400',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-gold-600" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-navy-900">{label}</span>
                    <span className="block text-xs text-navy-500">{allowed ? hint : 'Not available for this slot'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="session-notes" className="mb-1.5 block text-sm font-medium text-navy-800">
            Anything {counsellor.name.split(' ')[0]} should know? <span className="font-normal text-navy-400">(optional)</span>
          </label>
          <textarea
            id="session-notes"
            rows={3}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input resize-none"
            placeholder="e.g. I'd like to discuss scholarship options for the UK."
          />
          <p className="mt-1 text-right text-xs text-navy-400">{notes.length}/300</p>
        </div>
      </div>
    </Modal>
  );
}
