import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gift, X } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Closing hides the bar for this visit only (until the browser tab is closed); it shows again on the next visit. */
const STORAGE_KEY = 'ahat:announcement:referral';

function wasClosed() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'closed';
  } catch {
    return false;
  }
}

/**
 * A slim line above the menu on the public website: the referral programme. Folds away (`hidden`) when the page is scrolled or the
 * phone menu is open. Once closed, it stays closed for the rest of the visit.
 */
export function AnnouncementBar({ hidden }: { hidden: boolean }) {
  const [closed, setClosed] = useState(wasClosed);
  if (closed) return null;

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, 'closed');
    } catch {
      // Storage blocked: it stays closed until the page reloads.
    }
  };

  return (
    <div
      className={cn('overflow-hidden bg-navy-950 text-navy-100 transition-all duration-300', hidden ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100')}
      aria-hidden={hidden}
      data-announcement
    >
      <div className="relative flex items-center justify-center gap-2 px-12 py-2.5 text-center text-xs sm:text-sm">
        <Gift className="hidden h-4 w-4 shrink-0 text-gold-400 sm:block" aria-hidden />
        <p>
          {/* A shorter line on phones, so the bar stays one line high */}
          <span className="font-semibold text-white sm:hidden">Refer a friend to AHat.</span>
          <span className="hidden font-semibold text-white sm:inline">Know someone planning to study abroad?</span>
          <span className="hidden md:inline"> Refer them to AHat.</span>{' '}
          <Link to="/refer" tabIndex={hidden ? -1 : undefined} className="group inline-flex items-center gap-1 font-semibold text-gold-400 underline-offset-4 hover:underline">
            How it works
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </p>
        <button
          type="button"
          onClick={close}
          tabIndex={hidden ? -1 : undefined}
          aria-label="Close announcement"
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-navy-300 transition hover:bg-white/10 hover:text-white sm:right-4"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
