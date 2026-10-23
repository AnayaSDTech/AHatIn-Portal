/**
 * DEMO dashboard data for a fictional student. In the real portal this comes from
 * the FastAPI backend (e.g. GET /api/v1/students/me/dashboard).
 */

export type ServiceStatus = 'completed' | 'in_progress' | 'not_started';
export type DocStatus = 'verified' | 'pending' | 'rejected' | 'missing';
export type AppStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'conditional_offer'
  | 'unconditional_offer'
  | 'accepted'
  | 'declined'
  | 'rejected';

/** Date N days from today, as YYYY-MM-DD, so demo deadlines always look current. */
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fields the student can edit. Name and email come from the account; passport details lock once an application is submitted. */
export interface StudentProfile {
  dateOfBirth: string;
  city: string;
  passportNumber: string;
  degree: string;
  institution: string;
  grade: string;
  englishTest: string;
  englishScore: string;
  workExperience: string;
  courseInterest: string;
  destination: string;
  intake: string;
  budget: string;
}

export const demoProfile: StudentProfile = {
  dateOfBirth: '2001-04-18',
  city: 'Pune',
  passportNumber: 'Z1234567',
  degree: 'B.Tech Computer Science',
  institution: 'Demo Institute of Technology',
  grade: '8.4 CGPA',
  englishTest: 'IELTS',
  englishScore: '7.5',
  workExperience: '2 years · Data Analyst',
  courseInterest: 'MSc Data Science',
  destination: 'United Kingdom',
  intake: 'September 2027',
  budget: '₹25–35 lakh',
};

export const sessionTypes = [
  'Career counselling',
  'Application review',
  'Scholarship & funding',
  'Visa preparation',
  'Pre-departure briefing',
  'Post-arrival check-in',
] as const;


export const offerConditions: Record<string, { text: string; met: boolean }[]> = {
  'app-1': [
    { text: 'Final degree certificate with at least 60% / 7.0 CGPA', met: false },
    { text: 'IELTS 6.5 overall with no band below 6.0', met: true },
  ],
};

export const demoServices: { code: string; title: string; status: ServiceStatus; summary: string; next?: string }[] = [
  { code: 'S1', title: 'Career Counselling & Course Selection', status: 'completed', summary: 'Plan shared · Data Science & Analytics' },
  { code: 'S2', title: 'University & Country Selection', status: 'completed', summary: 'Shortlist of 4 approved' },
  { code: 'S3', title: 'Application Assistance', status: 'in_progress', summary: '3 of 4 applications submitted · 1 offer', next: 'Submit your University of Leeds application' },
  { code: 'S4', title: 'Scholarship & Financial Guidance', status: 'in_progress', summary: 'Funding plan ready · 1 scholarship applied', next: 'Upload your latest bank statement' },
  { code: 'S5', title: 'Visa Assistance', status: 'not_started', summary: 'Starts after you accept an offer' },
  { code: 'S6', title: 'Pre-Departure Support', status: 'not_started', summary: 'Starts after your visa is granted' },
  { code: 'S7', title: 'Post-Arrival Support', status: 'not_started', summary: 'Starts when you arrive' },
];

export const demoApplications: { id: string; university: string; course: string; agency: string; status: AppStatus; deadline: string }[] = [
  { id: 'app-1', university: 'University of Manchester', course: 'MSc Data Science', agency: 'Demo Partner Agency A', status: 'conditional_offer', deadline: inDays(30) },
  { id: 'app-2', university: 'King’s College London', course: 'MSc Data Science', agency: 'Demo Partner Agency A', status: 'under_review', deadline: inDays(45) },
  { id: 'app-3', university: 'University College Dublin', course: 'MSc Business Analytics', agency: 'Demo Partner Agency B', status: 'submitted', deadline: inDays(60) },
  { id: 'app-4', university: 'University of Leeds', course: 'MSc Data Science and Analytics', agency: 'Demo Partner Agency A', status: 'draft', deadline: inDays(9) },
];

export const demoDocuments: { id: string; name: string; status: DocStatus; note?: string }[] = [
  { id: 'doc-1', name: 'Passport (first and last page)', status: 'verified' },
  { id: 'doc-2', name: 'Degree certificate', status: 'verified' },
  { id: 'doc-3', name: 'Academic transcripts', status: 'verified' },
  { id: 'doc-4', name: 'IELTS score report', status: 'verified' },
  { id: 'doc-5', name: 'Statement of Purpose (final)', status: 'pending', note: 'Under review by your counsellor' },
  { id: 'doc-6', name: 'Letter of Recommendation 1', status: 'verified' },
  { id: 'doc-7', name: 'Letter of Recommendation 2', status: 'rejected', note: 'Signature missing; please upload a signed copy' },
  { id: 'doc-8', name: 'Bank statement (last 3 months)', status: 'missing' },
  { id: 'doc-9', name: 'Updated CV', status: 'missing' },
];

