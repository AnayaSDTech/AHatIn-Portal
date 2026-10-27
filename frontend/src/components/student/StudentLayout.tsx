import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays, FolderCheck, LayoutDashboard, MessageSquare, PartyPopper, PiggyBank, Plane, School, UserRound, UserRoundCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Container } from '../ui/Container';
import { DemoBadge } from '../ui/DemoBadge';
import { ProfileModal } from '../dashboard/ProfileModal';
import { BookSessionModal } from '../dashboard/BookSessionModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { blankProfile, type StudentProfile } from '../../data/dashboard';
import { applicationUpdates, type ApplicationUpdate, type Counsellor, type Message, type StaffStudent, type StudentTeam } from '../../data/staff';
import { useMessages, useSessions } from '../../hooks/useStaffData';
import { useStudentActions, type StudentActions } from '../../hooks/useJourney';
import { api } from '../../lib/api/client';
import { mutate, useApi } from '../../lib/api/store';
import type { User } from '../../lib/api/types';
import { computeServices, overallProgress, type ServiceView } from '../../lib/journey';
import type { Session } from '../../lib/scheduling';
import { cn, goToSection } from '../../lib/utils';

/** Everything the student pages share: the record, its progress, and ways to move around. */
export interface StudentContext {
  user: User;
  record: StaffStudent;
  profile: StudentProfile;
  /** Every field the profile form asks for is filled in. The journey starts once it is (and a counsellor is assigned). */
  profileComplete: boolean;
  /** Null until the admin assigns one, based on the completed profile. */
  counsellor: Counsellor | null;
  /** Counsellor, Financial Aid Officer and Visa Officer (each null until assigned). */
  team: StudentTeam;
  services: ServiceView[];
  /** This student's sessions. */
  sessions: Session[];
  /** All sessions the student may see (their own, plus other students' bookings shown only as busy times). */
  allSessions: Session[];
  messages: Message[];
  actions: StudentActions;
  /** Application status changes since the student last opened their applications. */
  appUpdates: ApplicationUpdate[];
  /** Opens the section a notification or tracker button points to, e.g. "documents" or "shortlist". */
  go: (target: string) => void;
  openProfile: () => void;
  /** Opens the booking window, or explains what has to happen first (profile, counsellor). */
  openBooking: (topic?: string) => void;
  /** What the optional sections have to show (they are hidden from the navigation until then). */
  showFunding: boolean;
  showTravel: boolean;
}

export const useStudent = () => useOutletContext<StudentContext>();

/** Which page each section lives on. */
const PAGE_FOR: Record<string, string> = {
  progress: '',
  notifications: '',
  counsellor: '',
  shortlist: 'applications',
  applications: 'applications',
  documents: 'documents',
  sessions: 'sessions',
  messages: 'messages',
  funding: 'funding',
  visa: 'funding',
  departure: 'travel',
};

interface Section {
  to: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: number;
  urgent?: boolean;
  hidden?: boolean;
}

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

/**
 * The student area: a header with a navigation bar (Overview, Applications, Documents, Sessions, Messages, and
 * Funding & visa / Travel once they apply), and one page per section underneath.
 */
export function StudentLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(Boolean((location.state as { welcome?: boolean } | null)?.welcome));
  // Just registered or signed in: the profile form opens until the profile is complete.
  const [justSignedIn] = useState(() => {
    const st = location.state as { welcome?: boolean; signedIn?: boolean } | null;
    return Boolean(st?.welcome || st?.signedIn);
  });

  // "My profile" in the account menu opens the profile (passed as navigation state, so the page doesn't jump).
  const [profileOpen, setProfileOpen] = useState<false | 'view' | 'edit'>(false);
  useEffect(() => {
    if ((location.state as { openProfile?: boolean } | null)?.openProfile) {
      setProfileOpen('view');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.key, location.state, location.pathname, navigate]);

  // The student's own record (the same one staff work on), their profile and their counsellor.
  // Refreshed regularly, so changes made by the counsellor show up while the dashboard is open.
  const [mine] = useApi<{ record: StaffStudent; profile: StudentProfile; profileComplete: boolean; counsellor: Counsellor | null; team: StudentTeam; seen: { applications?: string } } | null>(
    user ? '/me/record' : null,
    null,
    { pollMs: 30_000 },
  );
  const record = mine?.record;
  const counsellor = mine?.counsellor ?? null;
  const team: StudentTeam = mine?.team ?? { counsellor, finance: null, visa: null };
  const profile = mine?.profile ?? blankProfile;
  const profileComplete = mine?.profileComplete ?? false;

  const prompted = useRef(false);
  useEffect(() => {
    if (!mine || prompted.current) return;
    prompted.current = true;
    if (justSignedIn && !mine.profileComplete) setProfileOpen('edit');
  }, [mine, justSignedIn]);
  const [allSessions] = useSessions();
  const [messages] = useMessages();
  const sessions = useMemo(() => allSessions.filter((s) => s.studentId === record?.id), [allSessions, record?.id]);
  const actions = useStudentActions(record?.id);
  // Progress comes from real events in the shared record (the same record staff work on).
  const services = useMemo(() => (record ? computeServices(record, allSessions) : []), [record, allSessions]);

  const [booking, setBooking] = useState<{ open: boolean; topic?: string }>({ open: false });
  // Why booking isn't possible yet, shown instead of the booking window.
  const [notYet, setNotYet] = useState<'profile' | 'counsellor' | null>(null);

  // On small screens the tab bar scrolls sideways: keep the current tab in view.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
  }, [location.pathname, record]);

  // Links like /dashboard/applications#shortlist scroll to that section once it is on screen.
  useEffect(() => {
    if (location.hash && record) requestAnimationFrame(() => goToSection(location.hash.slice(1)));
  }, [location.pathname, location.hash, record]);

  if (!user || !record) return null;

  const { journey, documents, applications } = record;
  const status = (code: string) => services.find((s) => s.code === code)?.status;
  const funds = documents.filter((d) => d.category === 'funds');
  const f = journey.funding;
  const showFunding = !!journey.visa || (status('S4') !== 'not_needed' && (!!record.financeOfficerId || !!f.estimatedCost || f.sources.length > 0 || f.scholarships.length > 0 || funds.length > 0));
  const showTravel = journey.visa?.stage === 'granted' || !!journey.departure.confirmedAt;

  const unread = messages.filter((m) => m.studentId === record.id && m.from === 'staff' && !m.readAt).length;
  const docsToDo = documents.filter((d) => d.state === 'missing' || d.state === 'rejected').length;
  const offersToReply = applications.some((a) => a.state === 'accepted') ? 0 : applications.filter((a) => a.state === 'conditional_offer' || a.state === 'unconditional_offer').length;
  const appUpdates = applicationUpdates(applications, mine?.seen.applications);
  const appsToDo = offersToReply + (journey.shortlist?.status === 'shared' ? 1 : 0) + appUpdates.filter((u) => !(u.to === 'conditional_offer' || u.to === 'unconditional_offer')).length;

  const sections: Section[] = [
    { to: '/dashboard', label: 'Overview', title: '', description: '', icon: LayoutDashboard },
    { to: '/dashboard/applications', label: 'Applications', title: 'Applications', description: 'Your university shortlist and the applications your counsellor submits for you.', icon: School, badge: appsToDo },
    { to: '/dashboard/documents', label: 'Documents', title: 'Documents', description: 'Upload what your counsellor asks for; you can see when each one is checked.', icon: FolderCheck, badge: docsToDo, urgent: documents.some((d) => d.state === 'rejected') },
    { to: '/dashboard/sessions', label: 'Sessions', title: 'My sessions', description: team.finance || team.visa ? 'Book and manage sessions with your counsellor and officers.' : `Book and manage sessions with ${counsellor?.name ?? 'your counsellor'}.`, icon: CalendarDays },
    { to: '/dashboard/messages', label: 'Messages', title: 'Messages', description: team.finance || team.visa ? 'Your chats with the people looking after you.' : `Your chat with ${counsellor?.name ?? 'your counsellor'}.`, icon: MessageSquare, badge: unread, urgent: unread > 0 },
    { to: '/dashboard/funding', label: 'Funding & visa', title: 'Funding & visa', description: 'Your funding plan, scholarships and visa progress.', icon: PiggyBank, hidden: !showFunding },
    { to: '/dashboard/travel', label: 'Travel', title: 'Travel & arrival', description: 'Get ready to travel, then tell us when you have arrived.', icon: Plane, hidden: !showTravel },
  ];
  const current = sections.find((s) => (s.to === '/dashboard' ? location.pathname.replace(/\/$/, '') === '/dashboard' : location.pathname.startsWith(s.to))) ?? sections[0]!;
  const isOverview = current.to === '/dashboard';

  const firstName = user.name.split(' ')[0];
  const progress = overallProgress(services);
  const completed = services.filter((s) => s.status === 'completed').length;
  const counted = services.filter((s) => s.status !== 'not_needed').length;
  const offers = applications.filter((a) => a.state.includes('offer') || a.state === 'accepted').length;

  const context: StudentContext = {
    user,
    record,
    profile,
    profileComplete,
    counsellor,
    team,
    services,
    sessions,
    allSessions,
    messages,
    actions,
    appUpdates,
    showFunding,
    showTravel,
    go: (target) => {
      if (target === 'profile') return setProfileOpen(profileComplete ? 'view' : 'edit');
      const page = PAGE_FOR[target];
      if (page === undefined) return goToSection(target);
      navigate(`/dashboard${page ? `/${page}` : ''}#${target}`);
    },
    openProfile: () => setProfileOpen(profileComplete ? 'view' : 'edit'),
    openBooking: (topic) => {
      if (!profileComplete) return setNotYet('profile');
      if (!counsellor) return setNotYet('counsellor');
      setBooking({ open: true, topic });
    },
  };

  return (
    <div className="bg-[#F4F1EA] pb-20 pt-24">
      {/* Header band with the student navigation */}
      <div className="bg-navy-950 pt-10">
        <Container>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            {isOverview ? (
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
                  ) : record.destination !== 'Not decided' && record.intake !== 'To be decided' ? (
                    `Planning to study in ${record.destination} for ${record.intake}. Your counsellor will help you choose a course.`
                  ) : (
                    'Your counsellor will help you choose a course, a destination and an intake.'
                  )}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl text-white sm:text-4xl">{current.title}</h1>
                <p className="mt-2 max-w-xl text-navy-200">{current.description}</p>
              </div>
            )}
            {/* Progress summary: the same on every tab. */}
            <div className="flex items-center gap-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur" data-progress-summary>
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

          {/* Student navigation: scrolls sideways on small screens */}
          <nav ref={navRef} className="-mx-1 mt-8 flex gap-1 overflow-x-auto px-1" aria-label="My dashboard">
            {sections
              .filter((s) => !s.hidden)
              .map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.to === '/dashboard'}
                  className={({ isActive }) =>
                    cn(
                      'flex shrink-0 items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold transition',
                      isActive ? 'bg-[#F4F1EA] text-navy-900' : 'text-navy-200 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  <s.icon className="h-4 w-4" aria-hidden />
                  {s.label}
                  {!!s.badge && (
                    <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', s.urgent ? 'bg-red-500 text-white' : 'bg-gold-500 text-navy-950')}>
                      {s.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            {/* The profile opens in a window over the current page. */}
            <button
              type="button"
              onClick={() => setProfileOpen('view')}
              className="ml-auto flex shrink-0 items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold text-navy-200 transition hover:bg-white/10 hover:text-white"
              data-open-profile
            >
              <UserRound className="h-4 w-4" aria-hidden />
              My profile
            </button>
          </nav>
        </Container>
      </div>

      <Container className="mt-8">
        {showWelcome && isOverview && (
          <div role="status" className="mb-6 flex animate-fade-up items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft">
            <PartyPopper className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
            <div className="flex-1 text-sm text-emerald-900">
              <p className="font-semibold">Welcome to AHat, {firstName}!</p>
              <p className="mt-1">
                {profileComplete
                  ? "Your account is ready. We're matching you with a counsellor who knows your chosen country, and we'll email you when they're assigned."
                  : 'Your account is ready. Complete your profile so we can match you with a counsellor who knows your chosen country and course.'}
              </p>
            </div>
            <button type="button" onClick={() => setShowWelcome(false)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {!profileComplete && (
          <div role="status" className="mb-6 flex flex-col gap-4 rounded-2xl border border-gold-300 bg-gold-50 p-5 shadow-soft sm:flex-row sm:items-center" data-profile-banner>
            <UserRoundCheck className="h-6 w-6 shrink-0 text-gold-700" aria-hidden />
            <div className="flex-1 text-sm text-navy-800">
              <p className="font-semibold text-navy-900">Complete your profile to start your journey</p>
              <p className="mt-1">
                {counsellor
                  ? `${counsellor.name} needs your education, English test and study plans before your next steps. It takes about five minutes.`
                  : 'We use your education, English test and study plans to match you with the right counsellor. It takes about five minutes.'}
              </p>
            </div>
            <Button size="sm" onClick={() => setProfileOpen('edit')}>Complete profile</Button>
          </div>
        )}
        <Outlet context={context} />
      </Container>

      {counsellor && (
        <BookSessionModal
          open={booking.open}
          onClose={() => setBooking({ open: false })}
          studentId={record.id}
          studentName={user.name}
          team={team}
          initialType={booking.topic}
        />
      )}

      <Modal
        open={!!notYet}
        onClose={() => setNotYet(null)}
        title={notYet === 'profile' ? 'Complete your profile first' : 'Your counsellor is being matched'}
        footer={
          notYet === 'profile' ? (
            <>
              <Button variant="outline" onClick={() => setNotYet(null)}>Not now</Button>
              <Button
                onClick={() => {
                  setNotYet(null);
                  setProfileOpen('edit');
                }}
              >
                Complete profile
              </Button>
            </>
          ) : (
            <Button onClick={() => setNotYet(null)}>OK</Button>
          )
        }
      >
        <p className="text-sm text-navy-600" data-not-yet={notYet ?? ''}>
          {notYet === 'profile'
            ? 'You can book sessions once your profile is complete. We need your education, English test and study plans to match you with the right counsellor.'
            : `Thanks for completing your profile. We're matching you with a counsellor who knows ${profile.destination && profile.destination !== 'Not sure yet' ? profile.destination : 'your chosen country'}. You can book your first session as soon as they're assigned, and we'll email you when they are.`}
        </p>
      </Modal>

      <ProfileModal
        open={!!profileOpen}
        startEditing={profileOpen === 'edit'}
        completing={!profileComplete}
        onClose={() => setProfileOpen(false)}
        user={user}
        profile={profile}
        onSave={(p) => mutate(() => api.put('/me/profile', p), { silent: true }).then(() => undefined)}
        passportLocked={applications.some((a) => a.state !== 'draft')}
        counsellor={counsellor}
      />
    </div>
  );
}
