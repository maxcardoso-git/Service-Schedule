import { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import NewBookingDialog from '@/pages/admin/NewBookingDialog';

// Status color map for FullCalendar event styling
const STATUS_COLORS = {
  PRE_RESERVED: { bg: '#fbbf24', border: '#f59e0b', text: '#78350f' },
  CONFIRMED:    { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  COMPLETED:    { bg: '#22c55e', border: '#16a34a', text: '#ffffff' },
  CANCELLED:    { bg: '#9ca3af', border: '#6b7280', text: '#ffffff' },
  NO_SHOW:      { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
};

// Human-readable status labels
const STATUS_LABELS = {
  PRE_RESERVED: 'Pre-Reserved',
  CONFIRMED:    'Confirmed',
  COMPLETED:    'Completed',
  CANCELLED:    'Cancelled',
  NO_SHOW:      'No-Show',
};

// Status transitions: which new statuses are reachable from a given status
const STATUS_TRANSITIONS = {
  PRE_RESERVED: [
    { label: 'Confirm',  next: 'CONFIRMED' },
    { label: 'Cancel',   next: 'CANCELLED' },
  ],
  CONFIRMED: [
    { label: 'Complete', next: 'COMPLETED' },
    { label: 'No-Show',  next: 'NO_SHOW'   },
    { label: 'Cancel',   next: 'CANCELLED' },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW:   [],
};

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: colors?.bg ?? '#9ca3af',
        color: colors?.text ?? '#ffffff',
        border: `1px solid ${colors?.border ?? '#6b7280'}`,
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BookingDetailDialog({ booking, open, onOpenChange }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, status }) =>
      apiFetch('/admin/bookings/' + id + '/status', {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking status updated');
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update booking status');
    },
  });

  if (!booking) return null;

  const transitions = STATUS_TRANSITIONS[booking.status] ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Status</span>
            <StatusBadge status={booking.status} />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Client</span>
            <span className="text-right">{booking.client?.name ?? '—'}</span>
          </div>

          {booking.client?.phone && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Phone</span>
              <span className="text-right">{booking.client.phone}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Service</span>
            <span className="text-right">{booking.service?.name ?? '—'}</span>
          </div>

          {booking.service?.durationMin && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Duration</span>
              <span>{booking.service.durationMin} min</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Professional</span>
            <span className="text-right">{booking.professional?.name ?? '—'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Start</span>
            <span>{formatDateTime(booking.startTime)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">End</span>
            <span>{formatDateTime(booking.endTime)}</span>
          </div>

          {booking.price != null && (
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Price</span>
              <span>R$ {Number(booking.price).toFixed(2)}</span>
            </div>
          )}
        </div>

        {transitions.length > 0 && (
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {transitions.map(({ label, next }) => (
              <Button
                key={next}
                variant={next === 'CANCELLED' || next === 'NO_SHOW' ? 'outline' : 'default'}
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: booking.id, status: next })}
                className={
                  next === 'CANCELLED' || next === 'NO_SHOW'
                    ? 'border-destructive/50 text-destructive hover:bg-destructive/10'
                    : ''
                }
              >
                {mutation.isPending ? 'Updating...' : label}
              </Button>
            ))}
          </DialogFooter>
        )}

        {transitions.length === 0 && (
          <p className="text-center text-xs text-muted-foreground pb-2">
            This booking is in a final state and cannot be changed.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Status legend shown below the calendar title
function StatusLegend() {
  return (
    <div className="mb-4 flex flex-wrap gap-4">
      {Object.entries(STATUS_LABELS).map(([status, label]) => {
        const colors = STATUS_COLORS[status];
        return (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Calendar() {
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  // TODO: Add date range filtering for scale (hundreds+ of bookings).
  // For now, fetch all bookings — fine for small salon use case.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiFetch('/admin/bookings'),
  });

  const bookings = data?.data ?? [];

  // Transform bookings into FullCalendar event objects
  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.client?.name ?? 'Client'} — ${b.service?.name ?? 'Service'}`,
    start: b.startTime,
    end: b.endTime,
    backgroundColor: STATUS_COLORS[b.status]?.bg,
    borderColor: STATUS_COLORS[b.status]?.border,
    textColor: STATUS_COLORS[b.status]?.text,
    extendedProps: { booking: b },
  }));

  function handleEventClick(info) {
    setSelectedBooking(info.event.extendedProps.booking);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <Button onClick={() => setNewBookingOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Booking
        </Button>
      </div>

      <StatusLegend />

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load bookings. Please try again.
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridDay"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridDay,timeGridWeek',
            }}
            events={events}
            eventClick={handleEventClick}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            allDaySlot={false}
            height="auto"
            locale={ptBrLocale}
            slotDuration="00:30:00"
            nowIndicator={true}
          />
        )}
      </div>

      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(val) => {
          if (!val) setSelectedBooking(null);
        }}
      />

      <NewBookingDialog
        open={newBookingOpen}
        onOpenChange={setNewBookingOpen}
        onBookingCreated={() => queryClient.invalidateQueries({ queryKey: ['bookings'] })}
      />
    </div>
  );
}
