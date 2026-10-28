import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarPlus, Clock, Inbox, MessageSquare, PiggyBank } from 'lucide-react';
import { Panel } from '../../components/dashboard/Panel';
import { Button } from '../../components/ui/Button';
import { useStudent } from '../../components/student/StudentLayout';
import { ServiceTracker, type TrackerAction } from '../../components/dashboard/ServiceTracker';
import { CareerPlanDetails } from '../../components/dashboard/CareerPlanDetails';
import { GettingStarted } from '../../components/dashboard/GettingStarted';
import { NotificationsCard, buildNotifications } from '../../components/dashboard/NotificationsCard';
import { CounsellorCard } from '../../components/dashboard/CounsellorCard';
import { ApplicationsCard } from '../../components/dashboard/ApplicationsCard';
import { DocumentChecklist } from '../../components/dashboard/DocumentChecklist';
import { SessionsCard } from '../../components/dashboard/SessionsCard';
import { MessagesCard } from '../../components/dashboard/MessagesCard';
import { DepartureCard, FundingCard, ShortlistCard, VisaCard } from '../../components/dashboard/JourneyCards';
import { DEPARTURE_TASKS, type ServiceCode } from '../../lib/journey';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api/client';
import { act } from '../../lib/api/store';
import type { AppState, TeamArea } from '../../data/staff';
import { useNavigate, useSearchParams } from 'react-router-dom';

/** Shown on a section page that has nothing in it yet. */
function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center text-sm text-navy-500">
      <Inbox className="h-8 w-8 text-navy-300" aria-hidden />
      <p className="max-w-md">{children}</p>
      {action}
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

/**
 * Contact cards for everyone looking after the student (counsellor, Financial Aid Officer, Visa Officer): message, email
 * or call. "Message" opens that person's chat.
 */
function TeamContacts({ onMessage }: { onMessage: (chat: TeamArea) => void }) {
  const { counsellor, team, profileComplete } = useStudent();
  return (
    <>
      <CounsellorCard counsellor={counsellor} profileComplete={profileComplete} onMessage={() => onMessage('counsellor')} />
      {team.finance && <CounsellorCard counsellor={team.finance} title="Your Financial Aid Officer" onMessage={() => onMessage('finance')} />}
      {team.visa && <CounsellorCard counsellor={team.visa} title="Your Visa Officer" onMessage={() => onMessage('visa')} />}
    </>
  );
}

/* ------------------------------ Overview ------------------------------ */

export function StudentOverviewPage() {
  const { record, services, sessions, profile, profileComplete, messages, counsellor, appUpdates, go, openBooking, openProfile } = useStudent();
  const openChat = useOpenChat();
  // The journey starts once the profile is complete and the admin has assigned a counsellor.
  const started = profileComplete && !!counsellor;

  // Buttons in the progress tracker for steps that are waiting on the student.
  const trackerActions = useMemo(() => {
    const a: Partial<Record<ServiceCode, TrackerAction>> = {};
    const status = (code: ServiceCode) => services.find((s) => s.code === code)?.status;
    const open = (code: ServiceCode) => status(code) !== 'completed' && status(code) !== 'not_needed';
    const to = (target: string) => () => go(target);
    const { journey, applications, documents } = record;

    if (status('S1') === 'not_started') a.S1 = { label: 'Book a session', onClick: () => openBooking('Career counselling') };

    if (journey.shortlist?.status === 'shared') a.S2 = { label: 'Review shortlist', onClick: to('shortlist') };

    const offers = applications.filter((x) => x.state === 'conditional_offer' || x.state === 'unconditional_offer');
    if (open('S3') && offers.length && !applications.some((x) => x.state === 'accepted')) a.S3 = { label: 'Reply to offer', onClick: to('applications') };
    else if (open('S3') && applications.length && applications.every((x) => x.state === 'draft') && documents.some((d) => d.state === 'missing' || d.state === 'rejected'))
      a.S3 = { label: 'Upload documents', onClick: to('documents') };

    if (open('S4')) {
      const funds = documents.filter((d) => d.category === 'funds');
      if (funds.some((d) => d.state === 'missing' || d.state === 'rejected')) a.S4 = { label: 'Upload proof of funds', onClick: to('documents') };
      else if (journey.funding.estimatedCost && journey.funding.sources.length === 0) a.S4 = { label: 'Add funding plan', onClick: to('funding') };
    }

    if (status('S6') === 'in_progress' && DEPARTURE_TASKS.some((t) => !journey.departure.done[t.key])) a.S6 = { label: 'Open travel checklist', onClick: to('departure') };

    if (journey.departure.confirmedAt && !journey.arrival.arrivedAt) a.S7 = { label: 'Confirm arrival', onClick: to('departure') };
    return a;
  }, [record, services, go, openBooking]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="order-2 min-w-0 lg:order-1 lg:col-span-7">
        {started ? (
          <ServiceTracker
            services={services}
            actions={trackerActions}
            links={{ S3: { label: 'View applications', onClick: () => go('applications') } }}
            details={record.journey.careerPlan ? { S1: <CareerPlanDetails plan={record.journey.careerPlan} /> } : undefined}
          />
        ) : (
          <GettingStarted profile={profile} profileComplete={profileComplete} counsellor={counsellor} onCompleteProfile={openProfile} onBook={() => openBooking('Career counselling')} />
        )}
      </div>
      <div className="order-1 min-w-0 space-y-6 lg:order-2 lg:col-span-5">
        <NotificationsCard items={buildNotifications(record, services, sessions, profile, messages, appUpdates)} onOpenProfile={openProfile} onGo={go} />
        <TeamContacts onMessage={openChat} />
      </div>
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
  const hasShortlist = !!record.journey.shortlist && (record.journey.shortlist.status !== 'draft' || !!record.journey.shortlist.firstApprovedAt);
  return (
    <div className="space-y-6">
      {hasShortlist && <ShortlistCard student={record} actions={actions} />}
      <ApplicationsCard applications={record.applications} onDecide={actions.decideOffer} updated={updated} />
    </div>
  );
}

export function StudentDocumentsPage() {
  const { record, actions } = useStudent();
  return <DocumentChecklist documents={record.documents} onUpload={actions.uploadDocument} onRemove={actions.removeUpload} />;
}

/** Opens the Messages page on one person's chat. */
function useOpenChat() {
  const navigate = useNavigate();
  return (chat: TeamArea) => navigate(`/dashboard/messages${chat === 'counsellor' ? '' : `?chat=${chat}`}#messages`);
}

export function StudentSessionsPage() {
  const { record, user, counsellor, team, profileComplete } = useStudent();
  const openChat = useOpenChat();
  if (!counsellor || !profileComplete) return <NotStartedYet what="book sessions" />;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-7">
        <SessionsCard studentId={record.id} studentName={user.name} team={team} />
      </div>
      <div className="min-w-0 space-y-6 lg:col-span-5">
        <TeamContacts onMessage={openChat} />
      </div>
    </div>
  );
}

export function StudentMessagesPage() {
  const { record, counsellor, team, messages } = useStudent();
  // Which chat is open: ?chat=finance or ?chat=visa from links elsewhere, otherwise the counsellor's.
  const [params, setParams] = useSearchParams();
  const chat: TeamArea = params.get('chat') === 'finance' && team.finance ? 'finance' : params.get('chat') === 'visa' && team.visa ? 'visa' : 'counsellor';
  if (!counsellor) return <NotStartedYet what="message your counsellor" />;
  const switchTo = (c: TeamArea) => {
    setParams(c === 'counsellor' ? {} : { chat: c }, { replace: true });
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('#messages textarea')?.focus());
  };
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-8">
        <MessagesCard key={chat} studentId={record.id} team={team} messages={messages} initial={chat} />
      </div>
      <div className="min-w-0 space-y-6 lg:col-span-4">
        <TeamContacts onMessage={switchTo} />
      </div>
    </div>
  );
}

/** Scholarship & Financial Guidance before anything has been set up: who will start it, or that it isn't needed. */
function FundingNotStarted() {
  const { team, services, go, openBooking } = useStudent();
  const view = services.find((s) => s.code === 'S4');
  const officer = team.finance;
  let body: ReactNode;
  if (view?.status === 'not_needed') {
    body = (
      <>
        <p className="font-semibold text-navy-900">Not needed</p>
        <p className="mt-1 text-sm text-navy-500">{view.override?.reason}</p>
      </>
    );
  } else if (officer) {
    body = (
      <>
        <p className="font-semibold text-navy-900">Not started yet</p>
        <p className="mt-1 text-sm text-navy-500">{officer.name}, your Financial Aid Officer, will set your estimated cost and suggest scholarships.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
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
    <Panel id="funding" title="Funding plan" icon={<PiggyBank className="h-4 w-4" aria-hidden />}>
      <div className="py-6 text-center" data-funding-not-started>
        {body}
      </div>
    </Panel>
  );
}

export function StudentFundingPage() {
  const { record, actions, services, showFunding } = useStudent();
  const f = record.journey.funding;
  const notNeeded = services.find((s) => s.code === 'S4')?.status === 'not_needed';
  const started = !notNeeded && (!!f.estimatedCost || f.sources.length > 0 || f.scholarships.length > 0 || record.documents.some((d) => d.category === 'funds'));
  if (!showFunding) return <Empty>Your funding plan starts after you accept an offer: we assign you a Financial Aid Officer, who sets your estimated cost and helps with scholarships and proof of funds. Your visa progress appears here later.</Empty>;
  return (
    <div className={cn('grid grid-cols-1 gap-6', record.journey.visa && 'lg:grid-cols-2')}>
      <div className="min-w-0">
        {started ? <FundingCard student={record} actions={actions} notNeeded={notNeeded} /> : <FundingNotStarted />}
      </div>
      <div className="min-w-0">
        <VisaCard student={record} />
      </div>
    </div>
  );
}

export function StudentTravelPage() {
  const { record, actions, showTravel } = useStudent();
  if (!showTravel) return <Empty>Your travel checklist opens once your visa is granted.</Empty>;
  return (
    <div className="max-w-3xl">
      <DepartureCard student={record} actions={actions} />
    </div>
  );
}
