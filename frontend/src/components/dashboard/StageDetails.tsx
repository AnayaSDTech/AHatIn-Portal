import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { StageSteps, StepState } from '../../lib/journeySteps';
import { cn } from '../../lib/utils';

/** The marker on the step line: a tick when done, a pulsing dot for the current step, an empty ring for later ones. */
function Marker({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === 'now') {
    return (
      <span className="relative grid h-5 w-5 place-items-center rounded-full bg-sky-100 ring-2 ring-sky-500">
        <span className="absolute h-2 w-2 animate-ping rounded-full bg-sky-400 opacity-60" aria-hidden />
        <span className="h-2 w-2 rounded-full bg-sky-600" aria-hidden />
      </span>
    );
  }
  return <span className="block h-5 w-5 rounded-full border-2 border-navy-200 bg-white" />;
}

const stateText: Record<StepState, string> = { done: 'Done', now: 'In progress', next: 'Coming up' };

/**
 * "View details" under a stage of the student's progress tracker: the stage's steps in order (done, in progress,
 * coming up), plus anything that belongs to it, such as the career plan or the applications.
 */
export function StageDetails({ code, steps, label = 'View details', extra }: { code: string; steps: StageSteps; label?: string; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const list = steps.steps;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900"
        data-stage-details={code}
      >
        {open ? label.replace(/^View/, 'Hide') : label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="mt-3 animate-fade-up rounded-2xl border border-navy-100 bg-white p-4 sm:p-5" data-stage-panel={code}>
          <ol className="relative" aria-label="Steps">
            {list.map((s, i) => {
              const last = i === list.length - 1;
              return (
                <li key={s.label} className={cn('relative flex gap-3', !last && 'pb-4')} data-step-state={s.state}>
                  {!last && <span className={cn('absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-0.5 rounded-full', s.state === 'done' ? 'bg-emerald-200' : 'bg-navy-100')} aria-hidden />}
                  <span className="relative z-10 mt-0.5 shrink-0">
                    <Marker state={s.state} />
                  </span>
                  <div className={cn('min-w-0 flex-1', s.state === 'now' && '-my-1 rounded-xl bg-sky-50/70 px-3 py-1.5')}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className={cn('text-sm leading-snug', s.state === 'next' ? 'text-navy-500' : 'font-medium text-navy-900')}>
                        {s.label}
                        <span className="sr-only"> ({stateText[s.state]})</span>
                      </p>
                      {s.state === 'now' ? (
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700" aria-hidden>
                          In progress
                        </span>
                      ) : (
                        s.detail && <span className="text-xs text-navy-400">{s.detail}</span>
                      )}
                    </div>
                    {s.state === 'now' && s.detail && <p className="text-xs text-sky-800/80">{s.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          {steps.list && (
            <div className="mt-5 border-t border-navy-100 pt-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-navy-400">{steps.list.title}</p>
              <ul className="space-y-2.5">
                {steps.list.rows.map((r) => (
                  <li key={r.label} className="flex items-start gap-2.5 text-sm">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.done ? 'bg-emerald-500' : 'bg-sky-500')} aria-hidden />
                    <span className="min-w-0 flex-1 leading-snug text-navy-800">
                      {r.label}
                      <span className={cn('ml-2 whitespace-nowrap text-xs font-semibold', r.done ? 'text-emerald-700' : 'text-sky-700')}>{r.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {extra && <div className="mt-5 border-t border-navy-100 pt-4">{extra}</div>}
        </div>
      )}
    </div>
  );
}
