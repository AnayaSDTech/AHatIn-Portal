import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileSearch } from 'lucide-react';
import { useStaffScope, useStaffStudents } from '../../hooks/useStaffData';
import { EmptyState, FilterChips, PageHeader, SearchBox, ServiceBar } from '../../components/staff/StaffUi';
import { Pill } from '../../components/dashboard/Panel';
import { counsellorName, counsellors, serviceShortNames, stageIndex, stageLabel } from '../../data/staff';

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
  const scope = useStaffScope();
  const [allStudents] = useStaffStudents();
  const [owner, setOwner] = useState('all');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('all');
  // Counsellors see only students assigned to them (and anyone they're covering for); admins see all.
  const students = scope.filterStudents(allStudents).filter((s) => owner === 'all' || s.counsellorId === owner);

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
            label="Filter by counsellor"
            value={owner}
            onChange={setOwner}
            options={[
              { value: 'all', label: scope.isAdmin ? 'All counsellors' : 'All', count: scope.filterStudents(allStudents).length },
              ...counsellors
                .filter((c) => scope.canSee(c.id))
                .map((c) => ({ value: c.id, label: c.id === scope.myId ? 'Mine' : c.name, count: allStudents.filter((s) => s.counsellorId === c.id).length })),
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
                      {s.counsellorId !== scope.myId && !scope.isAdmin ? `Covering for ${counsellorName(s.counsellorId)}` : `Counsellor: ${counsellorName(s.counsellorId)}`}
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
                    <ServiceBar values={s.services} names={serviceShortNames} />
                    <p className="mt-1.5 text-xs text-navy-400">{s.services.filter((v) => v === 2).length} of 7 services completed</p>
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
