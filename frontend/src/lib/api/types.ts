// Shapes shared with the FastAPI backend (JSON uses the same camelCase names).

export type Role = 'student' | 'parent' | 'counsellor' | 'officer' | 'finance_officer' | 'visa_officer' | 'admin';

export const STAFF_ROLES: Role[] = ['counsellor', 'officer', 'finance_officer', 'visa_officer', 'admin'];
export const isStaff = (role: Role) => STAFF_ROLES.includes(role);

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  mobile: string;
  studentReference?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  mobile: string;
  consent: boolean;
}

/** Response after a one-time code is requested. */
export interface OtpRequestResult {
  /** Seconds until the code expires. */
  expiresIn: number;
  /** Seconds before another code can be requested. */
  resendIn: number;
  /** Development only: the code, so it can be shown on screen. Never returned in production. */
  demoCode?: string;
  /** Development only: helper text explaining what happened. */
  demoNote?: string;
}

/** Response after staff email and password are accepted; a second step is required. */
export interface StaffChallenge {
  challengeId: string;
  /** Development only: secret used to show the live authenticator code on screen. */
  demoSecret?: string;
}

export interface AuthResult {
  user: User;
}

/** Error format used by the backend (problem details with a trace ID). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: Record<string, string> = {},
    public traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
