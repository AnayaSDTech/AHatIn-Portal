import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CalendarPlus, CheckCircle2, Clock, FileSearch, Mail, Phone, MessageSquare, School, StickyNote, Trash2, UserCog, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMessages, useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { ChatThread } from '../../components/messages/ChatThread';
import { useStudentActions } from '../../hooks/useJourney';
import { SessionRow, StaffBookModal } from '../../components/scheduling/SessionManage';
import { SelectField } from '../../components/ui/FormField';
import { Panel, Pill } from '../../components/dashboard/Panel';
import { ServiceBar } from '../../components/staff/StaffUi';
import { JourneyPanel } from '../../components/staff/JourneyPanel';
import { categoryLabel } from '../../components/dashboard/DocumentChecklist';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { DemoBadge } from '../../components/ui/DemoBadge';
import { NotFoundPage } from '../NotFoundPage';
import {
  appStateLabel,
  appTransitions,
  counsellorName,
  counsellors,
  isStudentDecision,
  serviceShortNames,
  stageLabel,
  type AppState,
  type DocCategory,
  type StaffStudent,
  type StudentApplication,
} from '../../data/staff';
import { computeServices, overallProgress, serviceValues } from '../../lib/journey';
import { cn, formatDate, formatDateTime, relativeTime } from '../../lib/utils';

/** How many of the latest notes show before "Show all". */
const NOTES_SHOWN = 5;

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
  const [messages] = useMessages();
  const unreadFromStudent = messages.filter((m) => m.studentId === id && m.from === 'student' && !m.readAt).length;
  // Links like /staff/students/s1#messages jump to that section.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [hash, id]);
  const [sessions] = useSessions();
  const [booking, setBooking] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [ownerReason, setOwnerReason] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<DocCategory>('general');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [removingDoc, setRemovingDoc] = useState<StaffStudent['documents'][number] | null>(null);
  const [correcting, setCorrecting] = useState<StudentApplication | null>(null);
  const [corrTo, setCorrTo] = useState<AppState | ''>('');
  const [corrReason, setCorrReason] = useState('');
  const [corrError, setCorrError] = useState<string | null>(null);

  const student = students.find((s) => s.id === id);
  const actions = useStudentActions(student?.id);
  const services = useMemo(() => (student ? computeServices(student, sessions) : []), [student, sessions]);
  // A record the user may not see looks exactly like one that doesn't exist.
  if (!student || !scope.canSee(student.counsellorId)) return <NotFoundPage />;
  const studentSessions = sessions
    .filter((s) => s.studentId === student.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  const update = (fn: (s: StaffStudent) => StaffStudent) => setStudents((all) => all.map((s) => (s.id === student.id ? fn(s) : s)));
  const addNote = (s: StaffStudent, text: string) => ({ ...s, notes: [{ at: new Date().toISOString(), by: user?.name ?? 'Staff', text }, ...s.notes] });

  const verify = (docId: string, name: string) => {
    actions.verifyDocument(docId, name);
    setMessage(`${name} verified. The student can see this straight away.`);
  };

  const confirmReject = () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) return setReasonError('Tell the student what to fix (at least 5 characters).');
    actions.rejectDocument(rejecting.id, rejecting.name, reason.trim());
    setMessage(`${rejecting.name} rejected. The student is asked to re-upload it.`);
    setRejecting(null);
    setReason('');
    setReasonError(null);
  };

  const requestDocument = () => {
    if (docName.trim().length < 3) return;
    actions.requestDocument(docName.trim(), docCategory);
    setMessage(`${docName.trim()} added to the student's document checklist.`);
    setDocName('');
    setDocCategory('general');
    setRequesting(false);
  };

  const openCorrection = (a: StudentApplication) => {
    const prev = a.history?.[a.history.length - 1]?.from;
    setCorrecting(a);
    setCorrTo(prev && prev !== a.state && !isStudentDecision(prev) ? prev : '');
    setCorrReason('');
    setCorrError(null);
  };

  const saveCorrection = () => {
    if (!correcting) return;
    if (!corrTo) return setCorrError('Choose the correct status.');
    if (corrReason.trim().length < 5) return setCorrError('Give a short reason (at least 5 characters).');
    actions.correctApplicationState(correcting.id, correcting.university, correcting.state, corrTo, corrReason.trim());
    setMessage(`${correcting.university} corrected to "${appStateLabel[corrTo]}". The student sees this straight away.`);
    setCorrecting(null);
  };

  const changeStatus = (appId: string, from: AppState, to: AppState, university: string) => {
    actions.setApplicationState(appId, university, from, to);
    setMessage(`${university} updated to "${appStateLabel[to]}". The student sees this straight away.`);
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
          <div className="mb-2 flex items-center justify-between text-xs text-navy-500">
            <span>Overall progress (same as the student sees)</span>
            <span className="font-semibold text-navy-900" data-progress>{overallProgress(services)}%</span>
          </div>
          <ServiceBar values={serviceValues(services)} names={serviceShortNames} />
          <div className="mt-2 hidden grid-cols-7 gap-1 text-center text-[11px] text-navy-400 sm:grid">
            {serviceShortNames.map((n) => <span key={n}>{n}</span>)}
          </div>
        </div>
      </div>

      {message && <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <div className="mb-6">
        <JourneyPanel student={student} services={services} actions={actions} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <Panel
            id="staff-documents"
            title="Documents"
            icon={<FileSearch className="h-4 w-4" aria-hidden />}
            action={
              <div className="flex items-center gap-2">
                {pending.length > 0 && <Pill tone="amber">{pending.length} to verify</Pill>}
                <Button size="sm" variant="outline" onClick={() => setRequesting(true)}>Request</Button>
              </div>
            }
          >
            {student.documents.length === 0 ? (
              <p className="text-sm text-navy-400">No documents requested yet.</p>
            ) : (
              <ul className="divide-y divide-navy-100">
                {student.documents.map((d) => (
                  <li key={d.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center" data-staff-doc={d.name}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-navy-900">
                        {d.name}
                        {categoryLabel[d.category] && <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">{categoryLabel[d.category]}</span>}
                      </p>
                      <p className="text-xs text-navy-500">
                        {d.state === 'missing' ? 'Waiting for the student to upload' : `Uploaded ${d.uploadedAt ? relativeTime(d.uploadedAt) : ''}${d.fileName ? ` · ${d.fileName}` : ''}`}
                        {d.reason && <span className="text-red-600"> · {d.reason}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        <Pill tone={d.state === 'verified' ? 'green' : d.state === 'missing' ? 'grey' : 'red'}>{d.state === 'verified' ? 'Verified' : d.state === 'missing' ? 'Not uploaded' : 'Rejected'}</Pill>
                      )}
                      {/* Duplicate or mistaken requests can be removed; verified documents stay. */}
                      {d.state !== 'verified' && (
                        <button
                          type="button"
                          onClick={() => setRemovingDoc(d)}
                          className="grid h-7 w-7 place-items-center rounded-full text-navy-300 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove request: ${d.name}`}
                          title="Remove this request"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="applications" title="Applications" icon={<School className="h-4 w-4" aria-hidden />}>
            {student.applications.length === 0 ? (
              <p className="text-sm text-navy-400">No applications yet. Applications are created from the student's approved shortlist.</p>
            ) : (
              <ul className="divide-y divide-navy-100">
                {student.applications.map((a) => {
                  const next = appTransitions[a.state];
                  const last = a.history?.[a.history.length - 1];
                  return (
                    <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy-900">{a.university}</p>
                        <p className="text-sm text-navy-500">{a.course} · via {a.agency}{a.deadline && ` · deadline ${formatDate(a.deadline)}`}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <Pill tone={appTone(a.state)}>{appStateLabel[a.state]}</Pill>
                        {last && (
                          <span className="text-[11px] text-navy-400">
                            {appStateLabel[last.from]} → {appStateLabel[last.to]} · {last.by} · {formatDateTime(last.at)}
                            {last.reason && ` · corrected: ${last.reason}`}
                          </span>
                        )}
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
                          <span className="text-xs text-navy-400">{isStudentDecision(a.state) ? "Student's decision" : 'Final status'}</span>
                        )}
                        {isStudentDecision(a.state) ? (
                          next.length > 0 && <span className="text-[11px] text-navy-400">Accepted by the student; it can't be corrected here</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openCorrection(a)}
                            className="text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900"
                          >
                            Wrong status? Correct it
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-4 text-xs text-navy-400">“Change to” offers the normal next steps. If a status was chosen by mistake, use “Correct it” (a reason is recorded). Accepting or declining an offer is the student's decision.</p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-5">
          <Panel
            id="messages"
            title="Messages"
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            action={unreadFromStudent > 0 ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{unreadFromStudent} new</span> : undefined}
          >
            <ChatThread studentId={student.id} viewer="staff" emptyText={`No messages with ${student.name.split(' ')[0]} yet.`} />
          </Panel>

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
                  <SessionRow key={s.id} session={s} studentName={student.name} showCounsellor stacked />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Notes" icon={<StickyNote className="h-4 w-4" aria-hidden />} action={student.notes.length > 0 ? <span className="text-xs text-navy-400">{student.notes.length}</span> : undefined}>
            <form onSubmit={saveNote} className="flex flex-col gap-2">
              <label htmlFor="note" className="sr-only">Add a note</label>
              <textarea id="note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none py-2 text-sm" placeholder="Add a note (staff only)…" />
              {note.trim() && <Button type="submit" size="sm" className="self-start">Add note</Button>}
            </form>
            {/* Latest few only; the full history opens in a scrollable list. */}
            <ol className={cn('mt-4 divide-y divide-navy-100', showAllNotes && 'max-h-96 overflow-y-auto pr-1')} aria-label="Notes">
              {(showAllNotes ? student.notes : student.notes.slice(0, NOTES_SHOWN)).map((n, i) => (
                <li key={i} className="py-2.5 text-sm first:pt-0">
                  <p className="text-navy-800">{n.text}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-navy-400">
                    <Clock className="h-3 w-3" aria-hidden /> {n.by} · {formatDateTime(n.at)}
                  </p>
                </li>
              ))}
              {student.notes.length === 0 && <li className="text-sm text-navy-400">No notes yet.</li>}
            </ol>
            {student.notes.length > NOTES_SHOWN && (
              <button type="button" onClick={() => setShowAllNotes((v) => !v)} className="mt-3 text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900">
                {showAllNotes ? 'Show latest only' : `Show all ${student.notes.length} notes`}
              </button>
            )}
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
        open={!!removingDoc}
        onClose={() => setRemovingDoc(null)}
        title="Remove this document request?"
        description={removingDoc?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemovingDoc(null)}>Keep it</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!removingDoc) return;
                const hadFile = removingDoc.state !== 'missing';
                actions.removeDocument(removingDoc.id, removingDoc.name, hadFile);
                setMessage(`${removingDoc.name} removed from the student's document checklist.`);
                setRemovingDoc(null);
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">
          It disappears from the student's document checklist.
          {removingDoc && removingDoc.state !== 'missing' && (
            <strong className="mt-2 block text-red-700">The student has already uploaded a file{removingDoc.fileName ? ` (${removingDoc.fileName})` : ''} for it; that file is removed too.</strong>
          )}
        </p>
      </Modal>

      <Modal
        open={!!correcting}
        onClose={() => setCorrecting(null)}
        title="Correct application status"
        description={correcting ? `${correcting.university} · currently “${appStateLabel[correcting.state]}”` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setCorrecting(null)}>Cancel</Button>
            <Button onClick={saveCorrection}>Save correction</Button>
          </>
        }
      >
        {correcting && (
          <div className="space-y-4">
            <SelectField
              label="Correct status"
              placeholder="Choose the right status"
              options={(Object.keys(appStateLabel) as AppState[])
                .filter((s) => s !== correcting.state && !isStudentDecision(s))
                .map((s) => ({ value: s, label: appStateLabel[s] }))}
              value={corrTo}
              onChange={(e) => setCorrTo(e.target.value as AppState)}
            />
            <div>
              <label htmlFor="corr-reason" className="mb-1.5 block text-sm font-medium text-navy-800">Reason</label>
              <textarea id="corr-reason" rows={2} value={corrReason} onChange={(e) => setCorrReason(e.target.value)} className="input resize-none" placeholder="e.g. Chose the wrong status by mistake" />
            </div>
            {corrError && <p role="alert" className="text-sm font-medium text-red-600">{corrError}</p>}
            <p className="text-xs text-navy-400">The correction and reason are kept in the application's history and the student's notes. Offers the student has accepted or declined can't be corrected here.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request a document"
        description="It is added to the student's document checklist straight away."
        footer={
          <>
            <Button variant="outline" onClick={() => setRequesting(false)}>Cancel</Button>
            <Button onClick={requestDocument} disabled={docName.trim().length < 3}>Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="req-name" className="mb-1.5 block text-sm font-medium text-navy-800">Document</label>
            <input id="req-name" value={docName} onChange={(e) => setDocName(e.target.value)} className="input" placeholder="e.g. Statement of Purpose (final)" />
          </div>
          <SelectField
            label="Used for"
            options={[
              { value: 'general', label: 'Applications (general)' },
              { value: 'funds', label: 'Proof of funds (Scholarship & Financial Guidance)' },
              { value: 'visa', label: 'Visa' },
            ]}
            value={docCategory}
            onChange={(e) => setDocCategory(e.target.value as DocCategory)}
          />
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
