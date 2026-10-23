import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isStaff, type Role } from '../../lib/api/types';
import { NotFoundPage } from '../../pages/NotFoundPage';

/** Where each role lands after login. The role comes from the account, never from a choice at login. */
export function homeFor(role: Role) {
  if (role === 'admin') return '/admin';
  if (isStaff(role)) return '/staff';
  return '/dashboard';
}

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
    </div>
  );
}

/**
 * Only logged-in users with one of the allowed roles may see these pages.
 * Logged-out users go to the right login page; users with another role see "Page not found",
 * so the page's existence isn't revealed.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) {
    const staffArea = roles.some(isStaff) && !roles.includes('student');
    return <Navigate to={staffArea ? '/staff/login' : '/login'} replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) return <NotFoundPage />;
  return <>{children}</>;
}

/** Logged-in users skip the login and register pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
