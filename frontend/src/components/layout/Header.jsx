import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  function handleLogout() {
    useAuthStore.getState().logout();
    navigate('/login');
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium leading-none">
            {user?.name || user?.email || 'User'}
          </p>
          {user?.role && (
            <p className="text-xs text-muted-foreground mt-0.5">{user.role}</p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
