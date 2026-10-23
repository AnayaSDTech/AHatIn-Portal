import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../lib/api/auth';
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

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const { user } = await authService.verifyOtp(email, code);
    setUser(user);
    return user;
  }, []);

  const staffVerify = useCallback(async (challengeId: string, code: string) => {
    const { user } = await authService.staffVerify(challengeId, code);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
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
