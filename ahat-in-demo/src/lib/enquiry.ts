import { readShared, updateShared } from './demoStore';
import { uid } from './crypto';
import { ApiError } from './api/types';
import type { EnquiryForm } from './validation';
import { counsellorName, counsellors, demoFollowUps, demoLeads, demoStudents, type FollowUp, type Lead, type StaffStudent } from '../data/staff';

/**
 * DEMO ONLY: the homepage enquiry form, without an account. In the real portal the website posts
 * to the FastAPI backend, which applies the same rules on the server.
 */

export const enquiryDestinations = [
  { value: 'uk', label: 'United Kingdom' },
  { value: 'europe', label: 'Europe (Germany, Ireland, France)' },
  { value: 'undecided', label: 'Not sure yet' },
];

export const enquiryIntakes = [
  { value: '2027-01', label: 'January 2027' },
  { value: '2027-09', label: 'September 2027' },
  { value: '2028-01', label: 'January 2028' },
  { value: '2028-09', label: 'September 2028' },
  { value: 'unsure', label: 'Not sure yet' },
];

export const callTimes = [
  { value: '', label: 'Any time' },
  { value: 'Morning (10:00–13:00)', label: 'Morning (10:00–13:00)' },
  { value: 'Afternoon (13:00–16:00)', label: 'Afternoon (13:00–16:00)' },
  { value: 'Evening (16:00–19:00)', label: 'Evening (16:00–19:00)' },
];

export interface EnquiryResult {
  /** new: a new lead; lead: added to an existing lead; student: added to a registered student's record. */
  kind: 'new' | 'lead' | 'student' | 'ignored';
  counsellor?: string;
}

const RATE_KEY = 'ahatin-demo-enquiry-times';
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60_000;
const LEAD_STAGES = ['new_lead', 'contacted', 'assessment_booked', 'assessed'];

const lastTen = (mobile: string) => mobile.replace(/\D/g, '').slice(-10);
const formatMobile = (ten: string) => `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function checkRateLimit() {
  let times: number[] = [];
  try {
    times = (JSON.parse(localStorage.getItem(RATE_KEY) ?? '[]') as number[]).filter((t) => Date.now() - t < RATE_WINDOW_MS);
  } catch {
    /* ignore unreadable value */
  }
  if (times.length >= RATE_LIMIT) {
    throw new ApiError(429, 'You have sent several enquiries in the last few minutes. Please wait a little, or call us instead.');
  }
  try {
    localStorage.setItem(RATE_KEY, JSON.stringify([...times, Date.now()]));
  } catch {
    /* storage blocked: skip the limit in the demo */
  }
}

function summary(d: EnquiryForm) {
  const dest = d.destination === 'uk' ? 'UK' : d.destination === 'europe' ? 'Europe' : 'Destination not decided';
  const [y, m] = d.intake.split('-');
  const intake = y && m ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Intake not decided';
  return [d.course.trim() || 'Course not decided', dest, intake].join(' · ');
}

function followUp(counsellorId: string, person: string, personId: string, personType: FollowUp['personType'], action: string): FollowUp {
  return {
    id: `f-${uid()}`,
    counsellorId,
    person,
    personId,
    personType,
    action,
    rule: 'New enquiry · 15 minutes',
    dueAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    type: 'call',
    done: false,
  };
}

export async function submitEnquiry(d: EnquiryForm): Promise<EnquiryResult> {
  await wait(600);
  // Spam trap filled in: look successful but keep nothing.
  if (d.website.trim()) return { kind: 'ignored' };
  checkRateLimit();

  const email = d.email.trim().toLowerCase();
  const mobile = lastTen(d.mobile);
  const now = new Date().toISOString();
  const interest = summary(d);
  const details = [d.callTime && `Preferred call time: ${d.callTime}.`, d.message.trim()].filter(Boolean).join(' ');
  const matches = (x: { email: string; mobile: string }) => x.email.toLowerCase() === email || lastTen(x.mobile) === mobile;

  // Already a registered student: add it to their record for their counsellor.
  const student = readShared<StaffStudent[]>('students', demoStudents).find(matches);
  if (student) {
    updateShared<StaffStudent[]>('students', demoStudents, (all) =>
      all.map((s) => (s.id === student.id ? { ...s, notes: [{ at: now, by: 'Website', text: `New website enquiry: ${interest}.${details ? ` ${details}` : ''}` }, ...s.notes] } : s)),
    );
    updateShared<FollowUp[]>('followups', demoFollowUps, (all) => [followUp(student.counsellorId, student.name, student.id, 'student', 'Reply to website enquiry from a registered student'), ...all]);
    return { kind: 'student', counsellor: counsellorName(student.counsellorId) };
  }

  // Already a lead: add the enquiry to it instead of creating a duplicate.
  const lead = readShared<Lead[]>('leads', demoLeads).find(matches);
  if (lead) {
    updateShared<Lead[]>('leads', demoLeads, (all) =>
      all.map((l) =>
        l.id === lead.id
          ? { ...l, message: d.message.trim() || l.message, callTime: d.callTime || l.callTime, activities: [{ at: now, channel: 'Website', outcome: 'New enquiry received', notes: `${interest}.${details ? ` ${details}` : ''}` }, ...l.activities] }
          : l,
      ),
    );
    updateShared<FollowUp[]>('followups', demoFollowUps, (all) => [followUp(lead.counsellorId, lead.name, lead.id, 'lead', 'Reply to repeat website enquiry'), ...all]);
    return { kind: 'lead', counsellor: counsellorName(lead.counsellorId) };
  }

  // New lead, assigned to the counsellor with the fewest open leads.
  const leads = readShared<Lead[]>('leads', demoLeads);
  const open = (cid: string) => leads.filter((l) => l.counsellorId === cid && LEAD_STAGES.includes(l.stage)).length;
  const counsellorId = [...counsellors].sort((a, b) => open(a.id) - open(b.id))[0]!.id;
  const id = `l-${uid()}`;
  const score = 40 + (d.destination !== 'undecided' ? 15 : 0) + (d.intake !== 'unsure' ? 15 : 0) + (d.course.trim() ? 10 : 0) + (d.message.trim() ? 10 : 0);
  const newLead: Lead = {
    id,
    name: d.name.trim(),
    email,
    mobile: formatMobile(mobile),
    city: 'Not given',
    source: 'Website',
    interest,
    stage: 'new_lead',
    score,
    createdAt: now,
    counsellorId,
    message: d.message.trim() || undefined,
    callTime: d.callTime || undefined,
    activities: [{ at: now, channel: 'System', outcome: `Website enquiry. Assigned automatically to ${counsellorName(counsellorId)} (fewest open leads)` }],
  };
  updateShared<Lead[]>('leads', demoLeads, (all) => [newLead, ...all]);
  updateShared<FollowUp[]>('followups', demoFollowUps, (all) => [followUp(counsellorId, newLead.name, id, 'lead', 'First contact with new enquiry'), ...all]);
  return { kind: 'new', counsellor: counsellorName(counsellorId) };
}
