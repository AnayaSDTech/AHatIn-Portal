import type { Session } from './scheduling';
import type { StaffStudent } from '../data/staff';

/**
 * The student's journey through its stages.
 * Each service's status is worked out from real events in the student's record (sessions, shortlist,
 * applications, documents, visa, pre-departure tasks, arrival), never typed in directly. A counsellor can
 * override a service with a reason, e.g. "Not needed" for a self-funded student.
 * Student and staff screens both read this, so they always agree.
 */

/** S1 covers the career plan and the university shortlist (there is no S2 any more; the other codes stay as they were). */
export const SERVICE_CODES = ['S1', 'S3', 'S4', 'S5', 'S6', 'S7'] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export const SERVICE_TITLES: Record<ServiceCode, string> = {
  S1: 'Career Counselling & University Selection',
  S3: 'Application Assistance',
  S4: 'Scholarship & Financial Guidance',
  S5: 'Visa Assistance',
  S6: 'Pre-Departure Support',
  S7: 'Post-Arrival Support',
};

export type ServiceStatus = 'not_started' | 'in_progress' | 'completed' | 'not_needed';

export const serviceStatusLabel: Record<ServiceStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  not_needed: 'Not needed',
};

/* ------------------------------ Journey data ------------------------------ */

export interface Comment {
  at: string;
  by: string;
  role: 'student' | 'staff';
  text: string;
}

export interface ShortlistItem {
  id: string;
  university: string;
  course: string;
  country: string;
  intake: string;
  tuition: string;
  livingCost: string;
  deadline: string;
  /** e.g. "1 year" (options added before this was asked don't have it). */
  duration?: string;
  /** Only on options added before these were removed from the form. */
  agency?: string;
  earnsCommission?: boolean;
  reason: string;
  /** The student's choice when reviewing: apply, or remove with a reason. */
  choice?: 'apply' | 'removed';
  removeReason?: string;
  comments: Comment[];
  /** When the counsellor added it; options added after sharing are shown to the student as new. */
  addedAt?: string;
}

/** An option the counsellor added after sharing, which the student hasn't decided on yet. */
export const isNewOption = (item: ShortlistItem, sl: Shortlist) => !item.choice && !!item.addedAt && !!sl.sharedAt && item.addedAt >= sl.sharedAt;

export interface Shortlist {
  version: number;
  status: 'draft' | 'shared' | 'approved';
  sharedAt?: string;
  approvedAt?: string;
  /** Set once, the first time a shortlist is approved; later revisions don't undo it. */
  firstApprovedAt?: string;
  items: ShortlistItem[];
}

export const FUNDING_SOURCES = ['Family savings', 'Education loan', 'Scholarship', 'Sponsor', 'Other'] as const;
export type ScholarshipStatus = 'to_apply' | 'applied' | 'awarded' | 'not_awarded';
export const scholarshipStatusLabel: Record<ScholarshipStatus, string> = {
  to_apply: 'To apply',
  applied: 'Applied',
  awarded: 'Awarded',
  not_awarded: 'Not awarded',
};

export interface Funding {
  /** Total cost of study in ₹ lakh, estimated by the counsellor (tuition, living, visa, travel). */
  estimatedCost?: number;
  sources: { id: string; kind: string; amount: number }[];
  scholarships: { id: string; name: string; amount: string; deadline: string; status: ScholarshipStatus }[];
}

export const VISA_STAGES = ['cas_received', 'documents_verified', 'fees_paid', 'submitted', 'biometrics', 'granted', 'refused'] as const;
export type VisaStage = (typeof VISA_STAGES)[number];
export const visaStageLabel: Record<VisaStage, string> = {
  cas_received: 'CAS or admission letter received',
  documents_verified: 'Visa documents checked',
  fees_paid: 'Visa fee and health surcharge paid',
  submitted: 'Visa application submitted',
  biometrics: 'Biometrics appointment done',
  granted: 'Visa granted',
  refused: 'Visa refused',
};
/** The normal order; "granted" and "refused" are decisions after biometrics. */
export const VISA_PATH: VisaStage[] = ['cas_received', 'documents_verified', 'fees_paid', 'submitted', 'biometrics'];

export interface Visa {
  stage: VisaStage;
  reference?: string;
  refusalReason?: string;
  history: { at: string; by: string; stage: VisaStage; note?: string }[];
}

export const DEPARTURE_TASKS = [
  { key: 'accommodation', label: 'Accommodation booked' },
  { key: 'flight', label: 'Flight booked' },
  { key: 'insurance', label: 'Travel and health insurance arranged' },
  { key: 'money', label: 'Forex card or bank account ready' },
  { key: 'briefing', label: 'Pre-departure briefing attended' },
  { key: 'documents', label: 'Travel documents packed (passport, visa, offer, CAS or admission letter)' },
] as const;

export interface Departure {
  /** Task key → when the student ticked it. */
  done: Record<string, string>;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface Arrival {
  arrivedAt?: string;
  finalCheckInAt?: string;
  finalNote?: string;
}

export interface Override {
  status: ServiceStatus;
  reason: string;
  by: string;
  at: string;
}

/** What a counsellor records for the career plan (choices come from GET /career-options). */
export interface CareerPlanInput {
  direction: string;
  course: string;
  level: string;
  destinations: string[];
  notes: string;
}

/** The agreed career plan. Plans recorded before the structured form only have `summary`. */
export interface CareerPlan extends Partial<CareerPlanInput> {
  at: string;
  by: string;
  /** One readable line, e.g. "Data Science & Analytics (Master's) · United Kingdom, Ireland". */
  summary: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Journey {
  careerPlan?: CareerPlan;
  shortlist?: Shortlist;
  funding: Funding;
  visa?: Visa;
  departure: Departure;
  arrival: Arrival;
  /** S2: only on students whose university stage was overridden while it was a stage of its own. */
  overrides: Partial<Record<ServiceCode | 'S2', Override>>;
}

export const emptyJourney = (): Journey => ({ funding: { sources: [], scholarships: [] }, departure: { done: {} }, arrival: {}, overrides: {} });

/* ------------------------------ Status rules ------------------------------ */

export interface ServiceView {
  code: ServiceCode;
  title: string;
  status: ServiceStatus;
  /** What the rules say, before any override. */
  autoStatus: ServiceStatus;
  summary: string;
  next?: string;
  override?: Override;
}

const lakh = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} lakh`;

/** A document for the applications (not funding or visa, which come later) is still to upload, or to upload again. */
export const applicationDocumentsDue = (s: StaffStudent) => s.documents.some((d) => d.category !== 'funds' && d.category !== 'visa' && (d.state === 'missing' || d.state === 'rejected'));

/** The university stage was set as completed or not needed while it was a stage of its own. */
const skippedShortlist = (j: Journey) => ['completed', 'not_needed'].includes(j.overrides.S2?.status ?? '');

function auto(code: ServiceCode, s: StaffStudent, sessions: Session[]): Omit<ServiceView, 'code' | 'title' | 'autoStatus' | 'override'> {
  const j = s.journey;
  const apps = s.applications;
  // Visa, pre-departure and arrival are looked after by the Visa Officer once assigned.
  const visaLead = s.visaOfficerId ? 'Your Visa Officer' : 'Your counsellor';
  switch (code) {
    case 'S1': {
      // Complete once the student has both the career plan and the shortlist. A revision doesn't undo it.
      const sl = j.shortlist;
      const shared = !!sl?.sharedAt || (!!sl && sl.status !== 'draft') || skippedShortlist(j);
      const preparing = sl?.status === 'draft' && sl.items.length > 0;
      if (j.careerPlan && shared) return { status: 'completed', summary: `Career plan and shortlist shared · ${j.careerPlan.summary}` };
      if (j.careerPlan) {
        return { status: 'in_progress', summary: `Career plan shared · ${j.careerPlan.summary}`, next: preparing ? 'Your counsellor is preparing your university shortlist' : 'Your counsellor will share your university shortlist' };
      }
      if (shared) return { status: 'in_progress', summary: 'University shortlist shared', next: 'Your counsellor shares your career plan after your counselling session' };
      // Any session ever booked counts, so later sessions or a cancellation never move this step back.
      const mine = sessions.filter((x) => x.studentId === s.id);
      if (mine.length || preparing) return { status: 'in_progress', summary: 'Counselling under way', next: 'Your counsellor shares your career plan after your counselling session' };
      return { status: 'not_started', summary: 'Starts with your first counselling session', next: 'Book a career counselling session' };
    }
    case 'S3': {
      const shortlistWaiting = j.shortlist?.status === 'shared';
      // A new option added to a shortlist that was already approved.
      const newOption = shortlistWaiting ? 'Decide on the new option in your shortlist' : undefined;
      const accepted = apps.find((a) => a.state === 'accepted');
      if (accepted) return { status: 'completed', summary: `Offer accepted · ${accepted.university}` };
      const sent = apps.filter((a) => a.state !== 'draft');
      const offers = apps.filter((a) => a.state === 'conditional_offer' || a.state === 'unconditional_offer');
      const drafts = apps.filter((a) => a.state === 'draft');
      if (sent.length) {
        return {
          status: 'in_progress',
          summary: `${sent.length} of ${apps.length} submitted · ${offers.length} ${offers.length === 1 ? 'offer' : 'offers'}`,
          next: offers[0] ? `Reply to your offer from ${offers[0].university}` : newOption ?? drafts[0] ? `Your counsellor is preparing your ${drafts[0].university} application` : 'Waiting for university decisions',
        };
      }
      // Under way as soon as the shortlist is approved: the counsellor is preparing the applications.
      const shortlistDone = !!j.shortlist?.firstApprovedAt || skippedShortlist(j) || ['completed', 'not_needed'].includes(j.overrides.S1?.status ?? '');
      if (apps.length || shortlistDone) {
        return {
          status: 'in_progress',
          summary: apps.length ? `${apps.length} ${apps.length === 1 ? 'application' : 'applications'} being prepared` : 'Your counsellor is preparing your applications',
          next: newOption ?? (applicationDocumentsDue(s) ? 'Upload your remaining documents' : undefined),
        };
      }
      return { status: 'not_started', summary: 'Starts after you approve your shortlist', next: shortlistWaiting ? 'Review and approve your shortlist' : undefined };
    }
    case 'S4': {
      const f = j.funding;
      const funds = s.documents.filter((d) => d.category === 'funds');
      // Complete when the funding plan covers the estimated cost and every proof-of-funds document is verified
      // (scholarships are optional). The server uses the same rule to hand over to the Visa Officer.
      const covered = f.sources.reduce((n, x) => n + x.amount, 0);
      const planned = !!f.estimatedCost && covered >= f.estimatedCost;
      const allVerified = funds.length > 0 && funds.every((d) => d.state === 'verified');
      if (planned && allVerified) return { status: 'completed', summary: `Funding plan covers ${lakh(f.estimatedCost!)} · proof of funds verified` };
      const started = f.sources.length > 0 || f.scholarships.length > 0 || funds.some((d) => d.state !== 'missing');
      if (!started) {
        // Under way as soon as a Financial Aid Officer is assigned; they set the estimated cost.
        if (s.financeOfficerId) {
          return f.estimatedCost
            ? { status: 'in_progress', summary: `Estimated cost of study ${lakh(f.estimatedCost)}`, next: 'Add your funding plan' }
            : { status: 'in_progress', summary: 'Your Financial Aid Officer is preparing your estimated cost of study', next: 'Book a session or message them about scholarships, loans or sponsors' };
        }
        if (f.estimatedCost) return { status: 'not_started', summary: `Estimated cost of study ${lakh(f.estimatedCost)}`, next: 'Add your funding plan' };
        // Starts after Application Assistance: the admin assigns a Financial Aid Officer.
        if (!apps.some((a) => a.state === 'accepted')) return { status: 'not_started', summary: 'Starts once you accept an offer' };
        return { status: 'not_started', summary: 'Starts when your Financial Aid Officer is assigned' };
      }
      const toUpload = funds.find((d) => d.state === 'missing' || d.state === 'rejected');
      const checking = funds.some((d) => d.state === 'pending');
      return {
        status: 'in_progress',
        summary: `${f.estimatedCost ? `${lakh(covered)} of ${lakh(f.estimatedCost)} covered` : `${lakh(covered)} planned`} · ${f.scholarships.length} ${f.scholarships.length === 1 ? 'scholarship' : 'scholarships'}`,
        next: toUpload
          ? `${toUpload.state === 'rejected' ? 'Re-upload' : 'Upload'}: ${toUpload.name}`
          : checking
            ? 'Your Financial Aid Officer is checking your proof of funds'
            : !f.estimatedCost
              ? 'Your Financial Aid Officer will set your estimated cost of study'
              : !planned
                ? `Add your funding plan (${lakh(covered)} of ${lakh(f.estimatedCost)} covered)`
                : funds.length
                  ? undefined
                  : 'Your Financial Aid Officer will list the proof of funds you need',
      };
    }
    case 'S5': {
      const v = j.visa;
      // Under way as soon as a Visa Officer is assigned.
      if (!v && s.visaOfficerId) return { status: 'in_progress', summary: 'Waiting for your CAS or admission letter to arrive' };
      if (!v) return { status: 'not_started', summary: apps.some((a) => a.state === 'accepted') ? 'Starts when your CAS or admission letter arrives' : 'Starts after you accept an offer' };
      if (v.stage === 'granted') return { status: 'completed', summary: 'Visa granted' };
      if (v.stage === 'refused') return { status: 'in_progress', summary: 'Visa refused', next: `${visaLead} will talk you through the next steps` };
      const i = VISA_PATH.indexOf(v.stage);
      return { status: 'in_progress', summary: visaStageLabel[v.stage], next: i < VISA_PATH.length - 1 ? visaStageLabel[VISA_PATH[i + 1]!] : 'Waiting for the visa decision' };
    }
    case 'S6': {
      const d = j.departure;
      if (d.confirmedAt) return { status: 'completed', summary: 'Ready to travel' };
      if (j.visa?.stage !== 'granted') return { status: 'not_started', summary: 'Starts after your visa is granted' };
      const done = DEPARTURE_TASKS.filter((t) => d.done[t.key]).length;
      const nextTask = DEPARTURE_TASKS.find((t) => !d.done[t.key]);
      return {
        status: 'in_progress',
        summary: `${done} of ${DEPARTURE_TASKS.length} pre-departure tasks done`,
        next: nextTask ? nextTask.label : `${visaLead} will confirm you are ready to travel`,
      };
    }
    case 'S7': {
      const a = j.arrival;
      if (a.finalCheckInAt) return { status: 'completed', summary: 'Settled in · final check-in done' };
      if (a.arrivedAt) return { status: 'in_progress', summary: `Arrived on ${new Date(a.arrivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, next: `${visaLead} will check in with you during your first months` };
      return { status: 'not_started', summary: 'Starts when you arrive', next: j.departure.confirmedAt ? 'Tell us when you have arrived' : undefined };
    }
  }
}

/** After Application Assistance the admin assigns a Financial Aid Officer, and after funding a Visa Officer. */
function waitingFor(views: ServiceView[], student: StaffStudent): 'finance' | 'visa' | null {
  const done = (code: ServiceCode) => ['completed', 'not_needed'].includes(views.find((v) => v.code === code)!.status);
  if (!done('S3')) return null;
  if (done('S4')) return student.visaOfficerId ? null : 'visa';
  return student.financeOfficerId ? null : 'finance';
}

export function computeServices(student: StaffStudent, sessions: Session[]): ServiceView[] {
  const views = computeViews(student, sessions);
  const waiting = waitingFor(views, student);
  if (!waiting) return views;
  const code = waiting === 'finance' ? 'S4' : 'S5';
  const who = waiting === 'finance' ? 'Financial Aid Officer' : 'Visa Officer';
  return views.map((v) => (v.code === code ? { ...v, next: `We're assigning your ${who}. We'll email you when they are.` } : v));
}

function computeViews(student: StaffStudent, sessions: Session[]): ServiceView[] {
  return SERVICE_CODES.map((code) => {
    const a = auto(code, student, sessions);
    const override = student.journey.overrides[code];
    if (!override) return { code, title: SERVICE_TITLES[code], autoStatus: a.status, override, ...a };
    return {
      code,
      title: SERVICE_TITLES[code],
      autoStatus: a.status,
      override,
      status: override.status,
      summary: override.status === 'not_needed' ? `Not needed: ${override.reason}` : `${a.summary} · set by your counsellor`,
      next: override.status === 'completed' || override.status === 'not_needed' ? undefined : a.next,
    };
  });
}

/** Overall progress: completed = 1, in progress = ½; services marked "Not needed" are left out. */
export function overallProgress(views: ServiceView[]) {
  const counted = views.filter((v) => v.status !== 'not_needed');
  if (!counted.length) return 100;
  const score = counted.reduce((n, v) => n + (v.status === 'completed' ? 1 : v.status === 'in_progress' ? 0.5 : 0), 0);
  return Math.round((score / counted.length) * 100);
}

/** For the compact staff progress bar: 0 not started, 1 in progress, 2 completed, 3 not needed. */
export const serviceValues = (views: ServiceView[]) =>
  views.map((v) => (v.status === 'completed' ? 2 : v.status === 'in_progress' ? 1 : v.status === 'not_needed' ? 3 : 0));
