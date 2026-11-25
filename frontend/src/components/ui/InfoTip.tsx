import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const WIDTH = 288; // the popup's width (w-72)
const GAP = 6;
const EDGE = 12; // keep this far from the screen's edges

/**
 * A small ⓘ that shows a note: on hover or keyboard focus on a computer, and on tap on a phone (hover doesn't exist there).
 * A tap or click keeps it open until the next tap, Escape or a click elsewhere.
 * The note is drawn at the top of the page (not inside the ⓘ's card), so a card that hides its overflow can't cut it off; it opens
 * below the ⓘ, or above it when there isn't room below.
 */
export function InfoTip({ label, children, align = 'center', className }: { label: string; children: ReactNode; align?: 'left' | 'center' | 'right'; className?: string }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  const id = useId();
  const open = hover || pinned;

  // Place the note next to the ⓘ, inside the screen.
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const place = () => {
      const b = button.current?.getBoundingClientRect();
      if (!b) return;
      const height = popup.current?.offsetHeight ?? 0;
      const wanted = align === 'left' ? b.left : align === 'right' ? b.right - WIDTH : b.left + b.width / 2 - WIDTH / 2;
      const left = Math.min(Math.max(wanted, EDGE), window.innerWidth - WIDTH - EDGE);
      const below = b.bottom + GAP;
      const top = below + height > window.innerHeight - EDGE && b.top - GAP - height > EDGE ? b.top - GAP - height : below;
      setPos({ left: Math.max(left, EDGE), top });
    };
    place();
    const frame = requestAnimationFrame(place); // again once the note has its height
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);

  useEffect(() => {
    if (!pinned) return;
    const outside = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !popup.current?.contains(t)) setPinned(false);
    };
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
    <span className={cn('relative inline-flex align-middle', className)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        ref={button}
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
      {open &&
        createPortal(
          <span
            ref={popup}
            id={id}
            role="tooltip"
            style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH, maxWidth: `calc(100vw - ${EDGE * 2}px)` }}
            className="z-[70] block rounded-xl bg-navy-950 px-3.5 py-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-navy-50 shadow-lift"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
