import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Swords,
  User,
  LogOut,
  Zap,
  History,
  BarChart3,
  X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useAuth } from '../../features/auth/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/quests', icon: Swords, label: 'Quests' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/profile', icon: User, label: 'Profile' },
] as const;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-surface-800 bg-surface-950 transition-transform duration-200 ease-out',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      aria-label="Primary navigation"
    >
      {/* Logo + mobile close */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary-500" />
          <span className="text-lg font-bold tracking-tight text-surface-50">QuestLog</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden text-surface-400 hover:text-surface-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* XP bar */}
      {user && (
        <div className="px-4 py-3 border-b border-surface-800">
          <div className="flex justify-between text-xs text-surface-400 mb-1">
            <span className="font-medium text-surface-300">Lv {user.level}</span>
            <span className="font-mono text-xp-400">{user.xp} XP</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-600 to-xp-500 transition-all duration-500"
              style={{ width: `${Math.min(user.xp % 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600/15 text-primary-300'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {user && (
        <div className="border-t border-surface-800 p-3">
          <div className="mb-2 px-3 py-2">
            <p className="text-xs font-medium text-surface-200 truncate">{user.username}</p>
            <p className="text-xs text-surface-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-surface-400 hover:bg-danger-600/10 hover:text-danger-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
