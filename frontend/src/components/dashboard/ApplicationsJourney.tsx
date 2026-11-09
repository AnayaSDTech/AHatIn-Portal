import { Check, Compass, ListChecks, School } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StaffStudent } from '../../data/staff';
import { cn, formatDate } from '../../lib/utils';

export type ApplicationsTab = 'career-plan' | 'shortlist' | 'applications';

type State = 'done' | 'action' | 'now' | 'next';

const stateStyle: Record<State, { tile: string; text: string }> = {
  done: { tile: 'bg-emerald-500 text-white', text: 'text-emerald-700' },
  action: { tile: 'bg-gold-500 text-navy-950', text: 'font-semibold text-gold-700' },
  now: { tile: 'bg-navy-900 text-gold-400', text: 'text-sky-700' },
  next: { tile: 'bg-navy-50 text-navy-300', text: 'text-navy-400' },
};

export const shortlistVisible = (s: StaffStudent) => !!s.journey.shortlist && (s.journey.shortlist.status !== 'draft' || !!s.journey.shortlist.firstApprovedAt);

/** The tab to open first: whatever needs the student, else the furthest step reached. */
export function defaultTab(s: StaffStudent): ApplicationsTab {
  if (shortlistVisible(s) && s.journey.shortlist!.status === 'shared') return 'shortlist';
  if (s.applications.length) return 'applications';
  if (shortlistVisible(s)) return 'shortlist';
  return s.journey.careerPlan ? 'career-plan' : 'applications';
}

/**
 * Career plan → shortlist → applications, at the top of the Applications page. Each step is a tab that shows its card
 * at full width, so cards never sit side by side with uneven heights.
 */
export function ApplicationsJourney({ student, active, onSelect }: { student: StaffStudent; active: ApplicationsTab; onSelect: (tab: ApplicationsTab) => void }) {
  const plan = student.journey.careerPlan;
  const sl = student.journey.shortlist;
  const visible = shortlistVisible(student);
  const apps = student.applications;
  const offers = apps.filter((a) => a.state === 'conditional_offer' || a.state === 'unconditional_offer');
  const accepted = apps.find((a) => a.state === 'accepted');
  const chosen = sl?.items.filter((i) => i.choice === 'apply').length ?? 0;

  const steps: { key: ApplicationsTab; icon: ReactNode; title: string; status: string; state: State }[] = [
    {
      key: 'career-plan',
      icon: <Compass className="h-4 w-4" aria-hidden />,
      title: 'Career plan',
      status: plan ? `Agreed ${formatDate(plan.at)}` : 'Agreed in a session with your counsellor',
      state: plan ? 'done' : 'now',
    },
    {
      key: 'shortlist',
      icon: <ListChecks className="h-4 w-4" aria-hidden />,
      title: 'Shortlist',
      status: !visible
        ? 'Your counsellor suggests universities'
        : sl!.status === 'shared'
          ? 'Waiting for your choices'
          : sl!.status === 'approved'
            ? `Approved · ${chosen} chosen`
            : 'Being updated by your counsellor',
      state: !visible ? (plan ? 'now' : 'next') : sl!.status === 'shared' ? 'action' : sl!.status === 'approved' ? 'done' : 'now',
    },
    {
      key: 'applications',
      icon: <School className="h-4 w-4" aria-hidden />,
      title: 'Applications',
      status: accepted
        ? `Offer accepted · ${accepted.university}`
        : offers.length
          ? `${offers.length === 1 ? 'An offer is' : `${offers.length} offers are`} waiting for your reply`
          : apps.length
            ? `${apps.length} ${apps.length === 1 ? 'application' : 'applications'} in progress`
            : 'Prepared once your shortlist is approved',
      state: accepted ? 'done' : offers.length ? 'action' : apps.length ? 'now' : 'next',
    },
  ];

  return (
    <div className="card p-2 sm:p-3">
      <div role="tablist" aria-label="Your application journey" className="grid gap-1 sm:grid-cols-3 sm:gap-2">
        {steps.map((s, i) => {
          const style = stateStyle[s.state];
          const selected = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              id={`tab-${s.key}`}
              aria-selected={selected}
              aria-controls="applications-tabpanel"
              onClick={() => onSelect(s.key)}
              className={cn(
                'relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left ring-1 transition',
                selected ? 'bg-white shadow-soft ring-navy-200' : 'ring-transparent hover:bg-ivory',
                !selected && s.state === 'action' && 'bg-gold-50/60 hover:bg-gold-50',
              )}
            >
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', style.tile)}>
                {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-navy-400">Step {i + 1}</span>
                <span className="block text-sm font-semibold text-navy-900">{s.title}</span>
                <span className={cn('block text-xs', style.text)}>{s.status}</span>
              </span>
              {selected && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-navy-900" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
