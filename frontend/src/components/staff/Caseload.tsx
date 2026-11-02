import { Link } from 'react-router-dom';
import { ChevronRight, FolderKanban } from 'lucide-react';
import { Pill } from '../dashboard/Panel';
import { AllClear, Section } from './TodayParts';
import type { StaffStudent } from '../../data/staff';
import type { OfficerCase } from '../../lib/officerCase';
import { cn, initials } from '../../lib/utils';

export interface CaseRow {
  student: StaffStudent;
  c: OfficerCase;
}

/** "My caseload": the students someone looks after and what each needs from them, most urgent first. */
export function Caseload({ cases, groups, filter, onFilter }: { cases: CaseRow[]; groups: { value: string; label: string }[]; filter: string; onFilter: (value: string) => void }) {
  const needsMe = cases.filter((x) => x.c.urgency === 2).length;
  const shown = cases.filter((x) => filter === 'all' || (filter === 'action' ? x.c.urgency === 2 : x.c.group === filter));
  const filters = [
    { value: 'all', label: 'All', count: cases.length },
    { value: 'action', label: 'Needs you', count: needsMe },
    ...groups.map((g) => ({ ...g, count: cases.filter((x) => x.c.group === g.value).length })),
  ];

  return (
    <Section
      id="caseload"
      title={`My caseload · ${cases.length}`}
      icon={FolderKanban}
      action={
        <Link to="/staff/students" className="text-xs font-semibold text-navy-500 hover:text-navy-900">
          All students
        </Link>
      }
    >
      {cases.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-navy-100 px-4 py-3" role="tablist" aria-label="Filter caseload">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => onFilter(f.value)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                filter === f.value ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50',
              )}
              data-case-filter={f.value}
            >
              {f.label}
              <span className={cn('text-[11px]', filter === f.value ? 'text-navy-200' : f.value === 'action' && f.count ? 'font-bold text-amber-700' : 'text-navy-400')}>{f.count}</span>
            </button>
          ))}
        </div>
      )}
      {cases.length === 0 ? (
        <AllClear>No students assigned to you yet</AllClear>
      ) : shown.length === 0 ? (
        <AllClear>Nothing here</AllClear>
      ) : (
        <ul className="max-h-[36rem] divide-y divide-navy-100 overflow-y-auto" aria-label="Caseload">
          {shown.map(({ student: s, c }) => (
            <li key={s.id}>
              <Link to={`/staff/students/${s.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-ivory/60" data-case={s.id}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{initials(s.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-semibold text-navy-900 group-hover:text-gold-700">{s.name}</span>
                    <Pill tone={c.tone}>{c.phase}</Pill>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-navy-400">
                    {s.destination} · {s.intake}
                  </span>
                  <span className={cn('mt-2 flex items-center gap-1.5 text-sm', c.urgency === 2 ? 'font-semibold text-navy-900' : 'text-navy-600')}>
                    {c.urgency === 2 && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Needs you" />}
                    <span>{c.next}</span>
                  </span>
                  {c.detail && <span className="mt-0.5 block text-xs text-navy-400">{c.detail}</span>}
                </span>
                <span className="hidden w-24 shrink-0 sm:block" aria-label={`${Math.round(c.progress * 100)}% through`}>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-navy-100">
                    <span className={cn('block h-full rounded-full', c.progress >= 1 ? 'bg-emerald-500' : 'bg-sky-500')} style={{ width: `${Math.round(c.progress * 100)}%` }} />
                  </span>
                  <span className="mt-1 block text-right text-[11px] text-navy-400">{Math.round(c.progress * 100)}%</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-gold-600" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
