import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CareerPlan } from '../../lib/journey';
import { useCareerOptions } from '../staff/CareerPlanFields';
import { cn, formatDate } from '../../lib/utils';

/** The career plan agreed with the counsellor, opened from the student's progress tracker. */
export function CareerPlanDetails({ plan }: { plan: CareerPlan }) {
  const [open, setOpen] = useState(false);
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
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900"
      >
        {open ? 'Hide career plan' : 'View career plan'}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 animate-fade-up rounded-2xl bg-ivory p-4 text-sm" data-student-career-plan>
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
      )}
    </div>
  );
}
