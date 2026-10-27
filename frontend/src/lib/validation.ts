import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address, like name@example.com.');

/** Student and parent login: email first, then a one-time code. */
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

const indianMobile = z
  .string()
  .trim()
  .transform((v) => {
    const digits = v.replace(/[\s()-]/g, '');
    // Remove a country code or trunk zero only when present: +91XXXXXXXXXX, 91XXXXXXXXXX or 0XXXXXXXXXX.
    if (/^\+91\d{10}$/.test(digits)) return digits.slice(3);
    if (/^91\d{10}$/.test(digits)) return digits.slice(2);
    if (/^0\d{10}$/.test(digits)) return digits.slice(1);
    return digits;
  })
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number.');

export const registerSchema = z.object({
  name: fullName,
  email,
  mobile: indianMobile,
  consent: z.boolean().refine((v) => v, 'Please accept to continue.'),
});

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
    city: z.string().trim().min(2, 'Enter your city.').max(60, 'City name is too long.'),
    passportNumber: z.string(),
    degree: z.string().trim().min(2, 'Enter your highest qualification.').max(100),
    institution: z.string().trim().min(2, 'Enter your college or university.').max(100),
    grade: z.string().trim().min(1, 'Enter your grade, e.g. 8.4 CGPA or 72%.').max(30),
    englishTest: z.string().min(1, 'Choose an English test.'),
    englishScore: z.string().trim(),
    workExperience: z.string().trim().max(60, 'Keep this under 60 characters.'),
    courseInterest: z.string().trim().min(2, 'Enter the course you are interested in.').max(100),
    destination: z.string().min(1, 'Choose a destination.'),
    intake: z.string().min(1, 'Choose an intake.'),
    budget: z.string().min(1, 'Choose a budget range.'),
  })
  .superRefine((d, ctx) => {
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

