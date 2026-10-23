import { CheckCircle2, Circle, Loader, Route } from 'lucide-react';
import type { ServiceStatus, demoServices } from '../../data/dashboard';
import { cn } from '../../lib/utils';
import { Panel, Pill } from './Panel';

type Service = (typeof demoServices)[number];

const statusMeta: Record<ServiceStatus, { label: string; tone: 'green' | 'blue' | 'grey' }> = {
  completed: { label: 'Completed', tone: 'green' },
  in_progress: { label: 'In progress', tone: 'blue' },
  not_started: { label: 'Not started', tone: 'grey' },
};

export function overallProgress(services: Service[]) {
  const score = services.reduce((s, x) => s + (x.status === 'completed' ? 1 : x.status === 'in_progress' ? 0.5 : 0), 0);
  return Math.round((score / services.length) * 100);
}

export function ServiceTracker({ services }: { services: Service[] }) {
  return (
    <Panel title="Application progress" icon={<Route className="h-4 w-4" aria-hidden />}>
      <ol className="relative">
        {services.map((s, i) => {
          const meta = statusMeta[s.status];
          const last = i === services.length - 1;
          return (
            <li key={s.code} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && (
                <span
                  className={cn('absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5', s.status === 'completed' ? 'bg-emerald-300' : 'bg-navy-100')}
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
                ) : (
                  <Circle className="h-8 w-8 text-navy-200" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn('font-semibold', s.status === 'not_started' ? 'text-navy-400' : 'text-navy-900')}>{s.title}</p>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                </div>
                <p className="mt-1 text-sm text-navy-500">{s.summary}</p>
                {s.next && (
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
