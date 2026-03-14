import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ReceptionistBookingDialog from '@/pages/ReceptionistBookingDialog';

// ── Status constants (copied from Calendar.jsx — not imported since Calendar is a page) ──
const STATUS_COLORS = {
  PRE_RESERVED: { bg: '#fbbf24', border: '#f59e0b', text: '#78350f' },
  CONFIRMED:    { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  COMPLETED:    { bg: '#22c55e', border: '#16a34a', text: '#ffffff' },
  CANCELLED:    { bg: '#9ca3af', border: '#6b7280', text: '#ffffff' },
  NO_SHOW:      { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
};

const STATUS_LABELS = {
  PRE_RESERVED: 'Pre-Reserved',
  CONFIRMED:    'Confirmed',
  COMPLETED:    'Completed',
  CANCELLED:    'Cancelled',
  NO_SHOW:      'No-Show',
};

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

function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ── Booking detail dialog (inline, not imported from Calendar) ──
function BookingDetailDialog({ booking, open, onOpenChange }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, status }) =>
      apiFetch('/admin/bookings/' + id + '/status', {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptionist-bookings'] });
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
            <span className="font-medium text-muted-foreground">Time</span>
            <span>
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            </span>
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

// ── Today's Agenda Section ───────────────────────────────────────────────────
function AgendaSection({ bookings, professionals, onBookingClick }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Filter to today's bookings
  const todayBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startTime).toISOString().slice(0, 10);
    return bookingDate === todayStr;
  });

  // Group by professionalId
  const byProfessional = {};
  for (const b of todayBookings) {
    const key = b.professionalId ?? 'unknown';
    if (!byProfessional[key]) byProfessional[key] = [];
    byProfessional[key].push(b);
  }

  // Sort each group by startTime
  for (const key of Object.keys(byProfessional)) {
    byProfessional[key].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  // Build list of active professionals, only those who have bookings today or are active
  const activeProfessionals = professionals.filter((p) => p.active);

  // All professionals with today's bookings (include those with bookings even if not "active")
  const profIds = new Set([
    ...activeProfessionals.map((p) => p.id),
    ...Object.keys(byProfessional),
  ]);

  // Build display order: active professionals first, then any remaining
  const displayProfessionals = [
    ...activeProfessionals,
    ...Object.keys(byProfessional)
      .filter((id) => !activeProfessionals.find((p) => p.id === id))
      .map((id) => ({
        id,
        name: byProfessional[id][0]?.professional?.name ?? 'Unknown',
      })),
  ].filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx);

  if (todayBookings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No bookings scheduled for today.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {displayProfessionals
        .filter((pro) => byProfessional[pro.id]?.length > 0)
        .map((pro) => (
          <div key={pro.id} className="flex flex-col gap-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {pro.name}
            </h3>
            <div className="flex flex-col gap-2">
              {(byProfessional[pro.id] ?? []).map((booking) => {
                const colors = STATUS_COLORS[booking.status];
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onBookingClick(booking)}
                    className="w-full text-left rounded-lg border p-3 transition-shadow hover:shadow-md"
                    style={{
                      backgroundColor: colors?.bg ?? '#9ca3af',
                      borderColor: colors?.border ?? '#6b7280',
                    }}
                  >
                    <div
                      className="text-xs font-semibold mb-0.5"
                      style={{ color: colors?.text ?? '#ffffff' }}
                    >
                      {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                    </div>
                    <div
                      className="text-sm font-medium leading-tight"
                      style={{ color: colors?.text ?? '#ffffff' }}
                    >
                      {booking.client?.name ?? 'Unknown Client'}
                    </div>
                    <div
                      className="text-xs mt-0.5 opacity-90"
                      style={{ color: colors?.text ?? '#ffffff' }}
                    >
                      {booking.service?.name ?? '—'}
                    </div>
                    <div className="mt-1.5">
                      <StatusBadge status={booking.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

// ── Client Search Section ────────────────────────────────────────────────────
function ClientSearchSection() {
  const [phone, setPhone] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [client, setClient] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [lastVisit, setLastVisit] = useState(null);
  const [visitLoading, setVisitLoading] = useState(false);

  async function handleSearch() {
    if (!phone.trim()) return;
    setSearchError('');
    setClient(null);
    setNotFound(false);
    setLastVisit(null);
    setSearchLoading(true);
    try {
      const res = await apiFetch('/admin/clients/by-phone/' + encodeURIComponent(phone.trim()));
      const found = res.data;
      setClient(found);

      // Fetch last visit
      setVisitLoading(true);
      try {
        const apptRes = await apiFetch('/admin/clients/' + found.id + '/appointments');
        const appointments = apptRes.data ?? [];
        if (appointments.length > 0) {
          const sorted = [...appointments].sort(
            (a, b) => new Date(b.startTime) - new Date(a.startTime)
          );
          setLastVisit(sorted[0].startTime);
        } else {
          setLastVisit(null);
        }
      } catch {
        setLastVisit(null);
      } finally {
        setVisitLoading(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setSearchError(err.message || 'Search failed');
      }
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-base">Client Lookup</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rec-phone">Phone Number</Label>
        <div className="flex gap-2">
          <Input
            id="rec-phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setClient(null);
              setNotFound(false);
              setSearchError('');
            }}
            placeholder="e.g. 11999990000"
            autoComplete="off"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSearch}
            disabled={!phone.trim() || searchLoading}
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {searchError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {searchError}
        </p>
      )}

      {notFound && (
        <p className="text-sm text-muted-foreground">Client not found for this phone number.</p>
      )}

      {client && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 flex flex-col gap-1 text-sm">
          <p className="font-semibold text-base">{client.name}</p>
          <p className="text-muted-foreground">{client.phone}</p>
          {client.email && <p className="text-muted-foreground">{client.email}</p>}
          <p className="mt-1 text-muted-foreground">
            {visitLoading
              ? 'Loading last visit...'
              : lastVisit
              ? `Last visit: ${formatDate(lastVisit)}`
              : 'No previous visits'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Availability Check Section ───────────────────────────────────────────────
function AvailabilitySection({ services, professionals }) {
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState(null);
  const [availReason, setAvailReason] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState('');

  const activeServices = services.filter((s) => s.active);

  const filteredProfessionals = professionals.filter((p) => {
    if (!p.active) return false;
    if (!selectedServiceId) return true;
    if (!p.services || p.services.length === 0) return true;
    return p.services.some(
      (ps) => ps.serviceId === selectedServiceId || ps.service?.id === selectedServiceId
    );
  });

  const displayedProfessionals =
    filteredProfessionals.length > 0
      ? filteredProfessionals
      : professionals.filter((p) => p.active);

  async function handleCheck() {
    if (!selectedServiceId || !selectedProfessionalId) return;
    setCheckError('');
    setSlots(null);
    setAvailReason(null);
    setCheckLoading(true);
    try {
      const res = await apiFetch('/admin/bookings/availability', {
        method: 'POST',
        body: {
          serviceId: selectedServiceId,
          professionalId: selectedProfessionalId,
          date: selectedDate,
        },
      });
      const availability = res.data ?? res;
      if (availability.reason) {
        setAvailReason(availability.reason);
      } else {
        setSlots(availability.slots ?? []);
      }
    } catch (err) {
      setCheckError(err.message || 'Failed to check availability');
    } finally {
      setCheckLoading(false);
    }
  }

  const REASON_MESSAGES = {
    NOT_WORKING: 'This professional does not work on the selected day.',
    FULLY_BOOKED: 'No available slots — fully booked for this date.',
  };

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-base">Check Availability</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avail-service">Service</Label>
        <select
          id="avail-service"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={selectedServiceId}
          onChange={(e) => {
            setSelectedServiceId(e.target.value);
            setSelectedProfessionalId('');
            setSlots(null);
            setAvailReason(null);
          }}
        >
          <option value="">Select a service...</option>
          {activeServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMin} min)
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avail-professional">Professional</Label>
        <select
          id="avail-professional"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={selectedProfessionalId}
          onChange={(e) => {
            setSelectedProfessionalId(e.target.value);
            setSlots(null);
            setAvailReason(null);
          }}
          disabled={!selectedServiceId}
        >
          <option value="">Select a professional...</option>
          {displayedProfessionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!selectedProfessionalId && (
          <p className="text-xs text-muted-foreground">
            Select a professional to check slots.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="avail-date">Date</Label>
        <Input
          id="avail-date"
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSlots(null);
            setAvailReason(null);
          }}
        />
      </div>

      <Button
        type="button"
        onClick={handleCheck}
        disabled={!selectedServiceId || !selectedProfessionalId || checkLoading}
      >
        {checkLoading ? 'Checking...' : 'Check Slots'}
      </Button>

      {checkError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {checkError}
        </p>
      )}

      {availReason && (
        <p className="text-sm text-muted-foreground">
          {REASON_MESSAGES[availReason] ?? 'No available slots for this date.'}
        </p>
      )}

      {slots !== null && (
        <div>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No available slots for this date.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <div
                  key={slot.startTime}
                  className="rounded-md border border-input bg-accent/40 px-2 py-1.5 text-center text-sm font-medium"
                >
                  {new Date(slot.startTime).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Receptionist Page ───────────────────────────────────────────────────
export default function Receptionist() {
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Fetch all bookings — filter client-side to today
  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    isError: bookingsError,
  } = useQuery({
    queryKey: ['receptionist-bookings'],
    queryFn: () => apiFetch('/admin/bookings'),
    refetchInterval: 30000,
  });

  // Fetch professionals list
  const { data: professionalsData } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => apiFetch('/admin/professionals'),
    staleTime: 60000,
  });

  // Fetch services list (for availability section)
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch('/admin/services'),
    staleTime: 60000,
  });

  const bookings = bookingsData?.data ?? [];
  const professionals = professionalsData?.data ?? [];
  const services = servicesData?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Receptionist</h1>
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        </div>
        <Button onClick={() => setNewBookingOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Booking
        </Button>
      </div>

      {/* ── Today's Agenda ────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Today's Agenda</h2>
          {/* Status legend */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATUS_LABELS).map(([status, label]) => {
              const colors = STATUS_COLORS[status];
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {bookingsError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load bookings. Please try again.
          </div>
        )}

        {bookingsLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : (
          <AgendaSection
            bookings={bookings}
            professionals={professionals}
            onBookingClick={setSelectedBooking}
          />
        )}
      </div>

      {/* ── Bottom Row: Client Search + Availability ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ClientSearchSection />
        <AvailabilitySection services={services} professionals={professionals} />
      </div>

      {/* ── Booking Detail Dialog ─────────────────────────────────────── */}
      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(val) => {
          if (!val) setSelectedBooking(null);
        }}
      />

      {/* ── New Booking Dialog ────────────────────────────────────────── */}
      <ReceptionistBookingDialog
        open={newBookingOpen}
        onOpenChange={setNewBookingOpen}
        onBookingCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['receptionist-bookings'] });
        }}
      />
    </div>
  );
}
