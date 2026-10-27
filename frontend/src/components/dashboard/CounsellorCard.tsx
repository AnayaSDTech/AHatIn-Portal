import { Mail, MessageSquare, Phone, UserRoundSearch } from 'lucide-react';
import type { Counsellor } from '../../data/staff';
import { initials } from '../../lib/utils';

/** The student's named counsellor, with quick ways to get in touch (or a note while the admin is matching one). */
export function CounsellorCard({
  counsellor,
  onMessage,
  profileComplete = true,
  title = 'Your counsellor',
}: {
  counsellor: Counsellor | null;
  /** Opens the chat (on another page, or the box on this one). */
  onMessage?: () => void;
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
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={toMessages} className={chip}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Message
        </button>
        <a href={`mailto:${counsellor.email}`} className={chip}>
          <Mail className="h-3.5 w-3.5" aria-hidden /> Email
        </a>
        <a href={`tel:${counsellor.phone.replace(/\s/g, '')}`} className={chip}>
          <Phone className="h-3.5 w-3.5" aria-hidden /> Call
        </a>
      </div>
    </section>
  );
}
