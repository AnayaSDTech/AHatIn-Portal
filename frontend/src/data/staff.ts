import { isoDate } from '../lib/scheduling';
import type { Journey } from '../lib/journey';

/**
 * Types and labels for the counsellor and admin areas. The records themselves come from the FastAPI backend.
 */

export const STAGES = [
  { key: 'new_lead', label: 'New lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'assessment_booked', label: 'Assessment booked' },
  { key: 'assessed', label: 'Assessed / plan shared' },
  { key: 'registered', label: 'Registered client' },
  { key: 'documents_shortlist', label: 'Documents and shortlist' },
  { key: 'applications_submitted', label: 'Applications submitted' },
  { key: 'offer_accepted', label: 'Offer accepted' },
  { key: 'visa_filed', label: 'Visa filed' },
  { key: 'visa_granted', label: 'Visa granted' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'settled', label: 'Settled' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];
export const stageLabel = (key: string) => STAGES.find((s) => s.key === key)?.label ?? key;
export const stageIndex = (key: string) => STAGES.findIndex((s) => s.key === key);

export interface Counsellor {
  id: string;
  name: string;
  email: string;
  /** counsellor, finance_officer or visa_officer. */
  role?: string;
  phone: string;
  meetingLink: string;
  /** False for former counsellors (kept for names in history). */
  active?: boolean;
}

/**
 * Counsellors, loaded from the API once per sign-in (see useCounsellors). Kept as a shared list so labels
 * like counsellorName() work anywhere without passing the list around.
 */
export const counsellors: Counsellor[] = [];
export function setCounsellors(list: Counsellor[]) {
  counsellors.splice(0, counsellors.length, ...list);
}
export const counsellorName = (id: string | null | undefined) => (id && counsellors.find((c) => c.id === id)?.name) || 'Unassigned';
/** Counsellors who can be given students, leads or access now (the list also holds the officers). */
export const activeCounsellors = () => counsellors.filter((c) => c.active !== false && (c.role ?? 'counsellor') === 'counsellor');
/** Everyone with a schedule of sessions: counsellors and officers. */
export const activeSessionHosts = () => counsellors.filter((c) => c.active !== false);

/* ------------------------------ Who looks after what ------------------------------ */

/** counsellor: services 1–3; finance: service 4 (Financial Aid Officer); visa: services 5–7 (Visa Officer). */
export type TeamArea = 'counsellor' | 'finance' | 'visa';
export interface StudentTeam {
  counsellor: Counsellor | null;
  finance: Counsellor | null;
  visa: Counsellor | null;
}
export const teamTitle: Record<TeamArea, string> = { counsellor: 'Counsellor', finance: 'Financial Aid Officer', visa: 'Visa Officer' };
export const SERVICE_AREA: Record<string, TeamArea> = { S1: 'counsellor', S2: 'counsellor', S3: 'counsellor', S4: 'finance', S5: 'visa', S6: 'visa', S7: 'visa' };
export const DOC_AREA: Record<string, TeamArea> = { general: 'counsellor', funds: 'finance', visa: 'visa' };
/** Each kind of session is with the person who looks after it. */
export const SESSION_AREA: Record<string, TeamArea> = { 'Scholarship & funding': 'finance', 'Visa preparation': 'visa', 'Pre-departure briefing': 'visa', 'Post-arrival check-in': 'visa' };
export const sessionArea = (type: string): TeamArea => SESSION_AREA[type] ?? 'counsellor';
const OFFICER_FIELD = { finance: 'financeOfficerId', visa: 'visaOfficerId' } as const;
export const areaOfRole = (role: string): TeamArea | null => (role === 'finance_officer' ? 'finance' : role === 'visa_officer' ? 'visa' : null);
/** The staff member looking after an area of this student's journey (the counsellor until an officer is assigned). */
export const ownerOf = (s: StaffStudent, area: TeamArea) => (area === 'counsellor' ? s.counsellorId : s[OFFICER_FIELD[area]] || s.counsellorId);

/**
 * May this staff member change this part of a student's journey? (The server applies the same rule.)
 * Officers change only their own part; counsellors lose services 4–7 once the officer for them is assigned.
 */
export function canEditArea(role: string, s: StaffStudent, area: TeamArea) {
  if (role === 'admin') return true;
  const mine = areaOfRole(role);
  if (mine) return mine === area;
  return area === 'counsellor' || !s[OFFICER_FIELD[area]];
}

export const staffRoleLabel: Record<string, string> = {
  counsellor: 'Counsellor',
  officer: 'Application officer',
  finance_officer: 'Financial Aid Officer',
  visa_officer: 'Visa Officer',
  admin: 'Administrator',
};

export type LeadSource = 'Website' | 'Google ad' | 'Instagram ad' | 'Referral' | 'Seminar' | 'Walk-in' | 'WhatsApp';

export interface Lead {
  id: string;
  name: string;
  email: string;
  mobile: string;
  city: string;
  source: LeadSource;
  interest: string;
  stage: StageKey;
  score: number;
  createdAt: string;
  /** Null while the admin handles the enquiry (new website enquiries). */
  counsellorId: string | null;
  /** From the website enquiry form. */
  message?: string;
  callTime?: string;
  activities: { at: string; channel: string; outcome: string; notes?: string }[];
}

export type FollowUpType = 'call' | 'whatsapp' | 'verify' | 'reminder' | 'checkin';

export interface FollowUp {
  id: string;
  /** Null for the admin's own tasks (new enquiries, students waiting for a counsellor). */
  counsellorId: string | null;
  person: string;
  personId: string;
  personType: 'lead' | 'student';
  action: string;
  rule: string;
  dueAt: string;
  type: FollowUpType;
  done: boolean;
}

/** missing = requested but not uploaded yet. */
export type DocState = 'missing' | 'pending' | 'verified' | 'rejected';
/** funds = proof of funds (service 4); visa = visa documents (service 5). */
export type DocCategory = 'general' | 'funds' | 'visa';
export type AppState =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'more_info_requested'
  | 'interview'
  | 'conditional_offer'
  | 'unconditional_offer'
  | 'accepted'
  | 'declined'
  | 'rejected'
  | 'withdrawn';

export const appStateLabel: Record<AppState, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  more_info_requested: 'More information requested',
  interview: 'Interview',
  conditional_offer: 'Conditional offer',
  unconditional_offer: 'Unconditional offer',
  accepted: 'Accepted',
  declined: 'Declined',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Allowed status changes; anything else is blocked (the server enforces the same rules). */
export const appTransitions: Record<AppState, AppState[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'more_info_requested', 'interview', 'conditional_offer', 'unconditional_offer', 'rejected', 'withdrawn'],
  under_review: ['more_info_requested', 'interview', 'conditional_offer', 'unconditional_offer', 'rejected', 'withdrawn'],
  more_info_requested: ['under_review', 'withdrawn'],
  interview: ['under_review', 'conditional_offer', 'unconditional_offer', 'rejected', 'withdrawn'],
  conditional_offer: ['unconditional_offer', 'accepted', 'declined', 'rejected', 'withdrawn'],
  unconditional_offer: ['accepted', 'declined', 'withdrawn'],
  accepted: ['withdrawn'],
  declined: [],
  rejected: [],
  withdrawn: [],
};

export interface StaffStudent {
  id: string;
  /** Null until the admin assigns a counsellor (once the student's profile is complete). */
  counsellorId: string | null;
  /** Assigned by the admin once Application Assistance is complete. */
  financeOfficerId?: string | null;
  /** Assigned by the admin once Scholarship & Financial Guidance is complete. */
  visaOfficerId?: string | null;
  officerHistory?: { at: string; by: string; role: 'finance' | 'visa'; from: string; to: string; reason: string }[];
  /** Login account linked to this record. */
  userId?: string;
  assignmentHistory: { at: string; by: string; from: string; to: string; reason: string }[];
  reference: string;
  name: string;
  email: string;
  mobile: string;
  goal: string;
  destination: string;
  intake: string;
  stage: StageKey;
  documents: StudentDocument[];
  applications: StudentApplication[];
  /** Shortlist, funding, visa, pre-departure and arrival. Service progress is worked out from this. */
  journey: Journey;
  notes: { at: string; by: string; text: string }[];
}

export interface StudentDocument {
  id: string;
  name: string;
  state: DocState;
  category: DocCategory;
  uploadedAt?: string;
  fileName?: string;
  reason?: string;
}

export interface StudentApplication {
  id: string;
  university: string;
  course: string;
  agency: string;
  state: AppState;
  deadline?: string;
  conditions?: { text: string; met: boolean }[];
  /** Every status change, including corrections of mistakes (with the reason). */
  history?: { at: string; by: string; from: AppState; to: AppState; reason?: string }[];
}

/** A status change the student hasn't seen yet. */
export interface ApplicationUpdate {
  id: string;
  university: string;
  from: AppState;
  to: AppState;
  at: string;
}

/**
 * Status changes made by staff after `seenAt` (the student's own decisions aren't news to them).
 * One entry per application: its latest change.
 */
export function applicationUpdates(applications: StudentApplication[], seenAt: string | undefined): ApplicationUpdate[] {
  if (!seenAt) return [];
  return applications
    .map((a) => {
      const last = a.history?.[a.history.length - 1];
      return last && last.at > seenAt && !last.by.endsWith('(student)') ? { id: a.id, university: a.university, from: last.from, to: last.to, at: last.at } : null;
    })
    .filter((u): u is ApplicationUpdate => !!u)
    .sort((x, y) => y.at.localeCompare(x.at));
}

/** Accepting or declining an offer is the student's decision; staff can't change or correct it. */
export const isStudentDecision = (s: AppState) => s === 'accepted' || s === 'declined';

export const serviceShortNames = ['Counselling', 'Uni & country', 'Applications', 'Funding', 'Visa', 'Pre-departure', 'Post-arrival'];

/* ------------------------------ Admin ------------------------------ */

export type StaffRole = 'counsellor' | 'officer' | 'finance_officer' | 'visa_officer' | 'admin';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: 'active' | 'deactivated';
  /** Created, but hasn't set a password and authenticator yet. */
  invited?: boolean;
  phone?: string;
  lastLogin: string;
}

export interface Agency {
  id: string;
  name: string;
  type: string;
  countries: string;
  commissionShare: string;
  agreementEnd: string;
  status: 'Active' | 'Inactive';
  applications: number;
}

export interface FollowUpRule {
  trigger: string;
  action: string;
  limit: string;
  escalation: string;
}

export interface Overview {
  funnel: { stage: string; count: number }[];
  leadSources: { source: string; count: number }[];
  counsellorWorkload: { id: string; name: string; activeStudents: number; openLeads: number; overdue: number; medianResponse: number | null }[];
  agencies: Agency[];
}

/* ------------------------------ Messages ------------------------------ */

/** One message in the chat between a student and their counsellor (or whoever is covering). */
export interface Message {
  id: string;
  studentId: string;
  /** Which chat: with the counsellor, the Financial Aid Officer or the Visa Officer. */
  thread?: TeamArea;
  from: 'student' | 'staff';
  /** Sender's name, e.g. "Priya Desai". */
  by: string;
  text: string;
  at: string;
  /** When the other side read it. */
  readAt?: string;
}

/* ------------------------------ Temporary access ------------------------------ */

export interface AccessGrant {
  id: string;
  /** Counsellor who gets access. */
  granteeId: string;
  /** Counsellor whose students they can see. */
  ownerId: string;
  until: string; // YYYY-MM-DD, inclusive
  reason: string;
  grantedBy: string;
  revoked?: boolean;
}

export const isGrantActive = (g: AccessGrant, now = new Date()) => !g.revoked && g.until >= isoDate(now);
