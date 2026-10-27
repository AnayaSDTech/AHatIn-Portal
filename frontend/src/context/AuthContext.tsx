import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../lib/api/auth';
import { clearCache } from '../lib/api/store';
import type { OtpRequestResult, RegisterPayload, StaffChallenge, User } from '../lib/api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  register: (payload: RegisterPayload) => Promise<OtpRequestResult>;
  requestOtp: (email: string) => Promise<OtpRequestResult>;
  verifyOtp: (email: string, code: string) => Promise<User>;
  staffLogin: (email: string, password: string) => Promise<StaffChallenge>;
  staffVerify: (challengeId: string, code: string) => Promise<User>;
  logout: () => Promise<void>;
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

  const verifyOtp = useCallback(async (email: string, code: string) => signedIn((await authService.verifyOtp(email, code)).user), [signedIn]);

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
      requestOtp: authService.requestOtp,
      verifyOtp,
      staffLogin: authService.staffLogin,
      staffVerify,
      logout,
    }),
    [user, loading, verifyOtp, staffVerify, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
