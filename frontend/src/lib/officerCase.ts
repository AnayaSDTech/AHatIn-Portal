import { PiggyBank, Plane, type LucideIcon } from 'lucide-react';
import { DEPARTURE_TASKS, VISA_PATH, visaStageLabel } from './journey';
import type { StaffStudent } from '../data/staff';

/*
 * Where each student stands in an officer's part of the journey, written for the officer (not the student):
 * the phase, what the officer should do next, and how urgent that is.
 * Financial Aid Officer: Scholarship & Financial Guidance. Visa Officer: visa, pre-departure and post-arrival.
 */

export type OfficerArea = 'finance' | 'visa';

/** How each officer's area is named in their portal. */
export const DESK: Record<OfficerArea, { name: string; icon: LucideIcon; covers: string }> = {
  finance: { name: 'Financial Aid desk', icon: PiggyBank, covers: 'Scholarships, loans and proof of funds' },
  visa: { name: 'Visa desk', icon: Plane, covers: 'Visa, pre-departure and arrival' },
};

export type CaseTone = 'green' | 'blue' | 'amber' | 'red' | 'grey';

export interface OfficerCase {
  /** Short phase name, e.g. "Funding plan" or "Pre-departure". */
  phase: string;
  /** Filter group the phase belongs to. */
  group: string;
  tone: CaseTone;
  /** The next step, for the officer. */
  next: string;
  /** Detail under the next step, e.g. "₹18 lakh of ₹25 lakh covered". */
  detail?: string;
  /** 2: the officer should act now; 1: waiting on the student; 0: nothing to do. */
  urgency: 0 | 1 | 2;
  /** 0–1, how far through the officer's part the student is. */
  progress: number;
  /** Documents in the officer's area waiting to be checked. */
  toVerify: number;
}

export const CASE_GROUPS: Record<OfficerArea, { value: string; label: string }[]> = {
  finance: [
    { value: 'setup', label: 'To set up' },
    { value: 'planning', label: 'Planning' },
    { value: 'proof', label: 'Proof of funds' },
    { value: 'done', label: 'Complete' },
  ],
  visa: [
    { value: 'visa', label: 'Visa' },
    { value: 'departure', label: 'Pre-departure' },
    { value: 'abroad', label: 'Abroad' },
    { value: 'done', label: 'Complete' },
  ],
};

const lakh = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} lakh`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function officerCase(s: StaffStudent, area: OfficerArea): OfficerCase {
  return area === 'finance' ? financeCase(s) : visaCase(s);
}

function financeCase(s: StaffStudent): OfficerCase {
  const f = s.journey.funding;
  const funds = s.documents.filter((d) => d.category === 'funds');
  const toVerify = funds.filter((d) => d.state === 'pending').length;
  const verified = funds.filter((d) => d.state === 'verified').length;
  const covered = f.sources.reduce((n, x) => n + x.amount, 0);
  const cost = f.estimatedCost ?? 0;
  const override = s.journey.overrides.S4?.status;
  const proofDetail = funds.length ? `Proof of funds ${verified} of ${funds.length} verified` : 'No proof of funds listed';
  const coverDetail = cost ? `${lakh(covered)} of ${lakh(cost)} covered` : undefined;
  const base = { toVerify, detail: [coverDetail, proofDetail].filter(Boolean).join(' · ') };

  if (override === 'not_needed') return { ...base, phase: 'Not needed', group: 'done', tone: 'grey', next: 'Funding marked as not needed', urgency: 0, progress: 1 };
  if (override === 'completed' || (cost && covered >= cost && funds.length && verified === funds.length)) {
    return { ...base, phase: 'Complete', group: 'done', tone: 'green', next: s.visaOfficerId ? 'Handed over to the Visa Officer' : 'Waiting for a Visa Officer to be assigned', urgency: 0, progress: 1 };
  }
  if (toVerify) return { ...base, phase: 'Proof of funds', group: 'proof', tone: 'amber', next: `Verify ${plural(toVerify, 'document')}`, urgency: 2, progress: 0.75 };
  if (!cost) return { ...base, phase: 'To set up', group: 'setup', tone: 'grey', next: 'Set the estimated cost of study', urgency: 2, progress: 0 };
  if (covered < cost) {
    return {
      ...base,
      phase: 'Planning',
      group: 'planning',
      tone: 'blue',
      next: f.sources.length ? `Close the gap of ${lakh(cost - covered)}` : 'Agree the funding plan',
      urgency: f.sources.length ? 1 : 2,
      progress: 0.25 + 0.5 * Math.min(1, covered / cost),
    };
  }
  if (!funds.length) return { ...base, phase: 'Proof of funds', group: 'proof', tone: 'blue', next: 'List the proof of funds needed', urgency: 2, progress: 0.75 };
  const waiting = funds.find((d) => d.state === 'missing' || d.state === 'rejected');
  return {
    ...base,
    phase: 'Proof of funds',
    group: 'proof',
    tone: 'blue',
    next: waiting ? `Waiting for: ${waiting.name}` : 'Proof of funds in progress',
    urgency: 1,
    progress: 0.75 + 0.25 * (verified / funds.length),
  };
}

function visaCase(s: StaffStudent): OfficerCase {
  const j = s.journey;
  const toVerify = s.documents.filter((d) => d.category === 'visa' && d.state === 'pending').length;
  const verifyNext = toVerify ? { next: `Verify ${plural(toVerify, 'visa document')}`, urgency: 2 as const } : null;

  if (j.arrival.finalCheckInAt || j.overrides.S7?.status === 'completed') {
    return { phase: 'Complete', group: 'done', tone: 'green', next: 'Settled in · final check-in done', urgency: 0, progress: 1, toVerify };
  }
  if (j.arrival.arrivedAt) {
    const on = new Date(j.arrival.arrivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return { phase: 'Abroad', group: 'abroad', tone: 'blue', next: 'Check in and record the final check-in', detail: `Arrived ${on}`, urgency: 1, progress: 0.9, toVerify };
  }
  if (j.departure.confirmedAt) {
    return { phase: 'Ready to travel', group: 'departure', tone: 'green', next: 'Waiting for the student to arrive', urgency: 0, progress: 0.8, toVerify };
  }
  if (j.visa?.stage === 'granted') {
    const done = DEPARTURE_TASKS.filter((t) => j.departure.done[t.key]).length;
    const all = done === DEPARTURE_TASKS.length;
    return {
      phase: 'Pre-departure',
      group: 'departure',
      tone: 'blue',
      ...(verifyNext ?? { next: all ? 'Confirm the student is ready to travel' : `${DEPARTURE_TASKS.length - done} pre-departure tasks left`, urgency: all ? (2 as const) : (1 as const) }),
      detail: `Visa granted · ${done} of ${DEPARTURE_TASKS.length} tasks done`,
      progress: 0.5 + 0.3 * (done / DEPARTURE_TASKS.length),
      toVerify,
    };
  }
  const v = j.visa;
  if (!v) {
    return { phase: 'Visa', group: 'visa', tone: 'grey', ...(verifyNext ?? { next: 'Record the CAS or admission letter', urgency: 2 as const }), detail: 'Not started', progress: 0, toVerify };
  }
  if (v.stage === 'refused') {
    return { phase: 'Visa refused', group: 'visa', tone: 'red', next: 'Plan the next steps with the student', detail: v.refusalReason, urgency: 2, progress: 0.1, toVerify };
  }
  const i = VISA_PATH.indexOf(v.stage);
  const following = VISA_PATH[i + 1];
  return {
    phase: 'Visa',
    group: 'visa',
    tone: 'blue',
    ...(verifyNext ?? { next: following ? `Next: ${visaStageLabel[following].toLowerCase()}` : 'Record the visa decision', urgency: following ? (1 as const) : (2 as const) }),
    detail: `Step ${i + 1} of ${VISA_PATH.length} · ${visaStageLabel[v.stage]}`,
    progress: (0.5 * (i + 1)) / VISA_PATH.length,
    toVerify,
  };
}
