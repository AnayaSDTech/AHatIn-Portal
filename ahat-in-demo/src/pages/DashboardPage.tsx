import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, PartyPopper, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocalState } from '../hooks/useLocalState';
import { Container } from '../components/ui/Container';
import { DemoBadge } from '../components/ui/DemoBadge';
import { ProfileModal } from '../components/dashboard/ProfileModal';
import { ServiceTracker } from '../components/dashboard/ServiceTracker';
import { ApplicationsCard } from '../components/dashboard/ApplicationsCard';
import { DocumentChecklist } from '../components/dashboard/DocumentChecklist';
import { SessionsCard } from '../components/dashboard/SessionsCard';
import { NotificationsCard, buildNotifications } from '../components/dashboard/NotificationsCard';
import { DepartureCard, FundingCard, ShortlistCard, VisaCard } from '../components/dashboard/JourneyCards';
import { blankProfile, demoProfile } from '../data/dashboard';
import { counsellors, newStudentRecord } from '../data/staff';
import { useMessages, useSessions, useStaffStudents } from '../hooks/useStaffData';
import { MessagesCard } from '../components/dashboard/MessagesCard';
import { CounsellorCard } from '../components/dashboard/CounsellorCard';
import { BalancedColumns } from '../components/dashboard/BalancedColumns';
import { useStudentActions } from '../hooks/useJourney';
import { computeServices, overallProgress } from '../lib/journey';

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
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(Boolean((location.state as { welcome?: boolean } | null)?.welcome));

  // "My profile" in the account menu opens the profile modal (passed as navigation state, so the page doesn't jump).
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if ((location.state as { openProfile?: boolean } | null)?.openProfile) {
      setProfileOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.key, location.state, location.pathname, navigate]);

  const prefix = `ahatin-demo-${user?.id ?? 'guest'}`;
  // Only the main demo student comes with sample profile details; everyone else starts blank.
  const [profile, setProfile] = useLocalState(`${prefix}-profile`, user?.id === 'demo-student-1' ? demoProfile : blankProfile);
  const [staffStudents, setStaffStudents] = useStaffStudents();
  const [allSessions] = useSessions();
  const [messages] = useMessages();
  const record = staffStudents.find((s) => s.userId === user?.id);
  const counsellor = counsellors.find((c) => c.id === record?.counsellorId) ?? counsellors[0]!;
  const sessions = useMemo(() => allSessions.filter((s) => s.studentId === record?.id), [allSessions, record?.id]);

  // Every student account has a staff-side record (with an assigned counsellor) in the shared demo data.
  useEffect(() => {
    if (user && !record) setStaffStudents((all) => (all.some((s) => s.userId === user.id) ? all : [...all, newStudentRecord(user, {}, all)]));
  }, [user, record, setStaffStudents]);
  const actions = useStudentActions(record?.id);

  // Progress comes from real events in the shared record (the same record staff work on).
  const services = useMemo(() => (record ? computeServices(record, allSessions) : []), [record, allSessions]);

  if (!user || !record) return null;
  const { applications, documents } = record;
  const firstName = user.name.split(' ')[0];
  const progress = overallProgress(services);
  const completed = services.filter((s) => s.status === 'completed').length;
  const counted = services.filter((s) => s.status !== 'not_needed').length;
  const offers = applications.filter((a) => a.state.includes('offer') || a.state === 'accepted').length;

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
                {profile.courseInterest ? (
                  <>
                    You're working towards a <span className="font-semibold text-white">{profile.courseInterest}</span> in {profile.destination || record.destination} for{' '}
                    {profile.intake || record.intake}.
                  </>
                ) : (
                  <>Planning to study in {record.destination} for {record.intake}. Your counsellor will help you choose a course.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <ProgressRing value={progress} />
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2 text-navy-200">
                  <dt>Services completed:</dt>
                  <dd className="font-semibold text-white">{completed} of {counted}</dd>
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
              <p className="font-semibold">Welcome to AHat, {firstName}!</p>
              <p className="mt-1">Your account is ready. In the real portal, your counsellor would now contact you. The data below is a demo example.</p>
            </div>
            <button type="button" onClick={() => setShowWelcome(false)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Progress (left) and notifications, counsellor, sessions, messages (right) stay at the top;
            the other cards go to whichever column is shorter, so both columns end at about the same place. */}
        <BalancedColumns
          left={
            <div className="order-2 min-w-0">
              <ServiceTracker services={services} />
            </div>
          }
          right={
            <>
              <div className="order-1 min-w-0">
                <NotificationsCard items={buildNotifications(record, services, sessions, profile, messages)} onOpenProfile={() => setProfileOpen(true)} />
              </div>
              <div className="order-3 min-w-0">
                <CounsellorCard counsellor={counsellor} />
              </div>
              <div className="order-4 min-w-0">
                <SessionsCard studentId={record.id} studentName={user.name} counsellor={counsellor} />
              </div>
              <div className="order-5 min-w-0">
                <MessagesCard studentId={record.id} counsellor={counsellor} unread={messages.filter((m) => m.studentId === record.id && m.from === 'staff' && !m.readAt).length} />
              </div>
            </>
          }
          flow={[
            { key: 'shortlist', order: 'order-6', wide: true, wideOnly: true, node: <ShortlistCard student={record} actions={actions} /> },
            { key: 'applications', order: 'order-7', wide: true, node: <ApplicationsCard applications={applications} onDecide={actions.decideOffer} /> },
            { key: 'funding', order: 'order-8', node: <FundingCard student={record} actions={actions} notNeeded={services.find((s) => s.code === 'S4')?.status === 'not_needed'} /> },
            { key: 'visa', order: 'order-9', node: <VisaCard student={record} /> },
            { key: 'departure', order: 'order-10', node: <DepartureCard student={record} actions={actions} /> },
            { key: 'documents', order: 'order-11', wide: true, node: <DocumentChecklist documents={documents} onUpload={actions.uploadDocument} onRemove={actions.removeUpload} /> },
            {
              key: 'note',
              order: 'order-12',
              node: (
                <div className="card flex items-start gap-3 p-5 text-sm text-navy-600">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden />
                  <p>Demo data. Everything you do here appears straight away in your counsellor's view of your record, and their updates appear here.</p>
                </div>
              ),
            },
          ]}
        />
      </Container>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        profile={profile}
        onSave={setProfile}
        passportLocked={applications.some((a) => a.state !== 'draft')}
        counsellor={counsellor}
      />
    </div>
  );
}
