import { CalendarPlus, Mail, MessageSquare, UserRoundSearch, Users } from 'lucide-react';
import type { Counsellor } from '../../data/staff';
import { cn, initials } from '../../lib/utils';

export interface TeamMember {
  /** e.g. "Counsellor", "Financial Aid Officer". */
  role: string;
  person: Counsellor;
  onMessage: () => void;
  onBook: () => void;
}

const avatarTone = ['bg-gold-500 text-navy-950', 'bg-navy-900 text-gold-400', 'bg-sky-600 text-white'];

/**
 * "Your team" on the Overview: everyone looking after the student, each with Message, Email and Book.
 * Side by side (one column per person, so the card is always full), or `stacked` one under another for a side column.
 */
export function TeamPanel({ members, profileComplete, stacked = false }: { members: TeamMember[]; profileComplete: boolean; stacked?: boolean }) {
  const action = 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-navy-100 bg-white px-2.5 py-2 text-xs font-semibold text-navy-800 transition hover:border-navy-200 hover:bg-ivory';
  return (
    <section id="counsellor" className="card overflow-hidden" aria-labelledby="team-title">
      <header className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
        <h2 id="team-title" className="flex items-center gap-2.5 font-sans text-base font-semibold text-navy-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-50 text-navy-700">
            <Users className="h-4 w-4" aria-hidden />
          </span>
          Your team
        </h2>
        {members.length > 0 && !stacked && <span className="hidden text-xs text-navy-400 sm:inline">The people looking after your application</span>}
      </header>

      {members.length === 0 ? (
        <div className="flex items-start gap-4 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-500">
            <UserRoundSearch className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-navy-900">{profileComplete ? 'Your counsellor is being matched' : 'Matched after your profile'}</p>
            <p className="mt-1 text-sm text-navy-600">
              {profileComplete
                ? "We're choosing a counsellor who knows your chosen country and course. We'll email you when they're assigned."
                : 'Once your profile is complete, we match you with a counsellor who knows your chosen country and course.'}
            </p>
          </div>
        </div>
      ) : (
        <ul
          className={cn(
            'grid divide-y divide-navy-100',
            !stacked && 'sm:divide-x sm:divide-y-0',
            !stacked && (members.length === 3 ? 'sm:grid-cols-3' : members.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'),
          )}
        >
          {members.map((m, i) => (
            <li key={m.role} className="flex flex-col gap-4 p-5" data-team-card={`Your ${m.role.charAt(0).toLowerCase()}${m.role.slice(1)}`}>
              <div className="flex items-center gap-3.5">
                <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-lg', avatarTone[i % avatarTone.length])}>{initials(m.person.name)}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">{m.role}</p>
                  <p className="truncate font-semibold text-navy-900">{m.person.name}</p>
                  <a href={`mailto:${m.person.email}`} className="block truncate text-xs text-navy-500 hover:text-navy-800">
                    {m.person.email}
                  </a>
                </div>
              </div>
              <div className={cn('mt-auto flex gap-2', members.length === 1 && !stacked && 'sm:max-w-md')}>
                <button type="button" onClick={m.onMessage} className={action}>
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Message
                </button>
                <a href={`mailto:${m.person.email}`} className={action}>
                  <Mail className="h-3.5 w-3.5" aria-hidden /> Email
                </a>
                <button type="button" onClick={m.onBook} className={action} data-book-with={`Your ${m.role.charAt(0).toLowerCase()}${m.role.slice(1)}`}>
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Book
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The student's named counsellor, with quick ways to get in touch (or a note while the admin is matching one). */
export function CounsellorCard({
  counsellor,
  onMessage,
  profileComplete = true,
  title = 'Your counsellor',
  onBook,
}: {
  counsellor: Counsellor | null;
  /** Opens the chat (on another page, or the box on this one). */
  onMessage?: () => void;
  /** Opens the booking window for a session with this person; shown instead of "Call" when given. */
  onBook?: () => void;
  profileComplete?: boolean;
  /** e.g. "Your Financial Aid Officer" for an officer's card. */
  title?: string;
}) {
  if (!counsellor) {
    return (
      <section id="counsellor" className="card p-5" aria-label="Your counsellor">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-navy-50 text-navy-500">
            <UserRoundSearch className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">Your counsellor</p>
            <p className="font-semibold text-navy-900">{profileComplete ? 'Being matched' : 'Matched after your profile'}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-navy-600">
          {profileComplete
            ? "We're choosing a counsellor who knows your chosen country and course. We'll email you when they're assigned."
            : 'Once your profile is complete, we match you with a counsellor who knows your chosen country and course.'}
        </p>
      </section>
    );
  }
  const toMessages = () => {
    if (onMessage) return onMessage();
    const el = document.getElementById('messages');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.querySelector('textarea')?.focus({ preventScroll: true });
  };
  const chip = 'inline-flex items-center justify-center gap-1.5 rounded-full bg-navy-50 px-3 py-2 text-xs font-semibold text-navy-800 transition hover:bg-navy-100';
  return (
    <section id={title === 'Your counsellor' ? 'counsellor' : undefined} className="card p-5" aria-label={title} data-team-card={title}>
      <div className="flex items-center gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-500 font-display text-lg text-navy-950">{initials(counsellor.name)}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-navy-400">{title}</p>
          <p className="truncate font-semibold text-navy-900">{counsellor.name}</p>
          <p className="truncate text-xs text-navy-500">{counsellor.email}</p>
        </div>
      </div>
      <div className={cn('mt-4 grid gap-2', onBook ? 'grid-cols-3' : 'grid-cols-2')}>
        <button type="button" onClick={toMessages} className={chip}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Message
        </button>
        <a href={`mailto:${counsellor.email}`} className={chip}>
          <Mail className="h-3.5 w-3.5" aria-hidden /> Email
        </a>
        {onBook && (
          <button type="button" onClick={onBook} className={chip} data-book-with={title}>
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Book
          </button>
        )}
      </div>
    </section>
  );
}
