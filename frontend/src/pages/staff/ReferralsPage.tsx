import { ReferralsPanel } from '../../components/referrals/ReferralsPanel';
import { PageHeader } from '../../components/staff/StaffUi';
import { useAuth } from '../../context/AuthContext';

/** Referrals for counsellors (their own) and admins (everyone's). */
export function ReferralsPage() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  return (
    <>
      <PageHeader title="Referrals" description={admin ? 'Everyone referred by students, counsellors and referrers, and how far they have got.' : 'Refer a friend or family member, and follow how far they get.'} />
      <ReferralsPanel showReferrer={admin} />
    </>
  );
}
