import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, PartyPopper, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocalState } from '../hooks/useLocalState';
import { Container } from '../components/ui/Container';
import { DemoBadge } from '../components/ui/DemoBadge';
import { ProfileCard } from '../components/dashboard/ProfileCard';
import { ServiceTracker, overallProgress } from '../components/dashboard/ServiceTracker';
import { ApplicationsCard } from '../components/dashboard/ApplicationsCard';
import { DocumentChecklist } from '../components/dashboard/DocumentChecklist';
import { SessionsCard } from '../components/dashboard/SessionsCard';
import { AttentionCard } from '../components/dashboard/AttentionCard';
import { demoApplications, demoDocuments, demoProfile, demoServices } from '../data/dashboard';
import { counsellors, newStudentRecord } from '../data/staff';
import { useSessions, useStaffStudents } from '../hooks/useStaffData';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function ProgressRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#C9A227"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl text-white">{value}%</p>
          <p className="text-[10px] uppercase tracking-wider text-navy-200">overall</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(Boolean((location.state as { welcome?: boolean } | null)?.welcome));

  const prefix = `ahatin-demo-${user?.id ?? 'guest'}`;
  const [profile, setProfile] = useLocalState(`${prefix}-profile`, demoProfile);
  const [staffStudents, setStaffStudents] = useStaffStudents();
  const [allSessions] = useSessions();
  const record = staffStudents.find((s) => s.userId === user?.id);
  const counsellor = counsellors.find((c) => c.id === record?.counsellorId) ?? counsellors[0]!;
  const sessions = useMemo(() => allSessions.filter((s) => s.studentId === record?.id), [allSessions, record?.id]);

  // Every student account has a staff-side record (with an assigned counsellor) in the shared demo data.
  useEffect(() => {
    if (user && !record) setStaffStudents((all) => (all.some((s) => s.userId === user.id) ? all : [...all, newStudentRecord(user, {}, all)]));
  }, [user, record, setStaffStudents]);
  const [applications, setApplications] = useLocalState(`${prefix}-applications`, demoApplications);
  const [documents, setDocuments] = useLocalState(`${prefix}-documents`, demoDocuments);

  // The tracker reacts to decisions the student makes, e.g. accepting an offer.
  const services = useMemo(() => {
    const accepted = applications.find((a) => a.status === 'accepted');
    if (!accepted) return demoServices;
    return demoServices.map((s) => {
      if (s.code === 'S3') return { ...s, status: 'completed' as const, summary: `Offer accepted · ${accepted.university}`, next: undefined };
      if (s.code === 'S5') return { ...s, status: 'in_progress' as const, summary: 'Visa checklist being prepared', next: 'Your counsellor will share your visa checklist' };
      return s;
    });
  }, [applications]);

  if (!user) return null;
  const firstName = user.name.split(' ')[0];
  const progress = overallProgress(services);
  const completed = services.filter((s) => s.status === 'completed').length;
  const offers = applications.filter((a) => a.status.includes('offer') || a.status === 'accepted').length;

  return (
    <div className="bg-[#F4F1EA] pb-20 pt-24">
      {/* Header band */}
      <div className="bg-navy-950 pb-28 pt-10">
        <Container>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <DemoBadge light label="Demo dashboard · sample data" />
              <h1 className="mt-4 text-3xl text-white sm:text-4xl">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-2 max-w-xl text-navy-200">
                You're working towards a <span className="font-semibold text-white">{profile.courseInterest}</span> in{' '}
                {profile.destination} for {profile.intake}.
              </p>
            </div>
            <div className="flex items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <ProgressRing value={progress} />
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2 text-navy-200">
                  <dt>Services completed:</dt>
                  <dd className="font-semibold text-white">{completed} of 7</dd>
                </div>
                <div className="flex gap-2 text-navy-200">
                  <dt>Applications:</dt>
                  <dd className="font-semibold text-white">{applications.length}</dd>
                </div>
                <div className="flex gap-2 text-navy-200">
                  <dt>Offers:</dt>
                  <dd className="font-semibold text-gold-300">{offers}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Container>
      </div>

      <Container className="-mt-20">
        {showWelcome && (
          <div role="status" className="mb-6 flex animate-fade-up items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft">
            <PartyPopper className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
            <div className="flex-1 text-sm text-emerald-900">
              <p className="font-semibold">Welcome to AHatIn, {firstName}!</p>
              <p className="mt-1">Your account is ready. In the real portal, your counsellor would now contact you. The data below is a demo example.</p>
            </div>
            <button type="button" onClick={() => setShowWelcome(false)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="mb-6">
          <AttentionCard documents={documents} applications={applications} sessions={sessions} profile={profile} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <ServiceTracker services={services} />
            <ApplicationsCard applications={applications} onChange={setApplications} />
            <DocumentChecklist documents={documents} onChange={setDocuments} />
          </div>
          <div className="min-w-0 space-y-6 lg:col-span-4">
            <ProfileCard
              user={user}
              profile={profile}
              onSave={setProfile}
              passportLocked={applications.some((a) => a.status !== 'draft')}
              counsellor={counsellor}
            />
            {record && <SessionsCard studentId={record.id} studentName={user.name} counsellor={counsellor} />}
            <div className="card flex items-start gap-3 p-5 text-sm text-navy-600">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden />
              <p>
                Deadlines and data on this page are demo content. In the real portal, they come from your counsellor and
                applications.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
