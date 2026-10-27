import { useEffect, useState, type ReactNode } from 'react';
import { Building2, Video } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/FormField';
import { Pill } from '../dashboard/Panel';
import { SlotPicker } from './SlotPicker';
import { useAvailability, useSessions, useStaffStudents, useTimeOff } from '../../hooks/useStaffData';
import { counsellorName, counsellors, type StaffStudent } from '../../data/staff';
import { api } from '../../lib/api/client';
import { mutate } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { CareerPlanFields, careerPlanError, emptyCareerPlan, useCareerOptions } from '../staff/CareerPlanFields';
import { sessionTypes } from '../../data/dashboard';
import type { Session, SessionMode, Slot } from '../../lib/scheduling';
import { cn, formatDate } from '../../lib/utils';

export const sessionStatusTone = { booked: 'blue', completed: 'green', no_show: 'red', cancelled: 'grey' } as const;
export const sessionStatusLabel = { booked: 'Booked', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled' } as const;

/** Has the session's start time passed? */
export const hasStarted = (s: Session) => new Date(`${s.date}T${s.time}:00`).getTime() <= Date.now();
/** Has the session's scheduled end passed? */
export const hasEnded = (s: Session) => new Date(`${s.date}T${s.time}:00`).getTime() + s.durationMinutes * 60_000 <= Date.now();
/** Online sessions can be joined until they end. */
export const canJoin = (s: Session) => s.status === 'booked' && s.mode === 'online' && !hasEnded(s);

type Action = 'complete' | 'no_show' | 'reschedule' | 'cancel';

/** Opens the counsellor's meeting link in a new tab. */
export const joinMeeting = (counsellorId: string) => {
  const link = counsellors.find((c) => c.id === counsellorId)?.meetingLink;
  if (link) window.open(link, '_blank', 'noopener');
};

/** One session with its status and the actions a counsellor can take. */
export function SessionRow({ session, studentName, showCounsellor, stacked }: { session: Session; studentName: string; showCounsellor?: boolean; stacked?: boolean }) {
  const [action, setAction] = useState<Action | null>(null);
  const started = hasStarted(session);
  const Icon = session.mode === 'online' ? Video : Building2;

  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4', !stacked && 'sm:flex-row sm:items-center')}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <p className="font-display text-xl text-navy-900">{session.time}</p>
          <p className="text-[11px] text-navy-400">{session.durationMinutes} min</p>
        </div>
        <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-900">
            {studentName} · <span className="font-normal text-navy-600">{session.type}</span>
          </p>
          <p className="text-xs text-navy-500">
            {formatDate(session.date)} · {session.mode === 'online' ? 'Online' : 'Office'} · booked by {session.bookedBy}
            {showCounsellor && ` · ${counsellorName(session.counsellorId)}`}
          </p>
          {session.studentNote && <p className="mt-1 text-xs italic text-navy-600">“{session.studentNote}”</p>}
          {session.outcomeNotes && <p className="mt-1 text-xs text-emerald-700">Notes: {session.outcomeNotes}</p>}
          {session.cancelReason && <p className="mt-1 text-xs text-navy-500">Reason: {session.cancelReason}</p>}
        </div>
      </div>
      <div className={cn('flex flex-wrap items-center gap-2', !stacked && 'sm:justify-end')}>
        <Pill tone={sessionStatusTone[session.status]}>{sessionStatusLabel[session.status]}</Pill>
        {canJoin(session) && (
          <ActionButton onClick={() => joinMeeting(session.counsellorId)} primary={started}>
            <Video className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
            Join meeting
          </ActionButton>
        )}
        {session.status === 'booked' &&
          (started ? (
            <>
              <ActionButton onClick={() => setAction('complete')} primary={!canJoin(session)}>Complete</ActionButton>
              <ActionButton onClick={() => setAction('no_show')}>No-show</ActionButton>
            </>
          ) : (
            <>
              <ActionButton onClick={() => setAction('reschedule')}>Reschedule</ActionButton>
              <ActionButton onClick={() => setAction('cancel')} danger>Cancel</ActionButton>
            </>
          ))}
      </div>
      {action && <SessionActionModal session={session} studentName={studentName} action={action} onClose={() => setAction(null)} />}
    </div>
  );
}

function ActionButton({ children, onClick, primary, danger }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold transition',
        primary ? 'bg-navy-900 text-white hover:bg-navy-700' : danger ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'border border-navy-100 text-navy-700 hover:border-navy-900',
      )}
    >
      {children}
    </button>
  );
}

function SessionActionModal({ session, studentName, action, onClose }: { session: Session; studentName: string; action: Action; onClose: () => void }) {
  const [sessions] = useSessions();
  const [availabilityList] = useAvailability();
  const [timeOff] = useTimeOff();
  const availability = availabilityList.find((a) => a.counsellorId === session.counsellorId);
  const [text, setText] = useState('');
  const [pick, setPick] = useState<{ date: string; time: string; slot?: Slot }>({ date: '', time: '' });
  const [error, setError] = useState<string | null>(null);
  // Rescheduling keeps the meeting type unless the new time doesn't offer it.
  const [mode, setMode] = useState<SessionMode>(session.mode);
  const slotModes: SessionMode[] = pick.slot?.modes ?? ['online', 'office'];
  const newMode = slotModes.includes(mode) ? mode : slotModes[0]!;

  // Completing certain sessions also moves the student's progress forward.
  const [students] = useStaffStudents();
  const student = students.find((s) => s.id === session.studentId);
  const canRecordPlan = action === 'complete' && session.type === 'Career counselling' && !!student && !student.journey.careerPlan;
  const canFinalCheckIn = action === 'complete' && session.type === 'Post-arrival check-in' && !!student?.journey.arrival.arrivedAt && !student.journey.arrival.finalCheckInAt;
  const [markPlan, setMarkPlan] = useState(true);
  const [planDraft, setPlanDraft] = useState(emptyCareerPlan);
  const careerOptions = useCareerOptions();
  const [markFinal, setMarkFinal] = useState(false);
  const [saving, setSaving] = useState(false);

  const titles: Record<Action, string> = {
    complete: 'Complete session',
    no_show: 'Mark as no-show',
    reschedule: 'Reschedule session',
    cancel: 'Cancel session',
  };

  const confirm = async () => {
    const t = text.trim();
    let request: () => Promise<unknown>;
    if (action === 'complete') {
      if (t.length < 5) return setError('Add a few words about what was discussed and agreed.');
      const planProblem = canRecordPlan && markPlan ? careerPlanError(planDraft, careerOptions) : null;
      if (planProblem) return setError(`${planProblem} Or untick “career plan shared”.`);
      request = () =>
        api.post(`/sessions/${session.id}/complete`, {
          notes: t,
          careerPlan: canRecordPlan && markPlan ? { ...planDraft, notes: planDraft.notes.trim() } : null,
          finalCheckIn: canFinalCheckIn && markFinal,
        });
    } else if (action === 'no_show') {
      request = () => api.post(`/sessions/${session.id}/no-show`, { note: t || null });
    } else if (action === 'cancel') {
      if (t.length < 5) return setError('Give a reason; the student will see it.');
      request = () => api.post(`/sessions/${session.id}/cancel`, { reason: t });
    } else {
      if (!pick.date || !pick.time) return setError('Choose a new date and time.');
      if (t.length < 5) return setError('Give a reason; the student will see it.');
      request = () => api.post(`/sessions/${session.id}/reschedule`, { date: pick.date, time: pick.time, mode: newMode, reason: t });
    }
    setSaving(true);
    try {
      await mutate(request, { silent: true });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size={action === 'reschedule' ? 'lg' : 'md'}
      title={titles[action]}
      description={`${studentName} · ${session.type} · ${formatDate(session.date)} ${session.time}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Back</Button>
          <Button className={action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : undefined} onClick={confirm} loading={saving}>
            {action === 'complete' ? 'Save and complete' : action === 'no_show' ? 'Mark no-show' : action === 'cancel' ? 'Cancel session' : 'Move session'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action === 'reschedule' && availability && (
          <SlotPicker
            availability={availability}
            sessions={sessions}
            timeOff={timeOff}
            date={pick.date}
            time={pick.time}
            onChange={setPick}
            ignoreSessionId={session.id}
            ignoreNotice
          />
        )}
        {action === 'reschedule' && (
          <div>
            <p className="mb-2 text-sm font-medium text-navy-800">Meeting type</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meeting type">
              {(['online', 'office'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={newMode === m}
                  disabled={!slotModes.includes(m)}
                  onClick={() => setMode(m)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                    newMode === m ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100',
                  )}
                >
                  {m === 'online' ? <Video className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
                  {m === 'online' ? 'Online meeting' : 'At the office'}
                </button>
              ))}
            </div>
            {pick.slot && slotModes.length === 1 && (
              <p className="mt-2 text-xs text-amber-700">This time is {slotModes[0] === 'office' ? 'for office visits only' : 'online only'}.</p>
            )}
          </div>
        )}
        <div>
          <label htmlFor="session-text" className="mb-1.5 block text-sm font-medium text-navy-800">
            {action === 'complete' ? 'Session notes (added to the student record)' : action === 'no_show' ? 'Note (optional)' : 'Reason (shown to the student)'}
          </label>
          <textarea
            id="session-text"
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            className="input resize-none"
            placeholder={action === 'complete' ? 'What was discussed, and the agreed next steps…' : action === 'no_show' ? 'e.g. Called twice, no answer' : 'e.g. I’m at an education fair that day'}
          />
        </div>
        {canRecordPlan && (
          <div className="space-y-2 rounded-xl bg-ivory p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-navy-800">
              <input type="checkbox" checked={markPlan} onChange={(e) => setMarkPlan(e.target.checked)} className="h-4 w-4 accent-navy-900" />
              Career plan shared in this session (completes Career Counselling)
            </label>
            {markPlan && (
              <div className="pt-2">
                <CareerPlanFields
                  value={planDraft}
                  onChange={(v) => {
                    setPlanDraft(v);
                    setError(null);
                  }}
                />
              </div>
            )}
          </div>
        )}
        {canFinalCheckIn && (
          <label className="flex items-center gap-2 rounded-xl bg-ivory p-3 text-sm font-medium text-navy-800">
            <input type="checkbox" checked={markFinal} onChange={(e) => setMarkFinal(e.target.checked)} className="h-4 w-4 accent-navy-900" />
            This was the final check-in (completes Post-Arrival Support)
          </label>
        )}
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        {(action === 'cancel' || action === 'reschedule') && <p className="text-xs text-navy-400">The student is notified by email, with an updated calendar invitation.</p>}
      </div>
    </Modal>
  );
}

/** Counsellor (or admin) books a session on a student's behalf, e.g. during a phone call. */
export function StaffBookModal({
  open,
  onClose,
  counsellorId,
  students,
  fixedStudentId,
}: {
  open: boolean;
  onClose: () => void;
  counsellorId: string;
  students: StaffStudent[];
  fixedStudentId?: string;
}) {
  const [sessions] = useSessions();
  const [availabilityList] = useAvailability();
  const [timeOff] = useTimeOff();
  const availability = availabilityList.find((a) => a.counsellorId === counsellorId);
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState(fixedStudentId ?? '');
  const [type, setType] = useState('');
  const [pick, setPick] = useState<{ date: string; time: string; slot?: Slot }>({ date: '', time: '' });
  const [mode, setMode] = useState<SessionMode>('online');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStudentId(fixedStudentId ?? '');
      setType('');
      setPick({ date: '', time: '' });
      setError(null);
    }
  }, [open, fixedStudentId]);

  const modes = pick.slot?.modes ?? ['online', 'office'];
  const effectiveMode = modes.includes(mode) ? mode : modes[0]!;

  const save = async () => {
    if (!studentId) return setError('Choose a student.');
    if (!type) return setError('Choose a topic.');
    if (!pick.date || !pick.time || !availability) return setError('Choose a date and time.');
    setSaving(true);
    try {
      await mutate(() => api.post('/sessions', { studentId, counsellorId, type, date: pick.date, time: pick.time, mode: effectiveMode }), { silent: true });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Book a session for a student"
      description={`With ${counsellors.find((c) => c.id === counsellorId)?.name}. The student gets an invitation by email.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gold" onClick={save} loading={saving}>Book session</Button>
        </>
      }
    >
      <div className="space-y-5">
        {!fixedStudentId && (
          <SelectField
            label="Student"
            placeholder={students.length ? 'Choose a student' : 'No assigned students'}
            options={students.map((s) => ({ value: s.id, label: `${s.name} · ${s.reference}` }))}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        )}
        <SelectField label="Topic" placeholder="Choose a topic" options={sessionTypes.map((t) => ({ value: t, label: t }))} value={type} onChange={(e) => setType(e.target.value)} />
        {availability && (
          <SlotPicker availability={availability} sessions={sessions} timeOff={timeOff} date={pick.date} time={pick.time} onChange={setPick} ignoreNotice />
        )}
        <div className="flex gap-2" role="radiogroup" aria-label="Meeting type">
          {(['online', 'office'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={effectiveMode === m}
              disabled={!modes.includes(m)}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                effectiveMode === m ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100',
              )}
            >
              {m === 'online' ? 'Online' : 'Office'}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
