import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, CalendarCheck, CalendarDays, LayoutDashboard, LogOut, Settings, UserCog, Users, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { DemoBadge } from '../ui/DemoBadge';
import { useAuth } from '../../context/AuthContext';
import { cn, initials } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const counsellorNav: NavItem[] = [
  { to: '/staff', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/staff/leads', label: 'Leads', icon: UsersRound },
  { to: '/staff/students', label: 'Students', icon: Users },
];

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Staff users', icon: UserCog },
  { to: '/admin/agencies', label: 'Partner agencies', icon: Building2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/staff/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/staff/leads', label: 'Leads', icon: UsersRound },
  { to: '/staff/students', label: 'Students', icon: Users },
];

const roleLabel = { counsellor: 'Counsellor', officer: 'Application officer', admin: 'Administrator' } as const;

/** Layout for the staff and admin areas: separate from the public website, with role-based navigation. */
export function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const nav = user.role === 'admin' ? adminNav : counsellorNav;

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
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <DemoBadge light label="Demo data" />
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
              AHatIn staff portal · <span className="font-semibold text-navy-800">{roleLabel[user.role as keyof typeof roleLabel] ?? user.role}</span>
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
              </NavLink>
            ))}
          </nav>
        </header>

        <main id="main" className="px-5 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
