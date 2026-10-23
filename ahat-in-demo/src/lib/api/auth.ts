import { env } from '../../config/env';
import { apiRequest } from './client';
import { mockAuth } from './mockAuth';
import type { AuthResult, OtpRequestResult, RegisterPayload, StaffChallenge, User } from './types';

/**
 * Auth service used by the UI. In "mock" mode it uses demo data in the browser;
 * in "api" mode it calls the FastAPI endpoints below. The UI never needs to change.
 */
export interface AuthService {
  register(payload: RegisterPayload): Promise<OtpRequestResult>;
  requestOtp(email: string): Promise<OtpRequestResult>;
  verifyOtp(email: string, code: string): Promise<AuthResult>;
  staffLogin(email: string, password: string): Promise<StaffChallenge>;
  staffVerify(challengeId: string, code: string): Promise<AuthResult>;
  me(): Promise<User | null>;
  logout(): Promise<void>;
}

const post = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });

const apiAuth: AuthService = {
  register: (p) => post('/auth/register', p),
  requestOtp: (email) => post('/auth/otp/request', { email }),
  verifyOtp: (email, code) => post('/auth/otp/verify', { email, code }),
  staffLogin: (email, password) => post('/auth/staff/login', { email, password }),
  staffVerify: (challengeId, code) => post('/auth/staff/verify', { challenge_id: challengeId, code }),
  me: async () => {
    try {
      return await apiRequest<User>('/auth/me');
    } catch {
      return null;
    }
  },
  logout: () => post('/auth/logout', {}),
};

export const authService: AuthService = env.authMode === 'api' ? apiAuth : mockAuth;
