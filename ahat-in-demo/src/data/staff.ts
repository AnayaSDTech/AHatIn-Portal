import { isoDate, type Availability, type Session, type TimeOff } from '../lib/scheduling';

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

export type DocState = 'pending' | 'verified' | 'rejected';
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
  services: number[]; // 7 values: 0 not started, 1 in progress, 2 completed
  documents: { id: string; name: string; state: DocState; uploadedAt: string; reason?: string }[];
  applications: { id: string; university: string; course: string; agency: string; state: AppState }[];
  notes: { at: string; by: string; text: string }[];
}

export const demoStudents: StaffStudent[] = [
  {
    id: 's1', counsellorId: 'c1', userId: 'demo-student-1', assignmentHistory: [], reference: 'AH-2026-00042', name: 'Ananya Sharma', email: 'demo.student@ahatin.example', mobile: '+91 98000 00000',
    goal: 'MSc Data Science', destination: 'United Kingdom', intake: 'September 2027', stage: 'applications_submitted', services: [2, 2, 1, 1, 0, 0, 0],
    documents: [
      { id: 'd1', name: 'Statement of Purpose (final)', state: 'pending', uploadedAt: minutesFromNow(-60 * 5) },
      { id: 'd2', name: 'IELTS score report', state: 'verified', uploadedAt: minutesFromNow(-60 * 24 * 6) },
      { id: 'd3', name: 'Letter of Recommendation 2', state: 'rejected', uploadedAt: minutesFromNow(-60 * 24 * 2), reason: 'Signature missing' },
    ],
    applications: [
      { id: 'a1', university: 'University of Manchester', course: 'MSc Data Science', agency: 'Demo Partner Agency A', state: 'conditional_offer' },
      { id: 'a2', university: 'King’s College London', course: 'MSc Data Science', agency: 'Demo Partner Agency A', state: 'under_review' },
      { id: 'a3', university: 'University College Dublin', course: 'MSc Business Analytics', agency: 'Demo Partner Agency B', state: 'submitted' },
      { id: 'a4', university: 'University of Leeds', course: 'MSc Data Science and Analytics', agency: 'Demo Partner Agency A', state: 'draft' },
    ],
    notes: [{ at: minutesFromNow(-60 * 24 * 3), by: 'Priya Desai', text: 'Strong profile. Prioritise Manchester; check scholarship for international students.' }],
  },
  {
    id: 's2', counsellorId: 'c1', assignmentHistory: [], reference: 'AH-2026-00031', name: 'Arjun Mehta', email: 'arjun.m@example.com', mobile: '+91 98111 30002',
    goal: 'MSc Computer Science', destination: 'United Kingdom', intake: 'September 2027', stage: 'offer_accepted', services: [2, 2, 2, 2, 1, 0, 0],
    documents: [{ id: 'd4', name: 'Bank statement (sponsor)', state: 'pending', uploadedAt: minutesFromNow(-60 * 20) }],
    applications: [
      { id: 'a5', university: 'University of Glasgow', course: 'MSc Computer Science', agency: 'Demo Partner Agency A', state: 'accepted' },
      { id: 'a6', university: 'University of Leeds', course: 'MSc Advanced Computer Science', agency: 'Demo Partner Agency A', state: 'declined' },
    ],
    notes: [{ at: minutesFromNow(-60 * 24), by: 'Priya Desai', text: 'CAS received. Mock credibility interview scheduled next week.' }],
  },
  {
    id: 's3', counsellorId: 'c2', assignmentHistory: [], reference: 'AH-2026-00055', name: 'Fatima Sheikh', email: 'fatima.s@example.com', mobile: '+91 98111 30003',
    goal: 'MSc Public Health', destination: 'Ireland', intake: 'September 2027', stage: 'documents_shortlist', services: [2, 1, 0, 1, 0, 0, 0],
    documents: [
      { id: 'd5', name: 'Passport', state: 'pending', uploadedAt: minutesFromNow(-60 * 2) },
      { id: 'd6', name: 'Degree certificate', state: 'pending', uploadedAt: minutesFromNow(-60 * 2) },
    ],
    applications: [],
    notes: [],
  },
  {
    id: 's4', counsellorId: 'c1', assignmentHistory: [], reference: 'AH-2025-00187', name: 'Meera Krishnan', email: 'meera.k@example.com', mobile: '+91 98111 30004',
    goal: 'MSc Mechanical Engineering', destination: 'Germany', intake: 'Winter 2026', stage: 'arrived', services: [2, 2, 2, 2, 2, 2, 1],
    documents: [],
    applications: [{ id: 'a7', university: 'Technical University of Munich', course: 'MSc Mechanical Engineering', agency: 'Own application', state: 'accepted' }],
    notes: [{ at: minutesFromNow(-60 * 24 * 5), by: 'Priya Desai', text: 'Arrived in Munich. Anmeldung appointment booked.' }],
  },
  {
    id: 's5', counsellorId: 'c3', assignmentHistory: [], reference: 'AH-2026-00060', name: 'Nikhil Bose', email: 'nikhil.b@example.com', mobile: '+91 98111 30005',
    goal: 'MSc Finance', destination: 'United Kingdom', intake: 'January 2027', stage: 'visa_filed', services: [2, 2, 2, 2, 1, 0, 0],
    documents: [],
    applications: [{ id: 'a8', university: 'University of Leeds', course: 'MSc Finance', agency: 'Demo Partner Agency A', state: 'accepted' }],
    notes: [],
  },
  {
    id: 's6', counsellorId: 'c2', assignmentHistory: [], reference: 'AH-2026-00071', name: 'Tanvi Kulkarni', email: 'tanvi.k@example.com', mobile: '+91 98111 30006',
    goal: 'MSc Marketing', destination: 'Ireland', intake: 'September 2027', stage: 'registered', services: [2, 1, 0, 0, 0, 0, 0],
    documents: [],
    applications: [],
    notes: [],
  },
  {
    id: 's7', counsellorId: 'c3', assignmentHistory: [], reference: 'AH-2026-00077', name: 'Harsh Vardhan', email: 'harsh.v@example.com', mobile: '+91 98111 30007',
    goal: 'MSc Business Analytics', destination: 'Germany', intake: 'Winter 2027', stage: 'documents_shortlist', services: [2, 1, 0, 1, 0, 0, 0],
    documents: [{ id: 'd7', name: 'APS certificate', state: 'pending', uploadedAt: minutesFromNow(-60 * 7) }],
    applications: [],
    notes: [],
  },
  {
    id: 's8', counsellorId: 'c2', assignmentHistory: [], reference: 'AH-2026-00081', name: 'Leela Menon', email: 'leela.m@example.com', mobile: '+91 98111 30008',
    goal: 'MSc International Business', destination: 'France', intake: 'September 2027', stage: 'applications_submitted', services: [2, 2, 1, 1, 0, 0, 0],
    documents: [],
    applications: [{ id: 'a9', university: 'Demo Business School, Lyon', course: 'MSc International Business', agency: 'Demo Master Agent C', state: 'under_review' }],
    notes: [],
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
    services: [2, 1, 0, 0, 0, 0, 0],
    documents: [],
    applications: [],
    notes: [{ at: new Date().toISOString(), by: 'System', text: 'Registered online.' }],
  };
}
