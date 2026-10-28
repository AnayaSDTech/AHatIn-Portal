import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileSearch } from 'lucide-react';
import { useSessions, useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { computeServices, serviceValues } from '../../lib/journey';
import { EmptyState, FilterChips, PageHeader, SearchBox, ServiceBar } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { areaOfRole, counsellorName, counsellors, serviceShortNames, stageIndex, stageLabel, type StaffStudent } from '../../data/staff';
import { useAuth } from '../../context/AuthContext';
import { CASE_GROUPS, DESK, officerCase, type OfficerArea } from '../../lib/officerCase';
import { cn, initials } from '../../lib/utils';

type Group = 'all' | 'preparing' | 'applying' | 'visa' | 'abroad';

/** Groups of journey stages, so the list is easy to scan. */
const groupOf = (stage: string): Exclude<Group, 'all'> => {
  const i = stageIndex(stage);
  if (i <= stageIndex('documents_shortlist')) return 'preparing';
  if (i <= stageIndex('offer_accepted')) return 'applying';
  if (i <= stageIndex('visa_granted')) return 'visa';
  return 'abroad';
};

export function StudentsPage() {
  const { user } = useAuth();
  const area = areaOfRole(user?.role ?? '');
  return area === 'finance' || area === 'visa' ? <OfficerStudents area={area} /> : <AllStudents />;
}

/** Financial Aid and Visa Officers: the students assigned to them, by where they are in the officer's part of the journey. */
function OfficerStudents({ area }: { area: OfficerArea }) {
  const scope = useStaffScope();
  const [allStudents] = useStaffStudents();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const cases = useMemo(() => scope.filterStudents(allStudents).map((s) => ({ s, c: officerCase(s, area) })), [scope, allStudents, area]);
  const q = query.trim().toLowerCase();
  const visible = cases
    .filter(({ c }) => group === 'all' || (group === 'action' ? c.urgency === 2 : c.group === group))
    .filter(({ s }) => !q || [s.name, s.reference, s.email, s.goal, s.destination].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => b.c.urgency - a.c.urgency || a.s.name.localeCompare(b.s.name));

  return (
    <>
      <PageHeader title="My students" description={`${DESK[area].covers} for the students assigned to you.`} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, reference, course…" />
        <FilterChips
          label="Filter by stage"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'All', count: cases.length },
            { value: 'action', label: 'Needs you', count: cases.filter(({ c }) => c.urgency === 2).length },
            ...CASE_GROUPS[area].map((g) => ({ ...g, count: cases.filter(({ c }) => c.group === g.value).length })),
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState>{cases.length ? 'No students match your search.' : 'No students assigned to you yet.'}</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ s, c }) => (
            <li key={s.id}>
              <Link to={`/staff/students/${s.id}`} className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift" data-officer-student={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{initials(s.name)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-900 group-hover:text-gold-700">{s.name}</p>
                      <p className="text-xs text-navy-400">{s.reference}</p>
                    </div>
                  </div>
                  <Pill tone={c.tone}>{c.phase}</Pill>
                </div>
                <p className="mt-4 text-sm text-navy-700">{s.goal} · {s.destination}</p>
                <p className="text-xs text-navy-500">
                  {s.intake} · Counsellor: {counsellorName(s.counsellorId)}
                </p>
                <div className="mt-4 flex-1 rounded-xl bg-ivory/70 px-3.5 py-3">
                  <p className={cn('flex items-center gap-1.5 text-sm', c.urgency === 2 ? 'font-semibold text-navy-900' : 'text-navy-700')}>
                    {c.urgency === 2 && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Needs you" />}
                    {c.next}
                  </p>
                  {c.detail && <p className="mt-0.5 text-xs text-navy-500">{c.detail}</p>}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
                    <span className={cn('block h-full rounded-full', c.progress >= 1 ? 'bg-emerald-500' : 'bg-sky-500')} style={{ width: `${Math.round(c.progress * 100)}%` }} />
                  </span>
                  <span className="text-xs text-navy-400">{Math.round(c.progress * 100)}%</span>
                  {c.toVerify > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                      <FileSearch className="h-3 w-3" aria-hidden /> {c.toVerify} to verify
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AllStudents() {
  const scope = useStaffScope();
  const [allStudents] = useStaffStudents();
  const [sessions] = useSessions();
  const [owner, setOwner] = useState('all');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('all');
  // Counsellors see only students assigned to them (and anyone they're covering for); admins see all.
  // A staff member "has" a student as their counsellor, Financial Aid Officer or Visa Officer.
  const hasStudent = (id: string) => (s: StaffStudent) => s.counsellorId === id || s.financeOfficerId === id || s.visaOfficerId === id;
  const students = scope.filterStudents(allStudents).filter((s) => owner === 'all' || (owner === 'unassigned' ? !s.counsellorId : hasStudent(owner)(s)));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => group === 'all' || groupOf(s.stage) === group)
      .filter((s) => !q || [s.name, s.reference, s.email, s.goal, s.destination].some((v) => v.toLowerCase().includes(q)));
  }, [students, query, group]);

  const count = (g: Exclude<Group, 'all'>) => students.filter((s) => groupOf(s.stage) === g).length;

  return (
    <>
      <PageHeader
        title={scope.isAdmin ? 'Students' : 'My students'}
        description={scope.isAdmin ? 'All registered students and their counsellors.' : 'Registered students assigned to you.'}
      />
      {(scope.isAdmin || scope.covering.length > 0) && (
        <div className="mb-4">
          <FilterChips
            label="Filter by staff"
            value={owner}
            onChange={setOwner}
            options={[
              { value: 'all', label: scope.isAdmin ? 'All staff' : 'All', count: scope.filterStudents(allStudents).length },
              ...counsellors
                .filter((c) => scope.canSee(c.id) && (c.active !== false || allStudents.some(hasStudent(c.id))))
                .map((c) => ({
                  value: c.id,
                  label: c.id === scope.myId ? 'Mine' : (c.role ?? 'counsellor') === 'counsellor' ? c.name : `${c.name} (${c.role === 'finance_officer' ? 'Financial Aid' : 'Visa'})`,
                  count: allStudents.filter(hasStudent(c.id)).length,
                })),
              // Waiting for the admin to assign a counsellor (or still completing their profile).
              ...(scope.isAdmin ? [{ value: 'unassigned', label: 'No counsellor yet', count: allStudents.filter((s) => !s.counsellorId).length }] : []),
            ]}
          />
        </div>
      )}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, reference, course…" />
        <FilterChips<Group>
          label="Filter by journey"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'All', count: students.length },
            { value: 'preparing', label: 'Preparing', count: count('preparing') },
            { value: 'applying', label: 'Applying', count: count('applying') },
            { value: 'visa', label: 'Visa', count: count('visa') },
            { value: 'abroad', label: 'Abroad', count: count('abroad') },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState>No students match your search.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => {
            const pending = s.documents.filter((d) => d.state === 'pending').length;
            const values = serviceValues(computeServices(s, sessions));
            return (
              <li key={s.id}>
                <Link to={`/staff/students/${s.id}`} className="card group block h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy-900 group-hover:text-gold-700">{s.name}</p>
                      <p className="text-xs text-navy-400">{s.reference}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-gold-600" aria-hidden />
                  </div>
                  {(scope.isAdmin || s.counsellorId !== scope.myId) && (
                    <p className={s.counsellorId !== scope.myId && !scope.isAdmin ? 'mt-2 text-xs font-semibold text-sky-700' : 'mt-2 text-xs text-navy-500'}>
                      {s.counsellorId !== scope.myId && !scope.isAdmin
                        ? `Covering for ${counsellorName(s.counsellorId)}`
                        : s.counsellorId
                          ? `Counsellor: ${counsellorName(s.counsellorId)}`
                          : 'No counsellor yet'}
                    </p>
                  )}
                  {scope.isAdmin && (s.financeOfficerId || s.visaOfficerId) && (
                    <p className="text-xs text-navy-500">
                      {[s.financeOfficerId && `Financial Aid: ${counsellorName(s.financeOfficerId)}`, s.visaOfficerId && `Visa: ${counsellorName(s.visaOfficerId)}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-navy-700">{s.goal} · {s.destination}</p>
                  <p className="text-xs text-navy-500">{s.intake}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Pill tone="blue">{stageLabel(s.stage)}</Pill>
                    {pending > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                        <FileSearch className="h-3 w-3" aria-hidden /> {pending} to verify
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <ServiceBar values={values} names={serviceShortNames} />
                    <p className="mt-1.5 text-xs text-navy-400">{values.filter((v) => v === 2).length} of {values.filter((v) => v !== 3).length} services completed</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
