import { ArrowRight, BellRing, CalendarClock, FileWarning, FileUp, PartyPopper, Mail, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DocStatus, StudentProfile, demoApplications, demoDocuments } from '../../data/dashboard';
import type { Session } from '../../lib/scheduling';
import { cn, daysUntil, formatDate } from '../../lib/utils';

type Application = (typeof demoApplications)[number];
type Doc = (typeof demoDocuments)[number];

interface Item {
  key: string;
  icon: LucideIcon;
  text: string;
  detail?: string;
  target: string;
  urgent: boolean;
  /** Lower sorts first. */
  rank: number;
}

/** Scroll to a dashboard section and move keyboard focus to it. */
function goTo(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.focus({ preventScroll: true });
}

const missing: DocStatus[] = ['missing', 'rejected'];

interface Props {
  documents: Doc[];
  applications: Application[];
  sessions: Session[];
  profile: StudentProfile;
}

/** Everything waiting on the student, gathered from the rest of the dashboard. No manual or staff items. */
export function AttentionCard({ documents, applications, sessions, profile }: Props) {
  const items: Item[] = [];

  // Offers waiting for a reply (only until one offer is accepted)
  if (!applications.some((a) => a.status === 'accepted')) {
    applications
      .filter((a) => a.status === 'conditional_offer' || a.status === 'unconditional_offer')
      .forEach((a) => {
        const d = daysUntil(a.deadline);
        items.push({
          key: `offer-${a.id}`,
          icon: Mail,
          text: `Reply to your offer from ${a.university}`,
          detail: `by ${formatDate(a.deadline)}${d >= 0 && d <= 14 ? ` · ${d === 0 ? 'today' : `${d} days left`}` : ''}`,
          target: 'applications',
          urgent: d <= 14,
          rank: 1,
        });
      });
  }

  // Documents to upload or re-upload
  documents
    .filter((d) => missing.includes(d.status))
    .forEach((d) =>
      items.push({
        key: `doc-${d.id}`,
        icon: d.status === 'rejected' ? FileWarning : FileUp,
        text: d.status === 'rejected' ? `Re-upload: ${d.name}` : `Upload: ${d.name}`,
        detail: d.status === 'rejected' ? d.note : undefined,
        target: 'documents',
        urgent: d.status === 'rejected',
        rank: d.status === 'rejected' ? 0 : 2,
      }),
    );

  // Next booked session within a week
  const next = sessions
    .filter((s) => s.status === 'booked' && daysUntil(s.date) >= 0)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  if (next && daysUntil(next.date) <= 7) {
    const d = daysUntil(next.date);
    items.push({
      key: `session-${next.id}`,
      icon: CalendarClock,
      text: `${next.type} session ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `on ${formatDate(next.date)}`}`,
      detail: `${next.time} IST · ${next.mode === 'online' ? 'Online meeting' : 'At the office'}`,
      target: 'sessions',
      urgent: d <= 1,
      rank: 3,
    });
  }

  // Profile details still missing
  const gaps = [
    !profile.city && 'city',
    !profile.grade && 'grade',
    profile.englishTest !== 'Not taken yet' && !profile.englishScore && 'English score',
    !profile.workExperience && 'work experience',
  ].filter(Boolean) as string[];
  if (gaps.length) {
    items.push({
      key: 'profile',
      icon: UserRound,
      text: 'Complete your profile',
      detail: `Missing: ${gaps.join(', ')}`,
      target: 'profile',
      urgent: false,
      rank: 4,
    });
  }

  items.sort((a, b) => a.rank - b.rank);
  const urgentCount = items.filter((i) => i.urgent).length;

  return (
    <section className="card overflow-hidden" aria-labelledby="attention-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 bg-gradient-to-r from-gold-50 to-white px-6 py-4">
        <h2 id="attention-title" className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-500 text-navy-950">
            <BellRing className="h-4 w-4" aria-hidden />
          </span>
          Needs your attention
        </h2>
        {items.length > 0 && (
          <span className="text-sm text-navy-600">
            <span className="font-semibold text-navy-900">{items.length}</span> {items.length === 1 ? 'item' : 'items'}
            {urgentCount > 0 && <span className="font-semibold text-red-600"> · {urgentCount} urgent</span>}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-6 py-6 text-sm text-emerald-800">
          <PartyPopper className="h-5 w-5 text-emerald-600" aria-hidden />
          You're all caught up. Nothing needs your action right now.
        </div>
      ) : (
        <ul className="grid gap-2 p-3 sm:p-4 md:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => goTo(item.target)}
                  className={cn(
                    'group flex h-full w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-soft',
                    item.urgent ? 'border-red-100 bg-red-50/30 hover:border-red-200' : 'border-navy-100 hover:border-gold-300 hover:bg-ivory',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                      item.urgent ? 'bg-red-50 text-red-600' : 'bg-navy-50 text-navy-700',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-navy-900">{item.text}</span>
                    {item.detail && (
                      <span className={cn('mt-0.5 block text-xs', item.urgent ? 'font-medium text-red-600' : 'text-navy-500')}>
                        {item.detail}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="mt-2 h-4 w-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-gold-600"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
