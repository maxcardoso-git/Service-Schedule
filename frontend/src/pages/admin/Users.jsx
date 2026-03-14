import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  RECEPTIONIST: 'Receptionist',
};

function RoleBadge({ role }) {
  return (
    <Badge variant={role === 'ADMIN' ? 'default' : 'secondary'}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

function StatusBadge({ active }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
          : 'border-gray-400/30 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

const emptyCreateForm = { name: '', email: '', password: '', role: 'RECEPTIONIST' };

function CreateUserDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCreateForm);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => apiFetch('/admin/users', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User created successfully');
      onOpenChange(false);
      setForm(emptyCreateForm);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to create user');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password || !form.role) {
      setError('All fields are required');
      return;
    }
    mutation.mutate(form);
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleOpenChange(val) {
    if (!val) {
      setForm(emptyCreateForm);
      setError('');
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full name"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(val) => handleChange('role', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    role: user?.role ?? 'RECEPTIONIST',
    active: user?.active ?? true,
  });
  const [error, setError] = useState('');

  // Sync form when user changes
  useState(() => {
    if (user) {
      setForm({ name: user.name, role: user.role, active: user.active });
    }
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      apiFetch('/admin/users/' + user.id, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated successfully');
      onOpenChange(false);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to update user');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.role) {
      setError('Name and role are required');
      return;
    }
    mutation.mutate(form);
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleOpenChange(val) {
    if (!val) {
      setError('');
    }
    onOpenChange(val);
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(val) => handleChange('role', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="RECEPTIONIST">Receptionist</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="edit-active"
              checked={form.active}
              onCheckedChange={(val) => handleChange('active', val)}
            />
            <Label htmlFor="edit-active">Active</Label>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableCell key={i}>
          <div className="h-4 animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch('/admin/users'),
  });

  const users = data?.data ?? [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) =>
      apiFetch('/admin/users/' + id, { method: 'PATCH', body: { active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User status updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update user status');
    },
  });

  function handleToggleActive(user) {
    toggleActiveMutation.mutate({ id: user.id, active: !user.active });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New User
        </Button>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load users. Please try again.
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={user.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={user.active}
                        onCheckedChange={() => handleToggleActive(user)}
                        disabled={toggleActiveMutation.isPending}
                        size="sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditUser(user)}
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {user.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditUserDialog
        user={editUser}
        open={editUser !== null}
        onOpenChange={(val) => {
          if (!val) setEditUser(null);
        }}
      />
    </div>
  );
}
