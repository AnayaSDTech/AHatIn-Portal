import { useState, type FormEvent } from 'react';
import { CheckCircle2, Circle, ListChecks, MapPin, MessageCircle, PiggyBank, Plane, Stamp, Trash2, XCircle } from 'lucide-react';
import { Panel, Pill } from './Panel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={cn('font-semibold', item.choice === 'removed' ? 'text-navy-400 line-through' : 'text-navy-900')}>{item.university}</p>
          <p className="text-sm text-navy-600">{item.course} · {item.country} · {item.intake}</p>
        </div>
        {item.choice === 'apply' && <Pill tone="green">Apply</Pill>}
        {item.choice === 'removed' && <Pill tone="grey">Removed</Pill>}
        {isNew && <Pill tone="gold">New</Pill>}
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-navy-600 sm:grid-cols-3">
        <div><dt className="inline text-navy-400">Tuition: </dt><dd className="inline font-medium text-navy-800">{item.tuition}</dd></div>
        <div><dt className="inline text-navy-400">Living: </dt><dd className="inline font-medium text-navy-800">{item.livingCost}</dd></div>
        <div><dt className="inline text-navy-400">Apply by: </dt><dd className="inline font-medium text-navy-800">{formatDate(item.deadline)}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-navy-700">{item.reason}</p>
      <p className="mt-2 text-xs text-navy-500">
        Via {item.agency} ·{' '}
        <span className="font-semibold text-navy-700">{item.earnsCommission ? 'AHat earns a commission if you enrol here' : 'AHat earns no commission here'}</span>
      </p>
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
            : <>For each option, choose <strong>Apply here</strong> or <strong>Remove</strong>, and ask about anything you're unsure of. Then approve your shortlist.</>}
        </p>
      ) : sl.status === 'approved' ? (
        <p className="mb-4 text-sm text-navy-600">
          You approved this shortlist on {formatDate(sl.approvedAt!)}. Your counsellor is preparing applications for the {chosen.length} {chosen.length === 1 ? 'option' : 'options'} you chose.
        </p>
      ) : (
        <p className="mb-4 text-sm text-navy-600">Your counsellor is updating your shortlist. You'll be asked to review it again.</p>
      )}

      {sl.status === 'approved' && !expanded ? (
        <ul className="divide-y divide-navy-100" aria-label="Shortlist summary">
          {sl.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5" data-option={item.university}>
              <span className="min-w-0">
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
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-xs font-semibold text-navy-600 underline underline-offset-2 hover:text-navy-900">
          {expanded ? 'Show summary' : 'Show details'}
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

export function FundingCard({ student, actions, notNeeded }: { student: StaffStudent; actions: Actions; notNeeded: boolean }) {
  const f = student.journey.funding;
  const [kind, setKind] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const funds = student.documents.filter((d) => d.category === 'funds');
  if (notNeeded || (!f.estimatedCost && !f.sources.length && !f.scholarships.length && !funds.length)) return null;

  const covered = f.sources.reduce((n, x) => n + x.amount, 0);
  const pct = f.estimatedCost ? Math.min(100, Math.round((covered / f.estimatedCost) * 100)) : 0;

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
    <Panel id="funding" title="Funding plan" icon={<PiggyBank className="h-4 w-4" aria-hidden />}>
      {f.estimatedCost ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm text-navy-600">Estimated total cost of study</p>
            <p className="font-display text-2xl text-navy-900">{lakh(f.estimatedCost)}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-50">
            <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-gold-500')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-navy-500">
            {lakh(covered)} planned · {covered >= f.estimatedCost ? 'fully covered' : `${lakh(f.estimatedCost - covered)} still to plan`}
          </p>
        </>
      ) : (
        <p className="text-sm text-navy-600">Your counsellor will estimate your total cost of study.</p>
      )}

      <h3 className="mt-6 font-sans text-sm font-semibold text-navy-900">How you'll pay</h3>
      {f.sources.length === 0 ? (
        <p className="mt-2 text-sm text-navy-400">Nothing added yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-navy-100">
          {f.sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-navy-700">{s.kind}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold text-navy-900">{lakh(s.amount)}</span>
                <button type="button" onClick={() => actions.removeFundingSource(s.id)} className="text-navy-300 hover:text-red-600" aria-label={`Remove ${s.kind}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
        <label className="sr-only" htmlFor="fund-kind">Source</label>
        <select id="fund-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input py-2">
          <option value="">Source of money…</option>
          {FUNDING_SOURCES.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="fund-amount">Amount in lakh</label>
        <input id="fund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input py-2" placeholder="₹ lakh" />
        <Button type="submit" size="sm">Add</Button>
      </form>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}

      {f.scholarships.length > 0 && (
        <>
          <h3 className="mt-6 font-sans text-sm font-semibold text-navy-900">Scholarships suggested for you</h3>
          <ul className="mt-2 space-y-2">
            {f.scholarships.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-xl bg-ivory px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block font-medium text-navy-900">{s.name}</span>
                  <span className="text-xs text-navy-500">{s.amount} · apply by {formatDate(s.deadline)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Pill tone={s.status === 'awarded' ? 'green' : s.status === 'applied' ? 'blue' : s.status === 'not_awarded' ? 'grey' : 'gold'}>{scholarshipStatusLabel[s.status]}</Pill>
                  {s.status === 'to_apply' && (
                    <button type="button" onClick={() => actions.setScholarshipStatus(s.id, 'applied')} className="text-xs font-semibold text-navy-700 underline underline-offset-2">
                      I've applied
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {funds.length > 0 && (
        <p className="mt-6 rounded-xl bg-navy-50/70 px-4 py-3 text-xs text-navy-600">
          Proof of funds: {funds.filter((d) => d.state === 'verified').length} of {funds.length} verified. Upload them in your{' '}
          <a href="#documents" className="font-semibold text-navy-900 underline underline-offset-2">document checklist</a>.
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------ Visa ------------------------------ */

export function VisaCard({ student }: { student: StaffStudent }) {
  const v = student.journey.visa;
  if (!v) return null;
  const current = v.stage === 'granted' || v.stage === 'refused' ? VISA_PATH.length : VISA_PATH.indexOf(v.stage);
  const visaDocs = student.documents.filter((d) => d.category === 'visa');

  return (
    <Panel id="visa" title="Visa" icon={<Stamp className="h-4 w-4" aria-hidden />} action={v.stage === 'granted' ? <Pill tone="green">Granted</Pill> : v.stage === 'refused' ? <Pill tone="red">Refused</Pill> : <Pill tone="blue">In progress</Pill>}>
      <ol className="space-y-2.5">
        {VISA_PATH.map((stage, i) => (
          <li key={stage} className="flex items-center gap-3 text-sm">
            {i <= current ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-navy-200" aria-hidden />}
            <span className={i <= current ? 'text-navy-900' : 'text-navy-400'}>{visaStageLabel[stage]}</span>
            {i === current && v.stage === stage && <Pill tone="blue">Current</Pill>}
          </li>
        ))}
        <li className="flex items-center gap-3 text-sm">
          {v.stage === 'granted' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden /> : v.stage === 'refused' ? <XCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-navy-200" aria-hidden />}
          <span className={v.stage === 'granted' || v.stage === 'refused' ? 'font-semibold text-navy-900' : 'text-navy-400'}>Decision{v.stage === 'granted' ? ': granted' : v.stage === 'refused' ? ': refused' : ''}</span>
        </li>
      </ol>
      {v.reference && <p className="mt-4 text-xs text-navy-500">Application reference: <span className="font-semibold text-navy-800">{v.reference}</span></p>}
      {v.stage === 'refused' && v.refusalReason && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{v.refusalReason} Your counsellor will talk you through the next steps.</p>}
      {visaDocs.length > 0 && (
        <p className="mt-4 rounded-xl bg-navy-50/70 px-4 py-3 text-xs text-navy-600">
          Visa documents: {visaDocs.filter((d) => d.state === 'verified').length} of {visaDocs.length} verified. Upload them in your{' '}
          <a href="#documents" className="font-semibold text-navy-900 underline underline-offset-2">document checklist</a>.
        </p>
      )}
      <p className="mt-4 text-xs text-navy-400">Visa fees and the health surcharge are paid on the official government website. Your counsellor records each step here.</p>
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

  return (
    <Panel id="departure" title={arrival.arrivedAt ? 'Settling in' : 'Getting ready to travel'} icon={arrival.arrivedAt ? <MapPin className="h-4 w-4" aria-hidden /> : <Plane className="h-4 w-4" aria-hidden />}>
      {!arrival.arrivedAt && (
        <>
          <p className="text-sm text-navy-600">{locked ? 'Your counsellor has confirmed you are ready to travel.' : `Tick each task when it's done (${done} of ${DEPARTURE_TASKS.length}).`}</p>
          <ul className="mt-4 space-y-2">
            {DEPARTURE_TASKS.map((t) => (
              <li key={t.key}>
                <label className={cn('flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm', departure.done[t.key] ? 'bg-emerald-50/60 text-navy-800' : 'bg-ivory text-navy-700', !locked && 'cursor-pointer')}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" checked={!!departure.done[t.key]} disabled={locked} onChange={() => actions.toggleDepartureTask(t.key, !departure.done[t.key])} />
                  {t.label}
                </label>
              </li>
            ))}
          </ul>
          {!locked && done === DEPARTURE_TASKS.length && <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">All done. Your counsellor will check everything and confirm you are ready to travel.</p>}
          {locked && (
            <div className="mt-5 flex flex-col items-start gap-3 border-t border-navy-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-navy-600">Landed? Let us know you've arrived safely.</p>
              <Button variant="gold" onClick={() => setArriving(true)}>
                <MapPin className="h-4 w-4" aria-hidden /> I've arrived
              </Button>
            </div>
          )}
        </>
      )}
      {arrival.arrivedAt && (
        <div className="space-y-2 text-sm text-navy-700">
          <p className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden /> You arrived on {formatDate(arrival.arrivedAt)}.</p>
          {arrival.finalCheckInAt ? (
            <p className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden /> Final check-in done on {formatDate(arrival.finalCheckInAt)}. Welcome to your new home!</p>
          ) : (
            <p className="text-navy-500">Your counsellor will check in with you during your first months. Book a post-arrival check-in session any time.</p>
          )}
        </div>
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
        <p className="text-sm text-navy-600">Your counsellor will be told straight away and will check in with you during your first months.</p>
      </Modal>
    </Panel>
  );
}
