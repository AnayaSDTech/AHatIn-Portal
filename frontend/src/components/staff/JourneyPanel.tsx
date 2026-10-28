import { useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Circle, Plus, Route, Send, Trash2 } from 'lucide-react';
import { ApiError } from '../../lib/api/types';
import { Panel, Pill } from '../dashboard/Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SERVICE_AREA, canEditArea, counsellorName, ownerOf, teamTitle, type StaffStudent } from '../../data/staff';
import { useAgencies } from '../../hooks/useStaffData';
import { useApi } from '../../lib/api/store';
import { CareerPlanFields, careerPlanDraft, careerPlanError, useCareerOptions } from './CareerPlanFields';
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
  const plan = student.journey.careerPlan;
  const options = useCareerOptions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => careerPlanDraft(plan));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(careerPlanDraft(plan));
    setError(null);
    setEditing(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const problem = careerPlanError(draft, options);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await actions.recordCareerPlan({ ...draft, notes: draft.notes.trim() });
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (plan && !editing) {
    const directionLabel = options.directions.find((d) => d.key === plan.direction)?.label;
    const levelLabel = options.levels.find((l) => l.key === plan.level)?.label;
    const rows = plan.direction
      ? [
          { label: 'Career direction', value: directionLabel ?? plan.direction },
          { label: 'Preferred course', value: plan.course },
          { label: 'Study level', value: levelLabel ?? plan.level },
          { label: 'Destinations', value: plan.destinations?.join(', ') },
          { label: 'Notes', value: plan.notes },
        ].filter((r) => r.value)
      : [{ label: 'Plan', value: plan.summary }];
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-navy-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-navy-600">
              Career plan shared by {plan.by} on {formatDate(plan.at)}
              {plan.updatedAt && ` · updated by ${plan.updatedBy} on ${formatDate(plan.updatedAt)}`}
            </p>
            <Button size="sm" variant="outline" onClick={startEdit}>Edit career plan</Button>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2" data-career-plan>
            {rows.map((r) => (
              <div key={r.label} className={cn(r.label === 'Notes' || r.label === 'Plan' ? 'sm:col-span-2' : undefined)}>
                <dt className="text-xs text-navy-500">{r.label}</dt>
                <dd className="font-medium text-navy-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {!plan.direction && <Hint>This plan was recorded as free text. Edit it to choose the career direction, course, level and destinations.</Hint>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4" aria-label="Career plan">
      <Hint>
        {plan
          ? 'Update the agreed career plan. The student sees the new plan in their progress tracker.'
          : 'Record the career plan once it’s agreed with the student. You can also tick “career plan shared” when completing a Career counselling session.'}
      </Hint>
      <CareerPlanFields value={draft} onChange={(v) => { setDraft(v); setError(null); }} />
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={saving}>{plan ? 'Save changes' : 'Record career plan'}</Button>
        {plan && <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
    </form>
  );
}

const blankItem = { university: '', universityOther: '', course: '', courseOther: '', country: 'United Kingdom', intake: '', tuition: '', livingCost: '', deadline: '', agency: '', earnsCommission: true, reason: '' };

/** Universities by country and upcoming intakes, from the backend (courses come from the career options). */
interface ShortlistOptions {
  universities: Record<string, string[]>;
  intakes: string[];
  otherUniversity: string;
}
const NO_SHORTLIST_OPTIONS: ShortlistOptions = { universities: {}, intakes: [], otherUniversity: '' };
const OTHER_COURSE = 'Other (type the course)';

function ShortlistTab({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const sl = student.journey.shortlist;
  const [agencies] = useAgencies();
  const agencyNames = [...agencies.filter((a) => a.status === 'Active').map((a) => a.name), 'Own application'];
  const [options] = useApi<ShortlistOptions>('/shortlist-options', NO_SHORTLIST_OPTIONS);
  const careerOptions = useCareerOptions();
  const [form, setForm] = useState(blankItem);
  // Until one is chosen: the first active agency, the course from the student's career plan and their preferred intake.
  const agency = form.agency || agencyNames[0]!;
  const planCourse = student.journey.careerPlan?.course;
  const course = form.course || (planCourse && planCourse !== careerOptions.otherCourse ? planCourse : '');
  const intake = form.intake || (options.intakes.includes(student.intake) ? student.intake : '');
  const universities = options.universities[form.country] ?? [];
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
    const university = (form.university === options.otherUniversity ? form.universityOther : form.university).trim();
    const courseName = (course === OTHER_COURSE ? form.courseOther : course).trim();
    const missing = [university, courseName, intake, form.tuition, form.livingCost, form.deadline, form.reason].some((v) => !v.trim());
    if (missing) return setError('Fill in every field, including a short reason for the student.');
    const { universityOther: _u, courseOther: _c, ...rest } = form;
    actions.addShortlistItem({ ...rest, agency, university, course: courseName, intake, reason: form.reason.trim() });
    setForm(blankItem);
    setError(null);
    setAdding(false);
  };

  const cancelAdd = () => {
    setForm(blankItem);
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
            <Field label="Country" id="sl-country">
              {/* Universities depend on the country, so a new country clears the university. */}
              <select id="sl-country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, university: '', universityOther: '' }))} className="input py-2">
                {['United Kingdom', 'Ireland', 'Germany', 'France', 'Netherlands', 'Other in Europe'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="University" id="sl-uni">
              <select id="sl-uni" value={form.university} onChange={set('university')} className="input py-2">
                <option value="" disabled>Choose a university</option>
                {universities.map((u) => <option key={u}>{u}</option>)}
              </select>
              {form.university === options.otherUniversity && (
                <input aria-label="University name" value={form.universityOther} onChange={set('universityOther')} className="input mt-2 py-2" placeholder="University name" maxLength={150} />
              )}
            </Field>
            <Field label="Course" id="sl-course">
              <select id="sl-course" value={course} onChange={set('course')} className="input py-2">
                <option value="" disabled>Choose a course</option>
                {careerOptions.directions.map((d) => (
                  <optgroup key={d.key} label={d.label}>
                    {d.courses.filter((c) => c !== careerOptions.otherCourse).map((c) => <option key={`${d.key}-${c}`} value={c}>{c}</option>)}
                  </optgroup>
                ))}
                <option value={OTHER_COURSE}>{OTHER_COURSE}</option>
              </select>
              {course === OTHER_COURSE && (
                <input aria-label="Course name" value={form.courseOther} onChange={set('courseOther')} className="input mt-2 py-2" placeholder="Course name, e.g. MSc Occupational Therapy" maxLength={150} />
              )}
            </Field>
            <Field label="Intake" id="sl-intake">
              <select id="sl-intake" value={intake} onChange={set('intake')} className="input py-2">
                <option value="" disabled>Choose an intake</option>
                {options.intakes.map((i) => <option key={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Tuition" id="sl-tuition"><input id="sl-tuition" value={form.tuition} onChange={set('tuition')} className="input py-2" placeholder="e.g. £30,000 a year" /></Field>
            <Field label="Living cost" id="sl-living"><input id="sl-living" value={form.livingCost} onChange={set('livingCost')} className="input py-2" placeholder="e.g. £1,300 a month" /></Field>
            <Field label="Application deadline" id="sl-deadline"><input id="sl-deadline" type="date" value={form.deadline} onChange={set('deadline')} className="input py-2" /></Field>
            <Field label="Applied through" id="sl-agency">
              <select id="sl-agency" value={agency} onChange={set('agency')} className="input py-2">
                {agencyNames.map((a) => <option key={a}>{a}</option>)}
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
  const [costState, setCostState] = useState<{ saving?: boolean; saved?: number; error?: string }>({});
  const costValue = Math.round(Number(cost) * 10) / 10;
  const saveCost = async (e: FormEvent) => {
    e.preventDefault();
    if (!(costValue > 0 && costValue < 500)) return setCostState({ error: 'Enter an amount between 0.1 and 499 lakh.' });
    setCostState({ saving: true });
    try {
      await actions.setEstimatedCost(costValue);
      setCostState({ saved: costValue });
    } catch (err) {
      setCostState({ error: err instanceof ApiError ? err.message : 'Not saved. Please try again.' });
    }
  };
  const [sch, setSch] = useState({ name: '', amount: '', deadline: '' });
  const [docName, setDocName] = useState('');
  const funds = student.documents.filter((d) => d.category === 'funds');
  const covered = f.sources.reduce((n, x) => n + x.amount, 0);

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-end gap-x-3 gap-y-2" onSubmit={saveCost} noValidate data-cost-form>
        <Field label="Estimated total cost of study (₹ lakh)" id="fd-cost">
          <input
            id="fd-cost"
            inputMode="decimal"
            value={cost}
            onChange={(e) => {
              setCost(e.target.value);
              setCostState({});
            }}
            className="input w-40 py-2"
            aria-invalid={!!costState.error}
          />
        </Field>
        <Button type="submit" size="sm" variant="outline" loading={costState.saving} disabled={costValue === f.estimatedCost && !costState.error}>
          Save cost
        </Button>
        {costState.saved !== undefined && (
          <p role="status" className="flex items-center gap-1.5 pb-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved: ₹{costState.saved} lakh
          </p>
        )}
        {costState.error && (
          <p role="alert" className="w-full text-sm font-medium text-red-600">
            {costState.error}
          </p>
        )}
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
          {funds.length ? `${funds.filter((d) => d.state === 'verified').length} of ${funds.length} verified. This service is complete once they are all verified and the funding plan covers the estimated cost.` : 'Request the documents the student must show, e.g. bank statements held for 28 days (UK) or a blocked account confirmation (Germany).'}
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

export function JourneyPanel({ student, services, actions, role }: { student: StaffStudent; services: ServiceView[]; actions: Actions; /** The viewer's role. */ role: string }) {
  // Officers start on their own part of the journey.
  const editable = (code: ServiceCode) => canEditArea(role, student, SERVICE_AREA[code]!);
  const open = (s: ServiceView) => s.status === 'in_progress' || s.status === 'not_started';
  // Start on the first open step this person looks after; when everything is done, on the last part that is theirs.
  const firstOpen =
    services.find((s) => editable(s.code) && open(s))?.code ??
    services.find((s) => s.status === 'in_progress')?.code ??
    services.find((s) => s.status === 'not_started')?.code ??
    [...services].reverse().find((s) => editable(s.code))?.code ??
    'S1';
  const [tab, setTab] = useState<ServiceCode>(firstOpen);
  const [overriding, setOverriding] = useState(false);
  const view = services.find((s) => s.code === tab)!;
  const canEdit = editable(tab);
  const area = SERVICE_AREA[tab]!;
  const ownerId = ownerOf(student, area);

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
          {canEdit && (
            <button type="button" onClick={() => setOverriding(true)} className="text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900">
              Change status
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900" data-read-only>
          {area === 'counsellor'
            ? `${counsellorName(ownerId)}, the student's counsellor, looks after this part. You can view it.`
            : `${counsellorName(ownerId)}, the student's ${teamTitle[area]}, looks after this part now. You can view it, but not change it.`}
        </p>
      )}
      {/* Read-only for anyone else: every control inside is disabled. */}
      <fieldset disabled={!canEdit} className="min-w-0 disabled:opacity-80">
      <div className="mt-4" role="tabpanel">
        {tab === 'S1' && <CareerTab student={student} actions={actions} />}
        {tab === 'S2' && <ShortlistTab student={student} actions={actions} />}
        {tab === 'S3' && <Hint>Applications are created when the student approves the shortlist. Update their status in <a href="#applications" className="font-semibold underline">Applications</a> below; the student accepts or declines offers on their dashboard.</Hint>}
        {tab === 'S4' && <FundingTab student={student} actions={actions} />}
        {tab === 'S5' && <VisaTab student={student} actions={actions} />}
        {tab === 'S6' && <DepartureTab student={student} actions={actions} />}
        {tab === 'S7' && <ArrivalTab student={student} actions={actions} />}
      </div>
      </fieldset>

      {overriding && <OverrideModal view={view} actions={actions} onClose={() => setOverriding(false)} />}
    </Panel>
  );
}
