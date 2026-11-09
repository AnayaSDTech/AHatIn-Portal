import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, Check, CheckCircle2, ChevronDown, Circle, Clock, FileText, ListChecks, MapPin, MessageCircle, PiggyBank, Plane, Plus, ShieldCheck, Stamp, Trash2, Wallet, XCircle } from 'lucide-react';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { UniversityBadge } from './UniversityBadge';
import type { StaffStudent } from '../../data/staff';
import type { useStudentActions } from '../../hooks/useJourney';
import { DEPARTURE_TASKS, FUNDING_SOURCES, VISA_PATH, isNewOption, scholarshipStatusLabel, visaStageLabel, type ShortlistItem } from '../../lib/journey';
import { cn, formatDate, formatDateTime } from '../../lib/utils';

type Actions = ReturnType<typeof useStudentActions>;

const lakh = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} lakh`;

/* ------------------------------ Shortlist ------------------------------ */

function ShortlistOption({ item, editable, isNew, actions }: { item: ShortlistItem; editable: boolean; isNew: boolean; actions: Actions }) {
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ask = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 3) return;
    actions.commentOnItem(item.id, question.trim());
    setQuestion('');
    setAsking(false);
  };

  return (
    <li className={cn('rounded-2xl border p-4', item.choice === 'apply' ? 'border-emerald-200 bg-emerald-50/30' : item.choice === 'removed' ? 'border-navy-100 bg-navy-50/40' : 'border-navy-100')} data-option={item.university}>
      <div className="flex items-start gap-3">
        <UniversityBadge name={item.university} muted={item.choice === 'removed'} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={cn('font-semibold leading-snug', item.choice === 'removed' ? 'text-navy-400 line-through' : 'text-navy-900')}>{item.university}</p>
            <p className="text-sm text-navy-600">{item.course}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-navy-400">
              <MapPin className="h-3 w-3" aria-hidden /> {item.country} · {item.intake}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {item.choice === 'apply' && <Pill tone="green">Apply</Pill>}
            {item.choice === 'removed' && <Pill tone="grey">Removed</Pill>}
            {isNew && <Pill tone="gold">New</Pill>}
          </div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {item.duration && <Fact label="Duration" value={item.duration} />}
        <Fact label="Tuition" value={item.tuition} />
        <Fact label="Living costs" value={item.livingCost} />
        <Fact label="Apply by" value={formatDate(item.deadline)} />
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-navy-700">{item.reason}</p>
      {/* Only options added before agencies were removed from the form have this. */}
      {item.agency && (
        <p className="mt-2 text-xs text-navy-500">
          Via {item.agency} ·{' '}
          <span className="font-semibold text-navy-700">{item.earnsCommission ? 'AHat earns a commission if you enrol here' : 'AHat earns no commission here'}</span>
        </p>
      )}
      {item.choice === 'removed' && item.removeReason && <p className="mt-2 text-xs text-navy-500">Your reason: {item.removeReason}</p>}

      {item.comments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {item.comments.map((c, i) => (
            <li key={i} className={cn('rounded-xl px-3 py-2 text-xs', c.role === 'student' ? 'bg-white ring-1 ring-navy-100' : 'bg-gold-50')}>
              <span className="font-semibold text-navy-800">{c.role === 'student' ? 'You' : c.by}:</span> {c.text}
              <span className="ml-1 text-navy-400">· {formatDateTime(c.at)}</span>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant={item.choice === 'apply' ? 'primary' : 'outline'} onClick={() => actions.setChoice(item.id, item.choice === 'apply' ? undefined : 'apply')}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> {item.choice === 'apply' ? 'Chosen' : 'Apply here'}
          </Button>
          {item.choice === 'removed' ? (
            <Button size="sm" variant="outline" onClick={() => actions.setChoice(item.id, undefined)}>Undo remove</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setRemoving(true)}>
              <XCircle className="h-4 w-4" aria-hidden /> Remove
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAsking((v) => !v)}>
            <MessageCircle className="h-4 w-4" aria-hidden /> Ask a question
          </Button>
        </div>
      )}
      {asking && (
        <form onSubmit={ask} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`q-${item.id}`} className="sr-only">Your question</label>
          <input id={`q-${item.id}`} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} className="input py-2" placeholder="e.g. Is there a scholarship here?" />
          <Button type="submit" size="sm" disabled={question.trim().length < 3}>Send</Button>
        </form>
      )}

      <Modal
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Remove ${item.university}?`}
        description="Your counsellor will see your reason."
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoving(false)}>Back</Button>
            <Button
              onClick={() => {
                if (reason.trim().length < 3) return setError('Add a short reason.');
                actions.setChoice(item.id, 'removed', reason.trim());
                setRemoving(false);
                setReason('');
                setError(null);
              }}
            >
              Remove option
            </Button>
          </>
        }
      >
        <label htmlFor={`rm-${item.id}`} className="mb-1.5 block text-sm font-medium text-navy-800">Why are you removing it?</label>
        <textarea id={`rm-${item.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="input resize-none" placeholder="e.g. Too expensive for my budget" />
        {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      </Modal>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ivory px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-navy-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-navy-800">{value}</dd>
    </div>
  );
}

export function ShortlistCard({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const [confirming, setConfirming] = useState(false);
  // Once approved, the shortlist shows as a short list; full details on request.
  const [expanded, setExpanded] = useState(false);
  const sl = student.journey.shortlist;
  if (!sl || (sl.status === 'draft' && !sl.firstApprovedAt)) return null;

  const reviewing = sl.status === 'shared';
  const undecided = sl.items.filter((i) => !i.choice).length;
  const added = reviewing ? sl.items.filter((i) => isNewOption(i, sl)).length : 0;
  const chosen = sl.items.filter((i) => i.choice === 'apply');

  return (
    <Panel
      id="shortlist"
      title="Your shortlist"
      icon={<ListChecks className="h-4 w-4" aria-hidden />}
      action={reviewing ? <Pill tone="gold">Waiting for you</Pill> : sl.status === 'approved' ? <Pill tone="green">Approved</Pill> : <Pill tone="grey">Being updated</Pill>}
    >
      {reviewing ? (
        <p className="mb-4 rounded-xl bg-gold-50 px-4 py-3 text-sm text-gold-800">
          {added > 0 && (
            <>
              Your counsellor added {added === 1 ? 'a new option' : `${added} new options`}{sl.firstApprovedAt ? '. Your earlier choices are kept' : ''}.{' '}
            </>
          )}
          {added > 0 && sl.firstApprovedAt
            ? <>Choose <strong>Apply here</strong> or <strong>Remove</strong> for the new {added === 1 ? 'option' : 'options'}, then approve your shortlist again.</>
            : <>Choose <strong>Apply here</strong> or <strong>Remove</strong> for each option, then approve.</>}
        </p>
      ) : sl.status === 'approved' ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-navy-500">
          <span>Approved {formatDate(sl.approvedAt!)}</span>
          <span aria-hidden>·</span>
          <span className="font-semibold text-emerald-700">{chosen.length} chosen to apply</span>
          {sl.items.length > chosen.length && (
            <>
              <span aria-hidden>·</span>
              <span>{sl.items.length - chosen.length} removed</span>
            </>
          )}
        </p>
      ) : (
        <p className="mb-4 text-sm text-navy-600">Being updated by your counsellor.</p>
      )}

      {sl.status === 'approved' && !expanded ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Shortlist summary">
          {sl.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-navy-100 px-3 py-2.5" data-option={item.university}>
              <UniversityBadge name={item.university} muted={item.choice === 'removed'} size="sm" />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-semibold', item.choice === 'removed' ? 'text-navy-400 line-through' : 'text-navy-900')}>{item.university}</span>
                <span className="block truncate text-xs text-navy-500">{item.course} · {item.country}</span>
              </span>
              {item.choice === 'apply' ? <Pill tone="green">Apply</Pill> : <Pill tone="grey">Removed</Pill>}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {sl.items.map((item) => (
            <ShortlistOption key={item.id} item={item} editable={reviewing} isNew={reviewing && isNewOption(item, sl)} actions={actions} />
          ))}
        </ul>
      )}
      {sl.status === 'approved' && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-950">
          {expanded ? 'Show summary' : 'View details'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden />
        </button>
      )}

      {reviewing && (
        <div className="mt-5 flex flex-col items-start gap-2 border-t border-navy-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-navy-600">
            {undecided ? `${undecided} ${undecided === 1 ? 'option' : 'options'} still to decide` : `${chosen.length} chosen to apply`}
          </p>
          <Button variant="gold" disabled={undecided > 0 || chosen.length === 0} onClick={() => setConfirming(true)}>
            Approve shortlist
          </Button>
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Approve your shortlist?"
        description={`${chosen.length} ${chosen.length === 1 ? 'application' : 'applications'} will be prepared`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirming(false)}>Back</Button>
            <Button
              variant="gold"
              onClick={() => {
                const removed = sl.items.filter((i) => i.choice === 'removed');
                actions.approveShortlist(
                  `Apply to: ${chosen.map((i) => i.university).join(', ')}.${removed.length ? ` Removed: ${removed.map((i) => `${i.university} (${i.removeReason})`).join(', ')}.` : ''}`,
                );
                setConfirming(false);
              }}
            >
              Yes, approve
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-navy-700">
          {chosen.map((i) => (
            <li key={i.id}>{i.university} · {i.course}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-navy-500">Your counsellor will prepare and submit these applications. You can follow each one under My applications.</p>
      </Modal>
    </Panel>
  );
}

/* ------------------------------ Funding ------------------------------ */

/** Who looks after funding (and visa, travel and arrival) for this student: the officer once assigned, else the counsellor. */
const financeLead = (s: StaffStudent) => (s.financeOfficerId ? 'Your Financial Aid Officer' : 'Your counsellor');
const visaLead = (s: StaffStudent) => (s.visaOfficerId ? 'Your Visa Officer' : 'Your counsellor');

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-navy-400">{children}</h3>
      {aside}
    </div>
  );
}

function Stat({ label, value, tone = 'text-navy-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-ivory/50 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">{label}</dt>
      <dd className={cn('mt-1 font-display text-2xl leading-none', tone)}>{value}</dd>
    </div>
  );
}

/** A note linking to the document checklist, e.g. how many proof-of-funds documents are verified. */
function DocumentsNote({ label, verified, total }: { label: string; verified: number; total: number }) {
  const all = verified === total;
  return (
    <div className={cn('flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between', all ? 'bg-emerald-50' : 'bg-navy-50/70')}>
      <p className={cn('flex items-center gap-2 text-sm', all ? 'text-emerald-800' : 'text-navy-700')}>
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">{label}:</span> {verified} of {total} verified
        </span>
      </p>
      <Link to="/dashboard/documents" className="inline-flex items-center gap-1 text-xs font-semibold text-navy-800 hover:text-navy-950">
        Open documents <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

export function FundingCard({ student, actions, notNeeded }: { student: StaffStudent; actions: Actions; notNeeded: boolean }) {
  const f = student.journey.funding;
  const [kind, setKind] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const funds = student.documents.filter((d) => d.category === 'funds');
  if (notNeeded || (!f.estimatedCost && !f.sources.length && !f.scholarships.length && !funds.length)) return null;

  const covered = f.sources.reduce((n, x) => n + x.amount, 0);
  const pct = f.estimatedCost ? Math.min(100, Math.round((covered / f.estimatedCost) * 100)) : 0;
  const full = !!f.estimatedCost && covered >= f.estimatedCost;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!kind) return setError('Choose where the money comes from.');
    if (!Number.isFinite(n) || n <= 0 || n > 500) return setError('Enter an amount in lakh, e.g. 12.5');
    actions.addFundingSource(kind, Math.round(n * 10) / 10);
    setKind('');
    setAmount('');
    setError(null);
  };

  return (
    <Panel
      id="funding"
      title="Funding plan"
      icon={<PiggyBank className="h-4 w-4" aria-hidden />}
      action={f.estimatedCost ? <Pill tone={full ? 'green' : 'gold'}>{full ? 'Fully covered' : `${pct}% planned`}</Pill> : undefined}
    >
      {f.estimatedCost ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="Estimated cost of study" value={lakh(f.estimatedCost)} />
            <Stat label="Planned so far" value={lakh(covered)} tone="text-emerald-700" />
            <Stat label="Still to plan" value={full ? '₹0' : lakh(f.estimatedCost - covered)} tone={full ? 'text-emerald-700' : 'text-gold-700'} />
          </dl>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Funding planned">
              <div className={cn('h-full rounded-full transition-all', full ? 'bg-emerald-500' : 'bg-gold-500')} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-semibold text-navy-700">{pct}%</span>
          </div>
          <p className="mt-2 text-xs text-navy-400">Tuition, living costs, visa and travel, estimated by {financeLead(student).replace('Your', 'your')}.</p>
        </>
      ) : (
        <p className="rounded-xl bg-ivory px-4 py-3 text-sm text-navy-600">{financeLead(student)} will estimate your total cost of study.</p>
      )}

      <div className="mt-8">
        <SectionTitle>How you'll pay</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-navy-100">
          {f.sources.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-navy-400">Nothing added yet. Add where your money will come from below.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {f.sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="flex items-center gap-3 text-navy-800">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-50 text-gold-700">
                      <Wallet className="h-4 w-4" aria-hidden />
                    </span>
                    {s.kind}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-navy-900">{lakh(s.amount)}</span>
                    <button type="button" onClick={() => actions.removeFundingSource(s.id)} className="grid h-8 w-8 place-items-center rounded-full text-navy-300 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${s.kind}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="grid gap-2 border-t border-navy-100 bg-ivory/50 p-3 sm:grid-cols-[1fr_9rem_auto]">
            <label className="sr-only" htmlFor="fund-kind">Source</label>
            <select id="fund-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input py-2">
              <option value="">Source of money…</option>
              {FUNDING_SOURCES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="fund-amount">Amount in lakh</label>
            <input id="fund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input py-2" placeholder="₹ lakh" />
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Button>
          </form>
        </div>
        {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      </div>

      {f.scholarships.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Scholarships suggested for you</SectionTitle>
          <ul className="space-y-2">
            {f.scholarships.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border border-navy-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-900 text-gold-400">
                    <Award className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy-900">{s.name}</span>
                    <span className="text-xs text-navy-500">{s.amount} · apply by {formatDate(s.deadline)}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Pill tone={s.status === 'awarded' ? 'green' : s.status === 'applied' ? 'blue' : s.status === 'not_awarded' ? 'grey' : 'gold'}>{scholarshipStatusLabel[s.status]}</Pill>
                  {s.status === 'to_apply' && (
                    <button
                      type="button"
                      onClick={() => actions.setScholarshipStatus(s.id, 'applied')}
                      className="rounded-full border border-navy-100 bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 transition hover:border-navy-200 hover:bg-ivory"
                    >
                      I've applied
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {funds.length > 0 && (
        <div className="mt-8">
          <DocumentsNote label="Proof of funds" verified={funds.filter((d) => d.state === 'verified').length} total={funds.length} />
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------ Visa ------------------------------ */

export function VisaCard({ student, waiting = false }: { student: StaffStudent; /** The stage has started, but there's no visa step yet. */ waiting?: boolean }) {
  const v = student.journey.visa;
  if (!v && waiting) {
    return (
      <Panel id="visa" title="Visa" icon={<Stamp className="h-4 w-4" aria-hidden />} action={<Pill tone="blue">In progress</Pill>}>
        <div className="flex items-start gap-3 rounded-xl bg-sky-50 px-4 py-4 text-sm text-sky-900" data-visa-waiting>
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Waiting for your CAS or admission letter to arrive. Your Visa Officer will take you through the next steps once it does.</p>
        </div>
      </Panel>
    );
  }
  if (!v) return null;
  const decided = v.stage === 'granted' || v.stage === 'refused';
  const current = decided ? VISA_PATH.length : VISA_PATH.indexOf(v.stage);
  const visaDocs = student.documents.filter((d) => d.category === 'visa');
  const steps = [
    ...VISA_PATH.map((stage, i) => ({ key: stage, label: visaStageLabel[stage], state: i < current || (i === current && decided) ? 'done' : i === current ? 'now' : 'next' })),
    { key: 'decision', label: v.stage === 'granted' ? 'Visa granted' : v.stage === 'refused' ? 'Visa refused' : 'Decision', state: v.stage === 'granted' ? 'done' : v.stage === 'refused' ? 'refused' : 'next' },
  ] as const;

  return (
    <Panel
      id="visa"
      title="Visa"
      icon={<Stamp className="h-4 w-4" aria-hidden />}
      action={v.stage === 'granted' ? <Pill tone="green">Granted</Pill> : v.stage === 'refused' ? <Pill tone="red">Refused</Pill> : <Pill tone="blue">In progress</Pill>}
    >
      {/* Across on wide screens, down on phones. */}
      <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex items-center gap-3 lg:flex-col lg:items-center lg:gap-2 lg:px-2 lg:text-center">
            {i < steps.length - 1 && <span className={cn('absolute left-1/2 top-[17px] hidden h-0.5 w-full lg:block', s.state === 'done' ? 'bg-emerald-300' : 'bg-navy-100')} aria-hidden />}
            <span
              className={cn(
                'relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold',
                s.state === 'done' && 'bg-emerald-500 text-white',
                s.state === 'now' && 'bg-navy-900 text-gold-400 ring-4 ring-sky-100',
                s.state === 'next' && 'border-2 border-navy-100 bg-white text-navy-300',
                s.state === 'refused' && 'bg-red-500 text-white',
              )}
            >
              {s.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : s.state === 'refused' ? <XCircle className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-sm leading-snug', s.state === 'next' ? 'text-navy-400' : 'font-medium text-navy-900')}>{s.label}</span>
              {s.state === 'now' && <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-700">Current</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3">
        {v.reference && (
          <p className="flex items-center gap-2 text-sm text-navy-600">
            <FileText className="h-4 w-4 text-navy-400" aria-hidden /> Application reference: <span className="font-semibold text-navy-900">{v.reference}</span>
          </p>
        )}
        {v.stage === 'refused' && v.refusalReason && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {v.refusalReason} {visaLead(student)} will talk you through the next steps.
          </p>
        )}
        {visaDocs.length > 0 && <DocumentsNote label="Visa documents" verified={visaDocs.filter((d) => d.state === 'verified').length} total={visaDocs.length} />}
      </div>
      <p className="mt-4 border-t border-navy-100 pt-3 text-xs text-navy-400">Visa fees and the health surcharge are paid on the official government website. {visaLead(student)} records each step here.</p>
    </Panel>
  );
}

/* ------------------------------ Pre-departure and arrival ------------------------------ */

export function DepartureCard({ student, actions }: { student: StaffStudent; actions: Actions }) {
  const [arriving, setArriving] = useState(false);
  const { departure, arrival, visa } = student.journey;
  if (visa?.stage !== 'granted' && !departure.confirmedAt) return null;
  const done = DEPARTURE_TASKS.filter((t) => departure.done[t.key]).length;
  const locked = !!departure.confirmedAt;
  const pct = Math.round((done / DEPARTURE_TASKS.length) * 100);

  return (
    <Panel
      id="departure"
      title={arrival.arrivedAt ? 'Settling in' : 'Getting ready to travel'}
      icon={arrival.arrivedAt ? <MapPin className="h-4 w-4" aria-hidden /> : <Plane className="h-4 w-4" aria-hidden />}
      action={
        arrival.arrivedAt ? (
          <Pill tone="green">Arrived</Pill>
        ) : locked ? (
          <Pill tone="green">Ready to travel</Pill>
        ) : (
          <Pill tone={done === DEPARTURE_TASKS.length ? 'green' : 'blue'}>
            {done} of {DEPARTURE_TASKS.length} done
          </Pill>
        )
      }
    >
      {!arrival.arrivedAt && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Travel checklist">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-semibold text-navy-700">{pct}%</span>
          </div>
          <p className="mt-2 text-sm text-navy-600">{locked ? `${visaLead(student)} has confirmed you are ready to travel.` : 'Tick each task when it’s done.'}</p>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {DEPARTURE_TASKS.map((t) => {
              const ticked = !!departure.done[t.key];
              return (
                <li key={t.key}>
                  <label
                    className={cn(
                      'flex h-full items-start gap-3 rounded-xl border px-4 py-3 text-sm transition',
                      ticked ? 'border-emerald-200 bg-emerald-50/60 text-navy-800' : 'border-navy-100 bg-white text-navy-700',
                      !locked && 'cursor-pointer hover:border-navy-200',
                    )}
                  >
                    <input type="checkbox" className="peer sr-only" checked={ticked} disabled={locked} onChange={() => actions.toggleDepartureTask(t.key, !ticked)} />
                    <span
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400',
                        ticked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-navy-200 bg-white',
                      )}
                      aria-hidden
                    >
                      {ticked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className={cn(ticked && 'font-medium')}>{t.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          {!locked && done === DEPARTURE_TASKS.length && (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> All done. {visaLead(student)} will check everything and confirm you are ready to travel.
            </p>
          )}
          {locked && (
            <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-navy-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-gold-400">
                  <Plane className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">Landed safely?</p>
                  <p className="text-sm text-navy-200">Let us know you've arrived, so we can check in with you.</p>
                </div>
              </div>
              <Button variant="gold" onClick={() => setArriving(true)}>
                <MapPin className="h-4 w-4" aria-hidden /> I've arrived
              </Button>
            </div>
          )}
        </>
      )}

      {arrival.arrivedAt && (
        <ol className="space-y-3">
          <li className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-navy-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
            <span>
              <span className="font-semibold">You arrived</span> on {formatDate(arrival.arrivedAt)}.
            </span>
          </li>
          {arrival.finalCheckInAt ? (
            <li className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-navy-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
              <span>
                <span className="font-semibold">Final check-in done</span> on {formatDate(arrival.finalCheckInAt)}. Welcome to your new home!
              </span>
            </li>
          ) : (
            <li className="flex items-start gap-3 rounded-xl border border-navy-100 px-4 py-3 text-sm text-navy-600">
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-navy-200" aria-hidden />
              <span>{visaLead(student)} will check in with you during your first months. Book a post-arrival check-in session any time.</span>
            </li>
          )}
        </ol>
      )}

      <Modal
        open={arriving}
        onClose={() => setArriving(false)}
        title="Confirm you've arrived?"
        footer={
          <>
            <Button variant="outline" onClick={() => setArriving(false)}>Not yet</Button>
            <Button
              variant="gold"
              onClick={() => {
                actions.confirmArrival();
                setArriving(false);
              }}
            >
              Yes, I've arrived
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-600">{visaLead(student)} will be told straight away and will check in with you during your first months.</p>
      </Modal>
    </Panel>
  );
}
