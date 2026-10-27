import type { ReactNode } from 'react';
import { useReveal } from '../../hooks/useReveal';
import { cn } from '../../lib/utils';

/** Fades and slides its content in when it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
