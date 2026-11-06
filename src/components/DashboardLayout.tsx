import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from '@/lib/router-compat';
import { LogOut, Menu, X, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navByRole: Record<UserRole, NavItem[]> = {
  traveler: [
    { label: 'Dashboard', path: '/traveler', icon: LayoutDashboard },
    { label: 'My Identity', path: '/traveler/identity', icon: IdCard },
    { label: 'Scan ID', path: '/traveler/scan', icon: ScanLine },
    { label: 'My Trips', path: '/traveler/trips', icon: Plane },
    { label: 'Verification History', path: '/traveler/verifications', icon: ShieldCheck },
    { label: 'Settings', path: '/traveler/settings', icon: Settings },
  ],
  business: [
    { label: 'Dashboard', path: '/business', icon: LayoutDashboard },
    { label: 'Scan & Verify', path: '/business/scan', icon: ScanLine },
    { label: 'Bookings', path: '/business/bookings', icon: Calendar },
    { label: 'Verification History', path: '/business/verifications', icon: ShieldCheck },
    { label: 'Mismatch Reports', path: '/business/reports', icon: AlertTriangle },
    { label: 'Settings', path: '/business/settings', icon: Settings },
  ],
  admin: [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Bookings', path: '/admin/bookings', icon: Calendar },
    { label: 'Verifications', path: '/admin/verifications', icon: ShieldCheck },
    { label: 'Mismatch Reports', path: '/admin/reports', icon: AlertTriangle },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ],
};

import {
  LayoutDashboard, IdCard, ScanLine, Plane, ShieldCheck, Settings,
  Calendar, AlertTriangle, Users,
} from 'lucide-react';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!profile) return null;

  const navItems = navByRole[profile.role] || [];
  const roleLabel = profile.role.charAt(0).toUpperCase() + profile.role.slice(1) + ' Portal';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === `/${profile.role}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-navy-50 flex">
      {/* Sidebar - Desktop */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 overflow-hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="pointer-events-none absolute inset-0 paper-grid opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />

        <div className="relative px-6 pt-6 pb-5">
          <Logo size="md" />
        </div>

        <div className="relative mx-6 mb-2 flex items-center gap-2">
          <span className="eyebrow text-turquoise-700">{roleLabel}</span>
          <span className="flex-1 perforation" />
          <Plane size={12} className="text-accent-500" />
        </div>

        <nav className="relative flex-1 px-4 py-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item, index) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-navy-500 font-medium hover:bg-navy-100 hover:text-navy-900'
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sidebar-primary" />}
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${active ? 'border-transparent bg-sidebar-primary text-sidebar-primary-foreground' : 'border-sidebar-border bg-card text-navy-500 group-hover:text-navy-800'}`}>
                  <item.icon size={16} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                <span className="font-mono text-[10px] text-navy-400">{String(index + 1).padStart(2, '0')}</span>
              </button>
            );
          })}
        </nav>

        <div className="relative p-4 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-navy-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-overlay backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-navy-100 text-navy-600"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="hidden lg:block">
              <p className="eyebrow">Welcome back</p>
              <p className="font-display text-lg font-semibold text-navy-900 leading-tight">{profile.full_name}</p>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button className="relative p-2 rounded-lg hover:bg-navy-50 text-navy-600">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-turquoise-500 rounded-full" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-navy-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-turquoise-500 to-turquoise-700 flex items-center justify-center text-white text-sm font-semibold">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={16} className="text-navy-400" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 card p-2 z-20 animate-slide-down">
                      <div className="px-3 py-2 border-b border-navy-100 mb-1">
                        <p className="text-sm font-semibold text-navy-900">{profile.full_name}</p>
                        <p className="text-xs text-navy-400 capitalize">{profile.role} account</p>
                      </div>
                      <button
                        onClick={() => { navigate(`/${profile.role}/settings`); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-navy-600 hover:bg-navy-50"
                      >
                        <Settings size={16} />
                        Settings
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
