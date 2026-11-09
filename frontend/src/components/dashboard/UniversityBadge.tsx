import { cn, monogram } from '../../lib/utils';

/** A university's initials in a navy tile, used in place of a logo on the shortlist and applications. */
export function UniversityBadge({ name, muted = false, size = 'md' }: { name: string; muted?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl font-display font-semibold',
        size === 'sm' ? 'h-9 w-9 text-xs' : 'h-10 w-10 text-sm sm:h-12 sm:w-12 sm:text-base',
        muted ? 'bg-navy-50 text-navy-400' : 'bg-navy-900 text-gold-400',
      )}
      aria-hidden
    >
      {monogram(name)}
    </span>
  );
}
