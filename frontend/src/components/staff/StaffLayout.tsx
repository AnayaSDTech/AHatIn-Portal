import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, CalendarCheck, CalendarDays, LayoutDashboard, LogOut, Menu, Settings, UserCheck, UserCog, UserRoundPen, Users, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useStaffReady } from '../../hooks/useStaffData';
import { useApi } from '../../lib/api/store';
import { cn, initials } from '../../lib/utils';
import { DOC_AREA, areaOfRole, staffRoleLabel, type StaffStudent } from '../../data/staff';
import { DESK } from '../../lib/officerCase';

const NO_STUDENTS: StaffStudent[] = [];

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Something waiting, e.g. students to assign. */
  badge?: number;
  /** Label in the phone's bottom bar, when shorter than `label`. */
  short?: string;
  /** On phones, listed under "More" instead of in the bottom bar. */
  more?: boolean;
}

const counsellorNav: NavItem[] = [
  { to: '/staff', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/staff/leads', label: 'Leads', icon: UsersRound },
  { to: '/staff/students', label: 'Students', icon: Users },
  // The counsellor's matching profile (countries, subjects, capacity), used to suggest them for new students.
  { to: '/staff/profile', label: 'My profile', short: 'Profile', icon: UserRoundPen },
];

// Financial Aid and Visa Officers work only on the students assigned to them (no leads, no matching profile).
const officerNav: NavItem[] = [
  { to: '/staff', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/staff/students', label: 'My students', short: 'Students', icon: Users },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/assign', label: 'Assignments', short: 'Assign', icon: UserCheck },
  { to: '/admin/users', label: 'Staff users', icon: UserCog, more: true },
  { to: '/admin/agencies', label: 'Partner agencies', icon: Building2, more: true },
  { to: '/admin/settings', label: 'Settings', icon: Settings, more: true },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays, more: true },
  { to: '/staff/leads', label: 'Leads', icon: UsersRound },
  { to: '/staff/students', label: 'Students', icon: Users },
];


/** Layout for the staff and admin areas: separate from the public website, with role-based navigation. */
export function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Counsellor names and the user's access are loaded before any staff screen shows.
  const ready = useStaffReady();
  // Students waiting for the admin to assign a counsellor.
  const [queue] = useApi<{ waiting: unknown[]; waitingFinance?: unknown[]; waitingVisa?: unknown[] }>(user?.role === 'admin' ? '/admin/assignments' : null, { waiting: [] }, { pollMs: 60_000 });
  const toAssign = queue.waiting.length + (queue.waitingFinance?.length ?? 0) + (queue.waitingVisa?.length ?? 0);
  // Officers: documents in their area waiting to be checked.
  const area = areaOfRole(user?.role ?? '');
  const desk = area === 'finance' || area === 'visa' ? DESK[area] : null;
  const [students] = useApi<StaffStudent[]>(desk ? '/students' : null, NO_STUDENTS);
  const toVerify = students.reduce((n, s) => n + s.documents.filter((d) => d.state === 'pending' && DOC_AREA[d.category] === area).length, 0);
  if (!user) return null;
  const nav =
    user.role === 'admin'
      ? adminNav.map((n) => (n.to === '/admin/assign' ? { ...n, badge: toAssign } : n))
      : desk
        ? officerNav.map((n) => (n.to === '/staff/students' ? { ...n, badge: toVerify } : n))
        : counsellorNav;

  const handleLogout = async () => {
    await logout();
    navigate('/staff/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-950 text-navy-200 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-6 py-6">
          <Logo light />
        </div>
        {desk && (
          <div className="mx-3 mb-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10" data-desk-card>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-500 text-navy-950">
              <desk.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{desk.name}</span>
              <span className="block text-[11px] leading-snug text-navy-300">{desk.covers}</span>
            </span>
          </div>
        )}
        {desk && <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-400">Workspace</p>}
        <nav className="flex-1 space-y-1 px-3" aria-label="Staff">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
              {!!item.badge && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-navy-950">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3" data-signed-in>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">{initials(user.name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
              <span className="block truncate text-[11px] text-navy-300">{staffRoleLabel[user.role] ?? user.role}</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-navy-100/70 bg-ivory/90 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="hidden text-sm text-navy-500 lg:block">
              AHat staff portal · <span className="font-semibold text-navy-800">{staffRoleLabel[user.role] ?? user.role}</span>
            </p>
            <div className="flex items-center gap-3">
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-semibold text-navy-900">{user.name}</span>
                <span className="block text-xs text-navy-500">{user.email}</span>
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">{initials(user.name)}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="grid h-9 w-9 place-items-center rounded-full border border-navy-100 text-navy-600 transition hover:border-navy-900 hover:text-navy-900"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main id="main" className="px-5 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pb-8">
          {ready && <Outlet />}
        </main>
      </div>

      <MobileNav nav={nav} name={user.name} role={staffRoleLabel[user.role] ?? user.role} onLogout={handleLogout} />
    </div>
  );
}

/* ------------------------------ Phones and tablets: bottom navigation ------------------------------ */

/**
 * Below the desktop width the sections are a bar fixed to the bottom of the screen, like an app.
 * Pages marked `more` (the admin's settings pages) are listed under "More", with the signed-in person and Log out.
 */
function MobileNav({ nav, name, role, onLogout }: { nav: NavItem[]; name: string; role: string; onLogout: () => void }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const main = nav.filter((n) => !n.more);
  const extra = nav.filter((n) => n.more);
  const hasMore = extra.length > 0;
  const moreActive = extra.some((n) => location.pathname.startsWith(n.to));
  const moreBadge = extra.reduce((n, i) => n + (i.badge ?? 0), 0);
  const cols = main.length + (hasMore ? 1 : 0);

  // Close "More" when the page changes.
  useEffect(() => setOpen(false), [location.pathname]);

  const tab = (active: boolean) => cn('relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold transition', active ? 'text-navy-900' : 'text-navy-400');
  const indicator = (active: boolean) => cn('absolute inset-x-4 top-0 h-0.5 rounded-full', active ? 'bg-gold-500' : 'bg-transparent');

  return (
    <>
      {open && <button type="button" className="fixed inset-0 z-40 bg-navy-950/30 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
        {open && (
          <div className="mx-3 mb-2 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-navy-100" role="menu" aria-label="More" data-staff-more>
            <div className="flex items-center gap-3 border-b border-navy-100 bg-ivory/70 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">{initials(name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-navy-900">{name}</span>
                <span className="block truncate text-xs text-navy-500">{role}</span>
              </span>
            </div>
            {extra.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                role="menuitem"
                className={({ isActive }) => cn('flex items-center gap-3 border-b border-navy-100 px-4 py-3.5 text-sm font-semibold', isActive ? 'bg-navy-50 text-navy-900' : 'text-navy-700')}
              >
                <n.icon className="h-5 w-5 text-navy-400" aria-hidden /> {n.label}
                {!!n.badge && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold text-navy-950">{n.badge}</span>}
              </NavLink>
            ))}
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-red-600">
              <LogOut className="h-5 w-5" aria-hidden /> Log out
            </button>
          </div>
        )}
        <nav
          className="grid border-t border-navy-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(10,22,40,0.06)] backdrop-blur"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          aria-label="Staff"
          data-staff-mobile-nav
        >
          {main.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => tab(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={indicator(isActive)} aria-hidden />
                  <span className="relative">
                    <n.icon className="h-5 w-5" aria-hidden />
                    {!!n.badge && <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-950">{n.badge}</span>}
                  </span>
                  <span className="max-w-full truncate px-1">{n.short ?? n.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {hasMore && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={tab(open || moreActive)}>
              <span className={indicator(moreActive)} aria-hidden />
              <span className="relative">
                <Menu className="h-5 w-5" aria-hidden />
                {!!moreBadge && <span className="absolute -right-2 -top-1.5 h-2.5 w-2.5 rounded-full bg-gold-500" aria-hidden />}
              </span>
              More
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
