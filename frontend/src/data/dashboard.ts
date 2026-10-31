/**
 * DEMO dashboard data for a fictional student. In the real portal this comes from
 * the FastAPI backend (e.g. GET /api/v1/students/me/dashboard).
 */

/**
 * Fields the student can edit. Name and email come from the account; the mobile number comes from registration and can be
 * changed here; passport details are added by staff.
 */
export interface StudentProfile {
  dateOfBirth: string;
  /** Optional: one of GENDERS, or empty. */
  gender: string;
  /** 10-digit Indian mobile number. */
  mobile: string;
  /** Permanent address (city is part of it). */
  addressLine1: string;
  addressLine2: string;
  city: string;
  /** One of INDIAN_STATES. */
  state: string;
  pincode: string;
  passportNumber: string;
  /** 10th (SSC). */
  sscBoard: string;
  sscSchool: string;
  sscYear: string;
  sscScore: string;
  /** 12th (HSC). */
  hscBoard: string;
  hscStream: string;
  hscCollege: string;
  hscYear: string;
  hscScore: string;
  /** Highest qualification (the year may be the expected one). */
  degree: string;
  degreeSubject: string;
  institution: string;
  graduationYear: string;
  grade: string;
  englishTest: string;
  englishScore: string;
  workExperience: string;
  /** Up to MAX_COURSES courses, in the student's order of preference. */
  courseInterests: string[];
  /** The first of `courseInterests`. */
  courseInterest: string;
  destination: string;
  intake: string;
  budget: string;
}

export const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];
export const MAX_COURSES = 3;

export const demoProfile: StudentProfile = {
  dateOfBirth: '2001-04-18',
  gender: '',
  mobile: '9800000000',
  city: 'Pune',
  addressLine1: '12 MG Road',
  addressLine2: '',
  state: 'Maharashtra',
  pincode: '411001',
  sscBoard: '',
  sscSchool: '',
  sscYear: '',
  sscScore: '',
  hscBoard: '',
  hscStream: '',
  hscCollege: '',
  hscYear: '',
  hscScore: '',
  degreeSubject: '',
  graduationYear: '',
  passportNumber: 'Z1234567',
  degree: 'B.Tech Computer Science',
  institution: 'Demo Institute of Technology',
  grade: '8.4 CGPA',
  englishTest: 'IELTS',
  englishScore: '7.5',
  workExperience: '2 years · Data Analyst',
  courseInterests: ['MSc Data Science'],
  courseInterest: 'MSc Data Science',
  destination: 'United Kingdom',
  intake: 'September 2027',
  budget: '₹25–35 lakh',
};

/** Starting profile for any other student: they fill it in themselves. */
export const blankProfile: StudentProfile = {
  dateOfBirth: '',
  gender: '',
  mobile: '',
  city: '',
  addressLine1: '',
  addressLine2: '',
  state: '',
  pincode: '',
  sscBoard: '',
  sscSchool: '',
  sscYear: '',
  sscScore: '',
  hscBoard: '',
  hscStream: '',
  hscCollege: '',
  hscYear: '',
  hscScore: '',
  degreeSubject: '',
  graduationYear: '',
  passportNumber: '',
  degree: '',
  institution: '',
  grade: '',
  englishTest: 'Not taken yet',
  englishScore: '',
  workExperience: '',
  courseInterests: [],
  courseInterest: '',
  destination: '',
  intake: '',
  budget: '',
};

/**
 * Everything the profile form requires (the same rule as the server's): gender, grade and work experience are optional
 * and the passport is added by staff. The student's journey starts, and a counsellor is assigned, once it is complete.
 */
export function isProfileComplete(p: StudentProfile) {
  const required = ['dateOfBirth', 'city', 'degree', 'institution', 'englishTest', 'courseInterest', 'destination', 'intake', 'budget'] as const;
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
