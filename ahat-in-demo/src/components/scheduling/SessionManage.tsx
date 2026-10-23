import { useEffect, useState, type ReactNode } from 'react';
import { Building2, Video } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SelectField } from '../ui/FormField';
import { Pill } from '../dashboard/Panel';
import { SlotPicker } from './SlotPicker';
import { useAuth } from '../../context/AuthContext';
import { useAvailability, useSessions, useStaffStudents, useTimeOff } from '../../hooks/useStaffData';
import { counsellorName, counsellors, type StaffStudent } from '../../data/staff';
import { sessionTypes } from '../../data/dashboard';
import type { Session, SessionMode, Slot } from '../../lib/scheduling';
import { uid } from '../../lib/crypto';
import { cn, formatDate } from '../../lib/utils';

export const sessionStatusTone = { booked: 'blue', completed: 'green', no_show: 'red', cancelled: 'grey' } as const;
export const sessionStatusLabel = { booked: 'Booked', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled' } as const;

/** Has the session's start time passed? */
export const hasStarted = (s: Session) => new Date(`${s.date}T${s.time}:00`).getTime() <= Date.now();

type Action = 'complete' | 'no_show' | 'reschedule' | 'cancel';

/** Updates a session and adds a line to the student's notes. */
function useSessionUpdater() {
  const { user } = useAuth();
  const [, setSessions] = useSessions();
  const [, setStudents] = useStaffStudents();
  const by = user?.name ?? 'Staff';
  return (id: string, patch: Partial<Session>, historyText: string, studentId: string, noteText?: string) => {
    const at = new Date().toISOString();
    setSessions((all) => all.map((s) => (s.id === id ? { ...s, ...patch, history: [...s.history, { at, by, text: historyText }] } : s)));
    if (noteText) setStudents((all) => all.map((st) => (st.id === studentId ? { ...st, notes: [{ at, by, text: noteText }, ...st.notes] } : st)));
  };
}

/** One session with its status and the actions a counsellor can take. */
export function SessionRow({ session, studentName, showCounsellor }: { session: Session; studentName: string; showCounsellor?: boolean }) {
  const [action, setAction] = useState<Action | null>(null);
  const started = hasStarted(session);
  const Icon = session.mode === 'online' ? Video : Building2;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:flex-row sm:items-center">
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
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Pill tone={sessionStatusTone[session.status]}>{sessionStatusLabel[session.status]}</Pill>
        {session.status === 'booked' &&
          (started ? (
            <>
              <ActionButton onClick={() => setAction('complete')} primary>Complete</ActionButton>
              <ActionButton onClick={() => setAction('no_show')}>No-show</ActionButton>
            </>
          ) : (
            <>
              {session.mode === 'online' && <ActionButton onClick={() => alert('Demo: this opens your meeting link.')}>Join</ActionButton>}
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
  const update = useSessionUpdater();
  const [sessions] = useSessions();
  const [availabilityList] = useAvailability();
  const [timeOff] = useTimeOff();
  const availability = availabilityList.find((a) => a.counsellorId === session.counsellorId);
  const [text, setText] = useState('');
  const [pick, setPick] = useState<{ date: string; time: string; slot?: Slot }>({ date: '', time: '' });
  const [error, setError] = useState<string | null>(null);

  const titles: Record<Action, string> = {
    complete: 'Complete session',
    no_show: 'Mark as no-show',
    reschedule: 'Reschedule session',
    cancel: 'Cancel session',
  };

  const confirm = () => {
    const t = text.trim();
    if (action === 'complete') {
      if (t.length < 5) return setError('Add a few words about what was discussed and agreed.');
      update(session.id, { status: 'completed', outcomeNotes: t }, 'Marked completed.', session.studentId, `${session.type} session completed: ${t}`);
    } else if (action === 'no_show') {
      update(session.id, { status: 'no_show' }, 'Marked as no-show.', session.studentId, `Missed the ${session.type.toLowerCase()} session on ${formatDate(session.date)}.${t ? ` ${t}` : ''}`);
    } else if (action === 'cancel') {
      if (t.length < 5) return setError('Give a reason; the student will see it.');
      update(session.id, { status: 'cancelled', cancelReason: t }, `Cancelled: ${t}`, session.studentId, `${session.type} session on ${formatDate(session.date)} cancelled: ${t}`);
    } else {
      if (!pick.date || !pick.time) return setError('Choose a new date and time.');
      if (t.length < 5) return setError('Give a reason; the student will see it.');
      const mode: SessionMode = pick.slot && !pick.slot.modes.includes(session.mode) ? pick.slot.modes[0]! : session.mode;
      update(
        session.id,
        { date: pick.date, time: pick.time, mode },
        `Rescheduled from ${formatDate(session.date)} ${session.time} to ${formatDate(pick.date)} ${pick.time}: ${t}`,
        session.studentId,
        `${session.type} session moved to ${formatDate(pick.date)} at ${pick.time}: ${t}`,
      );
    }
    onClose();
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
          <Button className={action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : undefined} onClick={confirm}>
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
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        {(action === 'cancel' || action === 'reschedule') && <p className="text-xs text-navy-400">The student would be notified by email and WhatsApp. (Demo: no message is sent.)</p>}
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
  const { user } = useAuth();
  const [sessions, setSessions] = useSessions();
  const [availabilityList] = useAvailability();
  const [timeOff] = useTimeOff();
  const availability = availabilityList.find((a) => a.counsellorId === counsellorId);
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

  const save = () => {
    if (!studentId) return setError('Choose a student.');
    if (!type) return setError('Choose a topic.');
    if (!pick.date || !pick.time || !availability) return setError('Choose a date and time.');
    const student = students.find((s) => s.id === studentId)!;
    setSessions((all) => [
      ...all,
      {
        id: uid(),
        studentId,
        counsellorId,
        type,
        date: pick.date,
        time: pick.time,
        durationMinutes: availability.slotMinutes,
        mode: effectiveMode,
        status: 'booked',
        bookedBy: 'counsellor',
        history: [{ at: new Date().toISOString(), by: user?.name ?? 'Staff', text: `Booked on behalf of ${student.name}.` }],
      },
    ]);
    onClose();
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
          <Button variant="gold" onClick={save}>Book session</Button>
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
