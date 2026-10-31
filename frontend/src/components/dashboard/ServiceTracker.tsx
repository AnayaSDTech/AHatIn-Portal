import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Circle, Loader, MinusCircle, Route } from 'lucide-react';
import { serviceStatusLabel, type ServiceCode, type ServiceStatus, type ServiceView } from '../../lib/journey';
import { cn } from '../../lib/utils';
import { Panel, Pill } from './Panel';

const tone: Record<ServiceStatus, 'green' | 'blue' | 'grey'> = {
  completed: 'green',
  in_progress: 'blue',
  not_started: 'grey',
  not_needed: 'grey',
};

/** Something the student can do now for a service, e.g. book a session. */
export interface TrackerAction {
  label: string;
  onClick: () => void;
}

/**
 * The stages of the student's journey. Statuses come from real events in the shared record, never typed in.
 * Where the next step is the student's, a button takes them straight to it.
 */
export function ServiceTracker({
  services,
  actions = {},
  details = {},
  links = {},
  intro,
}: {
  services: ServiceView[];
  /** Shown above the stages, e.g. a button to complete the profile before the journey starts. */
  intro?: ReactNode;
  actions?: Partial<Record<ServiceCode, TrackerAction>>;
  /** A link shown beside a service's title, e.g. "View applications". */
  links?: Partial<Record<ServiceCode, TrackerAction>>;
  /** Extra detail under a service, e.g. the agreed career plan. */
  details?: Partial<Record<ServiceCode, ReactNode>>;
}) {
  return (
    <Panel id="progress" title="Application progress" icon={<Route className="h-4 w-4" aria-hidden />}>
      {intro && <div className="mb-6">{intro}</div>}
      <ol className="relative">
        {services.map((s, i) => {
          const last = i === services.length - 1;
          const muted = s.status === 'not_started' || s.status === 'not_needed';
          return (
            <li key={s.code} className="relative flex gap-4 pb-6 last:pb-0" data-service={s.code} data-status={s.status}>
              {!last && (
                <span
                  className={cn('absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5', s.status === 'completed' || s.status === 'not_needed' ? 'bg-emerald-300' : 'bg-navy-100')}
                  aria-hidden
                />
              )}
              <span className="relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white">
                {s.status === 'completed' ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden />
                ) : s.status === 'in_progress' ? (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-100">
                    <Loader className="h-4 w-4 animate-[spin_3s_linear_infinite] text-sky-600" aria-hidden />
                  </span>
                ) : s.status === 'not_needed' ? (
                  <MinusCircle className="h-8 w-8 text-navy-300" aria-hidden />
                ) : (
                  <Circle className="h-8 w-8 text-navy-200" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold', muted ? 'text-navy-400' : 'text-navy-900')}>
                    {s.title}
                    {links[s.code] && (
                      <button
                        type="button"
                        onClick={links[s.code]!.onClick}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 underline underline-offset-2 hover:text-navy-900"
                        data-service-link={s.code}
                      >
                        {links[s.code]!.label} <ArrowRight className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </p>
                  <Pill tone={tone[s.status]}>{serviceStatusLabel[s.status]}</Pill>
                </div>
                <p className="mt-1 text-sm text-navy-500">{s.summary}</p>
                {details[s.code]}
                {(() => {
                  const action = actions[s.code];
                  const showNext = !!s.next && (s.status !== 'completed' || !!action);
                  if (!showNext && !action) return null;
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {showNext && <p className="inline-flex rounded-lg bg-gold-50 px-3 py-1.5 text-xs font-medium text-gold-700">Next: {s.next}</p>}
                      {action && (
                        <button
                          type="button"
                          onClick={action.onClick}
                          className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-700"
                          data-service-action={s.code}
                        >
                          {action.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
