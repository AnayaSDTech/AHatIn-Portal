import type { ReactNode } from 'react';
import { ArrowRight, CalendarPlus, Check, FileUp, Minus, Route } from 'lucide-react';
import { overallProgress, serviceStatusLabel, type ServiceCode, type ServiceStatus, type ServiceView } from '../../lib/journey';
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

/** The round marker on the stage line: a tick when done, the stage number otherwise. */
function Marker({ status, n }: { status: ServiceStatus; n: number }) {
  if (status === 'completed') {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white shadow-sm">
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="relative grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-sm font-semibold text-gold-400 shadow-sm ring-4 ring-sky-100">
        {n}
      </span>
    );
  }
  if (status === 'not_needed') {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-navy-200 bg-white text-navy-300">
        <Minus className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-navy-100 bg-white text-sm font-semibold text-navy-300">{n}</span>;
}

const solid = 'inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-navy-700';

/**
 * The stages of the student's journey. Statuses come from real events in the shared record, never typed in.
 * Where the next step is the student's, a button takes them straight to it.
 */
export function ServiceTracker({
  services,
  actions = {},
  details = {},
  links = {},
  documents = {},
  bookings = {},
  intro,
}: {
  services: ServiceView[];
  /** Shown above the stages, e.g. a button to complete the profile before the journey starts. */
  intro?: ReactNode;
  actions?: Partial<Record<ServiceCode, TrackerAction>>;
  /** A link shown beside a service's title, e.g. "View applications". */
  links?: Partial<Record<ServiceCode, TrackerAction>>;
  /** Documents staff requested in a service: a button to the upload list. */
  documents?: Partial<Record<ServiceCode, TrackerAction>>;
  /** A session the student could book for a service, beside its other buttons. */
  bookings?: Partial<Record<ServiceCode, TrackerAction>>;
  /** Extra detail under a service, e.g. the agreed career plan. */
  details?: Partial<Record<ServiceCode, ReactNode>>;
}) {
  const counted = services.filter((s) => s.status !== 'not_needed');
  const completed = counted.filter((s) => s.status === 'completed').length;
  const pct = overallProgress(services);

  return (
    <Panel
      id="progress"
      title="Application progress"
      icon={<Route className="h-4 w-4" aria-hidden />}
      action={
        <span className="whitespace-nowrap text-xs font-medium text-navy-500">
          <span className="font-semibold text-navy-900">{completed}</span> of {counted.length} complete
        </span>
      }
    >
      <div className="-mt-1 mb-6 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-semibold text-navy-700">{pct}%</span>
      </div>

      {intro && <div className="mb-6">{intro}</div>}

      <ol className="relative">
        {services.map((s, i) => {
          const last = i === services.length - 1;
          const current = s.status === 'in_progress';
          const muted = s.status === 'not_started' || s.status === 'not_needed';
          const action = actions[s.code];
          const upload = documents[s.code];
          const booking = bookings[s.code];
          const link = links[s.code];
          const showNext = !!s.next && (s.status !== 'completed' || !!action);
          const hasFooter = showNext || action || upload || booking;
          return (
            <li key={s.code} className={cn('relative flex gap-4', !last && 'pb-4')} data-service={s.code} data-status={s.status}>
              {!last && (
                <span
                  className={cn('absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-0.5 rounded-full', s.status === 'completed' || s.status === 'not_needed' ? 'bg-emerald-200' : 'bg-navy-100')}
                  aria-hidden
                />
              )}
              <span className="relative z-10 shrink-0">
                <Marker status={s.status} n={i + 1} />
              </span>

              <div
                className={cn(
                  'min-w-0 flex-1 rounded-2xl border px-4 py-3.5 transition',
                  current ? 'border-sky-200 bg-sky-50/40 shadow-soft' : muted ? 'border-dashed border-navy-100 bg-transparent' : 'border-navy-100 bg-white',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0">
                    {current && <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Current stage</p>}
                    <p className={cn('font-semibold leading-snug', muted ? 'text-navy-400' : 'text-navy-900')}>{s.title}</p>
                  </div>
                  <Pill tone={tone[s.status]}>{serviceStatusLabel[s.status]}</Pill>
                </div>
                <p className={cn('mt-1 text-sm', muted ? 'text-navy-400' : 'text-navy-600')}>{s.summary}</p>

                {(link || details[s.code]) && (
                  <div className="flex flex-wrap items-center gap-x-5">
                    {details[s.code]}
                    {link && (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:text-navy-900"
                        data-service-link={s.code}
                      >
                        {link.label} <ArrowRight className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </div>
                )}

                {hasFooter && (
                  <div className="mt-3 flex flex-col gap-2.5 border-t border-navy-100/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {showNext ? (
                      <p className="text-xs text-navy-600">
                        <span className="font-semibold text-gold-700">Next: </span>
                        {s.next}
                      </p>
                    ) : (
                      <span />
                    )}
                    {(action || booking || upload) && (
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {action && (
                          <button type="button" onClick={action.onClick} className={solid} data-service-action={s.code}>
                            {action.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        {booking && (
                          <button type="button" onClick={booking.onClick} className={solid} data-service-booking={s.code}>
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> {booking.label}
                          </button>
                        )}
                        {upload && (
                          <button
                            type="button"
                            onClick={upload.onClick}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-2 text-xs font-semibold text-navy-950 shadow-sm transition hover:bg-gold-400"
                            data-service-documents={s.code}
                          >
                            <FileUp className="h-3.5 w-3.5" aria-hidden /> {upload.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
