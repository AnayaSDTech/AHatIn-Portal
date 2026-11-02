import { Bell, BellRing, CalendarClock, Check, FileUp, FileWarning, ListChecks, Mail, MapPin, MessageSquare, PartyPopper, PiggyBank, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isProfileComplete, type StudentProfile } from '../../data/dashboard';
import { appStateLabel, type ApplicationUpdate, type Message, type StaffStudent } from '../../data/staff';
import { api } from '../../lib/api/client';
import { act, useApi } from '../../lib/api/store';
import type { Session } from '../../lib/scheduling';
import { DEPARTURE_TASKS, type ServiceView } from '../../lib/journey';
import { cn, daysUntil, goToSection as goTo, relativeTime } from '../../lib/utils';

interface Item {
  key: string;
  icon: LucideIcon;
  text: string;
  /** Short tag on the right, e.g. "5 days". */
  tag?: string;
  target: string;
  urgent: boolean;
  rank: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Only what's waiting on the student, in a few words each. Built from the shared record. */
export function buildNotifications(
  student: StaffStudent,
  services: ServiceView[],
  sessions: Session[],
  profile: StudentProfile,
  messages: Message[] = [],
  /** Application status changes since the student last opened their applications. */
  appUpdates: ApplicationUpdate[] = [],
): Item[] {
  const { documents, applications, journey } = student;
  const status = (code: string) => services.find((s) => s.code === code)?.status;
  const items: Item[] = [];

  const unread = messages.filter((m) => m.studentId === student.id && m.from === 'staff' && !m.readAt);
  if (unread.length) items.push({ key: 'messages', icon: MessageSquare, text: unread.length === 1 ? `New message from ${unread[0]!.by.split(' ')[0]}` : `${unread.length} new messages`, target: 'messages', urgent: false, rank: 0 });

  if (appUpdates.length) {
    const u = appUpdates[0]!;
    const uni = u.university.replace(/^(The )?University of /, '');
    // Statuses that ask something of the student are flagged.
    const needsAttention = appUpdates.some((x) => ['more_info_requested', 'interview', 'conditional_offer', 'unconditional_offer'].includes(x.to));
    items.push({
      key: 'app-updates',
      icon: BellRing,
      text: appUpdates.length === 1 ? `${uni}: now ${appStateLabel[u.to]}` : `${appUpdates.length} application updates`,
      tag: 'New',
      target: 'applications',
      urgent: needsAttention,
      rank: 0,
    });
  }

  const rejected = documents.filter((d) => d.state === 'rejected');
  if (rejected.length) items.push({ key: 'reupload', icon: FileWarning, text: rejected.length === 1 ? `Re-upload ${rejected[0]!.name}` : `Re-upload ${plural(rejected.length, 'document')}`, target: 'documents', urgent: true, rank: 0 });

  if (!applications.some((a) => a.state === 'accepted')) {
    applications
      .filter((a) => a.state === 'conditional_offer' || a.state === 'unconditional_offer')
      .forEach((a) => {
        const d = a.deadline ? daysUntil(a.deadline) : undefined;
        const uni = a.university.replace(/^(The )?University of /, '');
        items.push({ key: `offer-${a.id}`, icon: Mail, text: `Reply to ${uni} offer`, tag: d !== undefined && d >= 0 ? (d === 0 ? 'Today' : plural(d, 'day')) : undefined, target: 'applications', urgent: d !== undefined && d <= 14, rank: 1 });
      });
  }

  if (journey.shortlist?.status === 'shared') items.push({ key: 'shortlist', icon: ListChecks, text: 'Review your shortlist', target: 'shortlist', urgent: false, rank: 1 });

  const toUpload = documents.filter((d) => d.state === 'missing');
  if (toUpload.length) items.push({ key: 'upload', icon: FileUp, text: toUpload.length === 1 ? `Upload ${toUpload[0]!.name}` : `Upload ${plural(toUpload.length, 'document')}`, target: 'documents', urgent: false, rank: 2 });

  if (journey.funding.estimatedCost && journey.funding.sources.length === 0 && status('S4') !== 'not_needed' && status('S4') !== 'completed') {
    items.push({ key: 'funding', icon: PiggyBank, text: 'Add your funding plan', target: 'funding', urgent: false, rank: 2 });
  }

  if (status('S6') === 'in_progress') {
    const left = DEPARTURE_TASKS.filter((t) => !journey.departure.done[t.key]).length;
    if (left) items.push({ key: 'departure', icon: ListChecks, text: 'Finish travel checklist', tag: `${left} left`, target: 'departure', urgent: false, rank: 2 });
  }
  if (journey.departure.confirmedAt && !journey.arrival.arrivedAt) items.push({ key: 'arrival', icon: MapPin, text: 'Confirm your arrival', target: 'departure', urgent: false, rank: 2 });

  const next = sessions
    .filter((s) => s.status === 'booked' && daysUntil(s.date) >= 0)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  if (next && daysUntil(next.date) <= 7) {
    const d = daysUntil(next.date);
    items.push({ key: `session-${next.id}`, icon: CalendarClock, text: `Session ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${plural(d, 'day')}`}`, tag: next.time, target: 'sessions', urgent: d <= 1, rank: 3 });
  }

  // Nothing starts until the profile is complete, so it comes first.
  if (!isProfileComplete(profile)) items.push({ key: 'profile', icon: UserRound, text: 'Complete your profile', target: 'profile', urgent: true, rank: 0 });

  return items.sort((a, b) => a.rank - b.rank);
}

export interface StudentUpdate {
  id: string;
  title: string;
  text: string;
  target: string;
  kind: string;
  at: string;
}

const updateIcon: Record<string, LucideIcon> = {
  team: UserRound,
  session: CalendarClock,
  plan: ListChecks,
  shortlist: ListChecks,
  application: Mail,
  funding: PiggyBank,
  document: FileUp,
  visa: BellRing,
  travel: MapPin,
  profile: UserRound,
};

const NO_UPDATES: StudentUpdate[] = [];

export function NotificationsCard({ items, onOpenProfile, onGo = goTo }: { items: Item[]; onOpenProfile: () => void; /** Opens the section an item points to. */ onGo?: (target: string) => void }) {
  const [updates] = useApi<StudentUpdate[]>('/me/updates', NO_UPDATES, { pollMs: 30_000 });
  const read = (id: string) => act(() => api.post(`/me/updates/${id}/read`));
  const total = items.length + updates.length;
  const urgent = items.filter((i) => i.urgent).length;
  return (
    <section id="notifications" className="card overflow-hidden" aria-labelledby="notifications-title">
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="notifications-title" className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <Bell className="h-4 w-4" aria-hidden />
            {total > 0 && (
              <span className={cn('absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white', urgent ? 'bg-red-500' : 'bg-gold-600')} aria-hidden>
                {total}
              </span>
            )}
          </span>
          Notifications
        </h2>
        {total > 0 && <span className="sr-only">{plural(total, 'item')}{urgent ? `, ${urgent} urgent` : ''}</span>}
      </header>

      {/* What staff have done: stays until opened or marked as read. */}
      {updates.length > 0 && (
        <div className="px-2 pb-2" data-student-updates>
          <div className="flex items-center justify-between gap-3 px-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Updates</p>
            <button type="button" onClick={() => act(() => api.post('/me/updates/read-all'))} className="text-xs font-semibold text-navy-500 hover:text-navy-900" data-updates-read-all>
              Mark all as read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto" aria-label="Updates">
            {updates.map((u) => {
              const Icon = updateIcon[u.kind] ?? BellRing;
              return (
                <li key={u.id} className="flex items-start gap-1 rounded-xl transition hover:bg-ivory" data-update={u.kind}>
                  <button
                    type="button"
                    onClick={() => {
                      read(u.id);
                      if (u.target === 'profile') onOpenProfile();
                      else onGo(u.target);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-2.5 text-left"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug text-navy-900">{u.title}</span>
                      {u.text && <span className="mt-0.5 line-clamp-2 text-xs text-navy-500">{u.text}</span>}
                      <span className="mt-0.5 block text-[11px] text-navy-400">{relativeTime(u.at)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => read(u.id)}
                    className="mr-2 mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-navy-100 text-navy-500 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
                    aria-label={`Mark as read: ${u.title}`}
                    title="Mark as read"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {items.length > 0 && updates.length > 0 && <p className="px-5 pb-1 text-xs font-semibold uppercase tracking-wider text-navy-400">To do</p>}

      {total === 0 ? (
        <p className="flex items-center gap-2.5 px-5 pb-5 text-sm text-emerald-800">
          <PartyPopper className="h-4 w-4 text-emerald-600" aria-hidden /> All caught up
        </p>
      ) : (
        items.length > 0 && <ul className="px-2 pb-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => (item.target === 'profile' ? onOpenProfile() : onGo(item.target))}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-ivory"
                  data-notification={item.key}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', item.urgent ? 'text-red-600' : 'text-navy-500')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-900">{item.text}</span>
                  {item.tag && <span className={cn('shrink-0 text-xs font-semibold', item.urgent ? 'text-red-600' : 'text-navy-400')}>{item.tag}</span>}
                  {item.urgent && !item.tag && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="Urgent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
