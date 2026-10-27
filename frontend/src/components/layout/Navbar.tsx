import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { Container } from '../ui/Container';
import { Logo } from '../ui/Logo';
import { ButtonLink, Button } from '../ui/Button';
import { navLinks } from '../../data/site';
import { useAuth } from '../../context/AuthContext';
import { cn, initials } from '../../lib/utils';
import { homeFor } from '../auth/RouteGuards';
import { isStaff } from '../../lib/api/types';

export function Navbar() {
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Account menu: closes on navigation, outside click and Escape.
  useEffect(() => setMenu(false), [key]);
  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const isHome = pathname === '/';
  const transparent = isHome && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on navigation and with the Escape key; lock page scroll while open.
  useEffect(() => setOpen(false), [key]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        transparent
          ? 'bg-transparent py-5'
          : open
            ? // No backdrop blur while the menu is open: it would trap the fixed menu panel inside the header.
              'bg-ivory py-3 shadow-sm'
            : 'border-b border-navy-100/60 bg-ivory/90 py-3 shadow-sm backdrop-blur-xl',
      )}
    >
      <Container className="flex items-center justify-between gap-6">
        <Logo light={transparent} />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              to={`/${l.href}`}
              className={cn('link-underline text-sm font-medium transition', transparent ? 'text-white/90 hover:text-white' : 'text-navy-700 hover:text-navy-950')}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-expanded={menu}
                aria-haspopup="menu"
                aria-label="Account menu"
                className={cn(
                  'flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold transition',
                  transparent ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-navy-50 text-navy-900 hover:bg-navy-100',
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">{initials(user.name)}</span>
                {user.name.split(' ')[0]}
                <ChevronDown className={cn('h-4 w-4 transition-transform', menu && 'rotate-180')} aria-hidden />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-64 animate-fade-up overflow-hidden rounded-2xl border border-navy-100 bg-white text-navy-900 shadow-lift">
                  <div className="border-b border-navy-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-navy-500">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <Link role="menuitem" to={homeFor(user.role)} onClick={() => setMenu(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ivory">
                      <LayoutDashboard className="h-4 w-4 text-navy-500" aria-hidden /> {isStaff(user.role) ? 'Staff portal' : 'My dashboard'}
                    </Link>
                    <button role="menuitem" type="button" onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-ivory">
                      <LogOut className="h-4 w-4 text-navy-500" aria-hidden /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <ButtonLink to="/login" variant={transparent ? 'light' : 'ghost'} size="sm">
                Log in
              </ButtonLink>
              <ButtonLink to="/register" variant="gold" size="sm">
                Register free
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className={cn('grid h-11 w-11 place-items-center rounded-full lg:hidden', transparent ? 'text-white' : 'text-navy-900')}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={cn(
          'fixed inset-x-0 bottom-0 top-[68px] origin-top overflow-y-auto bg-ivory transition-all duration-300 lg:hidden',
          open ? 'visible opacity-100' : 'invisible -translate-y-2 opacity-0',
        )}
      >
        <Container className="flex flex-col gap-2 py-6">
          {navLinks.map((l, i) => (
            <Link
              key={l.href}
              to={`/${l.href}`}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-4 font-display text-2xl text-navy-900 transition hover:bg-navy-50"
              style={{ transitionDelay: open ? `${i * 30}ms` : '0ms' }}
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-6 grid gap-3 border-t border-navy-100 pt-6">
            {user ? (
              <>
                <ButtonLink to={homeFor(user.role)} size="lg">
                  <LayoutDashboard className="h-5 w-5" aria-hidden /> {isStaff(user.role) ? 'Staff portal' : 'My dashboard'}
                </ButtonLink>
                <Button variant="outline" size="lg" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" aria-hidden /> Log out
                </Button>
              </>
            ) : (
              <>
                <ButtonLink to="/register" variant="gold" size="lg">
                  Register free
                </ButtonLink>
                <ButtonLink to="/login" variant="outline" size="lg">
                  Log in
                </ButtonLink>
              </>
            )}
          </div>
        </Container>
      </div>
    </header>
  );
}
