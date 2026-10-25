import { useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Circle, Plus, Route, Send, Trash2 } from 'lucide-react';
import { Panel, Pill } from '../dashboard/Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { demoAgencies, type StaffStudent } from '../../data/staff';
import type { useStudentActions } from '../../hooks/useJourney';
import {
  DEPARTURE_TASKS,
  SERVICE_TITLES,
  isNewOption,
  VISA_PATH,
  scholarshipStatusLabel,
  serviceStatusLabel,
  visaStageLabel,
  type ScholarshipStatus,
  type ServiceCode,
  type ServiceStatus,
  type ServiceView,
  type ShortlistItem,
  type VisaStage,
} from '../../lib/journey';
import { cn, formatDate, formatDateTime } from '../../lib/utils';

type Actions = ReturnType<typeof useStudentActions>;

const tone: Record<ServiceStatus, 'green' | 'blue' | 'grey'> = { completed: 'green', in_progress: 'blue', not_started: 'grey', not_needed: 'grey' };
const short: Record<ServiceCode, string> = { S1: 'Counselling', S2: 'Shortlist', S3: 'Applications', S4: 'Funding', S5: 'Visa', S6: 'Pre-departure', S7: 'Post-arrival' };

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-navy-700">{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-navy-50/70 px-4 py-3 text-sm text-navy-600">{children}</p>;
}

/* ------------------------------ Override ------------------------------ */

function OverrideModal({ view, actions, onClose }: { view: ServiceView; actions: Actions; onClose: () => void }) {
  const [status, setStatus] = useState<ServiceStatus | 'auto'>(view.override ? view.override.status : 'auto');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Change status: ${view.title}`}
      description={`Automatic status from the record: ${serviceStatusLabel[view.autoStatus]}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (reason.trim().length < 5) return setError('Give a reason (at least 5 characters). It is shown to the student for “Not needed”.');
              actions.setOverride(view.code, status === 'auto' ? null : status, reason.trim());
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Status" id="ov-status">
          <select id="ov-status" value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus | 'auto')} className="input">
            <option value="auto">Automatic (follow the record)</option>
            <option value="not_needed">Not needed</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
        <Field label="Reason" id="ov-reason">
          <textarea id="ov-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="e.g. Fully self-funded, no scholarship or loan needed" />
        </Field>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
        <p className="text-xs text-navy-400">Use this only for real exceptions. Normally each service moves by itself as the student and staff complete their steps.</p>
      </div>
    </Modal>
  );
}

/* ------------------------------ Tabs ------------------------------ */

function CareerTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const [summary, setSummary] = useState('');
  const plan = student.journey.careerPlan;
  if (plan) return <Hint>Career plan shared by {plan.by} on {formatDate(plan.at)}: <strong>{plan.summary}</strong></Hint>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (summary.trim().length >= 3) actions.recordCareerPlan(summary.trim());
      }}
      className="space-y-3"
    >
      <Hint>Record the career plan once it's agreed with the student. You can also tick “career plan shared” when completing a Career counselling session.</Hint>
      <Field label="Career direction and course area" id="cp-summary">
        <input id="cp-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={120} className="input" placeholder="e.g. Data Science and Analytics, UK first" />
      </Field>
      <Button type="submit" size="sm" disabled={summary.trim().length < 3}>Record career plan</Button>
    </form>
  );
}

const blankItem = { university: '', course: '', country: 'United Kingdom', intake: '', tuition: '', livingCost: '', deadline: '', agency: demoAgencies[0]!.name, earnsCommission: true, reason: '' };

function ShortlistTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const sl = student.journey.shortlist;
  const [form, setForm] = useState({ ...blankItem, intake: student.intake });
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const draft = !sl || sl.status === 'draft';
  // Once the shortlist is sent, the add form opens from a button instead of always showing.
  const [adding, setAdding] = useState(false);
  const showForm = draft || adding;
  // Options can be removed while drafting, or later if the student hasn't chosen to apply there.
  const canRemove = (i: ShortlistItem) => draft || (sl?.status === 'shared' && i.choice !== 'apply');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const add = (e: FormEvent) => {
    e.preventDefault();
    const missing = (['university', 'course', 'intake', 'tuition', 'livingCost', 'deadline', 'reason'] as const).filter((k) => !String(form[k]).trim());
    if (missing.length) return setError('Fill in every field, including a short reason for the student.');
    actions.addShortlistItem({ ...form, university: form.university.trim(), course: form.course.trim(), reason: form.reason.trim() });
    setForm({ ...blankItem, intake: student.intake });
    setError(null);
    setAdding(false);
  };

  const cancelAdd = () => {
    setForm({ ...blankItem, intake: student.intake });
    setError(null);
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {sl ? (
          <>
            <Pill tone={sl.status === 'approved' ? 'green' : sl.status === 'shared' ? 'gold' : 'grey'}>
              {sl.status === 'approved' ? 'Approved by student' : sl.status === 'shared' ? 'Shared · waiting for student' : 'Draft'}
            </Pill>
            <span className="text-navy-500">Version {sl.version}{sl.sharedAt && ` · shared ${formatDate(sl.sharedAt)}`}{sl.approvedAt && sl.status === 'approved' && ` · approved ${formatDate(sl.approvedAt)}`}</span>
          </>
        ) : (
          <span className="text-navy-500">No shortlist yet. Add the options you recommend, then share them with the student.</span>
        )}
      </div>

      {sl && sl.items.length > 0 && (
        <ul className="space-y-2">
          {sl.items.map((i) => (
            <li key={i.id} className="rounded-xl border border-navy-100 p-3 text-sm" data-staff-option={i.university}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">{i.university}</p>
                  <p className="text-xs text-navy-500">{i.course} · {i.country} · {i.intake} · {i.tuition} · apply by {formatDate(i.deadline)} · {i.agency} · {i.earnsCommission ? 'commission' : 'no commission'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {i.choice === 'apply' && <Pill tone="green">Student: apply</Pill>}
                  {i.choice === 'removed' && <Pill tone="grey">Student: removed</Pill>}
                  {isNewOption(i, sl) && <Pill tone="gold">New · waiting for student</Pill>}
                  {canRemove(i) && (
                    <button type="button" onClick={() => actions.removeShortlistItem(i.id)} className="text-navy-300 hover:text-red-600" aria-label={`Remove ${i.university}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {i.removeReason && <p className="mt-1 text-xs text-navy-500">Reason: {i.removeReason}</p>}
              {i.comments.map((c, n) => (
                <p key={n} className={cn('mt-2 rounded-lg px-2.5 py-1.5 text-xs', c.role === 'student' ? 'bg-gold-50' : 'bg-navy-50')}>
                  <span className="font-semibold">{c.role === 'student' ? `${student.name} (student)` : c.by}:</span> {c.text} <span className="text-navy-400">· {formatDateTime(c.at)}</span>
                </p>
              ))}
              {i.comments.some((c) => c.role === 'student') && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = (reply[i.id] ?? '').trim();
                    if (t.length < 2) return;
                    actions.commentOnItem(i.id, t);
                    setReply((r) => ({ ...r, [i.id]: '' }));
                  }}
                >
                  <label htmlFor={`reply-${i.id}`} className="sr-only">Reply</label>
                  <input id={`reply-${i.id}`} value={reply[i.id] ?? ''} onChange={(e) => setReply((r) => ({ ...r, [i.id]: e.target.value }))} className="input py-1.5 text-sm" placeholder="Reply to the student…" />
                  <Button type="submit" size="sm" variant="outline">Reply</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {!showForm && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add university option
        </Button>
      )}

      {showForm && (
        <form onSubmit={add} className="space-y-3 rounded-2xl bg-ivory p-4" aria-label="Add shortlist option">
          <p className="text-sm font-semibold text-navy-900">Add an option</p>
          {sl?.status === 'shared' && <p className="text-xs text-navy-500">The shortlist is with the student. A new option appears for them straight away, marked as new.</p>}
          {sl?.status === 'approved' && <p className="text-xs text-navy-500">The student has approved this shortlist. Adding an option sends it back to them to decide on the new option; their earlier choices and applications stay as they are.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="University" id="sl-uni"><input id="sl-uni" value={form.university} onChange={set('university')} className="input py-2" /></Field>
            <Field label="Course" id="sl-course"><input id="sl-course" value={form.course} onChange={set('course')} className="input py-2" /></Field>
            <Field label="Country" id="sl-country">
              <select id="sl-country" value={form.country} onChange={set('country')} className="input py-2">
                {['United Kingdom', 'Ireland', 'Germany', 'France', 'Netherlands', 'Other in Europe'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Intake" id="sl-intake"><input id="sl-intake" value={form.intake} onChange={set('intake')} className="input py-2" /></Field>
            <Field label="Tuition" id="sl-tuition"><input id="sl-tuition" value={form.tuition} onChange={set('tuition')} className="input py-2" placeholder="e.g. £30,000 a year" /></Field>
            <Field label="Living cost" id="sl-living"><input id="sl-living" value={form.livingCost} onChange={set('livingCost')} className="input py-2" placeholder="e.g. £1,300 a month" /></Field>
            <Field label="Application deadline" id="sl-deadline"><input id="sl-deadline" type="date" value={form.deadline} onChange={set('deadline')} className="input py-2" /></Field>
            <Field label="Applied through" id="sl-agency">
              <select id="sl-agency" value={form.agency} onChange={set('agency')} className="input py-2">
                {[...demoAgencies.filter((a) => a.status === 'Active').map((a) => a.name), 'Own application'].map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" checked={form.earnsCommission} onChange={(e) => setForm((f) => ({ ...f, earnsCommission: e.target.checked }))} className="h-4 w-4 accent-navy-900" />
            AHat earns commission from this university (disclosed to the student)
          </label>
          <Field label="Why you recommend it (shown to the student)" id="sl-reason"><textarea id="sl-reason" rows={2} value={form.reason} onChange={set('reason')} className="input resize-none" /></Field>
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant={draft ? 'outline' : 'primary'}>Add option</Button>
            {!draft && <Button type="button" size="sm" variant="outline" onClick={cancelAdd}>Cancel</Button>}
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {draft && sl && sl.items.length > 0 && (
          <Button size="sm" variant="gold" onClick={actions.shareShortlist}>
            <Send className="h-4 w-4" aria-hidden /> {sl.firstApprovedAt ? 'Share revised shortlist' : 'Share with student'}
          </Button>
        )}
      </div>
    </div>
  );
}

function FundingTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const f = student.journey.funding;
  const [cost, setCost] = useState(f.estimatedCost ? String(f.estimatedCost) : '');
  const [sch, setSch] = useState({ name: '', amount: '', deadline: '' });
  const [docName, setDocName] = useState('');
  const funds = student.documents.filter((d) => d.category === 'funds');
  const covered = f.sources.reduce((n, x) => n + x.amount, 0);

  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(cost);
          if (n > 0 && n < 500) actions.setEstimatedCost(Math.round(n * 10) / 10);
        }}
      >
        <Field label="Estimated total cost of study (₹ lakh)" id="fd-cost"><input id="fd-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="input w-40 py-2" /></Field>
        <Button type="submit" size="sm" variant="outline">Save cost</Button>
      </form>

      <div>
        <p className="text-sm font-semibold text-navy-900">Student's funding plan</p>
        {f.sources.length === 0 ? (
          <p className="mt-1 text-sm text-navy-400">The student hasn't added any funding yet.</p>
        ) : (
          <p className="mt-1 text-sm text-navy-700">
            {f.sources.map((s) => `${s.kind} ₹${s.amount} lakh`).join(' · ')} — <strong>₹{covered} lakh</strong>
            {f.estimatedCost ? ` of ₹${f.estimatedCost} lakh` : ''}
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-navy-900">Scholarships</p>
        <ul className="mt-2 space-y-2">
          {f.scholarships.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-xl bg-ivory px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>{s.name} · {s.amount} · by {formatDate(s.deadline)}</span>
              <label className="flex items-center gap-2 text-xs text-navy-500">
                Status
                <select value={s.status} onChange={(e) => actions.setScholarshipStatus(s.id, e.target.value as ScholarshipStatus)} className="rounded-lg border border-navy-100 bg-white px-2 py-1 text-xs">
                  {Object.entries(scholarshipStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_10rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!sch.name.trim() || !sch.amount.trim() || !sch.deadline) return;
            actions.addScholarship(sch.name.trim(), sch.amount.trim(), sch.deadline);
            setSch({ name: '', amount: '', deadline: '' });
          }}
        >
          <input aria-label="Scholarship name" value={sch.name} onChange={(e) => setSch((x) => ({ ...x, name: e.target.value }))} className="input py-2" placeholder="Scholarship name" />
          <input aria-label="Amount" value={sch.amount} onChange={(e) => setSch((x) => ({ ...x, amount: e.target.value }))} className="input py-2" placeholder="Amount" />
          <input aria-label="Deadline" type="date" value={sch.deadline} onChange={(e) => setSch((x) => ({ ...x, deadline: e.target.value }))} className="input py-2" />
          <Button type="submit" size="sm" variant="outline">Suggest</Button>
        </form>
      </div>

      <div>
        <p className="text-sm font-semibold text-navy-900">Proof of funds</p>
        <p className="mt-1 text-sm text-navy-600">
          {funds.length ? `${funds.filter((d) => d.state === 'verified').length} of ${funds.length} verified. Verifying all of them completes this service.` : 'Request the documents the student must show, e.g. bank statements held for 28 days (UK) or a blocked account confirmation (Germany).'}
        </p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (docName.trim().length < 3) return;
            actions.requestDocument(docName.trim(), 'funds');
            setDocName('');
          }}
        >
          <input aria-label="Proof-of-funds document" value={docName} onChange={(e) => setDocName(e.target.value)} className="input py-2" placeholder="e.g. Bank statement (28 days)" />
          <Button type="submit" size="sm" variant="outline">Request</Button>
        </form>
      </div>
    </div>
  );
}

function VisaTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const v = student.journey.visa;
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [refusing, setRefusing] = useState(false);
  const [docName, setDocName] = useState('');
  const accepted = student.applications.some((a) => a.state === 'accepted');
  const i = v ? VISA_PATH.indexOf(v.stage) : -1;
  const next: VisaStage | null = !v ? 'cas_received' : v.stage === 'refused' ? 'documents_verified' : i >= 0 && i < VISA_PATH.length - 1 ? VISA_PATH[i + 1]! : null;
  const canDecide = v && (v.stage === 'submitted' || v.stage === 'biometrics');

  if (!accepted && !v) return <Hint>The visa starts after the student accepts an offer.</Hint>;

  return (
    <div className="space-y-4">
      {v && (
        <ol className="space-y-1.5 text-sm">
          {v.history.map((h, n) => (
            <li key={n} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <span>{visaStageLabel[h.stage]}{h.note ? ` · ${h.note}` : ''} <span className="text-xs text-navy-400">({h.by}, {formatDate(h.at)})</span></span>
            </li>
          ))}
        </ol>
      )}
      {v?.stage === 'granted' ? (
        <Hint>Visa granted. Pre-departure support has started for the student.</Hint>
      ) : (
        <div className="space-y-3 rounded-2xl bg-ivory p-4">
          {next && (
            <>
              <p className="text-sm font-semibold text-navy-900">{v?.stage === 'refused' ? 'Start a new visa application' : `Next step: ${visaStageLabel[next]}`}</p>
              {next === 'submitted' && (
                <Field label="Visa application reference" id="vs-ref"><input id="vs-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="input py-2" placeholder="e.g. GWF0123456" /></Field>
              )}
              <Field label="Note (optional)" id="vs-note"><input id="vs-note" value={note} onChange={(e) => setNote(e.target.value)} className="input py-2" /></Field>
              <Button
                size="sm"
                onClick={() => {
                  actions.setVisaStage(next, note.trim() || undefined, reference.trim() || undefined);
                  setNote('');
                  setReference('');
                }}
              >
                Record: {visaStageLabel[next]}
              </Button>
            </>
          )}
          {canDecide && (
            <div className="flex flex-wrap gap-2 border-t border-navy-100 pt-3">
              <Button size="sm" variant="gold" onClick={() => actions.setVisaStage('granted')}>Visa granted</Button>
              <Button size="sm" variant="outline" onClick={() => setRefusing(true)}>Visa refused</Button>
            </div>
          )}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (docName.trim().length < 3) return;
          actions.requestDocument(docName.trim(), 'visa');
          setDocName('');
        }}
      >
        <input aria-label="Visa document" value={docName} onChange={(e) => setDocName(e.target.value)} className="input py-2" placeholder="Request a visa document, e.g. TB test certificate" />
        <Button type="submit" size="sm" variant="outline">Request</Button>
      </form>
      {refusing && (
        <Modal
          open
          onClose={() => setRefusing(false)}
          title="Record visa refusal"
          footer={
            <>
              <Button variant="outline" onClick={() => setRefusing(false)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (note.trim().length < 5) return;
                  actions.setVisaStage('refused', note.trim());
                  setNote('');
                  setRefusing(false);
                }}
              >
                Record refusal
              </Button>
            </>
          }
        >
          <Field label="Reason given (shown to the student)" id="vs-refuse"><textarea id="vs-refuse" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" /></Field>
        </Modal>
      )}
    </div>
  );
}

function DepartureTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const d = student.journey.departure;
  if (student.journey.visa?.stage !== 'granted' && !d.confirmedAt) return <Hint>Pre-departure starts once the visa is granted.</Hint>;
  const all = DEPARTURE_TASKS.every((t) => d.done[t.key]);
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm">
        {DEPARTURE_TASKS.map((t) => (
          <li key={t.key} className="flex items-center gap-2">
            {d.done[t.key] ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> : <Circle className="h-4 w-4 text-navy-200" aria-hidden />}
            <span className={d.done[t.key] ? 'text-navy-800' : 'text-navy-400'}>{t.label}</span>
          </li>
        ))}
      </ul>
      {d.confirmedAt ? (
        <Hint>Confirmed ready to travel by {d.confirmedBy} on {formatDate(d.confirmedAt)}.</Hint>
      ) : all ? (
        <Button size="sm" variant="gold" onClick={actions.confirmDeparture}>Confirm ready to travel</Button>
      ) : (
        <Hint>The student ticks these tasks on their dashboard. You can confirm once all are done.</Hint>
      )}
    </div>
  );
}

function ArrivalTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const a = student.journey.arrival;
  const [note, setNote] = useState('');
  if (!a.arrivedAt) return <Hint>Starts when the student taps “I've arrived” on their dashboard.</Hint>;
  if (a.finalCheckInAt) return <Hint>Arrived {formatDate(a.arrivedAt)}. Final check-in on {formatDate(a.finalCheckInAt)}: {a.finalNote}</Hint>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim().length >= 5) actions.recordFinalCheckIn(note.trim());
      }}
    >
      <Hint>Arrived on {formatDate(a.arrivedAt)}. Record the final check-in (for example after three months) to complete this service. You can also do it when completing a Post-arrival check-in session.</Hint>
      <Field label="Final check-in notes" id="ar-note"><textarea id="ar-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="input resize-none" placeholder="e.g. Settled, bank account and GP registration done" /></Field>
      <Button type="submit" size="sm" disabled={note.trim().length < 5}>Record final check-in</Button>
    </form>
  );
}

/* ------------------------------ Panel ------------------------------ */

export function JourneyPanel({ student, services, actions }: { student: StaffStudent; services: ServiceView[]; actions: Actions }) {
  const firstOpen = services.find((s) => s.status === 'in_progress')?.code ?? services.find((s) => s.status === 'not_started')?.code ?? 'S1';
  const [tab, setTab] = useState<ServiceCode>(firstOpen);
  const [overriding, setOverriding] = useState(false);
  const view = services.find((s) => s.code === tab)!;

  return (
    <Panel id="journey" title="Journey" icon={<Route className="h-4 w-4" aria-hidden />}>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Services">
        {services.map((s) => (
          <button
            key={s.code}
            type="button"
            role="tab"
            aria-selected={tab === s.code}
            onClick={() => setTab(s.code)}
            data-tab={s.code}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
              tab === s.code ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100 hover:bg-navy-50',
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', s.status === 'completed' ? 'bg-emerald-500' : s.status === 'in_progress' ? 'bg-sky-400' : s.status === 'not_needed' ? 'bg-navy-300' : 'bg-navy-100')} aria-hidden />
            {short[s.code]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-b border-navy-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-navy-900">{SERVICE_TITLES[tab]}</p>
          <p className="text-sm text-navy-500">{view.summary}</p>
          {view.override && <p className="mt-1 text-xs text-amber-700">Set by {view.override.by} on {formatDate(view.override.at)}: {view.override.reason} (automatic: {serviceStatusLabel[view.autoStatus]})</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill tone={tone[view.status]}>{serviceStatusLabel[view.status]}</Pill>
          <button type="button" onClick={() => setOverriding(true)} className="text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900">
            Change status
          </button>
        </div>
      </div>

      <div className="mt-4" role="tabpanel">
        {tab === 'S1' && <CareerTab student={student} actions={actions} />}
        {tab === 'S2' && <ShortlistTab student={student} actions={actions} />}
        {tab === 'S3' && <Hint>Applications are created when the student approves the shortlist. Update their status in <a href="#applications" className="font-semibold underline">Applications</a> below; the student accepts or declines offers on their dashboard.</Hint>}
        {tab === 'S4' && <FundingTab student={student} actions={actions} />}
        {tab === 'S5' && <VisaTab student={student} actions={actions} />}
        {tab === 'S6' && <DepartureTab student={student} actions={actions} />}
        {tab === 'S7' && <ArrivalTab student={student} actions={actions} />}
      </div>

      {overriding && <OverrideModal view={view} actions={actions} onClose={() => setOverriding(false)} />}
    </Panel>
  );
}
