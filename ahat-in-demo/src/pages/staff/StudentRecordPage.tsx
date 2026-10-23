import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CalendarPlus, CheckCircle2, Clock, FileSearch, Mail, Phone, School, StickyNote, UserCog, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { SessionRow, StaffBookModal } from '../../components/scheduling/SessionManage';
import { SelectField } from '../../components/ui/FormField';
import { Panel, Pill } from '../../components/dashboard/Panel';
import { ServiceBar } from '../../components/staff/StaffUi';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/DemoBadge';
import { NotFoundPage } from '../NotFoundPage';
import { appStateLabel, appTransitions, counsellorName, counsellors, serviceShortNames, stageLabel, type AppState, type StaffStudent } from '../../data/staff';
import { formatDateTime, relativeTime } from '../../lib/utils';

const appTone = (s: AppState) =>
  (s === 'accepted' || s === 'unconditional_offer' ? 'green' : s === 'conditional_offer' ? 'gold' : s === 'rejected' || s === 'withdrawn' ? 'red' : s === 'declined' || s === 'draft' ? 'grey' : 'blue') as
    'green' | 'gold' | 'red' | 'grey' | 'blue';

export function StudentRecordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [students, setStudents] = useStaffStudents();
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const scope = useStaffScope();
  const [sessions] = useSessions();
  const [booking, setBooking] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [ownerReason, setOwnerReason] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const student = students.find((s) => s.id === id);
  // A record the user may not see looks exactly like one that doesn't exist.
  if (!student || !scope.canSee(student.counsellorId)) return <NotFoundPage />;
  const studentSessions = sessions
    .filter((s) => s.studentId === student.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  const update = (fn: (s: StaffStudent) => StaffStudent) => setStudents((all) => all.map((s) => (s.id === student.id ? fn(s) : s)));
  const addNote = (s: StaffStudent, text: string) => ({ ...s, notes: [{ at: new Date().toISOString(), by: user?.name ?? 'Staff', text }, ...s.notes] });

  const verify = (docId: string, name: string) => {
    update((s) => addNote({ ...s, documents: s.documents.map((d) => (d.id === docId ? { ...d, state: 'verified' as const, reason: undefined } : d)) }, `Verified document: ${name}.`));
    setMessage(`${name} verified. The student can see this straight away.`);
  };

  const confirmReject = () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) return setReasonError('Tell the student what to fix (at least 5 characters).');
    update((s) =>
      addNote(
        { ...s, documents: s.documents.map((d) => (d.id === rejecting.id ? { ...d, state: 'rejected' as const, reason: reason.trim() } : d)) },
        `Rejected document: ${rejecting.name} (${reason.trim()}).`,
      ),
    );
    setMessage(`${rejecting.name} rejected. The student is asked to re-upload it.`);
    setRejecting(null);
    setReason('');
    setReasonError(null);
  };

  const changeStatus = (appId: string, from: AppState, to: AppState, university: string) => {
    update((s) => addNote({ ...s, applications: s.applications.map((a) => (a.id === appId ? { ...a, state: to } : a)) }, `${university}: ${appStateLabel[from]} → ${appStateLabel[to]}.`));
    setMessage(`${university} updated to "${appStateLabel[to]}". The student and parents are notified.`);
  };

  const reassign = () => {
    if (!newOwner) return setOwnerError('Choose the new counsellor.');
    if (ownerReason.trim().length < 5) return setOwnerError('Give a reason (at least 5 characters).');
    const from = student.counsellorId;
    const reason = ownerReason.trim();
    update((s) =>
      addNote(
        {
          ...s,
          counsellorId: newOwner,
          assignmentHistory: [...s.assignmentHistory, { at: new Date().toISOString(), by: user?.name ?? 'Admin', from, to: newOwner, reason }],
        },
        `Reassigned from ${counsellorName(from)} to ${counsellorName(newOwner)}: ${reason}`,
      ),
    );
    setMessage(`${student.name} is now assigned to ${counsellorName(newOwner)}. Upcoming sessions stay as booked until rescheduled.`);
    setReassigning(false);
    setNewOwner('');
    setOwnerReason('');
    setOwnerError(null);
  };

  const saveNote = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    update((s) => addNote(s, note.trim()));
    setNote('');
  };

  const pending = student.documents.filter((d) => d.state === 'pending');

  return (
    <>
      <Link to="/staff/students" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All students
      </Link>

      <div className="card mb-6 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <DemoBadge label="Demo data" />
            <h1 className="mt-3 text-3xl">{student.name}</h1>
            <p className="mt-1 text-navy-600">{student.goal} · {student.destination} · {student.intake}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy-500">
              <span>{student.reference}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" aria-hidden /> {student.email}</span>
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" aria-hidden /> {student.mobile}</span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Pill tone="blue">{stageLabel(student.stage)}</Pill>
            <p className="text-sm text-navy-600">
              Counsellor: <span className="font-semibold text-navy-900">{counsellorName(student.counsellorId)}</span>
              {!scope.isAdmin && student.counsellorId !== scope.myId && <span className="ml-1 text-xs font-semibold text-sky-700">(you're covering)</span>}
            </p>
            {scope.isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setReassigning(true)}>
                <UserCog className="h-4 w-4" aria-hidden /> Reassign
              </Button>
            )}
          </div>
        </div>
        <div className="mt-6">
          <ServiceBar values={student.services} names={serviceShortNames} />
          <div className="mt-2 hidden grid-cols-7 gap-1 text-center text-[11px] text-navy-400 sm:grid">
            {serviceShortNames.map((n) => <span key={n}>{n}</span>)}
          </div>
        </div>
      </div>

      {message && <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <Panel title="Documents" icon={<FileSearch className="h-4 w-4" aria-hidden />} action={pending.length > 0 ? <Pill tone="amber">{pending.length} to verify</Pill> : undefined}>
            {student.documents.length === 0 ? (
              <p className="text-sm text-navy-400">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-navy-100">
                {student.documents.map((d) => (
                  <li key={d.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-900">{d.name}</p>
                      <p className="text-xs text-navy-500">
                        Uploaded {relativeTime(d.uploadedAt)}
                        {d.reason && <span className="text-red-600"> · {d.reason}</span>}
                      </p>
                    </div>
                    {d.state === 'pending' ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setMessage('Demo: the document preview opens here.')} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-navy-900">
                          View
                        </button>
                        <button type="button" onClick={() => verify(d.id, d.name)} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Verify
                        </button>
                        <button type="button" onClick={() => setRejecting({ id: d.id, name: d.name })} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100">
                          <XCircle className="h-3.5 w-3.5" aria-hidden /> Reject
                        </button>
                      </div>
                    ) : (
                      <Pill tone={d.state === 'verified' ? 'green' : 'red'}>{d.state === 'verified' ? 'Verified' : 'Rejected'}</Pill>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Applications" icon={<School className="h-4 w-4" aria-hidden />}>
            {student.applications.length === 0 ? (
              <p className="text-sm text-navy-400">No applications yet. Applications are created from the student's approved shortlist.</p>
            ) : (
              <ul className="divide-y divide-navy-100">
                {student.applications.map((a) => {
                  const next = appTransitions[a.state];
                  return (
                    <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy-900">{a.university}</p>
                        <p className="text-sm text-navy-500">{a.course} · via {a.agency}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <Pill tone={appTone(a.state)}>{appStateLabel[a.state]}</Pill>
                        {next.length > 0 ? (
                          <label className="flex items-center gap-2 text-xs text-navy-500">
                            <span className="shrink-0">Change to</span>
                            <select
                              value=""
                              onChange={(e) => e.target.value && changeStatus(a.id, a.state, e.target.value as AppState, a.university)}
                              className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-xs font-medium text-navy-800 focus:border-gold-500 focus:outline-none"
                            >
                              <option value="">Choose…</option>
                              {next
                                .filter((s) => s !== 'accepted' && s !== 'declined') // students decide on offers themselves
                                .map((s) => (
                                  <option key={s} value={s}>{appStateLabel[s]}</option>
                                ))}
                            </select>
                          </label>
                        ) : (
                          <span className="text-xs text-navy-400">Final status</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 text-xs text-navy-400">Only allowed status changes are offered. Accepting or declining an offer is the student's decision.</p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-5">
          <Panel
            title="Sessions"
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            action={
              <Button size="sm" variant="gold" onClick={() => setBooking(true)}>
                <CalendarPlus className="h-4 w-4" aria-hidden /> Book
              </Button>
            }
          >
            {studentSessions.length === 0 ? (
              <p className="text-sm text-navy-400">No sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {studentSessions.map((s) => (
                  <SessionRow key={s.id} session={s} studentName={student.name} showCounsellor />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Notes" icon={<StickyNote className="h-4 w-4" aria-hidden />}>
            <form onSubmit={saveNote}>
              <label htmlFor="note" className="sr-only">Add a note</label>
              <textarea id="note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" placeholder="Add a note (staff only)…" />
              <Button type="submit" size="sm" className="mt-3" disabled={!note.trim()}>Add note</Button>
            </form>
            <ol className="mt-6 space-y-4">
              {student.notes.map((n, i) => (
                <li key={i} className="rounded-xl bg-ivory p-3.5 text-sm">
                  <p className="text-navy-800">{n.text}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-navy-400">
                    <Clock className="h-3 w-3" aria-hidden /> {n.by} · {formatDateTime(n.at)}
                  </p>
                </li>
              ))}
              {student.notes.length === 0 && <li className="text-sm text-navy-400">No notes yet.</li>}
            </ol>
          </Panel>
        </div>
      </div>

      <StaffBookModal
        open={booking}
        onClose={() => setBooking(false)}
        counsellorId={student.counsellorId}
        students={[student]}
        fixedStudentId={student.id}
      />

      <Modal
        open={reassigning}
        onClose={() => setReassigning(false)}
        title={`Reassign ${student.name}`}
        description={`Currently with ${counsellorName(student.counsellorId)}. The change is recorded in the student's history.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setReassigning(false)}>Cancel</Button>
            <Button onClick={reassign}>Reassign</Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="New counsellor"
            placeholder="Choose counsellor"
            options={counsellors.filter((c) => c.id !== student.counsellorId).map((c) => ({ value: c.id, label: c.name }))}
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
          />
          <div>
            <label htmlFor="owner-reason" className="mb-1.5 block text-sm font-medium text-navy-800">Reason</label>
            <textarea id="owner-reason" rows={2} value={ownerReason} onChange={(e) => setOwnerReason(e.target.value)} className="input resize-none" placeholder="e.g. Counsellor specialises in German university applications" />
          </div>
          {ownerError && <p role="alert" className="text-sm font-medium text-red-600">{ownerError}</p>}
          {student.assignmentHistory.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-400">Assignment history</p>
              <ul className="space-y-1 text-xs text-navy-600">
                {student.assignmentHistory.map((h, i) => (
                  <li key={i}>
                    {formatDateTime(h.at)} · {h.from ? `${counsellorName(h.from)} → ` : ''}{counsellorName(h.to)} · {h.reason} ({h.by})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!rejecting}
        onClose={() => {
          setRejecting(null);
          setReasonError(null);
        }}
        title="Reject document"
        description={rejecting?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmReject}>Reject and notify student</Button>
          </>
        }
      >
        <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-medium text-navy-800">What should the student fix?</label>
        <textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="e.g. Signature missing; please upload a signed copy" />
        {reasonError && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{reasonError}</p>}
      </Modal>
    </>
  );
}
