import { api, apiRequest } from './client';
import type { AuthResult, OtpRequestResult, RegisterPayload, StaffChallenge, StudentLoginResult, User } from './types';

/** Auth service used by the UI: the FastAPI auth endpoints. */
export interface AuthService {
  /** Creates the account and emails a code to verify the email. */
  register(payload: RegisterPayload): Promise<OtpRequestResult>;
  verifyEmail(email: string, code: string): Promise<AuthResult>;
  resendVerification(email: string): Promise<OtpRequestResult>;
  login(email: string, password: string): Promise<StudentLoginResult>;
  /** Emails a code for setting a new password. */
  forgotPassword(email: string): Promise<OtpRequestResult>;
  resetPassword(email: string, code: string, password: string): Promise<AuthResult>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  staffLogin(email: string, password: string): Promise<StaffChallenge>;
  staffVerify(challengeId: string, code: string): Promise<AuthResult>;
  me(): Promise<User | null>;
  logout(): Promise<void>;
}

export const authService: AuthService = {
  register: (p) => api.post('/auth/register', p),
  verifyEmail: (email, code) => api.post('/auth/verify-email', { email, code }),
  resendVerification: (email) => api.post('/auth/verify-email/resend', { email }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  forgotPassword: (email) => api.post('/auth/password/forgot', { email }),
  resetPassword: (email, code, password) => api.post('/auth/password/reset', { email, code, password }),
  changePassword: (currentPassword, newPassword) => api.post('/auth/password/change', { currentPassword, newPassword }),
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
