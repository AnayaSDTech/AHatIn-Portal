import { useMemo } from 'react';
import { useApi } from '../lib/api/store';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../lib/api/types';
import { setCounsellors, type AccessGrant, type Agency, type Counsellor, type FollowUp, type Lead, type Message, type StaffStudent } from '../data/staff';
import type { Availability, Session, TimeOff } from '../lib/scheduling';

/*
 * Shared data from the API. Every role reads the same endpoints; the server returns only what the signed-in
 * person may see (a student gets their own record, their sessions and their counsellor's free times).
 */

const NONE: never[] = [];

function useSignedIn() {
  const { user } = useAuth();
  return { user, staff: !!user && isStaff(user.role) };
}

export function useStaffStudents() {
  const { user } = useSignedIn();
  return useApi<StaffStudent[]>(user ? '/students' : null, NONE);
}
export function useSessions() {
  const { user } = useSignedIn();
  return useApi<Session[]>(user ? '/sessions' : null, NONE, { pollMs: 60_000 });
}
export function useAvailability() {
  const { user } = useSignedIn();
  return useApi<Availability[]>(user ? '/availability' : null, NONE);
}
export function useTimeOff() {
  const { user } = useSignedIn();
  return useApi<TimeOff[]>(user ? '/time-off' : null, NONE);
}
export function useMessages() {
  const { user } = useSignedIn();
  return useApi<Message[]>(user ? '/messages' : null, NONE, { pollMs: 15_000 });
}
export function useLeads() {
  const { staff } = useSignedIn();
  return useApi<Lead[]>(staff ? '/leads' : null, NONE, { pollMs: 60_000 });
}
export function useFollowUps() {
  const { staff } = useSignedIn();
  return useApi<FollowUp[]>(staff ? '/follow-ups' : null, NONE, { pollMs: 60_000 });
}
export function useGrants() {
  const { staff } = useSignedIn();
  return useApi<AccessGrant[]>(staff ? '/grants' : null, NONE);
}
export function useAgencies() {
  const { staff } = useSignedIn();
  return useApi<Agency[]>(staff ? '/agencies' : null, NONE);
}

/** Counsellors (staff: all of them; students: their own). Also fills the shared list used by counsellorName(). */
export function useCounsellors() {
  const { user } = useSignedIn();
  const [list, loaded] = useApi<Counsellor[]>(user ? '/counsellors' : null, NONE);
  // Filled during render, so screens shown below this one already have the names.
  useMemo(() => setCounsellors(list), [list]);
  return [list, loaded] as const;
}

interface ScopeData {
  isAdmin: boolean;
  myId: string | null;
  allStudents: boolean;
  ownerIds: string[];
  covering: AccessGrant[];
}
const NO_SCOPE: ScopeData = { isAdmin: false, myId: null, allStudents: false, ownerIds: [], covering: [] };

/**
 * What the signed-in staff member may see.
 * - Admins: everything. Officers: every student (no leads).
 * - Counsellors: their own leads and students, plus those of counsellors they are covering for
 *   (an active temporary-access grant).
 * The server applies the same rules to every request; this only shapes the screens.
 */
export function useStaffScope() {
  const { staff } = useSignedIn();
  const [scope] = useApi<ScopeData>(staff ? '/staff/scope' : null, NO_SCOPE);

  return useMemo(() => {
    const canSee = (ownerId: string | null) => scope.isAdmin || scope.allStudents || (!!ownerId && scope.ownerIds.includes(ownerId));
    return {
      isAdmin: scope.isAdmin,
      myId: scope.myId,
      covering: scope.covering,
      /** Can this staff member see a record owned by this counsellor? */
      canSee,
      /** Records shown in "my" lists: own (and covered), or all for admins. */
      filterStudents: (list: StaffStudent[]) => list.filter((s) => canSee(s.counsellorId)),
    };
  }, [scope]);
}

/** Loads what the staff screens need before showing them (so names and permissions are ready). */
export function useStaffReady() {
  const { staff } = useSignedIn();
  const [, counsellorsLoaded] = useCounsellors();
  const [, scopeLoaded] = useApi<ScopeData>(staff ? '/staff/scope' : null, NO_SCOPE);
  return counsellorsLoaded && scopeLoaded;
}
