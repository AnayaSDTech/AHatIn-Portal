import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarDays, FolderCheck, LayoutDashboard, Menu, MessageSquare, PartyPopper, PiggyBank, Plane, School, UserRound, UserRoundCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Container } from '../ui/Container';
import { BookSessionModal } from '../dashboard/BookSessionModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { blankProfile, type StudentProfile } from '../../data/dashboard';
import { applicationUpdates, type ApplicationUpdate, type Counsellor, type Message, type StaffStudent, type StudentTeam } from '../../data/staff';
import { useMessages, useSessions } from '../../hooks/useStaffData';
import { useStudentActions, type StudentActions } from '../../hooks/useJourney';
import { useApi } from '../../lib/api/store';
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

export const PROFILE_PATH = '/dashboard/profile';

/** "My profile": its own page, shown at the right of the tabs (and under "More" on phones). */
const profileSection: Section = { to: PROFILE_PATH, label: 'My profile', title: 'My profile', description: '', icon: UserRound };

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
  /** Label in the phone's bottom bar. */
  short?: string;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function ProgressRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0 sm:h-32 sm:w-32">
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
          <p className="font-display text-xl text-white sm:text-3xl">{value}%</p>
          <p className="text-[9px] uppercase tracking-wider text-navy-200 sm:text-[10px]">overall</p>
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

  // Older links asked for the profile with navigation state: it is a page now.
  useEffect(() => {
    if ((location.state as { openProfile?: boolean } | null)?.openProfile) navigate(PROFILE_PATH, { replace: true });
  }, [location.key, location.state, navigate]);

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
    // Just signed in with an incomplete profile: start on the profile form.
    if (justSignedIn && !mine.profileComplete && location.pathname !== PROFILE_PATH) navigate(PROFILE_PATH);
  }, [mine, justSignedIn, location.pathname, navigate]);
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
  const showFunding = !!journey.visa || !!record.visaOfficerId || (status('S4') !== 'not_needed' && (!!record.financeOfficerId || !!f.estimatedCost || f.sources.length > 0 || f.scholarships.length > 0 || funds.length > 0));
  const showTravel = journey.visa?.stage === 'granted' || !!journey.departure.confirmedAt;

  const unread = messages.filter((m) => m.studentId === record.id && m.from === 'staff' && !m.readAt).length;
  const docsToDo = documents.filter((d) => d.state === 'missing' || d.state === 'rejected').length;
  const offersToReply = applications.some((a) => a.state === 'accepted') ? 0 : applications.filter((a) => a.state === 'conditional_offer' || a.state === 'unconditional_offer').length;
  const appUpdates = applicationUpdates(applications, mine?.seen.applications);
  const appsToDo = offersToReply + (journey.shortlist?.status === 'shared' ? 1 : 0) + appUpdates.filter((u) => !(u.to === 'conditional_offer' || u.to === 'unconditional_offer')).length;

  const sections: Section[] = [
    { to: '/dashboard', label: 'Overview', short: 'Home', title: '', description: '', icon: LayoutDashboard },
    { to: '/dashboard/applications', label: 'Applications', short: 'Applications', title: 'Applications', description: 'Your university shortlist and the applications your counsellor submits for you.', icon: School, badge: appsToDo },
    { to: '/dashboard/documents', label: 'Documents', short: 'Documents', title: 'Documents', description: 'Upload what your counsellor asks for; you can see when each one is checked.', icon: FolderCheck, badge: docsToDo, urgent: documents.some((d) => d.state === 'rejected') },
    { to: '/dashboard/sessions', label: 'Sessions', title: 'My sessions', description: team.finance || team.visa ? 'Book and manage sessions with your counsellor and officers.' : `Book and manage sessions with ${counsellor?.name ?? 'your counsellor'}.`, icon: CalendarDays },
    { to: '/dashboard/messages', label: 'Messages', short: 'Messages', title: 'Messages', description: team.finance || team.visa ? 'Your chats with the people looking after you.' : `Your chat with ${counsellor?.name ?? 'your counsellor'}.`, icon: MessageSquare, badge: unread, urgent: unread > 0 },
    { to: '/dashboard/funding', label: 'Funding & visa', title: 'Funding & visa', description: 'Your funding plan, scholarships and visa progress.', icon: PiggyBank, hidden: !showFunding },
    { to: '/dashboard/travel', label: 'Travel', title: 'Travel & arrival', description: 'Get ready to travel, then tell us when you have arrived.', icon: Plane, hidden: !showTravel },
  ];
  const current =
    [...sections, profileSection].find((s) => (s.to === '/dashboard' ? location.pathname.replace(/\/$/, '') === '/dashboard' : location.pathname.startsWith(s.to))) ?? sections[0]!;
  const onProfilePage = current === profileSection;
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
      if (target === 'profile') return navigate(PROFILE_PATH);
      const page = PAGE_FOR[target];
      if (page === undefined) return goToSection(target);
      navigate(`/dashboard${page ? `/${page}` : ''}#${target}`);
    },
    openProfile: () => navigate(PROFILE_PATH),
    openBooking: (topic) => {
      if (!profileComplete) return setNotYet('profile');
      if (!counsellor) return setNotYet('counsellor');
      setBooking({ open: true, topic });
    },
  };

  return (
    <div className="bg-[#F4F1EA] pb-28 pt-24 sm:pb-20">
      {/* Header band with the student navigation (on phones the navigation is the bar at the bottom) */}
      <div className="bg-navy-950 pb-6 pt-6 sm:pb-0 sm:pt-10">
        <Container>
          <div className="flex flex-col justify-between gap-5 sm:gap-8 md:flex-row md:items-center">
            {isOverview ? (
              <div>
                <h1 className="text-2xl text-white sm:text-4xl">
                  {greeting()}, {firstName}
                </h1>
                {(() => {
                  // The study plan at a glance, from the profile (or the record) once known.
                  const plan = [
                    ...profile.courseInterests,
                    profile.destination || (record.destination !== 'Not decided' ? record.destination : ''),
                    profile.intake || (record.intake !== 'To be decided' ? record.intake : ''),
                  ].filter(Boolean);
                  return plan.length ? (
                    <div className="mt-4 flex flex-wrap gap-2" data-study-plan>
                      {plan.map((p, i) => (
                        <span key={p} className={cn('rounded-full px-3 py-1 text-sm', i < profile.courseInterests.length ? 'bg-gold-500 font-semibold text-navy-950' : 'bg-white/10 text-navy-100 ring-1 ring-white/15')}>
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <div>
                <h1 className="text-2xl text-white sm:text-4xl">{current.title}</h1>
              </div>
            )}
            {/* Progress summary: the same on every tab. */}
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:gap-6 sm:p-5" data-progress-summary>
              <ProgressRing value={progress} />
              <dl className="space-y-1.5 whitespace-nowrap text-sm sm:space-y-2">
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
          <nav ref={navRef} className="-mx-1 mt-8 hidden gap-1 overflow-x-auto px-1 sm:flex" aria-label="My dashboard">
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
            <NavLink
              to={PROFILE_PATH}
              className={({ isActive }) =>
                cn('ml-auto flex shrink-0 items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold transition', isActive ? 'bg-[#F4F1EA] text-navy-900' : 'text-navy-200 hover:bg-white/10 hover:text-white')
              }
              data-open-profile
            >
              <UserRound className="h-4 w-4" aria-hidden />
              My profile
            </NavLink>
          </nav>
        </Container>
      </div>

      <MobileNav sections={[...sections.filter((sec) => !sec.hidden), profileSection]} />

      <Container className="mt-6 sm:mt-8">
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
        {/* On the Overview the progress card has its own "Complete your profile" button. */}
        {!profileComplete && !onProfilePage && !isOverview && (
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
            <Button size="sm" onClick={() => navigate(PROFILE_PATH)}>Complete profile</Button>
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
                  navigate(PROFILE_PATH);
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
    </div>
  );
}

/* ------------------------------ Phones: bottom navigation ------------------------------ */

/**
 * On phones the sections are a bar fixed to the bottom of the screen, like an app: Home, Applications, Documents and
 * Messages, with "More" for Sessions, Funding & visa, Travel (once they apply) and My profile.
 */
function MobileNav({ sections }: { sections: Section[] }) {
  const location = useLocation();
  const [more, setMore] = useState(false);
  const main = sections.filter((s) => s.short);
  const extra = sections.filter((s) => !s.short);
  const moreActive = extra.some((s) => location.pathname.startsWith(s.to));
  const moreBadge = extra.reduce((n, s) => n + (s.badge ?? 0), 0);

  // Close "More" when the page changes.
  useEffect(() => setMore(false), [location.pathname]);

  // Keep the bottom of the page (the site footer) clear of the bar.
  useEffect(() => {
    document.body.classList.add('pb-16', 'sm:pb-0');
    return () => document.body.classList.remove('pb-16', 'sm:pb-0');
  }, []);

  return (
    <>
      {more && <button type="button" className="fixed inset-0 z-40 bg-navy-950/30 sm:hidden" aria-label="Close menu" onClick={() => setMore(false)} />}
      {/* Hidden while the site menu is open, so it never covers the menu (e.g. Log out). */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden [.site-menu-open_&]:hidden">
        {more && (
          <div className="mx-3 mb-2 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-navy-100" role="menu" aria-label="More">
            {extra.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                role="menuitem"
                className={({ isActive }) => cn('flex items-center gap-3 border-b border-navy-100 px-4 py-3.5 text-sm font-semibold last:border-b-0', isActive ? 'text-navy-900' : 'text-navy-700')}
              >
                <s.icon className="h-5 w-5 text-navy-400" aria-hidden /> {s.label}
              </NavLink>
            ))}
          </div>
        )}
        <nav className="grid grid-cols-5 border-t border-navy-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Dashboard sections" data-mobile-nav>
          {main.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.to === '/dashboard'}
              className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition', isActive ? 'text-navy-900' : 'text-navy-400')}
            >
              {({ isActive }) => (
                <>
                  <span className={cn('absolute inset-x-3 top-0 h-0.5 rounded-full', isActive ? 'bg-gold-500' : 'bg-transparent')} aria-hidden />
                  <span className="relative">
                    <s.icon className="h-5 w-5" aria-hidden />
                    {!!s.badge && (
                      <span className={cn('absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold', s.urgent ? 'bg-red-500 text-white' : 'bg-gold-500 text-navy-950')}>
                        {s.badge}
                      </span>
                    )}
                  </span>
                  {s.short}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className={cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition', more || moreActive ? 'text-navy-900' : 'text-navy-400')}
          >
            <span className={cn('absolute inset-x-3 top-0 h-0.5 rounded-full', moreActive ? 'bg-gold-500' : 'bg-transparent')} aria-hidden />
            <span className="relative">
              <Menu className="h-5 w-5" aria-hidden />
              {!!moreBadge && <span className="absolute -right-2 -top-1.5 h-2.5 w-2.5 rounded-full bg-gold-500" aria-hidden />}
            </span>
            More
          </button>
        </nav>
      </div>
    </>
  );
}
