import { sha256Hex, uid } from '../crypto';
import { updateShared } from '../demoStore';
import { demoStudents, newStudentRecord } from '../../data/staff';
import {
  ApiError,
  isStaff,
  type AuthResult,
  type OtpRequestResult,
  type RegisterPayload,
  type StaffChallenge,
  type User,
} from './types';

/**
 * DEMO ONLY: an in-browser stand-in for the FastAPI auth endpoints.
 * - Students and parents log in with a one-time code (shown on screen, since nothing is really sent).
 * - Staff log in with email + password, then a 6-digit authenticator code (also shown on screen).
 * Everything lives in this browser's localStorage. NOT secure; never use real data.
 */

const USERS_KEY = 'ahatin-demo-users-v2';
const SESSION_KEY = 'ahatin-demo-session-v2';
const OTP_KEY = 'ahatin-demo-otp';

const OTP_TTL = 10 * 60; // seconds
const OTP_RESEND = 30; // seconds (60 in the real portal; shorter for the demo)
const OTP_MAX_ATTEMPTS = 5;

const TIMEOUTS: Record<'staff' | 'student', { idle: number; absolute: number }> = {
  staff: { idle: 30 * 60_000, absolute: 12 * 3_600_000 },
  student: { idle: 7 * 86_400_000, absolute: 30 * 86_400_000 },
};

interface StoredUser extends User {
  passwordHash?: string; // staff only
  totpSecret?: string; // staff only
}

interface StoredOtp {
  email: string;
  codeHash: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

interface StoredSession {
  userId: string;
  createdAt: number;
  lastActive: number;
}

export const DEMO_ACCOUNTS = {
  student: { email: 'demo.student@ahatin.example', label: 'Student' },
  counsellor: { email: 'demo.counsellor@ahatin.example', password: 'Staff@1234', label: 'Counsellor' },
  admin: { email: 'demo.admin@ahatin.example', password: 'Admin@1234', label: 'Admin' },
} as const;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normalise = (email: string) => email.trim().toLowerCase();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const readUsers = () => read<StoredUser[]>(USERS_KEY, []);
const writeUsers = (users: StoredUser[]) => write(USERS_KEY, users);

function publicUser({ passwordHash: _p, totpSecret: _t, ...user }: StoredUser): User {
  return user;
}

function randomCode() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0]! % 1_000_000).padStart(6, '0');
}

/** Time-based 6-digit code that changes every 30 seconds (demo version of an authenticator app). */
export async function totpCode(secret: string, at = Date.now()) {
  const step = Math.floor(at / 30_000);
  const hex = await sha256Hex(`${secret}:${step}`);
  return String(parseInt(hex.slice(0, 8), 16) % 1_000_000).padStart(6, '0');
}

async function seedDemoAccounts() {
  const users = readUsers();
  const has = (email: string) => users.some((u) => u.email === email);
  let changed = false;
  if (!has(DEMO_ACCOUNTS.student.email)) {
    users.push({
      id: 'demo-student-1',
      role: 'student',
      name: 'Ananya Sharma',
      email: DEMO_ACCOUNTS.student.email,
      mobile: '+919800000000',
      studentReference: 'AH-2026-00042',
    });
    changed = true;
  }
  if (!has(DEMO_ACCOUNTS.counsellor.email)) {
    users.push({
      id: 'demo-counsellor-1',
      role: 'counsellor',
      name: 'Priya Desai',
      email: DEMO_ACCOUNTS.counsellor.email,
      mobile: '+919800011111',
      passwordHash: await sha256Hex(DEMO_ACCOUNTS.counsellor.password),
      totpSecret: 'demo-counsellor-secret',
    });
    changed = true;
  }
  if (!has(DEMO_ACCOUNTS.admin.email)) {
    users.push({
      id: 'demo-admin-1',
      role: 'admin',
      name: 'Vikram Rao',
      email: DEMO_ACCOUNTS.admin.email,
      mobile: '+919800022222',
      passwordHash: await sha256Hex(DEMO_ACCOUNTS.admin.password),
      totpSecret: 'demo-admin-secret',
    });
    changed = true;
  }
  if (changed) writeUsers(users);
}

function startSession(user: StoredUser) {
  const now = Date.now();
  write(SESSION_KEY, { userId: user.id, createdAt: now, lastActive: now } satisfies StoredSession);
}

async function issueOtp(email: string, exists: boolean, note?: string): Promise<OtpRequestResult> {
  const otps = read<StoredOtp[]>(OTP_KEY, []);
  const previous = otps.find((o) => o.email === email);
  const now = Date.now();
  if (previous && now - previous.sentAt < OTP_RESEND * 1000) {
    const left = Math.ceil((OTP_RESEND * 1000 - (now - previous.sentAt)) / 1000);
    throw new ApiError(429, `Please wait ${left} seconds before requesting another code.`);
  }
  if (!exists) {
    // Same response as a real send, so nobody can tell which emails have accounts.
    return { expiresIn: OTP_TTL, resendIn: OTP_RESEND, demoNote: note ?? 'No account uses this email, so no code was sent. Register first, or use the demo student account.' };
  }
  const code = randomCode();
  const record: StoredOtp = { email, codeHash: await sha256Hex(code), expiresAt: now + OTP_TTL * 1000, sentAt: now, attempts: 0 };
  write(OTP_KEY, [...otps.filter((o) => o.email !== email), record]);
  return { expiresIn: OTP_TTL, resendIn: OTP_RESEND, demoCode: code };
}

const challenges = new Map<string, { userId: string; expiresAt: number; attempts: number }>();

export const mockAuth = {
  /** POST /auth/register: creates the student account and sends a code to verify the email. */
  async register(payload: RegisterPayload): Promise<OtpRequestResult> {
    await seedDemoAccounts();
    await wait(600);
    const email = normalise(payload.email);
    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      throw new ApiError(409, 'An account with this email already exists. Log in instead.', { email: 'This email is already registered.' });
    }
    const user: StoredUser = {
      id: uid(),
      role: 'student',
      name: payload.name.trim(),
      email,
      mobile: payload.mobile,
      studentReference: `AH-2026-${String(Date.now()).slice(-5)}`,
    };
    writeUsers([...users, user]);
    // The new student appears in the staff portal, assigned to the counsellor with the fewest students.
    updateShared('students', demoStudents, (all) => [...all, newStudentRecord(user, { destination: payload.destination, intake: payload.intake }, all)]);
    return issueOtp(email, true);
  },

  /** POST /auth/otp/request: students and parents. */
  async requestOtp(rawEmail: string): Promise<OtpRequestResult> {
    await seedDemoAccounts();
    await wait(500);
    const email = normalise(rawEmail);
    const user = readUsers().find((u) => u.email === email);
    if (user && isStaff(user.role)) {
      return issueOtp(email, false, 'This is a staff account, so no code was sent. Staff use "Staff sign in".');
    }
    return issueOtp(email, !!user);
  },

  /** POST /auth/otp/verify */
  async verifyOtp(rawEmail: string, code: string): Promise<AuthResult> {
    await wait(500);
    const email = normalise(rawEmail);
    const otps = read<StoredOtp[]>(OTP_KEY, []);
    const record = otps.find((o) => o.email === email);
    const fail = (msg: string, status = 400) => {
      throw new ApiError(status, msg, { code: msg });
    };
    if (!record) return fail('This code is not valid. Request a new code.');
    if (Date.now() > record.expiresAt) {
      write(OTP_KEY, otps.filter((o) => o !== record));
      return fail('This code has expired. Request a new code.');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) return fail('Too many attempts. Request a new code.', 429);
    if ((await sha256Hex(code)) !== record.codeHash) {
      record.attempts += 1;
      write(OTP_KEY, otps);
      const left = OTP_MAX_ATTEMPTS - record.attempts;
      return fail(left > 0 ? `That code is incorrect. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.` : 'Too many attempts. Request a new code.');
    }
    write(OTP_KEY, otps.filter((o) => o !== record)); // single use
    const user = readUsers().find((u) => u.email === email);
    if (!user) return fail('Account not found.', 404);
    startSession(user);
    return { user: publicUser(user) };
  },

  /** POST /auth/staff/login: step 1 (email + password). */
  async staffLogin(rawEmail: string, password: string): Promise<StaffChallenge> {
    await seedDemoAccounts();
    await wait(600);
    const user = readUsers().find((u) => u.email === normalise(rawEmail));
    if (!user || !isStaff(user.role) || !user.passwordHash || user.passwordHash !== (await sha256Hex(password))) {
      throw new ApiError(401, 'The email or password is incorrect.');
    }
    const challengeId = uid();
    challenges.set(challengeId, { userId: user.id, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    return { challengeId, demoSecret: user.totpSecret };
  },

  /** POST /auth/staff/verify: step 2 (authenticator code). */
  async staffVerify(challengeId: string, code: string): Promise<AuthResult> {
    await wait(500);
    const challenge = challenges.get(challengeId);
    if (!challenge || Date.now() > challenge.expiresAt) {
      throw new ApiError(401, 'Your sign-in has timed out. Please start again.');
    }
    const user = readUsers().find((u) => u.id === challenge.userId);
    if (!user?.totpSecret) throw new ApiError(401, 'Please start again.');
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, 'Too many attempts. Please start again.');
    const now = Date.now();
    // Accept the current code and the previous one, to allow for clock drift.
    const valid = [await totpCode(user.totpSecret, now), await totpCode(user.totpSecret, now - 30_000)];
    if (!valid.includes(code)) {
      challenge.attempts += 1;
      throw new ApiError(400, 'That code is incorrect. Check your authenticator app.', { code: 'That code is incorrect.' });
    }
    challenges.delete(challengeId);
    startSession(user);
    return { user: publicUser(user) };
  },

  /** GET /auth/me: also enforces idle and absolute session timeouts. */
  async me(): Promise<User | null> {
    await seedDemoAccounts();
    const session = read<StoredSession | null>(SESSION_KEY, null);
    if (!session) return null;
    const user = readUsers().find((u) => u.id === session.userId);
    if (!user) return null;
    const limits = TIMEOUTS[isStaff(user.role) ? 'staff' : 'student'];
    const now = Date.now();
    if (now - session.lastActive > limits.idle || now - session.createdAt > limits.absolute) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    write(SESSION_KEY, { ...session, lastActive: now });
    return publicUser(user);
  },

  async logout(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  },
};
