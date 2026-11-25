import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * A small ⓘ that shows a note: on hover or keyboard focus on a computer, and on tap on a phone (hover doesn't exist there).
 * A tap or click keeps it open until the next tap, Escape or a click elsewhere.
 */
export function InfoTip({ label, children, align = 'center', className }: { label: string; children: ReactNode; align?: 'left' | 'center' | 'right'; className?: string }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const open = hover || pinned;

  useEffect(() => {
    if (!pinned) return;
    const outside = (e: MouseEvent | TouchEvent) => !ref.current?.contains(e.target as Node) && setPinned(false);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(false);
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [pinned]);

  return (
    <span ref={ref} className={cn('relative inline-flex align-middle', className)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation(); // e.g. inside a clickable table row
          setPinned((p) => !p);
        }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onKeyDown={(e) => e.key === 'Escape' && (setHover(false), setPinned(false))}
        className="grid h-6 w-6 place-items-center rounded-full text-navy-400 transition hover:bg-navy-50 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        data-info-tip
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute top-full z-40 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-navy-950 px-3.5 py-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-navy-50 shadow-lift',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'left' && 'left-0',
            align === 'right' && 'right-0',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </span>
      )}
    </span>
  );
}
