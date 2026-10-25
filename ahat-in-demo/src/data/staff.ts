import { isoDate, type Availability, type Session, type TimeOff } from '../lib/scheduling';
import { DEPARTURE_TASKS, emptyJourney, type Journey, type ShortlistItem } from '../lib/journey';

/**
 * DEMO data for the counsellor and admin areas. All people, numbers and agencies are fictional.
 * In the real portal this comes from the FastAPI backend.
 */

/** ISO date-time N minutes from now (negative = in the past), so the demo always looks current. */
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const daysFromNow = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

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

export const counsellors = [
  { id: 'c1', name: 'Priya Desai', email: 'demo.counsellor@ahatin.example', phone: '+91 98000 11111', meetingLink: 'https://meet.google.com/demo-priya' },
  { id: 'c2', name: 'Rohan Kapoor', email: 'rohan.k@ahatin.example', phone: '+91 98000 22222', meetingLink: 'https://meet.google.com/demo-rohan' },
  { id: 'c3', name: 'Neha Joshi', email: 'neha.j@ahatin.example', phone: '+91 98000 33333', meetingLink: 'https://meet.google.com/demo-neha' },
];
export type Counsellor = (typeof counsellors)[number];
export const counsellorName = (id: string) => counsellors.find((c) => c.id === id)?.name ?? 'Unassigned';

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
  counsellorId: string;
  /** From the website enquiry form. */
  message?: string;
  callTime?: string;
  activities: { at: string; channel: string; outcome: string; notes?: string }[];
}

export const demoLeads: Lead[] = [
  { id: 'l1', name: 'Karan Malhotra', email: 'karan.m@example.com', mobile: '+91 98111 20001', city: 'Delhi', source: 'Website', interest: 'MSc Computer Science · UK · Sep 2027', stage: 'new_lead', score: 82, createdAt: minutesFromNow(-22), counsellorId: 'c1', activities: [] },
  { id: 'l2', name: 'Diya Patel', email: 'diya.p@example.com', mobile: '+91 98111 20002', city: 'Ahmedabad', source: 'Instagram ad', interest: 'MBA · Ireland · Sep 2027', stage: 'new_lead', score: 64, createdAt: minutesFromNow(-6), counsellorId: 'c1', activities: [] },
  { id: 'l3', name: 'Aman Gill', email: 'aman.g@example.com', mobile: '+91 98111 20003', city: 'Chandigarh', source: 'Google ad', interest: 'MSc Data Science · UK · Sep 2027', stage: 'contacted', score: 71, createdAt: minutesFromNow(-60 * 26), counsellorId: 'c2', activities: [{ at: minutesFromNow(-60 * 25), channel: 'Call', outcome: 'Reached', notes: 'Interested in the Graduate Route. Wants a session this week.' }] },
  { id: 'l4', name: 'Sara Thomas', email: 'sara.t@example.com', mobile: '+91 98111 20004', city: 'Kochi', source: 'Referral', interest: 'MSc Nursing · UK · Jan 2028', stage: 'assessment_booked', score: 77, createdAt: minutesFromNow(-60 * 50), counsellorId: 'c1', activities: [{ at: minutesFromNow(-60 * 48), channel: 'WhatsApp', outcome: 'Reached', notes: 'Session booked for Friday.' }] },
  { id: 'l5', name: 'Rahul Nair', email: 'rahul.n@example.com', mobile: '+91 98111 20005', city: 'Bengaluru', source: 'Seminar', interest: 'MSc Mechanical Engineering · Germany · Winter 2027', stage: 'assessed', score: 88, createdAt: minutesFromNow(-60 * 120), counsellorId: 'c1', activities: [{ at: minutesFromNow(-60 * 30), channel: 'Meeting', outcome: 'Reached', notes: 'Plan shared: TU options, APS needed.' }] },
  { id: 'l6', name: 'Ishita Sen', email: 'ishita.s@example.com', mobile: '+91 98111 20006', city: 'Kolkata', source: 'Website', interest: 'MSc Finance · UK · Sep 2027', stage: 'contacted', score: 58, createdAt: minutesFromNow(-60 * 75), counsellorId: 'c3', activities: [{ at: minutesFromNow(-60 * 70), channel: 'Call', outcome: 'No answer' }, { at: minutesFromNow(-60 * 46), channel: 'Call', outcome: 'No answer' }] },
  { id: 'l7', name: 'Vivek Reddy', email: 'vivek.r@example.com', mobile: '+91 98111 20007', city: 'Hyderabad', source: 'WhatsApp', interest: 'MSc Information Systems · Ireland · Jan 2028', stage: 'new_lead', score: 45, createdAt: minutesFromNow(-60 * 3), counsellorId: 'c2', activities: [] },
  { id: 'l8', name: 'Pooja Iyer', email: 'pooja.i@example.com', mobile: '+91 98111 20008', city: 'Chennai', source: 'Walk-in', interest: 'MSc Biotechnology · Ireland · Sep 2027', stage: 'assessed', score: 69, createdAt: minutesFromNow(-60 * 200), counsellorId: 'c3', activities: [{ at: minutesFromNow(-60 * 90), channel: 'Meeting', outcome: 'Reached', notes: 'Shared plan; waiting for budget confirmation from parents.' }] },
];

export type FollowUpType = 'call' | 'whatsapp' | 'verify' | 'reminder' | 'checkin';

export interface FollowUp {
  id: string;
  counsellorId: string;
  person: string;
  personId: string;
  personType: 'lead' | 'student';
  action: string;
  rule: string;
  dueAt: string;
  type: FollowUpType;
  done: boolean;
}

export const demoFollowUps: FollowUp[] = [
  { id: 'f1', counsellorId: 'c1', person: 'Karan Malhotra', personId: 'l1', personType: 'lead', action: 'First contact with new enquiry', rule: 'New enquiry · 15 minutes', dueAt: minutesFromNow(-7), type: 'call', done: false },
  { id: 'f2', counsellorId: 'c1', person: 'Diya Patel', personId: 'l2', personType: 'lead', action: 'First contact with new enquiry', rule: 'New enquiry · 15 minutes', dueAt: minutesFromNow(9), type: 'call', done: false },
  { id: 'f3', counsellorId: 'c3', person: 'Ishita Sen', personId: 'l6', personType: 'lead', action: 'Follow up (2 unanswered calls)', rule: 'No session booked · 48 hours', dueAt: minutesFromNow(-60 * 2), type: 'whatsapp', done: false },
  { id: 'f4', counsellorId: 'c1', person: 'Ananya Sharma', personId: 's1', personType: 'student', action: 'Verify uploaded document: Statement of Purpose', rule: 'Document uploaded · 1 working day', dueAt: minutesFromNow(60 * 3), type: 'verify', done: false },
  { id: 'f5', counsellorId: 'c1', person: 'Rahul Nair', personId: 'l5', personType: 'lead', action: 'Follow up on shared plan', rule: 'Plan shared, not registered · 48 hours', dueAt: minutesFromNow(60 * 5), type: 'call', done: false },
  { id: 'f6', counsellorId: 'c1', person: 'Meera Krishnan', personId: 's4', personType: 'student', action: '1-week check-in after arrival', rule: 'After arrival · 1 week', dueAt: minutesFromNow(60 * 26), type: 'checkin', done: false },
  { id: 'f8', counsellorId: 'c2', person: 'Aman Gill', personId: 'l3', personType: 'lead', action: 'Book an assessment session', rule: 'Contacted, no session booked · 48 hours', dueAt: minutesFromNow(60 * 4), type: 'call', done: false },
  { id: 'f9', counsellorId: 'c3', person: 'Nikhil Bose', personId: 's5', personType: 'student', action: 'Check visa decision status', rule: 'Visa filed · follow up', dueAt: minutesFromNow(-30), type: 'reminder', done: false },
  { id: 'f7', counsellorId: 'c1', person: 'Arjun Mehta', personId: 's2', personType: 'student', action: 'Remind about visa fee due', rule: 'Visa fee due · 7 days before', dueAt: minutesFromNow(60 * 30), type: 'reminder', done: false },
];

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

/** Allowed status changes; anything else is blocked. */
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
  counsellorId: string;
  /** Login account linked to this record (for the demo student and new registrations). */
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

/** Accepting or declining an offer is the student's decision; staff can't change or correct it. */
export const isStudentDecision = (s: AppState) => s === 'accepted' || s === 'declined';

/** Moves the student's pipeline stage forward only (never back). */
export const advanceStage = (s: StaffStudent, to: StageKey): StaffStudent => (stageIndex(to) > stageIndex(s.stage) ? { ...s, stage: to } : s);

/** Documents every new student is asked for. */
export const starterDocuments = (): StudentDocument[] =>
  ['Passport (first and last page)', 'Degree certificate', 'Academic transcripts', 'English test score report', 'Updated CV'].map((name, i) => ({
    id: `doc-${Date.now().toString(36)}-${i}`,
    name,
    state: 'missing' as const,
    category: 'general' as const,
  }));

const ago = (days: number) => minutesFromNow(-60 * 24 * days);
const plan = (summary: string, days: number) => ({ at: ago(days), by: 'Priya Desai', summary });
const item = (id: string, university: string, course: string, country: string, extra: Partial<ShortlistItem> = {}): ShortlistItem => ({
  id,
  university,
  course,
  country,
  intake: 'September 2027',
  tuition: '£30,000 a year',
  livingCost: '£1,300 a month',
  deadline: daysFromNow(40),
  agency: 'Demo Partner Agency A',
  earnsCommission: true,
  reason: 'Good match for your profile and goals.',
  comments: [],
  ...extra,
});
const doc = (id: string, name: string, state: DocState, category: DocCategory = 'general', days = 3, reason?: string) => ({
  id,
  name,
  state,
  category,
  uploadedAt: state === 'missing' ? undefined : ago(days),
  reason,
});
const journey = (j: Partial<Journey>): Journey => ({ ...emptyJourney(), ...j });
const allDepartureDone = () => Object.fromEntries(DEPARTURE_TASKS.map((t) => [t.key, ago(20)]));

export const demoStudents: StaffStudent[] = [
  {
    id: 's1', counsellorId: 'c1', userId: 'demo-student-1', assignmentHistory: [], reference: 'AH-2026-00042', name: 'Ananya Sharma', email: 'demo.student@ahatin.example', mobile: '+91 98000 00000',
    goal: 'MSc Data Science', destination: 'United Kingdom', intake: 'September 2027', stage: 'applications_submitted',
    documents: [
      doc('d1', 'Passport (first and last page)', 'verified', 'general', 20),
      doc('d2', 'Degree certificate', 'verified', 'general', 20),
      doc('d3', 'Academic transcripts', 'verified', 'general', 20),
      doc('d4', 'IELTS score report', 'verified', 'general', 6),
      doc('d5', 'Statement of Purpose (final)', 'pending', 'general', 0.2),
      doc('d6', 'Letter of Recommendation 1', 'verified', 'general', 8),
      doc('d7', 'Letter of Recommendation 2', 'rejected', 'general', 2, 'Signature missing; please upload a signed copy'),
      doc('d8', 'Updated CV', 'missing'),
      doc('d9', 'Bank statement (last 3 months)', 'missing', 'funds'),
    ],
    applications: [
      { id: 'a1', university: 'University of Manchester', course: 'MSc Data Science', agency: 'Demo Partner Agency A', state: 'conditional_offer', deadline: daysFromNow(30), conditions: [{ text: 'Final degree certificate with at least 60% / 7.0 CGPA', met: false }, { text: 'IELTS 6.5 overall with no band below 6.0', met: true }] },
      { id: 'a2', university: 'King’s College London', course: 'MSc Data Science', agency: 'Demo Partner Agency A', state: 'under_review', deadline: daysFromNow(45) },
      { id: 'a3', university: 'University College Dublin', course: 'MSc Business Analytics', agency: 'Demo Partner Agency B', state: 'submitted', deadline: daysFromNow(60) },
      { id: 'a4', university: 'University of Leeds', course: 'MSc Data Science and Analytics', agency: 'Demo Partner Agency A', state: 'draft', deadline: daysFromNow(9) },
    ],
    journey: journey({
      careerPlan: plan('Data Science and Analytics, UK first', 40),
      shortlist: {
        version: 1, status: 'approved', sharedAt: ago(30), approvedAt: ago(28), firstApprovedAt: ago(28),
        items: [
          item('sl1', 'University of Manchester', 'MSc Data Science', 'United Kingdom', { tuition: '£33,000 a year', choice: 'apply', reason: 'Strong data-science department; your 8.4 CGPA meets the entry requirement.' }),
          item('sl2', 'King’s College London', 'MSc Data Science', 'United Kingdom', { tuition: '£35,000 a year', livingCost: '£1,600 a month', choice: 'apply', reason: 'Ambitious choice with excellent London employer links.' }),
          item('sl3', 'University College Dublin', 'MSc Business Analytics', 'Ireland', { tuition: '€29,000 a year', livingCost: '€1,400 a month', agency: 'Demo Partner Agency B', choice: 'apply', reason: 'Good back-up with a two-year stay-back visa in Ireland.' }),
          item('sl4', 'University of Leeds', 'MSc Data Science and Analytics', 'United Kingdom', { tuition: '£31,000 a year', choice: 'apply', reason: 'Safe option with a strong scholarship record for Indian students.' }),
          item('sl5', 'University of Glasgow', 'MSc Data Analytics', 'United Kingdom', { choice: 'removed', removeReason: 'I prefer to stay in England.', reason: 'Well-ranked, lower living costs.' }),
        ],
      },
      funding: {
        estimatedCost: 34,
        sources: [{ id: 'fs1', kind: 'Family savings', amount: 12 }, { id: 'fs2', kind: 'Education loan', amount: 18 }],
        scholarships: [{ id: 'sc1', name: 'Demo Global Excellence Scholarship (Manchester)', amount: '£5,000', deadline: daysFromNow(25), status: 'applied' }],
      },
    }),
    notes: [{ at: ago(3), by: 'Priya Desai', text: 'Strong profile. Prioritise Manchester; check scholarship for international students.' }],
  },
  {
    id: 's2', counsellorId: 'c1', assignmentHistory: [], reference: 'AH-2026-00031', name: 'Arjun Mehta', email: 'arjun.m@example.com', mobile: '+91 98111 30002',
    goal: 'MSc Computer Science', destination: 'United Kingdom', intake: 'September 2027', stage: 'offer_accepted',
    documents: [doc('d10', 'Passport (first and last page)', 'verified', 'general', 40), doc('d11', 'Bank statement (sponsor, 28 days)', 'pending', 'funds', 0.8), doc('d12', 'TB test certificate', 'missing', 'visa')],
    applications: [
      { id: 'a5', university: 'University of Glasgow', course: 'MSc Computer Science', agency: 'Demo Partner Agency A', state: 'accepted' },
      { id: 'a6', university: 'University of Leeds', course: 'MSc Advanced Computer Science', agency: 'Demo Partner Agency A', state: 'declined' },
    ],
    journey: journey({
      careerPlan: plan('Computer Science, UK', 90),
      shortlist: { version: 1, status: 'approved', sharedAt: ago(80), approvedAt: ago(78), firstApprovedAt: ago(78), items: [item('sl6', 'University of Glasgow', 'MSc Computer Science', 'United Kingdom', { choice: 'apply' }), item('sl7', 'University of Leeds', 'MSc Advanced Computer Science', 'United Kingdom', { choice: 'apply' })] },
      funding: { estimatedCost: 30, sources: [{ id: 'fs3', kind: 'Sponsor', amount: 30 }], scholarships: [] },
      visa: { stage: 'cas_received', history: [{ at: ago(2), by: 'Priya Desai', stage: 'cas_received', note: 'CAS from Glasgow received.' }] },
    }),
    notes: [{ at: ago(1), by: 'Priya Desai', text: 'CAS received. Mock credibility interview scheduled next week.' }],
  },
  {
    id: 's3', counsellorId: 'c2', assignmentHistory: [], reference: 'AH-2026-00055', name: 'Fatima Sheikh', email: 'fatima.s@example.com', mobile: '+91 98111 30003',
    goal: 'MSc Public Health', destination: 'Ireland', intake: 'September 2027', stage: 'documents_shortlist',
    documents: [doc('d13', 'Passport (first and last page)', 'pending', 'general', 0.1), doc('d14', 'Degree certificate', 'pending', 'general', 0.1)],
    applications: [],
    journey: journey({
      careerPlan: { at: ago(12), by: 'Rohan Kapoor', summary: 'Public Health, Ireland' },
      shortlist: {
        version: 1, status: 'shared', sharedAt: ago(1),
        items: [
          item('sl8', 'University College Dublin', 'MSc Public Health', 'Ireland', { tuition: '€24,000 a year', livingCost: '€1,400 a month', agency: 'Demo Partner Agency B' }),
          item('sl9', 'Demo University of Galway', 'MSc Health Promotion', 'Ireland', { tuition: '€19,000 a year', livingCost: '€1,100 a month', agency: 'Demo Partner Agency B', earnsCommission: false }),
        ],
      },
    }),
    notes: [],
  },
  {
    id: 's4', counsellorId: 'c1', assignmentHistory: [], reference: 'AH-2025-00187', name: 'Meera Krishnan', email: 'meera.k@example.com', mobile: '+91 98111 30004',
    goal: 'MSc Mechanical Engineering', destination: 'Germany', intake: 'Winter 2026', stage: 'arrived',
    documents: [doc('d15', 'Blocked account confirmation', 'verified', 'funds', 70)],
    applications: [{ id: 'a7', university: 'Technical University of Munich', course: 'MSc Mechanical Engineering', agency: 'Own application', state: 'accepted' }],
    journey: journey({
      careerPlan: plan('Mechanical Engineering, Germany', 300),
      shortlist: { version: 1, status: 'approved', sharedAt: ago(280), approvedAt: ago(275), firstApprovedAt: ago(275), items: [item('sl10', 'Technical University of Munich', 'MSc Mechanical Engineering', 'Germany', { tuition: 'No tuition fee', livingCost: '€1,100 a month', agency: 'Own application', earnsCommission: false, choice: 'apply' })] },
      funding: { estimatedCost: 14, sources: [{ id: 'fs4', kind: 'Family savings', amount: 14 }], scholarships: [] },
      visa: { stage: 'granted', history: [{ at: ago(60), by: 'Priya Desai', stage: 'granted' }] },
      departure: { done: allDepartureDone(), confirmedAt: ago(18), confirmedBy: 'Priya Desai' },
      arrival: { arrivedAt: ago(10) },
    }),
    notes: [{ at: ago(5), by: 'Priya Desai', text: 'Arrived in Munich. Anmeldung appointment booked.' }],
  },
  {
    id: 's5', counsellorId: 'c3', assignmentHistory: [], reference: 'AH-2026-00060', name: 'Nikhil Bose', email: 'nikhil.b@example.com', mobile: '+91 98111 30005',
    goal: 'MSc Finance', destination: 'United Kingdom', intake: 'January 2027', stage: 'visa_filed',
    documents: [doc('d16', 'Bank statement (28 days)', 'verified', 'funds', 25)],
    applications: [{ id: 'a8', university: 'University of Leeds', course: 'MSc Finance', agency: 'Demo Partner Agency A', state: 'accepted' }],
    journey: journey({
      careerPlan: { at: ago(120), by: 'Neha Joshi', summary: 'Finance, UK' },
      shortlist: { version: 1, status: 'approved', sharedAt: ago(110), approvedAt: ago(108), firstApprovedAt: ago(108), items: [item('sl11', 'University of Leeds', 'MSc Finance', 'United Kingdom', { intake: 'January 2027', choice: 'apply' })] },
      funding: { estimatedCost: 32, sources: [{ id: 'fs5', kind: 'Education loan', amount: 32 }], scholarships: [] },
      visa: { stage: 'submitted', reference: 'GWF0123456', history: [{ at: ago(6), by: 'Neha Joshi', stage: 'submitted', note: 'Reference GWF0123456' }] },
    }),
    notes: [],
  },
  {
    id: 's6', counsellorId: 'c2', assignmentHistory: [], reference: 'AH-2026-00071', name: 'Tanvi Kulkarni', email: 'tanvi.k@example.com', mobile: '+91 98111 30006',
    goal: 'MSc Marketing', destination: 'Ireland', intake: 'September 2027', stage: 'registered',
    documents: [doc('d17', 'Passport (first and last page)', 'missing'), doc('d18', 'Degree certificate', 'missing')],
    applications: [],
    journey: journey({}),
    notes: [],
  },
  {
    id: 's7', counsellorId: 'c3', assignmentHistory: [], reference: 'AH-2026-00077', name: 'Harsh Vardhan', email: 'harsh.v@example.com', mobile: '+91 98111 30007',
    goal: 'MSc Business Analytics', destination: 'Germany', intake: 'Winter 2027', stage: 'documents_shortlist',
    documents: [doc('d19', 'APS certificate', 'pending', 'general', 0.3)],
    applications: [],
    journey: journey({
      careerPlan: { at: ago(9), by: 'Neha Joshi', summary: 'Business Analytics, Germany' },
      shortlist: { version: 1, status: 'draft', items: [item('sl12', 'Demo University of Mannheim', 'MSc Business Analytics', 'Germany', { intake: 'Winter 2027', tuition: '€1,500 a semester', livingCost: '€1,000 a month', agency: 'Demo Master Agent C' })] },
    }),
    notes: [],
  },
  {
    id: 's8', counsellorId: 'c2', assignmentHistory: [], reference: 'AH-2026-00081', name: 'Leela Menon', email: 'leela.m@example.com', mobile: '+91 98111 30008',
    goal: 'MSc International Business', destination: 'France', intake: 'September 2027', stage: 'applications_submitted',
    documents: [],
    applications: [{ id: 'a9', university: 'Demo Business School, Lyon', course: 'MSc International Business', agency: 'Demo Master Agent C', state: 'under_review', deadline: daysFromNow(35) }],
    journey: journey({
      careerPlan: { at: ago(50), by: 'Rohan Kapoor', summary: 'International Business, France' },
      shortlist: { version: 1, status: 'approved', sharedAt: ago(40), approvedAt: ago(38), firstApprovedAt: ago(38), items: [item('sl13', 'Demo Business School, Lyon', 'MSc International Business', 'France', { tuition: '€18,000 a year', livingCost: '€1,100 a month', agency: 'Demo Master Agent C', choice: 'apply' })] },
    }),
    notes: [],
  },
  {
    // Demo login new.student@ahatin.example: nothing started, for trying every service by hand.
    id: 's9', counsellorId: 'c1', userId: 'demo-student-2', assignmentHistory: [], reference: 'AH-2026-00090', name: 'Aarav Patel', email: 'new.student@ahatin.example', mobile: '+91 98000 33333',
    goal: 'To be decided', destination: 'United Kingdom', intake: 'September 2027', stage: 'registered',
    documents: [
      doc('d20', 'Passport (first and last page)', 'missing'),
      doc('d21', 'Degree certificate', 'missing'),
      doc('d22', 'Academic transcripts', 'missing'),
      doc('d23', 'English test score report', 'missing'),
      doc('d24', 'Updated CV', 'missing'),
    ],
    applications: [],
    journey: journey({}),
    notes: [{ at: ago(1), by: 'System', text: 'Registered online.' }],
  },
];

export const serviceShortNames = ['Counselling', 'Uni & country', 'Applications', 'Funding', 'Visa', 'Pre-departure', 'Post-arrival'];

/* ------------------------------ Admin ------------------------------ */

export const funnel = [
  { stage: 'Enquiries', count: 420 },
  { stage: 'Contacted', count: 371 },
  { stage: 'Assessed', count: 214 },
  { stage: 'Registered', count: 118 },
  { stage: 'Applied', count: 96 },
  { stage: 'Offer accepted', count: 71 },
  { stage: 'Visa granted', count: 63 },
  { stage: 'Enrolled', count: 58 },
];

export const leadSources = [
  { source: 'Website', count: 148 },
  { source: 'Google ads', count: 92 },
  { source: 'Instagram', count: 71 },
  { source: 'Referrals', count: 54 },
  { source: 'Seminars & events', count: 38 },
  { source: 'Walk-in / WhatsApp', count: 17 },
];

export const counsellorWorkload = [
  { name: 'Priya Desai', activeStudents: 34, openLeads: 18, overdue: 2, medianResponse: 11 },
  { name: 'Rohan Kapoor', activeStudents: 29, openLeads: 22, overdue: 5, medianResponse: 19 },
  { name: 'Neha Joshi', activeStudents: 21, openLeads: 14, overdue: 0, medianResponse: 8 },
];

export type StaffRole = 'counsellor' | 'officer' | 'admin';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: 'active' | 'deactivated';
  lastLogin: string;
}

export const demoStaffUsers: StaffUser[] = [
  { id: 'u1', name: 'Vikram Rao', email: 'demo.admin@ahatin.example', role: 'admin', status: 'active', lastLogin: minutesFromNow(-5) },
  { id: 'u2', name: 'Priya Desai', email: 'demo.counsellor@ahatin.example', role: 'counsellor', status: 'active', lastLogin: minutesFromNow(-40) },
  { id: 'u3', name: 'Rohan Kapoor', email: 'rohan.k@ahatin.example', role: 'counsellor', status: 'active', lastLogin: minutesFromNow(-60 * 3) },
  { id: 'u4', name: 'Neha Joshi', email: 'neha.j@ahatin.example', role: 'counsellor', status: 'active', lastLogin: minutesFromNow(-60 * 20) },
  { id: 'u5', name: 'Sameer Khan', email: 'sameer.k@ahatin.example', role: 'officer', status: 'active', lastLogin: minutesFromNow(-60 * 2) },
];

export const demoAgencies = [
  { id: 'g1', name: 'Demo Partner Agency A', type: 'Aggregator', countries: 'UK, Ireland', commissionShare: '60%', agreementEnd: daysFromNow(240), status: 'Active', applications: 64 },
  { id: 'g2', name: 'Demo Partner Agency B', type: 'Aggregator', countries: 'Ireland, Germany', commissionShare: '55%', agreementEnd: daysFromNow(21), status: 'Active', applications: 41 },
  { id: 'g3', name: 'Demo Master Agent C', type: 'Master agent', countries: 'Germany, France', commissionShare: '50%', agreementEnd: daysFromNow(400), status: 'Active', applications: 12 },
  { id: 'g4', name: 'Demo Partner Agency D', type: 'Aggregator', countries: 'UK', commissionShare: '58%', agreementEnd: daysFromNow(-30), status: 'Inactive', applications: 9 },
];

export const followUpRules = [
  { trigger: 'New enquiry (working hours)', action: 'Make first contact', limit: '15 minutes', escalation: 'Manager alerted' },
  { trigger: 'New enquiry (out of hours)', action: 'Make first contact', limit: '11:00 next working day', escalation: 'Manager alerted' },
  { trigger: 'Contacted, no session booked', action: 'Follow up', limit: '48 hours, then 7 days', escalation: 'Nurture after 3 failed tries' },
  { trigger: 'Assessment done', action: 'Share the plan', limit: '24 hours', escalation: 'Manager alerted' },
  { trigger: 'Document uploaded', action: 'Verify or reject', limit: '1 working day', escalation: 'Manager alerted' },
  { trigger: 'Application or scholarship deadline', action: 'Remind student and staff', limit: '14, 7 and 2 days before', escalation: 'Manager alerted at 2 days' },
  { trigger: 'Planned arrival', action: 'Confirm safe arrival', limit: '24 hours', escalation: 'Counsellor and manager alerted' },
  { trigger: 'Urgent support message', action: 'Respond', limit: '2 hours, any day', escalation: 'Manager alerted immediately' },
];

/* ------------------------------ Scheduling ------------------------------ */

/** A date N days from today, moved forward past Sundays (and Saturdays when weekdaysOnly). */
function workday(offset: number, weekdaysOnly = false) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || (weekdaysOnly && d.getDay() === 6)) d.setDate(d.getDate() + 1);
  return isoDate(d);
}
const today = () => isoDate(new Date());

const weekdays = (blocks: Availability['weekly'][string]) => ({ '1': blocks, '2': blocks, '3': blocks, '4': blocks, '5': blocks });

export const demoAvailability: Availability[] = [
  {
    counsellorId: 'c1',
    weekly: {
      ...weekdays([
        { start: '10:00', end: '13:00', mode: 'both' },
        { start: '14:00', end: '18:00', mode: 'both' },
      ]),
      '6': [{ start: '10:00', end: '14:00', mode: 'office' }],
    },
    slotMinutes: 45,
    bufferMinutes: 15,
    minNoticeHours: 12,
    horizonDays: 14,
  },
  {
    counsellorId: 'c2',
    weekly: weekdays([{ start: '11:00', end: '19:00', mode: 'online' }]),
    slotMinutes: 30,
    bufferMinutes: 0,
    minNoticeHours: 4,
    horizonDays: 14,
  },
  {
    counsellorId: 'c3',
    weekly: { '2': [{ start: '10:00', end: '16:00', mode: 'both' }], '3': [{ start: '10:00', end: '16:00', mode: 'both' }], '4': [{ start: '10:00', end: '16:00', mode: 'both' }], '5': [{ start: '10:00', end: '16:00', mode: 'both' }], '6': [{ start: '10:00', end: '16:00', mode: 'both' }] },
    slotMinutes: 60,
    bufferMinutes: 0,
    minNoticeHours: 24,
    horizonDays: 21,
  },
];

export const demoTimeOff: TimeOff[] = [
  { id: 'to1', counsellorId: 'c1', date: workday(6, true), reason: 'Education fair (demo)' },
  { id: 'to2', counsellorId: 'c2', date: workday(2, true), start: '15:00', end: '19:00', reason: 'Training (demo)' },
];

const created = (by: string) => [{ at: new Date(Date.now() - 86_400_000).toISOString(), by, text: 'Session booked.' }];

export const demoSessions: Session[] = [
  { id: 'ss1', studentId: 's1', counsellorId: 'c1', type: 'Application review', date: workday(3, true), time: '16:00', durationMinutes: 45, mode: 'online', status: 'booked', bookedBy: 'student', studentNote: 'Want to discuss the Manchester offer conditions.', history: created('Ananya Sharma') },
  { id: 'ss2', studentId: 's2', counsellorId: 'c1', type: 'Visa preparation', date: today(), time: '17:00', durationMinutes: 45, mode: 'online', status: 'booked', bookedBy: 'counsellor', history: created('Priya Desai') },
  { id: 'ss3', studentId: 's4', counsellorId: 'c1', type: 'Post-arrival check-in', date: today(), time: '11:00', durationMinutes: 45, mode: 'online', status: 'booked', bookedBy: 'counsellor', history: created('Priya Desai') },
  { id: 'ss4', studentId: 's3', counsellorId: 'c2', type: 'Career counselling', date: workday(2, true), time: '12:00', durationMinutes: 30, mode: 'online', status: 'booked', bookedBy: 'student', history: created('Fatima Sheikh') },
  { id: 'ss5', studentId: 's5', counsellorId: 'c3', type: 'Visa preparation', date: workday(2), time: '11:00', durationMinutes: 60, mode: 'office', status: 'booked', bookedBy: 'student', history: created('Nikhil Bose') },
  { id: 'ss6', studentId: 's2', counsellorId: 'c1', type: 'Scholarship & funding', date: isoDate(new Date(Date.now() - 5 * 86_400_000)), time: '15:00', durationMinutes: 45, mode: 'office', status: 'completed', bookedBy: 'student', outcomeNotes: 'Confirmed sponsor funds; bank letter to be uploaded.', history: created('Arjun Mehta') },
  { id: 'ss7', studentId: 's6', counsellorId: 'c2', type: 'Career counselling', date: isoDate(new Date(Date.now() - 2 * 86_400_000)), time: '13:00', durationMinutes: 30, mode: 'online', status: 'no_show', bookedBy: 'student', history: created('Tanvi Kulkarni') },
  // Aarav's first session, booked by Priya for the day the demo data loads (same time as Arjun's, on request).
  { id: 'ss8', studentId: 's9', counsellorId: 'c1', type: 'Career counselling', date: today(), time: '17:00', durationMinutes: 45, mode: 'online', status: 'booked', bookedBy: 'counsellor', history: created('Priya Desai') },
];

/* ------------------------------ Messages ------------------------------ */

/** One message in the chat between a student and their counsellor (or whoever is covering). */
export interface Message {
  id: string;
  studentId: string;
  from: 'student' | 'staff';
  /** Sender's name, e.g. "Priya Desai". */
  by: string;
  text: string;
  at: string;
  /** When the other side read it. */
  readAt?: string;
}

export const demoMessages: Message[] = [
  { id: 'm1', studentId: 's1', from: 'student', by: 'Ananya Sharma', text: 'Hi Priya, does Manchester offer any scholarship for Indian students?', at: minutesFromNow(-60 * 26), readAt: minutesFromNow(-60 * 25) },
  { id: 'm2', studentId: 's1', from: 'staff', by: 'Priya Desai', text: 'Yes. The Global Excellence Scholarship (£5,000). I have added it to your funding plan; the deadline is in your dashboard.', at: minutesFromNow(-60 * 25), readAt: minutesFromNow(-60 * 24) },
  { id: 'm3', studentId: 's1', from: 'student', by: 'Ananya Sharma', text: 'Thank you! I will apply this week.', at: minutesFromNow(-60 * 3) },
];

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

export const demoGrants: AccessGrant[] = [
  { id: 'g1', granteeId: 'c1', ownerId: 'c2', until: workday(4, true), reason: 'Rohan on leave (demo)', grantedBy: 'Vikram Rao' },
];

export const isGrantActive = (g: AccessGrant, now = new Date()) => !g.revoked && g.until >= isoDate(now);

/* ------------------------------ New registrations ------------------------------ */

const destinationLabels: Record<string, string> = {
  uk: 'United Kingdom',
  europe: 'Europe',
  undecided: 'Not decided',
};

/** Builds the staff-side record for a student who registered online, assigned to the counsellor with the fewest students. */
export function newStudentRecord(
  user: { id: string; name: string; email: string; mobile: string; studentReference?: string },
  details: { destination?: string; intake?: string },
  existing: StaffStudent[],
): StaffStudent {
  const load = (cid: string) => existing.filter((s) => s.counsellorId === cid).length;
  const counsellorId = [...counsellors].sort((a, b) => load(a.id) - load(b.id))[0]!.id;
  const [y, m] = (details.intake ?? '').split('-');
  const intake = y && m ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'To be decided';
  return {
    id: `st-${user.id}`,
    counsellorId,
    userId: user.id,
    assignmentHistory: [{ at: new Date().toISOString(), by: 'System', from: '', to: counsellorId, reason: 'Assigned automatically to the counsellor with the fewest students' }],
    reference: user.studentReference ?? 'AH-2026-NEW',
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    goal: 'To be decided',
    destination: destinationLabels[details.destination ?? ''] ?? 'Not decided',
    intake,
    stage: 'registered',
    documents: starterDocuments(),
    applications: [],
    journey: emptyJourney(),
    notes: [{ at: new Date().toISOString(), by: 'System', text: 'Registered online.' }],
  };
}
