import { z } from 'zod';
import { OTHER_QUALIFICATION, SCHOOL_QUALIFICATION } from '../data/profileOptions';

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address, like name@example.com.');

/** An email on its own (forgot password). */
export const emailSchema = z.object({ email });

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

/** Staff login, step 1. */
export const staffLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

const fullName = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(100, 'Name is too long.')
  .regex(/^[\p{L} .'-]+$/u, 'Use letters, spaces, dots, apostrophes or hyphens only.');

/** The 10 digits of an Indian mobile number, with any country code or trunk zero removed. */
export function cleanMobile(v: string) {
  const digits = v.trim().replace(/[\s()-]/g, '');
  // Remove a country code or trunk zero only when present: +91XXXXXXXXXX, 91XXXXXXXXXX or 0XXXXXXXXXX.
  if (/^\+91\d{10}$/.test(digits)) return digits.slice(3);
  if (/^91\d{10}$/.test(digits)) return digits.slice(2);
  if (/^0\d{10}$/.test(digits)) return digits.slice(1);
  return digits;
}

const MOBILE_MESSAGE = 'Enter a valid 10-digit Indian mobile number.';
const isIndianMobile = (v: string) => /^[6-9]\d{9}$/.test(cleanMobile(v));

const indianMobile = z.string().trim().transform(cleanMobile).refine((v) => /^[6-9]\d{9}$/.test(v), MOBILE_MESSAGE);

/** A student's password: at least 8 characters, with letters and numbers (the server checks the same). */
export const studentPassword = z
  .string()
  .max(200, 'Keep your password under 200 characters.')
  .refine((v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v), 'Use at least 8 characters, with letters and numbers.');

const PASSWORDS_DIFFER = { message: 'The passwords don’t match.', path: ['confirmPassword'] };

export const registerSchema = z
  .object({
    name: fullName,
    email,
    mobile: indianMobile,
    password: studentPassword,
    confirmPassword: z.string(),
    consent: z.boolean().refine((v) => v, 'Please accept to continue.'),
  })
  .refine((d) => d.password === d.confirmPassword, PASSWORDS_DIFFER);

/** Student login. */
export const studentLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

/** Forgot password, step 2: the emailed code and a new password. */
export const resetPasswordSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from the email.'),
    password: studentPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, PASSWORDS_DIFFER);

/** Changing the password from the student's profile. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string(),
    password: studentPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, PASSWORDS_DIFFER);

/** Homepage enquiry: no account needed. `website` is a hidden spam trap that people never fill in. */
export const enquirySchema = z.object({
  name: fullName,
  email,
  mobile: indianMobile,
  destination: z.string().min(1, 'Choose a destination.'),
  intake: z.string().min(1, 'Choose your preferred intake.'),
  course: z.string().trim().max(100, 'Keep this under 100 characters.'),
  callTime: z.string(),
  message: z.string().trim().max(500, 'Keep your message under 500 characters.'),
  consent: z.boolean().refine((v) => v, 'Please agree so we can contact you.'),
  website: z.string(),
});

export type EnquiryForm = z.infer<typeof enquirySchema>;

export type EmailForm = z.infer<typeof emailSchema>;
export type OtpForm = z.infer<typeof otpSchema>;
export type StaffLoginForm = z.infer<typeof staffLoginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
export type StudentLoginForm = z.infer<typeof studentLoginSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const scoreRanges: Record<string, { min: number; max: number; step?: number }> = {
  IELTS: { min: 0, max: 9, step: 0.5 },
  PTE: { min: 10, max: 90 },
  TOEFL: { min: 0, max: 120 },
  Duolingo: { min: 10, max: 160 },
};

function ageOn(dateIso: string) {
  const dob = new Date(`${dateIso}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  return age;
}

export const profileSchema = z
  .object({
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth.')
      .refine((v) => {
        const age = ageOn(v);
        return age >= 14 && age <= 60;
      }, 'Age must be between 14 and 60.'),
    gender: z.string(),
    mobile: z.string().trim().refine(isIndianMobile, MOBILE_MESSAGE),
    addressLine1: z.string().trim().min(3, 'Enter your house or flat number and street.').max(120),
    addressLine2: z.string().trim().max(120, 'Keep this under 120 characters.'),
    city: z.string().trim().min(2, 'Enter your city or town.').max(60, 'City name is too long.'),
    state: z.string().min(1, 'Choose your state.'),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter your 6-digit PIN code.'),
    // 10th and 12th: optional, unless the 12th is the highest qualification.
    sscBoard: z.string(),
    sscSchool: z.string().trim().max(120, 'Keep this under 120 characters.'),
    sscYear: z.string(),
    sscScore: z.string().trim().max(30, 'Keep this under 30 characters.'),
    hscBoard: z.string(),
    hscStream: z.string(),
    hscCollege: z.string().trim().max(120, 'Keep this under 120 characters.'),
    hscYear: z.string(),
    hscScore: z.string().trim().max(30, 'Keep this under 30 characters.'),
    degree: z.string().min(1, 'Choose your highest qualification.'),
    degreeSubject: z.string().trim().max(100, 'Keep this under 100 characters.'),
    institution: z.string().trim().max(150, 'Keep this under 150 characters.'),
    graduationYear: z.string(),
    grade: z.string().trim().max(30, 'Keep this under 30 characters.'),
    englishTest: z.string().min(1, 'Choose an English test.'),
    englishScore: z.string().trim(),
    workExperience: z.string().trim().max(60, 'Keep this under 60 characters.'),
    // Up to MAX_COURSES courses (objects, so the form can add and remove rows).
    courseInterests: z
      .array(z.object({ value: z.string().trim().min(2, 'Enter at least 2 characters.').max(100, 'Keep this under 100 characters.') }))
      .min(1, 'Add the course you are interested in.')
      .max(3),
    destination: z.string().min(1, 'Choose a destination.'),
    intake: z.string().min(1, 'Choose an intake.'),
    budget: z.string().min(1, 'Choose a budget range.'),
  })
  .superRefine((d, ctx) => {
    const need = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const school = d.degree === SCHOOL_QUALIFICATION;
    if (school) {
      if (!d.hscBoard) need('hscBoard', 'Choose your board.');
      if (d.hscCollege.length < 2) need('hscCollege', 'Enter your junior college or school.');
      if (!d.hscYear) need('hscYear', 'Choose the year.');
    } else if (d.degree) {
      if (d.degree === OTHER_QUALIFICATION && d.degreeSubject.length < 2) need('degreeSubject', 'Enter the name of your qualification.');
      if (d.institution.length < 2) need('institution', 'Enter your college or university.');
      if (!d.graduationYear) need('graduationYear', 'Choose the year.');
    }
    // 10th, then 12th, then the highest qualification.
    if (d.sscYear && d.hscYear && Number(d.hscYear) <= Number(d.sscYear)) need('hscYear', 'Must be after your 10th year.');
    if (!school && d.hscYear && d.graduationYear && Number(d.graduationYear) < Number(d.hscYear)) need('graduationYear', "Can't be before your 12th year.");
    const seen = new Set<string>();
    d.courseInterests.forEach((c, i) => {
      const key = c.value.trim().toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['courseInterests', i, 'value'], message: 'You have already added this course.' });
      seen.add(key);
    });
    const range = scoreRanges[d.englishTest];
    if (!range) return; // "Not taken yet"
    const n = Number(d.englishScore);
    const validStep = range.step ? Number.isInteger(n / range.step) : Number.isInteger(n);
    if (d.englishScore === '' || Number.isNaN(n) || n < range.min || n > range.max || !validStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['englishScore'],
        message: `Enter a ${d.englishTest} score between ${range.min} and ${range.max}${range.step ? ` in steps of ${range.step}` : ''}.`,
      });
    }
  });

export type ProfileForm = z.infer<typeof profileSchema>;

