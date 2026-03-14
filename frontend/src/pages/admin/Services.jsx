import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

const emptyCreateForm = { name: '', durationMin: '', price: '' };

function CreateServiceDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCreateForm);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => apiFetch('/admin/services', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service created successfully');
      onOpenChange(false);
      setForm(emptyCreateForm);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to create service');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.durationMin || !form.price) {
      setError('All fields are required');
      return;
    }
    if (Number(form.durationMin) < 5) {
      setError('Duration must be at least 5 minutes');
      return;
    }
    if (Number(form.price) <= 0) {
      setError('Price must be greater than 0');
      return;
    }
    mutation.mutate({
      name: form.name,
      durationMin: Number(form.durationMin),
      price: Number(form.price),
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
          <DialogTitle>New Service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Service name"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-duration">Duration (minutes)</Label>
            <Input
              id="create-duration"
              type="number"
              min="5"
              value={form.durationMin}
              onChange={(e) => handleChange('durationMin', e.target.value)}
              placeholder="Duration in minutes"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-price">Price</Label>
            <Input
              id="create-price"
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={(e) => handleChange('price', e.target.value)}
              placeholder="0.00"
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
              {mutation.isPending ? 'Creating...' : 'Create Service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditServiceDialog({ service, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: service?.name ?? '',
    durationMin: service?.durationMin ?? '',
    price: service?.price ?? '',
  });
  const [error, setError] = useState('');

  // Sync form when service changes
  useEffect(() => {
    if (service) {
      setForm({
        name: service.name,
        durationMin: service.durationMin,
        price: service.price,
      });
    }
  }, [service]);

  const mutation = useMutation({
    mutationFn: (data) =>
      apiFetch('/admin/services/' + service.id, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service updated successfully');
      onOpenChange(false);
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to update service');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name || !form.durationMin || !form.price) {
      setError('All fields are required');
      return;
    }
    if (Number(form.durationMin) < 5) {
      setError('Duration must be at least 5 minutes');
      return;
    }
    if (Number(form.price) <= 0) {
      setError('Price must be greater than 0');
      return;
    }
    mutation.mutate({
      name: form.name,
      durationMin: Number(form.durationMin),
      price: Number(form.price),
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

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Service name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-duration">Duration (minutes)</Label>
            <Input
              id="edit-duration"
              type="number"
              min="5"
              value={form.durationMin}
              onChange={(e) => handleChange('durationMin', e.target.value)}
              placeholder="Duration in minutes"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-price">Price</Label>
            <Input
              id="edit-price"
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={(e) => handleChange('price', e.target.value)}
              placeholder="0.00"
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

export default function Services() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch('/admin/services'),
  });

  const services = data?.data ?? [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) =>
      apiFetch('/admin/services/' + id, { method: 'PUT', body: { active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service status updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update service status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiFetch('/admin/services/' + id, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Service deleted');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete service');
    },
  });

  function handleToggleActive(service) {
    toggleActiveMutation.mutate({ id: service.id, active: !service.active });
  }

  function handleDelete(service) {
    if (!confirm(`Delete "${service.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(service.id);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Services</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Service
        </Button>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load services. Please try again.
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Price</TableHead>
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

            {!isLoading && services.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No services found.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {service.durationMin} min
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    R$ {Number(service.price).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={service.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={service.active}
                        onCheckedChange={() => handleToggleActive(service)}
                        disabled={toggleActiveMutation.isPending}
                        size="sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditService(service)}
                        title="Edit service"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {service.name}</span>
                      </Button>
                      {!service.active && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(service)}
                          disabled={deleteMutation.isPending}
                          title="Delete service"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {service.name}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <CreateServiceDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditServiceDialog
        service={editService}
        open={editService !== null}
        onOpenChange={(val) => {
          if (!val) setEditService(null);
        }}
      />
    </div>
  );
}
