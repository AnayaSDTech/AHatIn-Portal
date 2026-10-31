import type { CareerPlan } from '../../lib/journey';
import { useCareerOptions } from '../staff/CareerPlanFields';
import { cn, formatDate } from '../../lib/utils';

/** The career plan agreed with the counsellor, shown in the details of Career Counselling in the student's progress tracker. */
export function CareerPlanSummary({ plan }: { plan: CareerPlan }) {
  const options = useCareerOptions();
  // Plans recorded before the structured form only have a one-line summary, already shown above.
  if (!plan.direction) return null;

  const rows = [
    { label: 'Career direction', value: options.directions.find((d) => d.key === plan.direction)?.label ?? plan.direction },
    { label: 'Course', value: plan.course === options.otherCourse ? 'Other (see notes)' : plan.course },
    { label: 'Study level', value: options.levels.find((l) => l.key === plan.level)?.label ?? plan.level },
    { label: 'Destinations', value: plan.destinations?.join(', ') },
    { label: 'Notes from your counsellor', value: plan.notes, wide: true },
  ].filter((r) => r.value);

  return (
    <div data-student-career-plan>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">Your career plan</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className={cn(r.wide && 'sm:col-span-2')}>
            <dt className="text-xs text-navy-500">{r.label}</dt>
            <dd className="font-medium text-navy-900">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-navy-400">
        Agreed with {plan.by} on {formatDate(plan.at)}
        {plan.updatedAt && ` · updated ${formatDate(plan.updatedAt)}`}
      </p>
    </div>
  );
}
