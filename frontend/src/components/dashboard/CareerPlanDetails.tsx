import type { ReactNode } from 'react';
import { BookOpen, Compass, GraduationCap, MapPin, Target } from 'lucide-react';
import type { CareerPlan } from '../../lib/journey';
import { useCareerOptions } from '../staff/CareerPlanFields';
import { cn, formatDate } from '../../lib/utils';
import { Panel, Pill } from './Panel';

/**
 * The career plan agreed with the counsellor: in the details of Career Counselling in the student's progress tracker,
 * and as its own card on the Applications page.
 */
export function CareerPlanSummary({ plan, heading = true }: { plan: CareerPlan; heading?: boolean }) {
  const options = useCareerOptions();

  // Plans recorded before the structured form only have a one-line summary.
  const rows = plan.direction
    ? [
        { label: 'Career direction', value: options.directions.find((d) => d.key === plan.direction)?.label ?? plan.direction },
        { label: 'Course', value: plan.course === options.otherCourse ? 'Other (see notes)' : plan.course },
        { label: 'Study level', value: options.levels.find((l) => l.key === plan.level)?.label ?? plan.level },
        { label: 'Destinations', value: plan.destinations?.join(', ') },
        { label: 'Notes from your counsellor', value: plan.notes, wide: true },
      ].filter((r) => r.value)
    : [{ label: 'Your plan', value: plan.summary, wide: true }];

  return (
    <div data-student-career-plan>
      {heading && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-400">Your career plan</p>}
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

/** "Your career plan" on the Applications page: a compact card beside the shortlist and applications it leads to. */
export function CareerPlanCard({ plan }: { plan: CareerPlan }) {
  const options = useCareerOptions();
  const rows: { icon: ReactNode; label: string; value?: string }[] = plan.direction
    ? [
        { icon: <Target className="h-4 w-4" aria-hidden />, label: 'Career direction', value: options.directions.find((d) => d.key === plan.direction)?.label ?? plan.direction },
        { icon: <BookOpen className="h-4 w-4" aria-hidden />, label: 'Course', value: plan.course === options.otherCourse ? 'Other (see notes)' : plan.course },
        { icon: <GraduationCap className="h-4 w-4" aria-hidden />, label: 'Study level', value: options.levels.find((l) => l.key === plan.level)?.label ?? plan.level },
        { icon: <MapPin className="h-4 w-4" aria-hidden />, label: 'Destinations', value: plan.destinations?.join(', ') },
      ].filter((r) => r.value)
    : [];
  return (
    <Panel id="career-plan" title="Your career plan" icon={<Compass className="h-4 w-4" aria-hidden />} action={<Pill tone="green">Agreed</Pill>}>
      <div data-student-career-plan>
        {rows.length > 0 ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-3 rounded-xl border border-navy-100 p-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold-50 text-gold-700">{r.icon}</span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">{r.label}</dt>
                  <dd className="text-sm font-medium text-navy-900">{r.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-navy-800">{plan.summary}</p>
        )}
        {plan.direction && plan.notes && (
          <figure className="mt-4 rounded-xl border-l-2 border-gold-400 bg-ivory px-4 py-3">
            <figcaption className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Notes from your counsellor</figcaption>
            <blockquote className="mt-1 text-sm leading-relaxed text-navy-700">{plan.notes}</blockquote>
          </figure>
        )}
        <p className="mt-4 border-t border-navy-100 pt-3 text-xs text-navy-400">
          Agreed with {plan.by} on {formatDate(plan.at)}
          {plan.updatedAt && ` · updated ${formatDate(plan.updatedAt)}`}
        </p>
      </div>
    </Panel>
  );
}
