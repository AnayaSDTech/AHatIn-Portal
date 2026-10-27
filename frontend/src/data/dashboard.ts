/**
 * DEMO dashboard data for a fictional student. In the real portal this comes from
 * the FastAPI backend (e.g. GET /api/v1/students/me/dashboard).
 */

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

/** Starting profile for any other student: they fill it in themselves. */
export const blankProfile: StudentProfile = {
  dateOfBirth: '',
  city: '',
  passportNumber: '',
  degree: '',
  institution: '',
  grade: '',
  englishTest: 'Not taken yet',
  englishScore: '',
  workExperience: '',
  courseInterest: '',
  destination: '',
  intake: '',
  budget: '',
};

/**
 * Everything the profile form requires (the same rule as the server's): work experience is optional and the
 * passport is added by staff. The student's journey starts, and a counsellor is assigned, once it is complete.
 */
export function isProfileComplete(p: StudentProfile) {
  const required: (keyof StudentProfile)[] = ['dateOfBirth', 'city', 'degree', 'institution', 'grade', 'englishTest', 'courseInterest', 'destination', 'intake', 'budget'];
  if (required.some((k) => !p[k]?.trim())) return false;
  return p.englishTest === 'Not taken yet' || !!p.englishScore.trim();
}

export const sessionTypes = [
  'Career counselling',
  'Application review',
  'Scholarship & funding',
  'Visa preparation',
  'Pre-departure briefing',
  'Post-arrival check-in',
] as const;
