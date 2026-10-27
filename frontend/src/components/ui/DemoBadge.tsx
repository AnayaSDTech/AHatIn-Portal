import { FlaskConical } from 'lucide-react';
import { cn } from '../../lib/utils';
import { showDemoHints } from '../../lib/demoAccounts';

/** Marks fictional content so nobody mistakes it for real data. Hidden when demo hints are off (production). */
export function DemoBadge({ label = 'Demo content', className, light }: { label?: string; className?: string; light?: boolean }) {
  if (!showDemoHints) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider',
        light ? 'bg-white/10 text-gold-200 ring-1 ring-white/20' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
