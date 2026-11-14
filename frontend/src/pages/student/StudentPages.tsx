import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarPlus, Clock, Compass, Inbox, ListChecks, MessageSquare, PiggyBank, UserRoundPen } from 'lucide-react';
import { Panel, Pill } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { useStudent } from '../../components/student/StudentLayout';
import { ServiceTracker, type TrackerAction } from '../../components/dashboard/ServiceTracker';
import { CareerPlanCard, CareerPlanSummary } from '../../components/dashboard/CareerPlanDetails';
import { StageDetails } from '../../components/dashboard/StageDetails';
import { stageSteps } from '../../lib/journeySteps';
import { NotificationsCard, buildNotifications } from '../../components/dashboard/NotificationsCard';
import { TeamPanel, type TeamMember } from '../../components/dashboard/CounsellorCard';
import { ApplicationsCard } from '../../components/dashboard/ApplicationsCard';
import { ApplicationsJourney, defaultTab, shortlistVisible, type ApplicationsTab } from '../../components/dashboard/ApplicationsJourney';
import { DocumentChecklist } from '../../components/dashboard/DocumentChecklist';
import { SessionsCard } from '../../components/dashboard/SessionsCard';
import { MessagesCard } from '../../components/dashboard/MessagesCard';
import { DepartureCard, FundingCard, ShortlistCard, VisaCard } from '../../components/dashboard/JourneyCards';
import { DEPARTURE_TASKS, applicationDocumentsDue, type ServiceCode } from '../../lib/journey';
import { DelegatesCard } from '../../components/dashboard/DelegatesCard';
import { ReferralsPanel } from '../../components/referrals/ReferralsPanel';
import { api } from '../../lib/api/client';
import { act } from '../../lib/api/store';
import { areaHasOwner, hostFor, type AppState, type StaffStudent, type TeamArea } from '../../data/staff';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/** Shown on a section page that has nothing in it yet. */
function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-200 bg-ivory/50 px-6 py-12 text-center text-sm text-navy-600">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-navy-400 shadow-sm">
          <Inbox className="h-6 w-6" aria-hidden />
        </span>
        <p className="max-w-md leading-relaxed">{children}</p>
        {action}
      </div>
    </div>
  );
}

/** What a student without a complete profile or a counsellor sees on Sessions and Messages. */
function NotStartedYet({ what }: { what: string }) {
  const { profileComplete, openProfile } = useStudent();
  return profileComplete ? (
    <Empty>You can {what} once your counsellor is assigned. We're matching you with one now and will email you when they are.</Empty>
  ) : (
    <Empty action={<Button size="sm" onClick={openProfile}>Complete profile</Button>}>
      Complete your profile first. We use it to match you with a counsellor, and then you can {what}.
    </Empty>
  );
}

/** The kind of session that fits where the student is now; they can still choose another in the booking window. */
function sessionFor(record: StaffStudent, area: TeamArea) {
  const { careerPlan, visa, departure, arrival } = record.journey;
  if (area === 'finance') return 'Scholarship & funding';
  if (area === 'visa') return arrival.arrivedAt ? 'Post-arrival check-in' : visa?.stage === 'granted' || departure.confirmedAt ? 'Pre-departure briefing' : 'Visa preparation';
  return careerPlan ? 'Application review' : 'Career counselling';
}

/* ------------------------------ Overview ------------------------------ */

/**
 * Where a sticky side column stops: just under the site header when it fits on the screen; otherwise high enough that
 * its bottom stays on screen. A tall column then scrolls with the page until its end shows, and stays there, so it
 * never needs a scroll bar of its own and nothing is cut off.
 */
function useStickyTop<T extends HTMLElement>(headerGap = 112, bottomGap = 24) {
  const ref = useRef<T>(null);
  const [top, setTop] = useState(headerGap);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(headerGap, window.innerHeight - el.offsetHeight - bottomGap));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [headerGap, bottomGap]);
  return [ref, top] as const;
}

export function StudentOverviewPage() {
  const { record, services, sessions, profile, profileComplete, messages, counsellor, team, appUpdates, go, openBooking, openProfile } = useStudent();
  const openChat = useOpenChat();
  // The journey starts once the profile is complete and the admin has assigned a counsellor.
  const journeyStarted = profileComplete && !!counsellor;
  /** A stage that is under way or done (its link in the tracker shows only then). */
  const started = (code: ServiceCode) => {
    const status = services.find((sv) => sv.code === code)?.status;
    return status === 'in_progress' || status === 'completed';
  };

  // Documents staff asked for at a stage and the student hasn't uploaded yet: a button on that stage.
  const documentButtons = useMemo(() => {
    const due: Partial<Record<ServiceCode, string[]>> = {};
    record.documents.forEach((d) => {
      if (d.requestedStage && (d.state === 'missing' || d.state === 'rejected')) (due[d.requestedStage] ??= []).push(d.name);
    });
    return Object.fromEntries(
      Object.entries(due).map(([code, names]) => [code, { label: names.length === 1 ? `Upload ${names[0]}` : `Upload ${names.length} documents`, onClick: () => go('documents') }]),
    ) as Partial<Record<ServiceCode, TrackerAction>>;
  }, [record.documents, go]);

  // Funding runs alongside the other stages: until a session is booked by anyone (a cancelled one doesn't count).
  const fundingBooked = sessions.some((x) => x.studentId === record.id && x.type === 'Scholarship & funding' && x.status !== 'cancelled');
  const bookingButtons: Partial<Record<ServiceCode, TrackerAction>> = {};
  if (areaHasOwner(record, 'finance') && services.find((s) => s.code === 'S4')?.status === 'in_progress' && !fundingBooked) {
    bookingButtons.S4 = { label: 'Book a session', onClick: () => openBooking('Scholarship & funding') };
  }
  // The same for the visa: until a session is booked by anyone (a cancelled one doesn't count).
  const visaBooked = sessions.some((x) => x.studentId === record.id && x.type === 'Visa preparation' && x.status !== 'cancelled');
  if (areaHasOwner(record, 'visa') && services.find((s) => s.code === 'S5')?.status === 'in_progress' && !visaBooked) {
    bookingButtons.S5 = { label: 'Book a session', onClick: () => openBooking('Visa preparation') };
  }
  // Until the first session is booked (cancelled ones count, as they do for the stage).
  if (services.find((s) => s.code === 'S1')?.status === 'in_progress' && !record.journey.careerPlan && !sessions.some((x) => x.studentId === record.id)) {
    bookingButtons.S1 = { label: 'Book a session', onClick: () => openBooking('Career counselling') };
  }

  // Buttons in the progress tracker for steps that are waiting on the student.
  const trackerActions = useMemo(() => {
    const a: Partial<Record<ServiceCode, TrackerAction>> = {};
    const status = (code: ServiceCode) => services.find((s) => s.code === code)?.status;
    const open = (code: ServiceCode) => status(code) !== 'completed' && status(code) !== 'not_needed';
    const to = (target: string) => () => go(target);
    const { journey, applications, documents } = record;


    const offers = applications.filter((x) => x.state === 'conditional_offer' || x.state === 'unconditional_offer');
    if (open('S3') && offers.length && !applications.some((x) => x.state === 'accepted')) a.S3 = { label: 'Reply to offer', onClick: to('applications') };
    else if (journey.shortlist?.status === 'shared') a.S3 = { label: 'Review shortlist', onClick: to('shortlist') };
    else if (open('S3') && !documentButtons.S3 && applications.length && applications.every((x) => x.state === 'draft') && applicationDocumentsDue(record))
      a.S3 = { label: 'Upload documents', onClick: to('documents') };

    if (open('S4')) {
      const funds = documents.filter((d) => d.category === 'funds');
      if (funds.some((d) => d.state === 'missing' || d.state === 'rejected')) {
        if (!documentButtons.S4) a.S4 = { label: 'Upload proof of funds', onClick: to('documents') };
      }
      else if (journey.funding.estimatedCost && journey.funding.sources.length === 0) a.S4 = { label: 'Add funding plan', onClick: to('funding') };
    }

    if (status('S6') === 'in_progress' && DEPARTURE_TASKS.some((t) => !journey.departure.done[t.key])) a.S6 = { label: 'Open travel checklist', onClick: to('departure') };

    if (journey.departure.confirmedAt && !journey.arrival.arrivedAt) a.S7 = { label: 'Confirm arrival', onClick: to('departure') };
    return a;
  }, [record, services, sessions, documentButtons, go, openBooking]);

  // Everyone looking after the student, for "Your team".
  const members: TeamMember[] = [
    ...(counsellor ? [{ role: 'Counsellor', person: counsellor, area: 'counsellor' as const }] : []),
    ...(team.finance ? [{ role: 'Financial Aid Officer', person: team.finance, area: 'finance' as const }] : []),
    ...(team.visa ? [{ role: 'Visa Officer', person: team.visa, area: 'visa' as const }] : []),
  ].map(({ area, ...m }) => ({ ...m, onMessage: () => openChat(area), onBook: () => openBooking(sessionFor(record, area)) }));

  // The journey first (main column), with notifications and the team beside it. The side column stays in view while
  // the student scrolls the progress, so it never leaves an empty area (see useStickyTop).
  const [asideRef, asideTop] = useStickyTop<HTMLElement>();
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        <ServiceTracker
            services={services}
            // Buttons for the student's next steps once the journey has started (profile complete, counsellor assigned).
            actions={journeyStarted ? trackerActions : {}}
            documents={journeyStarted ? documentButtons : {}}
            bookings={journeyStarted ? bookingButtons : {}}
            intro={
              !profileComplete ? (
                <Button onClick={openProfile} className="w-full sm:w-auto" data-complete-profile>
                  <UserRoundPen className="h-4 w-4" aria-hidden /> Complete your profile
                </Button>
              ) : !counsellor ? (
                <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900" data-being-matched>
                  We're matching you with a counsellor and will email you when they're assigned.
                </p>
              ) : undefined
            }
            links={{
              // The shortlist once the counsellor has shared it; applications, funding and visa once that stage has started.
              ...(record.journey.shortlist?.sharedAt ? { S1: { label: 'View shortlist', onClick: () => go('shortlist') } } : {}),
              ...(started('S3') ? { S3: { label: 'View applications', onClick: () => go('applications') } } : {}),
              ...(started('S4') ? { S4: { label: 'View funding', onClick: () => go('funding') } } : {}),
              ...(started('S5') ? { S5: { label: 'View visa', onClick: () => go('visa') } } : {}),
            }}
            details={Object.fromEntries(
              services
                .filter((sv) => sv.status !== 'not_needed')
                .map((sv) => {
                  const plan = sv.code === 'S1' ? record.journey.careerPlan : undefined;
                  return [
                    sv.code,
                    <StageDetails
                      key={sv.code}
                      code={sv.code}
                      steps={stageSteps(sv.code, record, sessions, sv.status)}
                      extra={plan ? <CareerPlanSummary plan={plan} /> : undefined}
                    />,
                  ];
                }),
            )}
          />
      </div>
      <aside ref={asideRef} style={{ top: asideTop }} className="min-w-0 space-y-6 lg:sticky lg:col-span-4" aria-label="Notifications and your team">
        <NotificationsCard items={buildNotifications(record, services, sessions, profile, messages, appUpdates)} onOpenProfile={openProfile} onGo={go} />
        <TeamPanel members={members} profileComplete={profileComplete} stacked />
      </aside>
    </div>
  );
}

/* ------------------------------ Sections ------------------------------ */

export function StudentApplicationsPage() {
  const { record, actions, appUpdates } = useStudent();
  // What changed since the last visit stays marked "Updated" while the student is on this page;
  // opening the page counts as having seen it.
  const [updated] = useState(() => new Map<string, AppState>(appUpdates.map((u) => [u.id, u.from])));
  useEffect(() => {
    if (appUpdates.length) act(() => api.post('/me/seen/applications'));
  }, [appUpdates.length]);
  // One step at a time, full width. Links such as /dashboard/applications#shortlist open that step.
  const location = useLocation();
  const fromHash = (hash: string): ApplicationsTab | null => (['career-plan', 'shortlist', 'applications'] as const).find((t) => `#${t}` === hash) ?? null;
  const [tab, setTab] = useState<ApplicationsTab>(() => fromHash(location.hash) ?? defaultTab(record));
  useEffect(() => {
    const t = fromHash(location.hash);
    if (t) setTab(t);
  }, [location.hash]);
  const plan = record.journey.careerPlan;
  return (
    <div className="space-y-6">
      <ApplicationsJourney student={record} active={tab} onSelect={setTab} />
      <div role="tabpanel" id="applications-tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="animate-fade-up">
        {tab === 'career-plan' &&
          (plan ? (
            <CareerPlanCard plan={plan} />
          ) : (
            <NotYetPanel id="career-plan" title="Your career plan" icon={<Compass className="h-4 w-4" aria-hidden />}>
              In your first counselling session, your counsellor agrees a career plan with you: the direction, course, study level and countries that suit you. It will appear here.
            </NotYetPanel>
          ))}
        {tab === 'shortlist' &&
          (shortlistVisible(record) ? (
            <ShortlistCard student={record} actions={actions} />
          ) : (
            <NotYetPanel id="shortlist" title="Your shortlist" icon={<ListChecks className="h-4 w-4" aria-hidden />}>
              After your career plan, your counsellor suggests universities and courses that match it. You'll choose which ones to apply to here.
            </NotYetPanel>
          ))}
        {tab === 'applications' && <ApplicationsCard applications={record.applications} onDecide={actions.decideOffer} updated={updated} />}
      </div>
    </div>
  );
}

/** A step of the Applications page that hasn't started yet. */
function NotYetPanel({ id, title, icon, children }: { id: string; title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Panel id={id} title={title} icon={icon} action={<Pill tone="grey">Coming up</Pill>}>
      <div className="rounded-2xl border border-dashed border-navy-200 bg-ivory/50 px-6 py-10 text-center">
        <p className="mx-auto max-w-md text-sm leading-relaxed text-navy-600">{children}</p>
      </div>
    </Panel>
  );
}

export function StudentDocumentsPage() {
  const { record, actions } = useStudent();
  return (
    <div className="space-y-6">
      <DocumentChecklist documents={record.documents} onUpload={actions.uploadDocument} onRemove={actions.removeUpload} />
      <DelegatesCard />
    </div>
  );
}

/** Opens the Messages page on one person's chat. */
function useOpenChat() {
  const navigate = useNavigate();
  return (chat: TeamArea) => navigate(`/dashboard/messages${chat === 'counsellor' ? '' : `?chat=${chat}`}#messages`);
}

export function StudentSessionsPage() {
  const { record, user, counsellor, team, profileComplete } = useStudent();
  const openChat = useOpenChat();
  // Which person's sessions are shown: ?with=finance or ?with=visa, otherwise the counsellor's.
  const [params, setParams] = useSearchParams();
  const tab: TeamArea = params.get('with') === 'finance' && team.finance ? 'finance' : params.get('with') === 'visa' && team.visa ? 'visa' : 'counsellor';
  if (!counsellor || !profileComplete) return <NotStartedYet what="book sessions" />;
  return (
    <SessionsCard
      studentId={record.id}
      studentName={user.name}
      team={team}
      initial={tab}
      onTab={(k) => setParams(k === 'counsellor' ? {} : { with: k }, { replace: true })}
      suggestedType={(k) => sessionFor(record, k)}
      onMessage={openChat}
    />
  );
}

export function StudentMessagesPage() {
  const { record, counsellor, team, messages, openBooking } = useStudent();
  // Which chat is open: ?chat=finance or ?chat=visa from links elsewhere, otherwise the counsellor's.
  const [params, setParams] = useSearchParams();
  const chat: TeamArea = params.get('chat') === 'finance' && team.finance ? 'finance' : params.get('chat') === 'visa' && team.visa ? 'visa' : 'counsellor';
  if (!counsellor) return <NotStartedYet what="message your counsellor" />;
  const switchTo = (c: TeamArea) => {
    setParams(c === 'counsellor' ? {} : { chat: c }, { replace: true });
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('#messages textarea')?.focus());
  };
  return <MessagesCard studentId={record.id} team={team} messages={messages} active={chat} onSelect={switchTo} onBook={(k) => openBooking(sessionFor(record, k))} />;
}

/** Scholarship & Financial Guidance before anything has been set up: who will start it, or that it isn't needed. */
function FundingNotStarted() {
  const { team, services, go, openBooking } = useStudent();
  const view = services.find((s) => s.code === 'S4');
  // The Financial Aid Officer, or the counsellor when they handle funding instead.
  const officer = hostFor(team, 'finance');
  const title = team.finance ? 'Financial Aid Officer' : 'counsellor';
  let body: ReactNode;
  let pill: ReactNode;
  if (view?.status === 'not_needed') {
    pill = <Pill tone="grey">Not needed</Pill>;
    body = (
      <>
        <p className="font-semibold text-navy-900">Funding help isn't needed</p>
        <p className="mt-1 text-sm text-navy-500">{view.override?.reason}</p>
      </>
    );
  } else if (officer) {
    pill = <Pill tone="blue">Getting started</Pill>;
    body = (
      <>
        <p className="font-semibold text-navy-900">Your funding plan is being prepared</p>
        <p className="mt-1 text-sm text-navy-500">{officer.name}, your {title}, will set your estimated cost and suggest scholarships.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => go('messages')}>
            <MessageSquare className="h-4 w-4" aria-hidden /> Message {officer.name.split(' ')[0]}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openBooking('Scholarship & funding')}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Book a funding session
          </Button>
        </div>
      </>
    );
  } else {
    pill = <Pill tone="grey">Coming up</Pill>;
    body = (
      <>
        <p className="flex items-center justify-center gap-1.5 font-semibold text-navy-900">
          <Clock className="h-4 w-4 text-sky-600" aria-hidden /> We're assigning your Financial Aid Officer
        </p>
        <p className="mt-1 text-sm text-navy-500">We'll email you when they are.</p>
      </>
    );
  }
  return (
    <Panel id="funding" title="Funding plan" icon={<PiggyBank className="h-4 w-4" aria-hidden />} action={pill}>
      <div className="rounded-2xl border border-dashed border-navy-200 bg-ivory/50 px-6 py-10 text-center" data-funding-not-started>
        {body}
      </div>
    </Panel>
  );
}

export function StudentFundingPage() {
  const { record, actions, services, showFunding } = useStudent();
  const f = record.journey.funding;
  const notNeeded = services.find((s) => s.code === 'S4')?.status === 'not_needed';
  const visaWaiting = !record.journey.visa && services.find((s) => s.code === 'S5')?.status === 'in_progress';
  const started = !notNeeded && (!!f.estimatedCost || f.sources.length > 0 || f.scholarships.length > 0 || record.documents.some((d) => d.category === 'funds'));
  if (!showFunding) return <Empty>Your funding plan starts after you accept an offer: we assign you a Financial Aid Officer, who sets your estimated cost and helps with scholarships and proof of funds. Your visa progress appears here later.</Empty>;
  // Full-width cards, one under another, so neither leaves a gap beside the other.
  return (
    <div className="space-y-6">
      {started ? <FundingCard student={record} actions={actions} notNeeded={notNeeded} /> : <FundingNotStarted />}
      <VisaCard student={record} waiting={visaWaiting} />
    </div>
  );
}

export function StudentReferPage() {
  return <ReferralsPanel />;
}

export function StudentTravelPage() {
  const { record, actions, showTravel } = useStudent();
  if (!showTravel) return <Empty>Your travel checklist opens once your visa is granted.</Empty>;
  return <DepartureCard student={record} actions={actions} />;
}
