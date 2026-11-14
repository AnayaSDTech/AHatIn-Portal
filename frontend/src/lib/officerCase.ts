import { PiggyBank, Plane, type LucideIcon } from 'lucide-react';
import { DEPARTURE_TASKS, VISA_PATH, earlyVisaDocuments, offerAccepted, visaStageLabel } from './journey';
import { counsellorCovers, type StaffStudent } from '../data/staff';
import type { Session } from './scheduling';
import { formatDate } from './utils';

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
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'setup', label: 'To set up' },
    { value: 'planning', label: 'Planning' },
    { value: 'proof', label: 'Proof of funds' },
    { value: 'done', label: 'Complete' },
  ],
  visa: [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'visa', label: 'Visa' },
    { value: 'departure', label: 'Pre-departure' },
    { value: 'abroad', label: 'Abroad' },
    { value: 'done', label: 'Complete' },
  ],
};

const lakh = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} lakh`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The counsellor's part of the journey: counselling, the shortlist and the applications. */
export const COUNSELLOR_GROUPS = [
  { value: 'counselling', label: 'Counselling' },
  { value: 'shortlist', label: 'Shortlist' },
  { value: 'applications', label: 'Applications' },
  { value: 'offers', label: 'Offers' },
  { value: 'done', label: 'Complete' },
];

/** Groups for the officer areas a counsellor handles instead of an officer ("Counsellor handles this"). */
export const COUNSELLOR_EXTRA_GROUPS = [
  { value: 'funding', label: 'Funding' },
  { value: 'visa', label: 'Visa & travel' },
];

/**
 * Where a student stands for their counsellor: counselling, the shortlist and the applications, plus funding or the
 * visa when the admin chose to have the counsellor handle them. Progress covers every part they handle; the part that
 * needs them most is shown, and the student is complete only when all of them are.
 */
export function counsellorCase(s: StaffStudent, sessions: Session[]): OfficerCase {
  const own = ownCounsellorCase(s, sessions);
  const extra = (['finance', 'visa'] as const).filter((area) => counsellorCovers(s, area)).map((area) => ({ area, c: officerCase(s, area) }));
  if (!extra.length) return own;
  const parts = [{ area: 'counsellor' as const, c: own }, ...extra];
  const progress = parts.reduce((n, p) => n + p.c.progress, 0) / parts.length;
  const toVerify = parts.reduce((n, p) => n + p.c.toVerify, 0);
  const done = (c: OfficerCase) => c.group === 'done';
  // Most urgent unfinished part; their own part first on a tie (the sort is stable).
  const lead = [...parts].filter((p) => !done(p.c) || p.c.urgency > 0).sort((a, b) => b.c.urgency - a.c.urgency)[0];
  if (!lead) return { ...own, next: 'All the stages you handle are complete', detail: undefined, progress: 1, toVerify };
  if (lead.area === 'counsellor') return { ...own, progress, toVerify };
  const phase = lead.area === 'finance' ? 'Funding' : lead.c.phase === 'Preparation' ? 'Visa preparation' : lead.c.phase === 'Upcoming' ? 'Visa' : lead.c.phase;
  return { ...lead.c, phase, group: lead.area === 'finance' ? 'funding' : 'visa', progress, toVerify };
}

/** The counsellor's own part: counselling, the shortlist and the applications. Documents to check come first. */
function ownCounsellorCase(s: StaffStudent, sessions: Session[]): OfficerCase {
  const j = s.journey;
  const sl = j.shortlist;
  const apps = s.applications;
  const toVerify = s.documents.filter((d) => d.category === 'general' && d.state === 'pending').length;
  const verify = toVerify ? { next: `Verify ${plural(toVerify, 'document')}`, urgency: 2 as const } : null;
  const accepted = apps.find((a) => a.state === 'accepted');
  const override = j.overrides.S3?.status;

  if (accepted || override === 'completed' || override === 'not_needed') {
    return { phase: 'Complete', group: 'done', tone: 'green', ...(verify ?? { next: accepted ? `Offer accepted · ${accepted.university}` : 'Applications marked as finished', urgency: 0 as const }), progress: 1, toVerify };
  }

  const shared = !!sl?.sharedAt || (!!sl && sl.status !== 'draft');
  if (!j.careerPlan) {
    const mine = sessions.filter((x) => x.studentId === s.id && x.type === 'Career counselling');
    const held = mine.find((x) => x.status === 'completed');
    const booked = mine.find((x) => x.status === 'booked');
    return {
      phase: 'Counselling',
      group: 'counselling',
      tone: booked ? 'blue' : 'grey',
      ...(verify ?? (held ? { next: 'Record the career plan', urgency: 2 as const } : booked ? { next: 'Hold the career counselling session', urgency: 1 as const } : { next: 'Book the career counselling session', urgency: 2 as const })),
      detail: booked && !held ? `Session booked for ${formatDate(booked.date)} at ${booked.time}` : undefined,
      progress: held ? 0.2 : booked ? 0.1 : 0,
      toVerify,
    };
  }

  if (!shared) {
    const options = sl?.items.length ?? 0;
    return { phase: 'Shortlist', group: 'shortlist', tone: 'blue', ...(verify ?? { next: options ? 'Finish and share the shortlist' : 'Build the university shortlist', urgency: 2 as const }), detail: options ? `${plural(options, 'option')} added` : undefined, progress: 0.3, toVerify };
  }

  if (!sl?.firstApprovedAt) {
    return { phase: 'Shortlist', group: 'shortlist', tone: 'amber', ...(verify ?? { next: 'Waiting for the student to approve the shortlist', urgency: 1 as const }), progress: 0.45, toVerify };
  }

  const open = apps.filter((a) => !['declined', 'rejected', 'withdrawn'].includes(a.state));
  const offers = open.filter((a) => a.state === 'conditional_offer' || a.state === 'unconditional_offer');
  const drafts = open.filter((a) => a.state === 'draft');
  const moreInfo = open.filter((a) => a.state === 'more_info_requested');
  const interviews = open.filter((a) => a.state === 'interview');
  const sent = apps.filter((a) => a.state !== 'draft').length;
  const detail = apps.length ? `${sent} of ${plural(apps.length, 'application')} submitted${offers.length ? ` · ${plural(offers.length, 'offer')}` : ''}` : undefined;

  if (offers.length) return { phase: 'Offers', group: 'offers', tone: 'amber', ...(verify ?? { next: 'Waiting for the student to reply to their offer', urgency: 1 as const }), detail, progress: 0.85, toVerify };
  if (moreInfo.length) return { phase: 'Applications', group: 'applications', tone: 'amber', next: `Send what ${moreInfo[0]!.university} asked for`, urgency: 2, detail, progress: 0.7, toVerify };
  if (drafts.length) return { phase: 'Applications', group: 'applications', tone: 'blue', ...(verify ?? { next: `Prepare and submit ${plural(drafts.length, 'application')}`, urgency: 2 as const }), detail, progress: 0.6, toVerify };
  if (interviews.length) return { phase: 'Applications', group: 'applications', tone: 'blue', ...(verify ?? { next: `Help them prepare for the ${interviews[0]!.university} interview`, urgency: 1 as const }), detail, progress: 0.75, toVerify };
  if (open.length) return { phase: 'Applications', group: 'applications', tone: 'blue', ...(verify ?? { next: 'Waiting for university decisions', urgency: 1 as const }), detail, progress: 0.7, toVerify };
  return { phase: 'Applications', group: 'applications', tone: 'red', ...(verify ?? { next: 'No applications left: add more options', urgency: 2 as const }), detail, progress: 0.6, toVerify };
}

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
  // Funding starts with the first stage, once the student has a counsellor as well.
  if (!s.counsellorId && !cost && !f.sources.length && !f.scholarships.length) {
    return { ...base, detail: undefined, phase: 'Upcoming', group: 'upcoming', tone: 'grey', next: 'Starts once the student has a counsellor', urgency: 0, progress: 0 };
  }
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
  // Preparation runs from the start; the formal steps wait for an accepted offer.
  if (!v && !offerAccepted(s)) {
    const early = earlyVisaDocuments(s);
    const waiting = early.find((d) => d.state === 'missing' || d.state === 'rejected');
    const prep = { phase: 'Preparation', group: 'visa', detail: 'Formal visa steps start once the student accepts an offer', progress: 0, toVerify };
    if (verifyNext) return { ...prep, tone: 'amber', ...verifyNext };
    if (!s.counsellorId) return { ...prep, phase: 'Upcoming', group: 'upcoming', tone: 'grey', next: 'Starts once the student has a counsellor', urgency: 0 };
    if (!early.length) return { ...prep, tone: 'grey', next: 'Hold a visa preparation session and request early documents', urgency: 2 };
    if (waiting) return { ...prep, tone: 'blue', next: `Waiting for: ${waiting.name}`, urgency: 1 };
    return { ...prep, tone: 'blue', next: 'Waiting for the student to accept an offer', urgency: 0 };
  }
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
