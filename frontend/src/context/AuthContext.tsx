import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../lib/api/auth';
import { clearCache } from '../lib/api/store';
import type { OtpRequestResult, RegisterPayload, StaffChallenge, User } from '../lib/api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  register: (payload: RegisterPayload) => Promise<OtpRequestResult>;
  /** The code from the registration email: verifies the email and signs in. */
  verifyEmail: (email: string, code: string) => Promise<User>;
  resendVerification: (email: string) => Promise<OtpRequestResult>;
  /** Student login. If the email isn't verified yet, a code is emailed and returned instead of a user. */
  login: (email: string, password: string) => Promise<{ user: User } | { verifyEmail: OtpRequestResult }>;
  forgotPassword: (email: string) => Promise<OtpRequestResult>;
  /** The emailed code and a new password: signs in. */
  resetPassword: (email: string, code: string, password: string) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  staffLogin: (email: string, password: string) => Promise<StaffChallenge>;
  staffVerify: (challengeId: string, code: string) => Promise<User>;
  logout: () => Promise<void>;
  /** After the user changes their own details (e.g. their name). */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService
      .me()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  // The server ended the session (idle timeout, deactivated account, signed out elsewhere).
  useEffect(() => {
    const onSignedOut = () => {
      clearCache();
      setUser(null);
    };
    window.addEventListener('ahat:signed-out', onSignedOut);
    return () => window.removeEventListener('ahat:signed-out', onSignedOut);
  }, []);

  const signedIn = useCallback((u: User) => {
    clearCache();
    setUser(u);
    return u;
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => signedIn((await authService.verifyEmail(email, code)).user), [signedIn]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authService.login(email, password);
      if ('user' in result) signedIn(result.user);
      return result;
    },
    [signedIn],
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => signedIn((await authService.resetPassword(email, code, password)).user),
    [signedIn],
  );

  const staffVerify = useCallback(async (challengeId: string, code: string) => signedIn((await authService.staffVerify(challengeId, code)).user), [signedIn]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearCache();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      register: authService.register,
      verifyEmail,
      resendVerification: authService.resendVerification,
      login,
      forgotPassword: authService.forgotPassword,
      resetPassword,
      changePassword: authService.changePassword,
      staffLogin: authService.staffLogin,
      staffVerify,
      logout,
      updateUser: setUser,
    }),
    [user, loading, verifyEmail, login, resetPassword, staffVerify, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
