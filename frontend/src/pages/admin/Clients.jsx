import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, History, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

function StatusBadge({ status }) {
  const map = {
    CONFIRMED: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
    COMPLETED: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    PRE_RESERVED: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    CANCELLED: 'border-gray-400/30 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    NO_SHOW: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  };
  return (
    <Badge variant="outline" className={map[status] ?? ''}>
      {status}
    </Badge>
  );
}

function RegisterClientDialog({ open, onOpenChange, initialPhone = '' }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: initialPhone, email: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm((prev) => ({ ...prev, phone: initialPhone }));
      setError('');
    }
  }, [open, initialPhone]);

  const mutation = useMutation({
    mutationFn: (data) => apiFetch('/admin/clients', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client registered successfully');
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setError('A client with this phone number already exists.');
      } else {
        setError(err.message || 'Failed to register client');
      }
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone is required');
      return;
    }
    mutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
    });
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleOpenChange(val) {
    if (!val) {
      setForm({ name: '', phone: initialPhone, email: '' });
      setError('');
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-name">Name *</Label>
            <Input
              id="client-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full name"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-phone">Phone *</Label>
            <Input
              id="client-phone"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="e.g. 11999990000"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-email">Email (optional)</Label>
            <Input
              id="client-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@example.com"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending ? 'Registering...' : 'Register Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentHistoryDialog({ client, open, onOpenChange }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['client-appointments', client?.id],
    queryFn: () => apiFetch(`/admin/clients/${client.id}/appointments`),
    enabled: open && !!client?.id,
  });

  const appointments = data?.data ?? [];

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Appointment History — {client?.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading...</div>
        )}

        {isError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load appointment history.
          </div>
        )}

        {!isLoading && !isError && appointments.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No appointments found
          </div>
        )}

        {!isLoading && appointments.length > 0 && (
          <div className="rounded-xl border bg-card max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Professional</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell>{formatDate(appt.startTime)}</TableCell>
                    <TableCell>{formatTime(appt.startTime)}</TableCell>
                    <TableCell>
                      {appt.services?.[0]?.service?.name ?? '—'}
                    </TableCell>
                    <TableCell>{appt.professional?.name ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={appt.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {[1, 2, 3, 4].map((i) => (
        <TableCell key={i}>
          <div className="h-4 animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function Clients() {
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [registerPhone, setRegisterPhone] = useState('');
  const [historyClient, setHistoryClient] = useState(null);

  // Debounce: update searchTerm 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['clients', searchTerm],
    queryFn: () =>
      apiFetch('/admin/clients?search=' + encodeURIComponent(searchTerm) + '&limit=50'),
  });

  const clients = data?.data ?? [];

  // Phone lookup: searchTerm is digits-only and at least 8 chars
  const isPhoneLookup = /^\d{8,}$/.test(searchTerm);

  function handlePhoneLookup() {
    setRegisterPhone(searchTerm);
    setCreateOpen(true);
  }

  function openHistory(client) {
    setHistoryClient(client);
  }

  function handleNewClient() {
    setRegisterPhone('');
    setCreateOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={handleNewClient}>
          <Plus className="mr-2 h-4 w-4" />
          New Client
        </Button>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or phone..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>
        {isPhoneLookup && (
          <Button variant="outline" onClick={handlePhoneLookup}>
            <UserPlus className="mr-2 h-4 w-4" />
            Register with this phone
          </Button>
        )}
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load clients. Please try again.
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
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

            {!isLoading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {searchTerm ? 'No clients found matching your search.' : 'No clients yet.'}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.email ?? <span className="text-xs text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openHistory(client)}
                      title="View appointment history"
                    >
                      <History className="mr-1.5 h-4 w-4" />
                      History
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <RegisterClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialPhone={registerPhone}
      />

      <AppointmentHistoryDialog
        client={historyClient}
        open={historyClient !== null}
        onOpenChange={(val) => {
          if (!val) setHistoryClient(null);
        }}
      />
    </div>
  );
}
