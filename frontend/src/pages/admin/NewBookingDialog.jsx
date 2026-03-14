import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatWorkingHours(workingHours) {
  if (!workingHours || workingHours.length === 0) return null;
  // Group by day, show "Day HH:MM-HH:MM"
  const byDay = new Map();
  for (const wh of workingHours) {
    const key = wh.dayOfWeek;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(`${wh.startTime}-${wh.endTime}`);
  }
  const parts = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    if (byDay.has(day)) {
      parts.push(`${DAY_SHORT[day]} ${byDay.get(day).join(', ')}`);
    }
  }
  return parts.join(' · ');
}

/**
 * Multi-step booking creation dialog.
 *
 * Props:
 *   open          - boolean
 *   onOpenChange  - (bool) => void
 *   onBookingCreated - () => void  (called after successful booking)
 */
export default function NewBookingDialog({ open, onOpenChange, onBookingCreated }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [phoneInput, setPhoneInput] = useState('');
  const [clientResult, setClientResult] = useState(null); // found client object
  const [clientNotFound, setClientNotFound] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', phone: '', email: '' });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  // Step 2 state
  const [selectedService, setSelectedService] = useState(null);

  // Step 3 state
  const [selectedProfessional, setSelectedProfessional] = useState(null);

  // Step 4 state
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Step 5 state
  const [confirming, setConfirming] = useState(false);

  // ── Fetch lists (enabled based on step) ─────────────────────────────
  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch('/admin/services'),
    enabled: step === 2,
    staleTime: 60000,
  });

  const { data: professionalsData } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => apiFetch('/admin/professionals'),
    enabled: step === 3,
    staleTime: 60000,
  });

  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    isError: availabilityError,
  } = useQuery({
    queryKey: ['admin-availability', selectedProfessional?.id, selectedService?.id, selectedDate],
    queryFn: () =>
      apiFetch('/admin/bookings/availability', {
        method: 'POST',
        body: {
          professionalId: selectedProfessional.id,
          serviceId: selectedService.id,
          date: selectedDate,
        },
      }),
    enabled: step === 4 && !!selectedProfessional && !!selectedService && !!selectedDate,
    staleTime: 0, // Always fresh for availability
  });

  const services = (servicesData?.data ?? []).filter((s) => s.active);
  const professionals = professionalsData?.data ?? [];
  const availability = availabilityData?.data ?? null;

  // ── Reset on close ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setStep(1);
      setPhoneInput('');
      setClientResult(null);
      setClientNotFound(false);
      setRegForm({ name: '', phone: '', email: '' });
      setLookupLoading(false);
      setLookupError('');
      setSelectedClient(null);
      setSelectedService(null);
      setSelectedProfessional(null);
      setSelectedDate(new Date().toISOString().slice(0, 10));
      setSelectedSlot(null);
      setConfirming(false);
    }
  }, [open]);

  // ── Step 1: phone lookup ──────────────────────────────────────────────
  async function handlePhoneLookup() {
    setLookupError('');
    setClientResult(null);
    setClientNotFound(false);
    setLookupLoading(true);
    try {
      const res = await apiFetch('/admin/clients/by-phone/' + encodeURIComponent(phoneInput.trim()));
      setClientResult(res.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setClientNotFound(true);
        setRegForm((prev) => ({ ...prev, phone: phoneInput.trim() }));
      } else {
        setLookupError(err.message || 'Lookup failed');
      }
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleRegisterInline(e) {
    e.preventDefault();
    setLookupError('');
    if (!regForm.name.trim()) {
      setLookupError('Name is required');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await apiFetch('/admin/clients', {
        method: 'POST',
        body: {
          name: regForm.name.trim(),
          phone: regForm.phone.trim(),
          email: regForm.email.trim() || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setSelectedClient(res.data);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setLookupError('A client with this phone already exists. Try searching again.');
      } else {
        setLookupError(err.message || 'Registration failed');
      }
    } finally {
      setLookupLoading(false);
    }
  }

  // ── Step 5: confirm booking ───────────────────────────────────────────
  async function handleConfirm() {
    setConfirming(true);
    try {
      // 1. Create pre-reservation
      const bookingRes = await apiFetch('/admin/bookings', {
        method: 'POST',
        body: {
          clientId: selectedClient.id,
          serviceId: selectedService.id,
          professionalId: selectedProfessional.id,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      const booking = bookingRes.data;

      // 2. Immediately confirm
      await apiFetch('/admin/bookings/' + booking.id + '/status', {
        method: 'PATCH',
        body: { status: 'CONFIRMED' },
      });

      toast.success('Booking created successfully');
      onBookingCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || 'Failed to create booking');
    } finally {
      setConfirming(false);
    }
  }

  // ── Step indicator ────────────────────────────────────────────────────
  function StepIndicator() {
    return (
      <p className="text-xs text-muted-foreground mb-4">
        Step {step} of 5 &mdash;{' '}
        {['Select Client', 'Select Service', 'Select Professional', 'Pick Time Slot', 'Confirm'][step - 1]}
      </p>
    );
  }

  // ── Slot grid ─────────────────────────────────────────────────────────
  function SlotGrid() {
    if (availabilityLoading) {
      return <p className="text-sm text-muted-foreground py-4">Loading slots...</p>;
    }
    if (availabilityError) {
      return (
        <p className="text-sm text-destructive py-2">Failed to load availability. Try another date.</p>
      );
    }
    if (!availability) return null;

    if (availability.reason) {
      const messages = {
        NOT_WORKING: 'This professional does not work on the selected day.',
        FULLY_BOOKED: 'No available slots — fully booked for this date.',
      };
      return (
        <p className="text-sm text-muted-foreground py-2">
          {messages[availability.reason] ?? 'No available slots for this date.'}
        </p>
      );
    }

    const rawSlots = availability.slots ?? [];
    if (rawSlots.length === 0) {
      return <p className="text-sm text-muted-foreground py-2">No available slots for this date.</p>;
    }

    // API returns slots as ISO strings; convert to {startTime, endTime} objects
    const durationMs = (selectedService?.durationMin ?? 60) * 60 * 1000;
    const slots = rawSlots.map((s) => {
      const iso = typeof s === 'string' ? s : s.startTime;
      const start = new Date(iso);
      return { startTime: start.toISOString(), endTime: new Date(start.getTime() + durationMs).toISOString() };
    });

    return (
      <div className="grid grid-cols-4 gap-2 mt-2 max-h-52 overflow-y-auto">
        {slots.map((slot) => {
          const time = new Date(slot.startTime).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const isSelected = selectedSlot?.startTime === slot.startTime;
          return (
            <button
              key={slot.startTime}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={[
                'rounded-md border px-2 py-1.5 text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
            >
              {time}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Filter professionals by selected service ──────────────────────────
  const filteredProfessionals = professionals.filter((p) => {
    if (!p.active) return false;
    if (!p.services || p.services.length === 0) return true; // show all if no service info
    return p.services.some((ps) => ps.serviceId === selectedService?.id || ps.service?.id === selectedService?.id);
  });

  const displayedProfessionals = filteredProfessionals.length > 0 ? filteredProfessionals : professionals.filter((p) => p.active);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <StepIndicator />

          {/* ── STEP 1: Client ───────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Client Phone</Label>
                <div className="flex gap-2">
                  <Input
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setClientResult(null);
                      setClientNotFound(false);
                      setLookupError('');
                    }}
                    placeholder="e.g. 11999990000"
                    autoComplete="off"
                    onKeyDown={(e) => e.key === 'Enter' && handlePhoneLookup()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePhoneLookup}
                    disabled={!phoneInput.trim() || lookupLoading}
                  >
                    {lookupLoading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>

              {lookupError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {lookupError}
                </p>
              )}

              {/* Client found */}
              {clientResult && (
                <div className="rounded-md border bg-muted/40 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{clientResult.name}</p>
                    <p className="text-xs text-muted-foreground">{clientResult.phone}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedClient(clientResult);
                      setStep(2);
                    }}
                  >
                    Select
                  </Button>
                </div>
              )}

              {/* Client not found — inline register */}
              {clientNotFound && (
                <form onSubmit={handleRegisterInline} className="flex flex-col gap-3 rounded-md border p-4">
                  <p className="text-sm font-medium">Client not found. Register new client:</p>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nb-name">Name *</Label>
                    <Input
                      id="nb-name"
                      value={regForm.name}
                      onChange={(e) => setRegForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Full name"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nb-phone">Phone *</Label>
                    <Input
                      id="nb-phone"
                      value={regForm.phone}
                      onChange={(e) => setRegForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone number"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nb-email">Email (optional)</Label>
                    <Input
                      id="nb-email"
                      type="email"
                      value={regForm.email}
                      onChange={(e) => setRegForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com"
                      autoComplete="off"
                    />
                  </div>
                  <Button type="submit" disabled={lookupLoading}>
                    {lookupLoading ? 'Registering...' : 'Register & Continue'}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ── STEP 2: Service ──────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {services.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No active services available.</p>
              )}
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      setSelectedService(svc);
                      setStep(3);
                    }}
                    className="flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="font-medium text-sm">{svc.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {svc.durationMin} min &bull; R$ {Number(svc.price).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Professional ─────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-2">
              {displayedProfessionals.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No active professionals available.</p>
              )}
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {displayedProfessionals.map((pro) => {
                  const schedule = formatWorkingHours(pro.workingHours);
                  return (
                    <button
                      key={pro.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfessional(pro);
                        setSelectedSlot(null);
                        setStep(4);
                      }}
                      className="flex flex-col gap-1 rounded-md border px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="font-medium text-sm">{pro.name}</span>
                      {schedule && (
                        <span className="text-xs text-muted-foreground">{schedule}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 4: Date + Slot ──────────────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nb-date">Date</Label>
                <Input
                  id="nb-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Available Slots</p>
                <SlotGrid />
              </div>

              {selectedSlot && (
                <div className="flex justify-end">
                  <Button onClick={() => setStep(5)}>Next</Button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 5: Confirm ──────────────────────────────────── */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border bg-muted/40 p-4 flex flex-col gap-2 text-sm">
                <SummaryRow label="Client" value={`${selectedClient?.name} (${selectedClient?.phone})`} />
                <SummaryRow
                  label="Service"
                  value={`${selectedService?.name} — R$ ${Number(selectedService?.price ?? 0).toFixed(2)}`}
                />
                <SummaryRow label="Professional" value={selectedProfessional?.name} />
                <SummaryRow
                  label="Date"
                  value={new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                />
                <SummaryRow
                  label="Time"
                  value={
                    selectedSlot
                      ? new Date(selectedSlot.startTime).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }) +
                        ' – ' +
                        new Date(selectedSlot.endTime).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'
                  }
                />
              </div>

              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? 'Creating Booking...' : 'Confirm Booking'}
              </Button>
            </div>
          )}

          {/* ── Back navigation ──────────────────────────────────── */}
          {step > 1 && (
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                &larr; Back
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground font-medium shrink-0">{label}</span>
      <span className="text-right">{value ?? '—'}</span>
    </div>
  );
}
