import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  BookOpen,
  ChevronDown,
  Clock,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  Phone,
  PiggyBank,
  Plane,
  Search,
  Sparkles,
  UserCheck,
  UserRoundX,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/FormField';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { cn, initials, relativeTime } from '../../lib/utils';
import { counsellorName } from '../../data/staff';

/* ------------------------------ Types (GET /admin/assignments) ------------------------------ */

interface Match {
  counsellorId: string;
  name: string;
  score: number;
  points: { country: number; subject: number; capacity: number };
  reasons: string[];
  atCapacity: boolean;
  activeStudents: number;
  capacity: number;
  universities: string[];
  languages: string[];
}

interface QueueStudent {
  id: string;
  name: string;
  reference: string;
  email: string;
  mobile: string;
  registeredAt: string;
  profileCompletedAt: string | null;
  profile: Record<'courseInterest' | 'destination' | 'intake' | 'budget' | 'degree' | 'institution' | 'grade' | 'englishTest' | 'englishScore' | 'workExperience' | 'city', string>;
  fromEnquiry: boolean;
  subject?: string | null;
  matches?: Match[];
}

/** A student ready for a Financial Aid Officer or a Visa Officer. */
interface OfficerQueueStudent {
  id: string;
  name: string;
  reference: string;
  goal: string;
  destination: string;
  intake: string;
  counsellorId: string | null;
  financeOfficerId: string | null;
  readySince: string | null;
}

interface Officer {
  id: string;
  name: string;
  activeStudents: number;
}

type OfficerKind = 'finance' | 'visa';
type View = 'counsellor' | OfficerKind | 'incomplete';

const NO_QUEUE = {
  waiting: [] as QueueStudent[],
  incomplete: [] as QueueStudent[],
  waitingFinance: [] as OfficerQueueStudent[],
  waitingVisa: [] as OfficerQueueStudent[],
  officers: { finance: [] as Officer[], visa: [] as Officer[] },
};

/** How many suggestions show before "Show all counsellors". */
const SHOWN = 3;

/* ------------------------------ Small building blocks ------------------------------ */

const DAY = 86_400_000;
const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : 0);

/** How long a student has been waiting: grey today, amber after a day, red after three. */
function WaitingBadge({ since, label = 'Waiting' }: { since: string | null | undefined; label?: string }) {
  if (!since) return null;
  const d = daysSince(since);
  const tone = d >= 3 ? 'bg-red-50 text-red-700 ring-red-200' : d >= 1 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-navy-50 text-navy-600 ring-navy-100';
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1', tone)} title={new Date(since).toLocaleString('en-GB')}>
      <Clock className="h-3 w-3" aria-hidden />
      {label} {d === 0 ? 'since today' : `${d} ${d === 1 ? 'day' : 'days'}`}
    </span>
  );
}

function Avatar({ name, tone = 'navy' }: { name: string; tone?: 'navy' | 'gold' }) {
  return (
    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-base', tone === 'gold' ? 'bg-gold-500 text-navy-950' : 'bg-navy-900 text-gold-300')} aria-hidden>
      {initials(name)}
    </span>
  );
}

function Chip({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ivory px-2.5 py-1 text-xs font-medium text-navy-700 ring-1 ring-navy-100">
      {Icon && <Icon className="h-3.5 w-3.5 text-navy-400" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * Students' load. Against a capacity (counsellors): green, amber from 80%, red when full. Officers have no capacity, so
 * their bars are only compared with each other (neutral colour).
 */
function LoadBar({ value, max, label, neutral = false }: { value: number; max: number; label: string; neutral?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="min-w-[7rem]" title={label}>
      <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
        <div className={cn('h-full rounded-full', neutral ? 'bg-navy-400' : pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-navy-500">{label}</p>
    </div>
  );
}

/** The match score split into its parts: country (out of 50), subject (30) and spare capacity (20). */
function ScoreBar({ m }: { m: Match }) {
  const parts = [
    { key: 'country', label: 'Country', value: m.points.country, max: 50, cls: 'bg-navy-800' },
    { key: 'subject', label: 'Subject', value: m.points.subject, max: 30, cls: 'bg-gold-500' },
    { key: 'capacity', label: 'Capacity', value: m.points.capacity, max: 20, cls: 'bg-emerald-500' },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-navy-100" role="img" aria-label={parts.map((p) => `${p.label} ${p.value} of ${p.max}`).join(', ')}>
        {parts.map((p) => (
          <span key={p.key} className={p.cls} style={{ width: `${p.value}%` }} />
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-navy-500">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', p.cls)} aria-hidden />
            {p.label} {p.value}/{p.max}
          </span>
        ))}
      </p>
    </div>
  );
}

function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-navy-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-navy-500">{children}</p>
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

/**
 * The admin chooses who looks after each student at each handover: the counsellor once the profile is complete (ranked
 * on the profile: country 50%, subject 30%, spare capacity 20%), the Financial Aid Officer once Application Assistance is
 * complete, and the Visa Officer once Scholarship & Financial Guidance is complete. The portal suggests; the admin decides.
 */
export function AssignCounsellorsPage() {
  const [queue, loaded] = useApi('/admin/assignments', NO_QUEUE, { pollMs: 60_000 });
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<View>('counsellor');
  const [query, setQuery] = useState('');
  const { hash } = useLocation();

  // Links from a student's record (#student-<id>) open the right list and jump to that student.
  useEffect(() => {
    if (!hash || !loaded) return;
    const id = hash.replace(/^#(student|finance|visa)-/, '');
    if (queue.incomplete.some((s) => s.id === id)) setView('incomplete');
    else if (queue.waitingFinance.some((s) => s.id === id)) setView('finance');
    else if (queue.waitingVisa.some((s) => s.id === id)) setView('visa');
    else setView('counsellor');
    requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [hash, loaded, queue]);

  const q = query.trim().toLowerCase();
  const matchesQuery = (...fields: (string | null | undefined)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));

  const oldest = (dates: (string | null)[]) => dates.filter(Boolean).sort()[0] ?? null;
  const tabs: { key: View; label: string; hint: string; count: number; since: string | null; icon: LucideIcon; tone: string }[] = [
    { key: 'counsellor', label: 'Counsellor', hint: 'Profile complete', count: queue.waiting.length, since: oldest(queue.waiting.map((s) => s.profileCompletedAt)), icon: UserCheck, tone: 'bg-navy-900 text-gold-300' },
    { key: 'finance', label: 'Financial Aid Officer', hint: 'Offer accepted', count: queue.waitingFinance.length, since: oldest(queue.waitingFinance.map((s) => s.readySince)), icon: PiggyBank, tone: 'bg-gold-500 text-navy-950' },
    { key: 'visa', label: 'Visa Officer', hint: 'Funding complete', count: queue.waitingVisa.length, since: oldest(queue.waitingVisa.map((s) => s.readySince)), icon: Plane, tone: 'bg-sky-600 text-white' },
    { key: 'incomplete', label: 'Profile incomplete', hint: "Can't be assigned yet", count: queue.incomplete.length, since: null, icon: UserRoundX, tone: 'bg-navy-100 text-navy-700' },
  ];
  const waitingTotal = queue.waiting.length + queue.waitingFinance.length + queue.waitingVisa.length;

  return (
    <>
      <PageHeader
        title="Assignments"
        description={
          loaded
            ? waitingTotal
              ? `${waitingTotal} ${waitingTotal === 1 ? 'student is' : 'students are'} waiting for you to choose who looks after them.`
              : 'Everyone is assigned. New students appear here at each handover.'
            : 'Choose who looks after each student at each handover.'
        }
      />
      {message && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <UserCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {message}
        </p>
      )}

      {/* The four queues: each card opens its list. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Assignment queues">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={view === t.key}
                onClick={() => setView(t.key)}
                data-queue-tab={t.key}
                className={cn(
                  'card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift',
                  view === t.key ? 'ring-2 ring-navy-900' : 'ring-1 ring-transparent',
                )}
              >
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', t.tone)}>
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-3xl leading-none text-navy-900">{t.count}</span>
                    {t.count > 0 && t.since && daysSince(t.since) >= 1 && (
                      <span className={cn('text-[11px] font-semibold', daysSince(t.since) >= 3 ? 'text-red-600' : 'text-amber-700')}>oldest {daysSince(t.since)}d</span>
                    )}
                  </span>
                  <span className="mt-1.5 block text-sm font-semibold text-navy-900">{t.key === 'incomplete' ? t.label : `Waiting for ${t.label === 'Counsellor' ? 'a counsellor' : `a ${t.label}`}`}</span>
                  <span className="block text-xs text-navy-500">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mb-5 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy-600">
              {view === 'counsellor' && 'Suggestions are ranked on the student’s profile: country 50%, subject 30%, spare capacity 20%. You decide.'}
              {view === 'finance' && 'Students who have accepted an offer. The Financial Aid Officer looks after scholarships, the funding plan and proof of funds.'}
              {view === 'visa' && 'Students whose funding is complete. The Visa Officer looks after the visa, pre-departure and post-arrival support.'}
              {view === 'incomplete' && 'Registered, but the profile isn’t complete, so they can’t be assigned yet. The profile form opens each time they sign in.'}
            </p>
            <label className="relative block w-full shrink-0 sm:w-72">
              <span className="sr-only">Search students</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, reference or email" className="input py-2.5 pl-10" type="search" />
            </label>
          </div>

      {view === 'counsellor' &&
        (queue.waiting.length === 0 ? (
          <Empty icon={UserCheck} title="No one is waiting for a counsellor">Students appear here as soon as they complete their profile.</Empty>
        ) : (
          <ul className="space-y-5">
            {queue.waiting
              .filter((s) => matchesQuery(s.name, s.reference, s.email))
              .map((s) => (
                <WaitingStudent key={s.id} student={s} onAssigned={setMessage} />
              ))}
          </ul>
        ))}

      {(view === 'finance' || view === 'visa') && (
        <OfficerQueue
          kind={view}
          students={(view === 'finance' ? queue.waitingFinance : queue.waitingVisa).filter((s) => matchesQuery(s.name, s.reference))}
          total={(view === 'finance' ? queue.waitingFinance : queue.waitingVisa).length}
          officers={queue.officers[view]}
          onAssigned={setMessage}
        />
      )}

      {view === 'incomplete' &&
        (queue.incomplete.length === 0 ? (
          <Empty icon={UserCheck} title="Every student has completed their profile">Students who register appear here until their profile is complete.</Empty>
        ) : (
          <div className="card overflow-hidden">
            <ul className="divide-y divide-navy-100">
              {queue.incomplete
                .filter((s) => matchesQuery(s.name, s.reference, s.email))
                .map((s) => (
                  <IncompleteStudent key={s.id} student={s} onSent={setMessage} />
                ))}
            </ul>
          </div>
        ))}

    </>
  );
}

/* ------------------------------ One suggested counsellor ------------------------------ */

/** Score, name and Assign at a glance; the reasons, score breakdown, capacity and background open on click. */
function SuggestedCounsellor({ m, best, onAssign }: { m: Match; best: boolean; onAssign: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn('rounded-2xl ring-1 transition', best ? 'bg-gold-50/60 ring-gold-300' : 'bg-white ring-navy-100 hover:ring-navy-200')} data-match={m.counsellorId}>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
          data-match-toggle
        >
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold', best ? 'bg-gold-500 text-navy-950' : 'bg-navy-50 text-navy-800')} title="Match score out of 100">
            {m.score}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy-900">{m.name}</span>
              {best && <Pill tone="gold">Best match</Pill>}
              {m.atCapacity && <Pill tone="red">At capacity</Pill>}
            </span>
            <span className="text-xs text-navy-500">{open ? 'Hide details' : 'View details'}</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-navy-400 transition', open && 'rotate-180')} aria-hidden />
        </button>
        <Button size="sm" variant={best ? 'primary' : 'outline'} className="shrink-0" onClick={onAssign}>
          Assign
        </Button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-navy-100 px-3 pb-3.5 pt-3 sm:pl-16" data-match-details>
          <ul className="space-y-1 text-xs text-navy-700">
            {m.reasons.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-navy-300" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <ScoreBar m={m} />
            <LoadBar value={m.activeStudents} max={m.capacity} label={`${m.activeStudents}/${m.capacity} students`} />
          </div>
          {(m.universities.length > 0 || m.languages.length > 0) && (
            <p className="text-xs text-navy-500">
              {[m.universities.length ? `Studied at ${m.universities.join(', ')}` : '', m.languages.length ? `Speaks ${m.languages.join(', ')}` : ''].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------ A student waiting for a counsellor ------------------------------ */

function WaitingStudent({ student: s, onAssigned }: { student: QueueStudent; onAssigned: (message: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [choice, setChoice] = useState<Match | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const p = s.profile;
  const matches = s.matches ?? [];
  const shown = showAll ? matches : matches.slice(0, SHOWN);
  const facts = useMemo(
    () => [
      { icon: GraduationCap, label: 'Education', value: [p.degree, p.institution].filter(Boolean).join(', ') + (p.grade ? ` · ${p.grade}` : '') },
      { icon: Languages, label: 'English', value: p.englishTest === 'Not taken yet' ? 'Not taken yet' : `${p.englishTest} ${p.englishScore}` },
      { icon: Wallet, label: 'Budget', value: p.budget },
      { icon: Sparkles, label: 'Experience', value: p.workExperience || 'None given' },
    ],
    [p],
  );

  const assign = async () => {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await mutate(() => api.post(`/students/${s.id}/assign`, { counsellorId: choice.counsellorId, reason: reason.trim() }), { silent: true });
      onAssigned(`${s.name} is now assigned to ${choice.name}. Both have been emailed, and ${s.name.split(' ')[0]} can now book their first session.`);
      setChoice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li id={`student-${s.id}`} className="card scroll-mt-28 overflow-hidden" data-waiting={s.id}>
      <div className="grid lg:grid-cols-12">
        {/* The student */}
        <section className="border-b border-navy-100 p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <Avatar name={s.name} />
            <div className="min-w-0 flex-1">
              <Link to={`/staff/students/${s.id}`} className="font-semibold text-navy-900 hover:underline">
                {s.name}
              </Link>
              <p className="text-xs text-navy-400">{s.reference}{p.city ? ` · ${p.city}` : ''}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <WaitingBadge since={s.profileCompletedAt} />
            {s.fromEnquiry && <Pill tone="blue">From website enquiry</Pill>}
          </div>
          <div className="mt-4 rounded-2xl bg-ivory p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Wants to study</p>
            <p className="mt-0.5 font-semibold text-navy-900">{p.courseInterest}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip icon={MapPin}>{p.destination}</Chip>
              <Chip icon={Clock}>{p.intake}</Chip>
              {s.subject && <Chip icon={BookOpen}>{s.subject}</Chip>}
            </div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-2.5">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">{f.label}</dt>
                  <dd className="text-sm text-navy-800">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* Suggested counsellors */}
        <section className="p-5 lg:col-span-7">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">Suggested counsellors</p>
          {matches.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">No active counsellors. Add one in Staff users.</p>
          ) : (
            <ol className="space-y-2">
              {shown.map((m, i) => (
                <SuggestedCounsellor
                  key={m.counsellorId}
                  m={m}
                  best={i === 0 && !m.atCapacity}
                  onAssign={() => {
                    setChoice(m);
                    setReason('');
                    setError(null);
                  }}
                />
              ))}
            </ol>
          )}
          {matches.length > SHOWN && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900">
              {showAll ? 'Show top suggestions only' : `Show all ${matches.length} counsellors`}
            </button>
          )}
        </section>
      </div>

      <Modal
        open={!!choice}
        onClose={() => setChoice(null)}
        title={`Assign ${s.name} to ${choice?.name ?? ''}?`}
        description="The student and the counsellor are both emailed. The student can then book sessions and message their counsellor."
        footer={
          <>
            <Button variant="outline" onClick={() => setChoice(null)}>Cancel</Button>
            <Button onClick={() => void assign()} loading={saving}>Assign counsellor</Button>
          </>
        }
      >
        {choice?.atCapacity && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{choice.name} is at capacity ({choice.activeStudents} of {choice.capacity} students).</p>}
        <TextField
          label="Note (optional)"
          placeholder="e.g. Best match for the UK and computing"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          hint="Kept in the student's history. Leave empty to record “Matched on the student's profile”."
        />
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </Modal>
    </li>
  );
}

/* ------------------------------ Students waiting for an officer ------------------------------ */

const OFFICER = {
  finance: {
    title: 'Financial Aid Officer',
    ready: 'Offer accepted',
    empty: 'No one is waiting for a Financial Aid Officer',
    emptyText: 'Students appear here when they accept an offer.',
    icon: PiggyBank,
  },
  visa: {
    title: 'Visa Officer',
    ready: 'Funding complete',
    empty: 'No one is waiting for a Visa Officer',
    emptyText: 'Students appear here when their proof of funds is verified (or funding is marked "Not needed").',
    icon: Plane,
  },
} as const;

function OfficerQueue({ kind, students, total, officers, onAssigned }: { kind: OfficerKind; students: OfficerQueueStudent[]; total: number; officers: Officer[]; onAssigned: (message: string) => void }) {
  const o = OFFICER[kind];
  const [choice, setChoice] = useState<{ student: OfficerQueueStudent; officer: Officer } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Officers come lightest workload first; bars are scaled to the busiest one.
  const busiest = Math.max(1, ...officers.map((x) => x.activeStudents));

  const assign = async () => {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await mutate(() => api.post(`/students/${choice.student.id}/officer`, { kind, officerId: choice.officer.id }), { silent: true });
      onAssigned(`${choice.officer.name} is now ${choice.student.name}'s ${o.title}. The student, the officer and the counsellor have been emailed.`);
      setChoice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (total === 0) return <Empty icon={o.icon} title={o.empty}>{o.emptyText}</Empty>;

  return (
    <>
      {officers.length === 0 && <p className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">No active {o.title}s yet. Add one in Staff users to assign these students.</p>}
      <ul className="space-y-5">
        {students.map((st) => (
          <li key={st.id} id={`${kind}-${st.id}`} className="card scroll-mt-28 overflow-hidden" data-officer-queue={kind} data-student={st.id}>
            <div className="grid lg:grid-cols-12">
              <section className="border-b border-navy-100 p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
                <div className="flex items-start gap-3">
                  <Avatar name={st.name} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/staff/students/${st.id}`} className="font-semibold text-navy-900 hover:underline">
                      {st.name}
                    </Link>
                    <p className="text-xs text-navy-400">{st.reference}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <WaitingBadge since={st.readySince} label={`${o.ready} ·`} />
                </div>
                <div className="mt-4 rounded-2xl bg-ivory p-3.5">
                  <p className="font-semibold text-navy-900">{st.goal}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip icon={MapPin}>{st.destination}</Chip>
                    <Chip icon={Clock}>{st.intake}</Chip>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-navy-500">Counsellor</dt>
                    <dd className="font-medium text-navy-900">{counsellorName(st.counsellorId)}</dd>
                  </div>
                  {kind === 'visa' && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-navy-500">Financial Aid Officer</dt>
                      <dd className="font-medium text-navy-900">{st.financeOfficerId ? counsellorName(st.financeOfficerId) : 'None (not needed)'}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="p-5 lg:col-span-7">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-navy-400">Choose a {o.title}</p>
                {officers.length === 0 ? (
                  <p className="text-sm text-navy-400">No one to choose from yet.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {officers.map((off, i) => (
                      <li key={off.id} className={cn('flex items-center gap-3 rounded-2xl p-3.5 ring-1', i === 0 ? 'bg-gold-50/60 ring-gold-300' : 'bg-white ring-navy-100')}>
                        <Avatar name={off.name} tone={i === 0 ? 'gold' : 'navy'} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-navy-900">{off.name}</p>
                            {i === 0 && officers.length > 1 && <Pill tone="gold">Lightest workload</Pill>}
                          </div>
                          <LoadBar neutral value={off.activeStudents} max={busiest} label={`${off.activeStudents} active ${off.activeStudents === 1 ? 'student' : 'students'}`} />
                        </div>
                        <Button
                          size="sm"
                          variant={i === 0 ? 'primary' : 'outline'}
                          className="shrink-0"
                          onClick={() => {
                            setChoice({ student: st, officer: off });
                            setError(null);
                          }}
                          data-assign-officer={off.id}
                        >
                          Assign
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={!!choice}
        onClose={() => setChoice(null)}
        title={`Assign ${choice?.officer.name ?? ''} as ${choice?.student.name ?? ''}'s ${o.title}?`}
        description={
          kind === 'finance'
            ? 'They will look after scholarships, the funding plan and proof of funds. The counsellor can still see this part but not change it.'
            : 'They will look after the visa, pre-departure and post-arrival support. The counsellor can still see these parts but not change them.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setChoice(null)}>Cancel</Button>
            <Button onClick={() => void assign()} loading={saving}>Assign {o.title}</Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">The student, the officer and the counsellor are emailed, and the student can then message the officer and book sessions with them.</p>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </Modal>
    </>
  );
}

/* ------------------------------ A student still completing their profile ------------------------------ */

function IncompleteStudent({ student: s, onSent }: { student: QueueStudent; onSent: (message: string) => void }) {
  const [sending, setSending] = useState(false);
  const remind = async () => {
    setSending(true);
    try {
      await mutate(() => api.post(`/students/${s.id}/profile-reminder`), { silent: true });
      onSent(`A reminder to complete their profile was emailed to ${s.name}.`);
    } catch (err) {
      onSent(err instanceof ApiError ? err.message : 'The reminder could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };
  return (
    <li id={`student-${s.id}`} className="flex scroll-mt-28 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5" data-incomplete={s.id}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={s.name} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <Link to={`/staff/students/${s.id}`} className="font-semibold text-navy-900 hover:underline">
              {s.name}
            </Link>
            <span className="text-xs text-navy-400">{s.reference}</span>
            {s.fromEnquiry && <Pill tone="blue">From website enquiry</Pill>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-navy-500">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" aria-hidden /> {s.email}
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" aria-hidden /> {s.mobile}
            </span>
          </p>
        </div>
      </div>
      <span className="text-xs text-navy-500 sm:w-36 sm:text-right">Registered {relativeTime(s.registeredAt)}</span>
      <Button size="sm" variant="outline" onClick={() => void remind()} loading={sending} className="shrink-0">
        <BellRing className="h-4 w-4" aria-hidden /> Send reminder
      </Button>
    </li>
  );
}
