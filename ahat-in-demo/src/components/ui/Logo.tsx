import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

/** The AHat mark: an "A" wearing a graduation cap. `light` is for dark backgrounds. */
export function LogoMark({ light, className }: { light?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('h-10 w-10 shrink-0', className)} aria-hidden>
      <rect width="100" height="100" rx="22" fill={light ? '#FFFFFF' : '#0B1F3A'} />
      {/* The A */}
      <polygon points="44,41 56,41 78,82 66.5,82 50,51 33.5,82 22,82" fill={light ? '#0B1F3A' : '#FAF7F2'} />
      <polygon points="38.5,63 61.5,63 64.6,69 35.4,69" fill={light ? '#0B1F3A' : '#FAF7F2'} />
      {/* Mortarboard resting on the A's peak, with its tassel */}
      <polygon points="38,37 50,42 62,37 62,44 50,49 38,44" fill="#A8851C" />
      <polygon points="50,17 82,30 50,43 18,30" fill="#C9A227" />
      <rect x="79.2" y="30" width="2.2" height="16" fill="#C9A227" />
      <polygon points="77.8,45 82.8,45 84,53 76.6,53" fill="#C9A227" />
    </svg>
  );
}

/** Mark + "AHat", with "International" and "Education" on their own lines below the name. */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)} aria-label="AHat International Education, home">
      <LogoMark light={light} className="h-11 w-11" />
      <span className="leading-none">
        <span className={cn('block font-display text-[1.4rem] font-semibold leading-none tracking-tight', light ? 'text-white' : 'text-navy-900')}>
          A<span className={light ? 'text-gold-400' : 'text-gold-600'}>Hat</span>
        </span>
        <span className={cn('mt-1 block text-[8.5px] font-semibold uppercase leading-[1.3] tracking-[0.14em]', light ? 'text-navy-200' : 'text-navy-500')}>
          <span className="block">International</span>
          <span className="block">Education</span>
        </span>
      </span>
    </Link>
  );
}
