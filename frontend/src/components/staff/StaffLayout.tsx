import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, CalendarCheck, CalendarDays, LayoutDashboard, LogOut, Settings, UserCheck, UserCog, UserRoundPen, Users, UsersRound } from 'lucide-react';
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
}

const counsellorNav: NavItem[] = [
  { to: '/staff', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/staff/leads', label: 'Leads', icon: UsersRound },
  { to: '/staff/students', label: 'Students', icon: Users },
  // The counsellor's matching profile (countries, subjects, capacity), used to suggest them for new students.
  { to: '/staff/profile', label: 'My profile', icon: UserRoundPen },
];

// Financial Aid and Visa Officers work only on the students assigned to them (no leads, no matching profile).
const officerNav: NavItem[] = [
  { to: '/staff', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/staff/students', label: 'My students', icon: Users },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/assign', label: 'Assignments', icon: UserCheck },
  { to: '/admin/users', label: 'Staff users', icon: UserCog },
  { to: '/admin/agencies', label: 'Partner agencies', icon: Building2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
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
          {/* Navigation (mobile and tablet) */}
          <nav className="flex gap-2 overflow-x-auto px-5 pb-3 sm:px-8 lg:hidden" aria-label="Staff">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition',
                    isActive ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100',
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
                {!!item.badge && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-950">{item.badge}</span>}
              </NavLink>
            ))}
          </nav>
        </header>

        <main id="main" className="px-5 py-8 sm:px-8">
          {ready && <Outlet />}
        </main>
      </div>
    </div>
  );
}
