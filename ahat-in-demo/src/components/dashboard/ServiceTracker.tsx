import { CheckCircle2, Circle, Loader, MinusCircle, Route } from 'lucide-react';
import { serviceStatusLabel, type ServiceStatus, type ServiceView } from '../../lib/journey';
import { cn } from '../../lib/utils';
import { Panel, Pill } from './Panel';

const tone: Record<ServiceStatus, 'green' | 'blue' | 'grey'> = {
  completed: 'green',
  in_progress: 'blue',
  not_started: 'grey',
  not_needed: 'grey',
};

/** The student's seven services. Statuses come from real events in the shared record, never typed in. */
export function ServiceTracker({ services }: { services: ServiceView[] }) {
  return (
    <Panel id="progress" title="Application progress" icon={<Route className="h-4 w-4" aria-hidden />}>
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
                  <p className={cn('font-semibold', muted ? 'text-navy-400' : 'text-navy-900')}>{s.title}</p>
                  <Pill tone={tone[s.status]}>{serviceStatusLabel[s.status]}</Pill>
                </div>
                <p className="mt-1 text-sm text-navy-500">{s.summary}</p>
                {s.next && s.status !== 'completed' && (
                  <p className="mt-2 inline-flex rounded-lg bg-gold-50 px-3 py-1.5 text-xs font-medium text-gold-700">Next: {s.next}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
