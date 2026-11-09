import { useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronDown, Circle, GraduationCap, School } from 'lucide-react';
import type { AppState, StudentApplication } from '../../data/staff';
import { applicationSteps } from '../../lib/journeySteps';
import { cn, daysUntil, formatDate } from '../../lib/utils';
import { Panel, Pill } from './Panel';
import { StepTimeline } from './StageDetails';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { UniversityBadge } from './UniversityBadge';

type Tone = 'green' | 'blue' | 'amber' | 'red' | 'grey' | 'gold';

const statusMeta: Record<AppState, { label: string; tone: Tone }> = {
  draft: { label: 'Being prepared', tone: 'grey' },
  submitted: { label: 'Submitted', tone: 'blue' },
  under_review: { label: 'Under review', tone: 'amber' },
  more_info_requested: { label: 'More information needed', tone: 'amber' },
  interview: { label: 'Interview', tone: 'blue' },
  conditional_offer: { label: 'Conditional offer', tone: 'gold' },
  unconditional_offer: { label: 'Unconditional offer', tone: 'green' },
  accepted: { label: 'Offer accepted', tone: 'green' },
  declined: { label: 'Offer declined', tone: 'grey' },
  rejected: { label: 'Unsuccessful', tone: 'red' },
  withdrawn: { label: 'Withdrawn', tone: 'grey' },
};

const describe: Partial<Record<AppState, string>> = {
  draft: 'Your counsellor is preparing this application.',
  submitted: 'Submitted to the university. Decisions usually take 2–6 weeks.',
  under_review: 'The university is reviewing your application. We will tell you as soon as there is news.',
  more_info_requested: 'The university has asked for more information. Your counsellor will contact you.',
  interview: 'The university would like to interview you. Your counsellor will help you prepare.',
  declined: 'You declined this offer.',
  rejected: 'This application was not successful. Talk to your counsellor about next steps.',
  withdrawn: 'This application was withdrawn.',
};

/** Colour of the progress bar, by status. */
const barTone: Record<Tone, string> = {
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  amber: 'bg-amber-500',
  red: 'bg-red-400',
  grey: 'bg-navy-300',
  gold: 'bg-gold-500',
};

const isOffer = (s: AppState) => s === 'conditional_offer' || s === 'unconditional_offer';
const isFinal = (s: AppState) => ['accepted', 'declined', 'rejected', 'withdrawn'].includes(s);
const isClosed = (s: AppState) => ['declined', 'rejected', 'withdrawn'].includes(s);

/** Offers waiting for a reply first, then applications in progress, then accepted, then closed ones. */
const rank = (s: AppState) => (isOffer(s) ? 0 : s === 'accepted' ? 2 : isClosed(s) ? 3 : 1);

interface Props {
  applications: StudentApplication[];
  onDecide: (appId: string, accept: boolean, university: string) => void;
  /** Applications whose status changed since the student last looked, with the previous status. */
  updated?: Map<string, AppState>;
}

export function ApplicationsCard({ applications, onDecide, updated }: Props) {
  const [expanded, setExpanded] = useState<string | null>(applications.find((a) => isOffer(a.state))?.id ?? null);
  const [decision, setDecision] = useState<{ app: StudentApplication; action: 'accept' | 'decline' } | null>(null);
  const [saving, setSaving] = useState(false);

  const hasAccepted = applications.some((a) => a.state === 'accepted');
  const sorted = useMemo(() => applications.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a.state) - rank(y.a.state) || x.i - y.i).map((x) => x.a), [applications]);

  const confirm = async () => {
    if (!decision) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600)); // simulated request
    onDecide(decision.app.id, decision.action === 'accept', decision.app.university);
    setSaving(false);
    setDecision(null);
  };

  return (
    <Panel
      id="applications"
      title="My applications"
      icon={<School className="h-4 w-4" aria-hidden />}
      action={applications.length > 0 ? <span className="text-xs font-medium text-navy-400">{applications.length === 1 ? '1 application' : `${applications.length} applications`}</span> : undefined}
    >
      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-ivory/50 px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-navy-400 shadow-sm">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 font-semibold text-navy-900">No applications yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">Once your shortlist is agreed, your counsellor prepares your applications and you can follow each one here.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {sorted.map((a) => {
              const meta = statusMeta[a.state];
              const open = expanded === a.id;
              const conditions = a.conditions ?? [];
              const metCount = conditions.filter((c) => c.met).length;
              const canDecide = isOffer(a.state) && !hasAccepted;
              const steps = applicationSteps(a);
              const done = steps.filter((s) => s.state === 'done').length;
              const current = Math.min(steps.length, done + (steps.some((s) => s.state === 'now') ? 1 : 0));
              const closed = isClosed(a.state);
              const urgent = !!a.deadline && !isFinal(a.state) && daysUntil(a.deadline) <= 10;
              const panelId = `app-panel-${a.id}`;
              return (
                <li
                  key={a.id}
                  className={cn(
                    'overflow-hidden rounded-2xl border bg-white transition-shadow',
                    canDecide ? 'border-gold-300 shadow-soft ring-1 ring-gold-200' : a.state === 'accepted' ? 'border-emerald-200' : 'border-navy-100',
                    open && 'shadow-soft',
                  )}
                >
                  {canDecide && (
                    <div className="flex items-center gap-2 bg-gold-50 px-4 py-2 text-xs font-semibold text-gold-700 sm:px-5">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                      Action needed: accept or decline this offer
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : a.id)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="group flex w-full gap-4 p-4 text-left transition hover:bg-ivory/40 sm:p-5"
                  >
                    <UniversityBadge name={a.university} muted={closed} />

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <span className="min-w-0">
                          <span className={cn('flex flex-wrap items-center gap-2 font-semibold leading-snug', closed ? 'text-navy-500' : 'text-navy-900')}>
                            {a.university}
                            {updated?.has(a.id) && (
                              <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-950" data-updated>
                                Updated
                              </span>
                            )}
                          </span>
                          {/* The partner agency is for staff only, so students see just the course. */}
                          <span className="mt-0.5 block text-sm text-navy-500">{a.course}</span>
                          {updated?.has(a.id) && <span className="mt-0.5 block text-xs text-gold-700">Was: {statusMeta[updated.get(a.id)!].label}</span>}
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                          {a.deadline && !isFinal(a.state) && (
                            <span className={cn('inline-flex items-center gap-1 text-xs', urgent ? 'font-semibold text-red-600' : 'text-navy-400')}>
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                              {isOffer(a.state) ? 'Reply by' : 'Deadline'} {formatDate(a.deadline)}
                            </span>
                          )}
                        </span>
                      </span>

                      <span className="mt-3 flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100" aria-hidden>
                          <span
                            className={cn('block h-full rounded-full transition-all', closed ? 'bg-navy-200' : barTone[meta.tone])}
                            style={{ width: `${isFinal(a.state) ? 100 : steps.length ? Math.max(6, (done / steps.length) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-navy-400">
                          {a.state === 'accepted' ? 'Complete' : isFinal(a.state) ? 'Closed' : `Step ${Math.max(1, current)} of ${steps.length}`}
                        </span>
                      </span>

                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-700 group-hover:text-navy-950" data-app-details>
                        {open ? 'Hide details' : 'View details'}
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
                      </span>
                    </span>
                  </button>

                  {open && (
                    <div id={panelId} className="animate-fade-up border-t border-navy-100 bg-ivory/40 p-4 text-sm sm:p-5" data-app-panel={a.university}>
                      <div className="grid gap-6 lg:grid-cols-5">
                        <section className="lg:col-span-3">
                          <SectionLabel>Progress</SectionLabel>
                          <div className="mt-3 rounded-xl border border-navy-100 bg-white p-4">
                            <StepTimeline steps={steps} />
                          </div>
                        </section>

                        <section className="lg:col-span-2">
                          <SectionLabel>{isOffer(a.state) || a.state === 'accepted' ? 'Your offer' : 'Where things stand'}</SectionLabel>
                          <div className="mt-3 rounded-xl border border-navy-100 bg-white p-4">
                            {isOffer(a.state) || a.state === 'accepted' ? (
                              <>
                                {conditions.length > 0 ? (
                                  <>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-semibold text-navy-900">Offer conditions</p>
                                      <span className="text-xs font-medium text-navy-500">
                                        {metCount} of {conditions.length} met
                                      </span>
                                    </div>
                                    <ul className="mt-3 space-y-2.5">
                                      {conditions.map((c) => (
                                        <li key={c.text} className="flex items-start gap-2 text-navy-700">
                                          {c.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" aria-hidden />}
                                          <span>
                                            {c.text} <span className="sr-only">({c.met ? 'met' : 'pending'})</span>
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                ) : (
                                  <p className="text-navy-600">{a.state === 'unconditional_offer' ? 'This offer has no conditions.' : 'No conditions have been added to this offer.'}</p>
                                )}
                                {canDecide && (
                                  <div className="mt-5 flex flex-col gap-2 border-t border-navy-100 pt-4 sm:flex-row">
                                    <Button size="sm" variant="gold" onClick={() => setDecision({ app: a, action: 'accept' })}>
                                      Accept offer
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setDecision({ app: a, action: 'decline' })}>
                                      Decline
                                    </Button>
                                  </div>
                                )}
                                {a.state === 'accepted' && (
                                  <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 font-medium text-emerald-800">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                    You've accepted this offer. Your counsellor will guide you through the deposit and visa next.
                                  </p>
                                )}
                                {isOffer(a.state) && hasAccepted && <p className="mt-4 text-navy-500">You've already accepted another offer for this intake.</p>}
                              </>
                            ) : (
                              <p className="leading-relaxed text-navy-600">{describe[a.state]}</p>
                            )}
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'accept' ? 'Accept this offer?' : 'Decline this offer?'}
        description={decision ? `${decision.app.university} · ${decision.app.course}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Go back
            </Button>
            <Button
              variant={decision?.action === 'accept' ? 'gold' : 'primary'}
              className={decision?.action === 'decline' ? 'bg-red-600 hover:bg-red-700' : undefined}
              loading={saving}
              onClick={confirm}
            >
              {decision?.action === 'accept' ? 'Yes, accept offer' : 'Yes, decline offer'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-navy-600">
          {decision?.action === 'accept'
            ? 'You can accept only one offer per intake. Your counsellor will confirm with the university, explain any deposit, and close your other applications for this intake.'
            : 'Declining is final for this application. If you are unsure, talk to your counsellor first.'}
        </p>
      </Modal>
    </Panel>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-navy-400">{children}</h3>;
}
