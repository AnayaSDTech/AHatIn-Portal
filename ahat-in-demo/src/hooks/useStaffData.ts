import { useMemo } from 'react';
import { useShared } from '../lib/demoStore';
import { useAuth } from '../context/AuthContext';
import {
  counsellors,
  demoAvailability,
  demoFollowUps,
  demoGrants,
  demoLeads,
  demoSessions,
  demoStudents,
  demoTimeOff,
  isGrantActive,
  type AccessGrant,
  type StaffStudent,
} from '../data/staff';

/* Shared demo collections, used by every role. */
export const useLeads = () => useShared('leads', demoLeads);
export const useFollowUps = () => useShared('followups', demoFollowUps);
export const useStaffStudents = () => useShared('students', demoStudents);
export const useSessions = () => useShared('sessions', demoSessions);
export const useAvailability = () => useShared('availability', demoAvailability);
export const useTimeOff = () => useShared('timeoff', demoTimeOff);
export const useGrants = () => useShared<AccessGrant[]>('grants', demoGrants);

/**
 * What the signed-in staff member may see.
 * - Admins: everything.
 * - Counsellors: their own leads and students, plus students of counsellors they are covering for
 *   (an active temporary-access grant).
 * The real portal enforces this on the server for every request.
 */
export function useStaffScope() {
  const { user } = useAuth();
  const [grants] = useGrants();

  return useMemo(() => {
    const isAdmin = user?.role === 'admin';
    const me = counsellors.find((c) => c.email === user?.email);
    const myId = me?.id ?? null;
    const covering = grants.filter((g) => isGrantActive(g) && g.granteeId === myId);
    const coveredOwnerIds = covering.map((g) => g.ownerId);
    const visibleOwnerIds = isAdmin ? counsellors.map((c) => c.id) : myId ? [myId, ...coveredOwnerIds] : [];

    return {
      isAdmin,
      myId,
      covering,
      /** Can this staff member see a record owned by this counsellor? */
      canSee: (ownerId: string) => visibleOwnerIds.includes(ownerId),
      /** Records shown in "my" lists: own (and covered), or all for admins. */
      filterStudents: (list: StaffStudent[]) => list.filter((s) => visibleOwnerIds.includes(s.counsellorId)),
    };
  }, [user, grants]);
}
