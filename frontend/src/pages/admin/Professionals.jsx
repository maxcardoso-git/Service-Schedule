import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Scissors, Clock } from 'lucide-react';
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

const emptyCreateForm = { name: '', email: '', phone: '' };

function CreateProfessionalDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCreateForm);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) =>
      apiFetch('/admin/professionals', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Professional created successfully');
      onOpenChange(false);
      setForm(emptyCreateForm);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to create professional');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Name is required');
      return;
    }
    mutation.mutate({
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
    });
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
          <DialogTitle>New Professional</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-name">Name *</Label>
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
              placeholder="professional@example.com"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-phone">Phone</Label>
            <Input
              id="create-phone"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+55 11 99999-9999"
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
              {mutation.isPending ? 'Creating...' : 'Create Professional'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditProfessionalDialog({ professional, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: professional?.name ?? '',
    email: professional?.email ?? '',
    phone: professional?.phone ?? '',
  });
  const [error, setError] = useState('');

  // Sync when professional prop changes
  useEffect(() => {
    if (professional) {
      setForm({
        name: professional.name,
        email: professional.email ?? '',
        phone: professional.phone ?? '',
      });
    }
  }, [professional]);

  const mutation = useMutation({
    mutationFn: (data) =>
      apiFetch('/admin/professionals/' + professional.id, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Professional updated successfully');
      onOpenChange(false);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to update professional');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Name is required');
      return;
    }
    mutation.mutate({
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
    });
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

  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Professional</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="professional@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+55 11 99999-9999"
            />
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

function ServiceAssignmentDialog({ professional, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [localAssigned, setLocalAssigned] = useState(new Set());

  // Sync local state when professional prop changes or dialog opens
  useEffect(() => {
    if (professional) {
      setLocalAssigned(new Set(
        (professional.services ?? []).map((ps) => ps.service.id)
      ));
    }
  }, [professional]);

  const {
    data: servicesData,
    isLoading: servicesLoading,
    isError: servicesError,
  } = useQuery({
    queryKey: ['admin-services-list'],
    queryFn: () => apiFetch('/admin/services'),
    enabled: open,
    retry: 1,
  });

  const assignMutation = useMutation({
    mutationFn: ({ serviceId }) =>
      apiFetch('/admin/professionals/' + professional.id + '/services', {
        method: 'POST',
        body: { serviceId },
      }),
    onSuccess: (_data, { serviceId }) => {
      setLocalAssigned((prev) => new Set([...prev, serviceId]));
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Service assigned');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to assign service');
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ serviceId }) =>
      apiFetch('/admin/professionals/' + professional.id + '/services/' + serviceId, {
        method: 'DELETE',
      }),
    onSuccess: (_data, { serviceId }) => {
      setLocalAssigned((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Service removed');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove service');
    },
  });

  function handleToggle(service, currentlyAssigned) {
    if (currentlyAssigned) {
      removeMutation.mutate({ serviceId: service.id });
    } else {
      assignMutation.mutate({ serviceId: service.id });
    }
  }

  if (!professional) return null;

  const allServices = servicesData?.data ?? [];
  const isPending = assignMutation.isPending || removeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Services — {professional.name}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {servicesLoading && (
            <p className="text-sm text-muted-foreground">Loading services...</p>
          )}

          {servicesError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Could not load services. Make sure the services endpoint is available.
            </p>
          )}

          {!servicesLoading && !servicesError && allServices.length === 0 && (
            <p className="text-sm text-muted-foreground">No services available.</p>
          )}

          {!servicesLoading && !servicesError && allServices.length > 0 && (
            <div className="flex flex-col gap-3">
              {allServices.map((service) => {
                const assigned = localAssigned.has(service.id);
                return (
                  <div key={service.id} className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{service.name}</span>
                      {service.durationMin != null && (
                        <span className="text-xs text-muted-foreground">
                          {service.durationMin} min
                        </span>
                      )}
                    </div>
                    <Switch
                      checked={assigned}
                      onCheckedChange={() => handleToggle(service, assigned)}
                      disabled={isPending}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const defaultHours = () =>
  Array.from({ length: 7 }, () => ({ enabled: false, startTime: '09:00', endTime: '18:00' }));

function WorkingHoursDialog({ professional, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(defaultHours());
  const [error, setError] = useState('');

  // Load existing working hours when dialog opens
  useEffect(() => {
    if (professional && open) {
      const fresh = defaultHours();
      const workingHours = professional.workingHours ?? [];
      workingHours.forEach(({ dayOfWeek, startTime, endTime }) => {
        fresh[dayOfWeek] = { enabled: true, startTime, endTime };
      });
      setHours(fresh);
      setError('');
    }
  }, [professional, open]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      apiFetch('/admin/professionals/' + professional.id + '/working-hours', {
        method: 'PUT',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Working hours saved');
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err.message || 'Failed to save working hours');
    },
  });

  function handleDayToggle(dayIndex, enabled) {
    setHours((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, enabled } : d))
    );
  }

  function handleTimeChange(dayIndex, field, value) {
    setHours((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, [field]: value } : d))
    );
  }

  function handleSave() {
    setError('');
    // Validate enabled days: startTime must be before endTime
    for (const dayIndex of DAY_DISPLAY_ORDER) {
      const day = hours[dayIndex];
      if (day.enabled && day.startTime >= day.endTime) {
        setError(
          `${DAY_LABELS[dayIndex]}: start time must be before end time.`
        );
        return;
      }
    }
    const payload = {
      hours: hours
        .map((day, dayOfWeek) => ({ ...day, dayOfWeek }))
        .filter((day) => day.enabled)
        .map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
    };
    mutation.mutate(payload);
  }

  function handleOpenChange(val) {
    if (!val) {
      setError('');
      setHours(defaultHours());
    }
    onOpenChange(val);
  }

  if (!professional) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Working Hours — {professional.name}</DialogTitle>
        </DialogHeader>

        <div className="py-2">
            <div className="flex flex-col gap-3">
              {DAY_DISPLAY_ORDER.map((dayIndex) => {
                const day = hours[dayIndex];
                return (
                  <div key={dayIndex} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-medium">
                      {DAY_LABELS[dayIndex]}
                    </span>
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(val) => handleDayToggle(dayIndex, val)}
                    />
                    <div
                      className={`flex items-center gap-2 ${
                        day.enabled ? '' : 'opacity-40'
                      }`}
                    >
                      <Input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => handleTimeChange(dayIndex, 'startTime', e.target.value)}
                        disabled={!day.enabled}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => handleTimeChange(dayIndex, 'endTime', e.target.value)}
                        disabled={!day.enabled}
                        className="w-32"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

          {error && (
            <p className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Hours'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <TableCell key={i}>
          <div className="h-4 animate-pulse rounded bg-muted" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function Professionals() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProfessional, setEditProfessional] = useState(null);
  const [assignProfessional, setAssignProfessional] = useState(null);
  const [hoursProf, setHoursProf] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => apiFetch('/admin/professionals'),
  });

  const professionals = data?.data ?? [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) =>
      apiFetch('/admin/professionals/' + id, { method: 'PUT', body: { active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      toast.success('Professional status updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update professional status');
    },
  });

  function handleToggleActive(professional) {
    toggleActiveMutation.mutate({ id: professional.id, active: !professional.active });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Professionals</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Professional
        </Button>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load professionals. Please try again.
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Availability</TableHead>
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

            {!isLoading && professionals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No professionals found.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              professionals.map((professional) => (
                <TableRow key={professional.id}>
                  <TableCell className="font-medium">{professional.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      {professional.email && <span>{professional.email}</span>}
                      {professional.phone && (
                        <span className="text-xs">{professional.phone}</span>
                      )}
                      {!professional.email && !professional.phone && (
                        <span className="italic">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {professional.services.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {professional.services.map((ps) => (
                          <Badge key={ps.service.id} variant="secondary">
                            {ps.service.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(!professional.workingHours || professional.workingHours.length === 0) ? (
                      <span className="text-sm text-muted-foreground italic">Not set</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {DAY_DISPLAY_ORDER
                          .filter((d) => professional.workingHours.some((wh) => wh.dayOfWeek === d))
                          .map((d) => {
                            const wh = professional.workingHours.find((w) => w.dayOfWeek === d);
                            return (
                              <span key={d} className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{DAY_SHORT[d]}</span>{' '}
                                {wh.startTime}–{wh.endTime}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={professional.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={professional.active}
                        onCheckedChange={() => handleToggleActive(professional)}
                        disabled={toggleActiveMutation.isPending}
                        size="sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditProfessional(professional)}
                        title="Edit professional"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {professional.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setAssignProfessional(professional)}
                        title="Manage services"
                      >
                        <Scissors className="h-4 w-4" />
                        <span className="sr-only">Assign services to {professional.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setHoursProf(professional)}
                        title="Working hours"
                      >
                        <Clock className="h-4 w-4" />
                        <span className="sr-only">Working hours for {professional.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <CreateProfessionalDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditProfessionalDialog
        professional={editProfessional}
        open={editProfessional !== null}
        onOpenChange={(val) => {
          if (!val) setEditProfessional(null);
        }}
      />

      <ServiceAssignmentDialog
        professional={assignProfessional}
        open={assignProfessional !== null}
        onOpenChange={(val) => {
          if (!val) setAssignProfessional(null);
        }}
      />

      <WorkingHoursDialog
        professional={hoursProf}
        open={hoursProf !== null}
        onOpenChange={(val) => {
          if (!val) setHoursProf(null);
        }}
      />
    </div>
  );
}
