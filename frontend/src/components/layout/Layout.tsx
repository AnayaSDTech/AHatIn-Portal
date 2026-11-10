import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

/** Scrolls to the #section in the URL, or to the top on a new page. */
function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  // A new page: start at the top.
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  // A link to a section: scroll to it. `key` changes on every click, so the same section link works twice in a row.
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    // Wait a frame so the target section has rendered.
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, key]);
  return null;
}

export function Layout({ hideFooter }: { hideFooter?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-gold-500 px-4 py-2 font-semibold text-navy-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <ScrollManager />
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
      <UpdatePrompt />
    </div>
  );
}
