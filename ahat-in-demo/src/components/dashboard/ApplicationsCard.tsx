import { useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, Info, School } from 'lucide-react';
import { offerConditions, type AppStatus, demoApplications } from '../../data/dashboard';
import { cn, daysUntil, formatDate } from '../../lib/utils';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type Application = (typeof demoApplications)[number];

const statusMeta: Record<AppStatus, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'grey' | 'gold' }> = {
  draft: { label: 'Being prepared', tone: 'grey' },
  submitted: { label: 'Submitted', tone: 'blue' },
  under_review: { label: 'Under review', tone: 'amber' },
  conditional_offer: { label: 'Conditional offer', tone: 'gold' },
  unconditional_offer: { label: 'Unconditional offer', tone: 'green' },
  accepted: { label: 'Offer accepted', tone: 'green' },
  declined: { label: 'Offer declined', tone: 'grey' },
  rejected: { label: 'Unsuccessful', tone: 'red' },
};

const isOffer = (s: AppStatus) => s === 'conditional_offer' || s === 'unconditional_offer';

interface Props {
  applications: Application[];
  onChange: (applications: Application[]) => void;
}

export function ApplicationsCard({ applications, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(applications.find((a) => isOffer(a.status))?.id ?? null);
  const [decision, setDecision] = useState<{ app: Application; action: 'accept' | 'decline' } | null>(null);
  const [saving, setSaving] = useState(false);

  const hasAccepted = applications.some((a) => a.status === 'accepted');

  const confirm = async () => {
    if (!decision) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600)); // simulated request
    const next: AppStatus = decision.action === 'accept' ? 'accepted' : 'declined';
    onChange(applications.map((a) => (a.id === decision.app.id ? { ...a, status: next } : a)));
    setSaving(false);
    setDecision(null);
  };

  return (
    <Panel id="applications" title="My applications" icon={<School className="h-4 w-4" aria-hidden />}>
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-navy-50/70 px-4 py-3 text-xs text-navy-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Your counsellor submits applications and updates their status. You can follow progress here and accept or decline offers.
      </p>

      <ul className="divide-y divide-navy-100">
        {applications.map((a) => {
          const meta = statusMeta[a.status];
          const days = daysUntil(a.deadline);
          const open = expanded === a.id;
          const conditions = offerConditions[a.id] ?? [];
          const canDecide = isOffer(a.status) && !hasAccepted;
          return (
            <li key={a.id} className="py-4 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : a.id)}
                aria-expanded={open}
                className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-navy-900">{a.university}</span>
                  <span className="block text-sm text-navy-500">
                    {a.course} · via {a.agency}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="flex flex-col items-start gap-1.5 sm:items-end">
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                    {!['accepted', 'declined', 'rejected'].includes(a.status) && (
                      <span className={days <= 10 ? 'text-xs font-semibold text-red-600' : 'text-xs text-navy-400'}>
                        {isOffer(a.status) ? 'Reply by' : 'Deadline'} {formatDate(a.deadline)}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-navy-400 transition-transform', open && 'rotate-180')} aria-hidden />
                </span>
              </button>

              {open && (
                <div className="mt-4 animate-fade-up rounded-2xl bg-ivory p-4 text-sm">
                  {isOffer(a.status) || a.status === 'accepted' ? (
                    <>
                      {conditions.length > 0 && (
                        <>
                          <p className="font-semibold text-navy-900">Offer conditions</p>
                          <ul className="mt-2 space-y-2">
                            {conditions.map((c) => (
                              <li key={c.text} className="flex items-start gap-2 text-navy-700">
                                {c.met ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-navy-300" aria-hidden />
                                )}
                                <span>
                                  {c.text} <span className="text-xs text-navy-400">({c.met ? 'met' : 'pending'})</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {canDecide && (
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <Button size="sm" variant="gold" onClick={() => setDecision({ app: a, action: 'accept' })}>
                            Accept offer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDecision({ app: a, action: 'decline' })}>
                            Decline
                          </Button>
                        </div>
                      )}
                      {a.status === 'accepted' && (
                        <p className="mt-3 font-medium text-emerald-700">
                          You've accepted this offer. Your counsellor will guide you through the deposit and visa next.
                        </p>
                      )}
                      {isOffer(a.status) && hasAccepted && (
                        <p className="mt-3 text-navy-500">You've already accepted another offer for this intake.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-navy-600">
                      {a.status === 'draft' && 'Your counsellor is preparing this application. Make sure your documents are uploaded.'}
                      {a.status === 'submitted' && 'Submitted to the university. Decisions usually take 2–6 weeks.'}
                      {a.status === 'under_review' && 'The university is reviewing your application. We will tell you as soon as there is news.'}
                      {a.status === 'declined' && 'You declined this offer.'}
                      {a.status === 'rejected' && 'This application was not successful. Talk to your counsellor about next steps.'}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
