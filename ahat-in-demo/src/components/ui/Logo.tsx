import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-3', className)} aria-label="AHatIn home">
      <svg viewBox="0 0 100 100" className="h-10 w-10 shrink-0" aria-hidden>
        <rect width="100" height="100" rx="22" fill={light ? '#FFFFFF' : '#0B1F3A'} />
        <polygon points="32,50 50,58 68,50 68,66 50,73 32,66" fill="#A8851C" />
        <polygon points="50,29 82,44 50,59 18,44" fill="#C9A227" />
        <rect x="79.5" y="44" width="2" height="19" fill="#C9A227" />
        <polygon points="78,62 83,62 84,69 77,69" fill="#C9A227" />
      </svg>
      <span className="leading-none">
        <span className={cn('block font-display text-xl font-semibold tracking-tight', light ? 'text-white' : 'text-navy-900')}>
          AHatIn
        </span>
        <span className={cn('block text-[10px] font-medium uppercase tracking-[0.18em]', light ? 'text-navy-200' : 'text-navy-400')}>
          International Education
        </span>
      </span>
    </Link>
  );
}
