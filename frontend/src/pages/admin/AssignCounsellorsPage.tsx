import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellRing, Pencil, PiggyBank, Plane, UserCheck, UserRoundCog, UsersRound } from 'lucide-react';
import { PageHeader, EmptyState } from '../../components/staff/StaffUi';
import { Panel, Pill } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/FormField';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import { ApiError } from '../../lib/api/types';
import { cn, relativeTime } from '../../lib/utils';
import { counsellorName } from '../../data/staff';

/* ------------------------------ Types (GET /admin/assignments, /admin/counsellors/matching) ------------------------------ */

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

interface MatchingProfile {
  countries: { country: string; years: number }[];
  universities: string[];
  subjects: string[];
  languages: string[];
  capacity: number;
}

interface CounsellorMatching {
  id: string;
  name: string;
  activeStudents: number;
  matchingProfile: MatchingProfile;
}

interface CareerOptions {
  directions: { key: string; label: string }[];
  destinations: string[];
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

const NO_QUEUE = {
  waiting: [] as QueueStudent[],
  incomplete: [] as QueueStudent[],
  waitingFinance: [] as OfficerQueueStudent[],
  waitingVisa: [] as OfficerQueueStudent[],
  officers: { finance: [] as Officer[], visa: [] as Officer[] },
};
const NO_COUNSELLORS: CounsellorMatching[] = [];
const NO_OPTIONS: CareerOptions = { directions: [], destinations: [] };

/** How many suggestions show before "Show all counsellors". */
const SHOWN = 3;

/* ------------------------------ Page ------------------------------ */

/**
 * The admin assigns every student's counsellor, based only on the student's profile, once it is complete.
 * The portal ranks the counsellors (country 50%, subject 30%, spare capacity 20%); the admin decides.
 */
export function AssignCounsellorsPage() {
  const [queue] = useApi('/admin/assignments', NO_QUEUE, { pollMs: 60_000 });
  const [counsellorProfiles] = useApi('/admin/counsellors/matching', NO_COUNSELLORS);
  const [options] = useApi<CareerOptions>('/career-options', NO_OPTIONS);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<CounsellorMatching | null>(null);
  const { hash } = useLocation();

  // Links from a student's record (#student-<id>) jump to that student.
  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [hash, queue]);

  const subjectLabel = (key: string) => options.directions.find((d) => d.key === key)?.label ?? key;

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Choose each student's counsellor once their profile is complete, their Financial Aid Officer once Application Assistance is complete, and their Visa Officer once Scholarship & Financial Guidance is complete."
      />
      {message && <p role="status" className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <p className="mb-3 text-sm text-navy-600">Counsellor suggestions are ranked on the student's profile: country 50%, subject 30%, spare capacity 20%. You decide.</p>
      <Panel title={`Waiting for a counsellor (${queue.waiting.length})`} icon={<UserCheck className="h-4 w-4" aria-hidden />}>
        {queue.waiting.length === 0 ? (
          <EmptyState>No students are waiting. Students appear here as soon as they complete their profile.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {queue.waiting.map((s) => (
              <WaitingStudent key={s.id} student={s} onAssigned={setMessage} />
            ))}
          </ul>
        )}
      </Panel>

      <OfficerQueue kind="finance" students={queue.waitingFinance} officers={queue.officers.finance} onAssigned={setMessage} />
      <OfficerQueue kind="visa" students={queue.waitingVisa} officers={queue.officers.visa} onAssigned={setMessage} />

      <Panel title={`Profile incomplete (${queue.incomplete.length})`} icon={<BellRing className="h-4 w-4" aria-hidden />} className="mt-6">
        <p className="mb-4 text-sm text-navy-600">Registered, but their profile isn't complete yet, so they can't be assigned. The profile form opens each time they sign in.</p>
        {queue.incomplete.length === 0 ? (
          <p className="text-sm text-navy-400">Nobody is waiting on their profile.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {queue.incomplete.map((s) => (
              <IncompleteStudent key={s.id} student={s} onSent={setMessage} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Counsellor profiles for matching" icon={<UsersRound className="h-4 w-4" aria-hidden />} className="mt-6">
        <p className="mb-4 text-sm text-navy-600">Used only for suggestions; students don't see them. Keep countries, subjects and capacity up to date.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {counsellorProfiles.map((c) => {
            const m = c.matchingProfile;
            return (
              <div key={c.id} className="rounded-2xl border border-navy-100 p-4" data-counsellor-profile={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy-900">{c.name}</p>
                    <p className={cn('text-xs', c.activeStudents >= m.capacity ? 'font-semibold text-red-600' : 'text-navy-500')}>
                      {c.activeStudents} of {m.capacity} students
                    </p>
                  </div>
                  <button type="button" onClick={() => setEditing(c)} className="inline-flex items-center gap-1 rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:border-navy-900">
                    <Pencil className="h-3 w-3" aria-hidden /> Edit
                  </button>
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <Row label="Countries" value={m.countries.map((x) => `${x.country} (${x.years} yr${x.years === 1 ? '' : 's'})`).join(', ')} />
                  <Row label="Subjects" value={m.subjects.map(subjectLabel).join(', ')} />
                  <Row label="Studied at" value={m.universities.join(', ')} />
                  <Row label="Languages" value={m.languages.join(', ')} />
                </dl>
              </div>
            );
          })}
        </div>
      </Panel>

      {editing && (
        <MatchingProfileModal
          counsellor={editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            setMessage(`${name}'s matching profile was saved. Suggestions use it straight away.`);
          }}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-navy-400">{label}</dt>
      <dd className={value ? 'text-navy-800' : 'text-navy-300'}>{value || 'Not set'}</dd>
    </div>
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
    <li id={`student-${s.id}`} className="scroll-mt-28 rounded-2xl border border-navy-100 p-4" data-waiting={s.id}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link to={`/staff/students/${s.id}`} className="font-semibold text-navy-900 hover:underline">{s.name}</Link>
          <span className="ml-2 text-xs text-navy-400">{s.reference}</span>
          <p className="mt-1 text-sm text-navy-700">
            <span className="font-medium">{p.courseInterest}</span> · {p.destination} · {p.intake}
            {s.subject && <span className="ml-2"><Pill tone="grey">{s.subject}</Pill></span>}
          </p>
          <p className="mt-1 text-xs text-navy-500">
            {[p.degree && `${p.degree}${p.grade ? ` (${p.grade})` : ''}`, p.englishTest === 'Not taken yet' ? 'No English test yet' : `${p.englishTest} ${p.englishScore}`, `Budget ${p.budget}`, p.workExperience, p.city]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-xs text-navy-500 sm:text-right">
          <p>Profile completed {s.profileCompletedAt ? relativeTime(s.profileCompletedAt) : ''}</p>
          {s.fromEnquiry && <p className="mt-1 font-semibold text-sky-700">Came from a website enquiry</p>}
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-navy-400">Suggested counsellors</p>
      {matches.length === 0 ? (
        <p className="text-sm text-navy-500">No active counsellors. Add one in Staff users.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((m, i) => (
            <li key={m.counsellorId} className="flex flex-col gap-3 rounded-xl bg-ivory px-4 py-3 sm:flex-row sm:items-center" data-match={m.counsellorId}>
              <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold', i === 0 && !m.atCapacity ? 'bg-gold-500 text-navy-950' : 'bg-white text-navy-700 ring-1 ring-navy-100')} title="Match score out of 100">
                {m.score}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">
                  {m.name}
                  {i === 0 && !m.atCapacity && <span className="ml-2 text-xs font-semibold text-gold-700">Best match</span>}
                  {m.atCapacity && <span className="ml-2"><Pill tone="red">At capacity</Pill></span>}
                </p>
                <p className="text-xs text-navy-600">{m.reasons.join(' · ')}</p>
                {(m.universities.length > 0 || m.languages.length > 0) && (
                  <p className="text-xs text-navy-400">
                    {[m.universities.length ? `Studied at ${m.universities.join(', ')}` : '', m.languages.length ? `Speaks ${m.languages.join(', ')}` : ''].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Button size="sm" variant={i === 0 && !m.atCapacity ? 'primary' : 'outline'} onClick={() => { setChoice(m); setReason(''); setError(null); }}>
                Assign
              </Button>
            </li>
          ))}
        </ul>
      )}
      {matches.length > SHOWN && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900">
          {showAll ? 'Show top suggestions only' : `Show all ${matches.length} counsellors`}
        </button>
      )}

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
    list: 'Waiting for a Financial Aid Officer',
    ready: 'Application Assistance complete',
    empty: 'Nobody is waiting. Students appear here when they accept an offer.',
    icon: PiggyBank,
  },
  visa: {
    title: 'Visa Officer',
    list: 'Waiting for a Visa Officer',
    ready: 'Scholarship & Financial Guidance complete',
    empty: 'Nobody is waiting. Students appear here when their proof of funds is verified (or funding is marked "Not needed").',
    icon: Plane,
  },
} as const;

function OfficerQueue({ kind, students, officers, onAssigned }: { kind: OfficerKind; students: OfficerQueueStudent[]; officers: Officer[]; onAssigned: (message: string) => void }) {
  const o = OFFICER[kind];
  const [choice, setChoice] = useState<{ student: OfficerQueueStudent; officer: Officer } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <Panel title={`${o.list} (${students.length})`} icon={<o.icon className="h-4 w-4" aria-hidden />} className="mt-6">
      {students.length === 0 ? (
        <p className="text-sm text-navy-400">{o.empty}</p>
      ) : officers.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">No active {o.title}s. Add one in Staff users.</p>
      ) : null}
      {students.length > 0 && (
        <ul className="space-y-3">
          {students.map((st) => (
            <li key={st.id} id={`${kind}-${st.id}`} className="scroll-mt-28 rounded-2xl border border-navy-100 p-4" data-officer-queue={kind} data-student={st.id}>
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <Link to={`/staff/students/${st.id}`} className="font-semibold text-navy-900 hover:underline">{st.name}</Link>
                  <span className="ml-2 text-xs text-navy-400">{st.reference}</span>
                  <p className="text-sm text-navy-600">{st.goal} · {st.destination} · {st.intake}</p>
                  <p className="text-xs text-navy-500">
                    Counsellor: {counsellorName(st.counsellorId)}
                    {kind === 'visa' && ` · Financial Aid Officer: ${st.financeOfficerId ? counsellorName(st.financeOfficerId) : 'none (not needed)'}`}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-navy-500">{o.ready}{st.readySince ? ` ${relativeTime(st.readySince)}` : ''}</p>
              </div>
              {officers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {officers.map((off, i) => (
                    <button
                      key={off.id}
                      type="button"
                      onClick={() => {
                        setChoice({ student: st, officer: off });
                        setError(null);
                      }}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                        i === 0 ? 'bg-navy-900 text-white hover:bg-navy-800' : 'bg-white text-navy-700 ring-1 ring-navy-100 hover:bg-navy-50',
                      )}
                      data-assign-officer={off.id}
                    >
                      Assign {off.name} · {off.activeStudents} {off.activeStudents === 1 ? 'student' : 'students'}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

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
    </Panel>
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
    <li id={`student-${s.id}`} className="flex scroll-mt-28 flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" data-incomplete={s.id}>
      <div className="text-sm">
        <Link to={`/staff/students/${s.id}`} className="font-semibold text-navy-900 hover:underline">{s.name}</Link>
        <span className="ml-2 text-xs text-navy-400">{s.reference}</span>
        <p className="text-xs text-navy-500">
          Registered {relativeTime(s.registeredAt)} · {s.email} · {s.mobile}
          {s.fromEnquiry && ' · came from a website enquiry'}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => void remind()} loading={sending}>
        <BellRing className="h-4 w-4" aria-hidden /> Send reminder
      </Button>
    </li>
  );
}

/* ------------------------------ Editing a counsellor's matching profile ------------------------------ */

const splitList = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

function MatchingProfileModal({ counsellor, options, onClose, onSaved }: { counsellor: CounsellorMatching; options: CareerOptions; onClose: () => void; onSaved: (name: string) => void }) {
  const m = counsellor.matchingProfile;
  // Years per country; empty = no experience there.
  const [years, setYears] = useState<Record<string, string>>(() => Object.fromEntries(m.countries.map((c) => [c.country, String(c.years)])));
  const [subjects, setSubjects] = useState<string[]>(m.subjects);
  const [universities, setUniversities] = useState(m.universities.join(', '));
  const [languages, setLanguages] = useState(m.languages.join(', '));
  const [capacity, setCapacity] = useState(String(m.capacity));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const countries = Array.from(new Set([...options.destinations, ...m.countries.map((c) => c.country)]));

  const save = async () => {
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) return setError('Capacity must be a whole number between 1 and 500.');
    const list = Object.entries(years).filter(([, y]) => y.trim() !== '');
    if (list.some(([, y]) => !/^\d{1,2}$/.test(y.trim()))) return setError('Years must be a whole number (0–50).');
    setSaving(true);
    setError(null);
    try {
      await mutate(
        () =>
          api.put(`/admin/staff/${counsellor.id}/matching-profile`, {
            countries: list.map(([country, y]) => ({ country, years: Number(y) })),
            subjects,
            universities: splitList(universities),
            languages: splitList(languages),
            capacity: cap,
          }),
        { silent: true },
      );
      onSaved(counsellor.name);
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
      size="lg"
      title={`Matching profile: ${counsellor.name}`}
      description="Used only to suggest counsellors for new students. Students don't see it."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={saving}>Save profile</Button>
        </>
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
            <UserRoundCog className="h-4 w-4" aria-hidden /> Countries with experience
          </legend>
          <p className="mb-3 text-xs text-navy-500">Years working with each country's universities. Leave empty for none.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {countries.map((c) => (
              <label key={c} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 px-3 py-2 text-sm text-navy-800">
                {c}
                <span className="flex items-center gap-1.5 text-xs text-navy-500">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    inputMode="numeric"
                    value={years[c] ?? ''}
                    onChange={(e) => setYears({ ...years, [c]: e.target.value })}
                    className="input w-20 py-1.5 text-right"
                    aria-label={`Years with ${c}`}
                  />
                  years
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-900">Subject areas</legend>
          <div className="flex flex-wrap gap-2">
            {options.directions.map((d) => {
              const on = subjects.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSubjects(on ? subjects.filter((x) => x !== d.key) : [...subjects, d.key])}
                  className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', on ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50')}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Universities studied at" placeholder="e.g. University of Leeds" hint="Separate with commas" value={universities} onChange={(e) => setUniversities(e.target.value)} />
          <TextField label="Languages" placeholder="e.g. English, Hindi, Marathi" hint="Separate with commas" value={languages} onChange={(e) => setLanguages(e.target.value)} />
          <TextField label="Capacity (active students)" type="number" inputMode="numeric" min={1} max={500} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
