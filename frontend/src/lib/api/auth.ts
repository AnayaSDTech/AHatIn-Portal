import { api, apiRequest } from './client';
import type { AuthResult, OtpRequestResult, RegisterPayload, StaffChallenge, User } from './types';

/** Auth service used by the UI: the FastAPI auth endpoints. */
export interface AuthService {
  register(payload: RegisterPayload): Promise<OtpRequestResult>;
  requestOtp(email: string): Promise<OtpRequestResult>;
  verifyOtp(email: string, code: string): Promise<AuthResult>;
  staffLogin(email: string, password: string): Promise<StaffChallenge>;
  staffVerify(challengeId: string, code: string): Promise<AuthResult>;
  me(): Promise<User | null>;
  logout(): Promise<void>;
}

export const authService: AuthService = {
  register: (p) => api.post('/auth/register', p),
  requestOtp: (email) => api.post('/auth/otp/request', { email }),
  verifyOtp: (email, code) => api.post('/auth/otp/verify', { email, code }),
  staffLogin: (email, password) => api.post('/auth/staff/login', { email, password }),
  staffVerify: (challengeId, code) => api.post('/auth/staff/verify', { challenge_id: challengeId, code }),
  me: async () => {
    try {
      return await apiRequest<User>('/auth/me');
    } catch {
      return null;
    }
  },
  logout: () => api.post('/auth/logout', {}),
};
