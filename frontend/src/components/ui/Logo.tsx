import { useId } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

/**
 * The A-Hat mark: a graduation cap forming the top of an "A", with a gold orbit rising across it (a global journey).
 * The gap around the orbit is cut out, so the mark works on any background. `light` is for dark backgrounds.
 */
export function LogoMark({ light, className }: { light?: boolean; className?: string }) {
  const cut = useId();
  return (
    <svg viewBox="0 0 64 64" className={cn('h-10 w-10 shrink-0', className)} aria-hidden>
      <mask id={cut}>
        <rect width="64" height="64" fill="#fff" />
        <path d="M1 50.5C17 56 41 54 63 39.5 45 58 16 61.5 1 50.5z" fill="#000" stroke="#000" strokeWidth="3.6" />
      </mask>
      {/* The A */}
      <path d="M26.5 23h11L58 61H46.5L32 33.5 17.5 61H6z" fill={light ? '#FFFFFF' : '#0B1F3A'} mask={`url(#${cut})`} />
      {/* The orbit */}
      <path d="M1 50.5C17 56 41 54 63 39.5 45 58 16 61.5 1 50.5z" fill="#C9A227" />
      {/* The cap and its tassel */}
      <path d="M32 3 62 15.5 32 28 2 15.5z" fill="#C9A227" />
      <path d="M57.5 17.5v12" fill="none" stroke="#C9A227" strokeWidth="2.4" />
      <path d="M55.2 29h4.6l1.3 7.5h-7.2z" fill="#C9A227" />
    </svg>
  );
}

/** One word with its letters spread across the full width of its parent. */
function SpreadWord({ word, ...rest }: { word: string; [data: `data-${string}`]: boolean }) {
  return (
    <span className="flex w-0 min-w-full justify-between" {...rest}>
      {word.split('').map((letter, i) => (
        <span key={i}>{letter}</span>
      ))}
    </span>
  );
}

/**
 * The compact logo: the mark, then "A-Hat" over "International" over "Education".
 * "A-Hat" sets the width of the stack; the two smaller words are spread to match it.
 */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('flex w-max shrink-0 items-center gap-2', className)} aria-label="A-Hat International Education, home" data-logo>
      <LogoMark light={light} className="h-11 w-11" />
      <span className="inline-block w-max" data-logo-words>
        <span className={cn('block font-display text-[1.65rem] font-bold leading-none tracking-tight', light ? 'text-white' : 'text-navy-900')}>
          A-<span className={light ? 'text-gold-400' : 'text-gold-600'}>Hat</span>
        </span>
        <span className={cn('mt-0.5 block text-[8px] font-semibold uppercase leading-[1.3]', light ? 'text-navy-200' : 'text-navy-500')}>
          <SpreadWord word="International" data-logo-international />
          <SpreadWord word="Education" data-logo-education />
        </span>
      </span>
    </Link>
  );
}
