import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Scissors,
  Users,
  Calendar,
  UserSearch,
  Shield,
  ClipboardList,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['ADMIN'],
  },
  {
    label: 'Services',
    path: '/admin/services',
    icon: Scissors,
    roles: ['ADMIN'],
  },
  {
    label: 'Professionals',
    path: '/admin/professionals',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    label: 'Calendar',
    path: '/admin/calendar',
    icon: Calendar,
    roles: ['ADMIN'],
  },
  {
    label: 'Clients',
    path: '/admin/clients',
    icon: UserSearch,
    roles: ['ADMIN'],
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: Shield,
    roles: ['ADMIN'],
  },
  {
    label: 'Receptionist',
    path: '/receptionist',
    icon: ClipboardList,
    roles: ['RECEPTIONIST'],
  },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-background flex flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold tracking-tight">Service Schedule</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
