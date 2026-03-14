---
phase: 08
plan: 01
subsystem: frontend-receptionist
tags: [react, tanstack-query, receptionist, booking-dialog, role-based-routing]

dependency-graph:
  requires:
    - "07-03: admin booking endpoints (POST /admin/bookings, PATCH /admin/bookings/:id/status, POST /admin/bookings/availability)"
    - "07-03: client endpoints (GET /admin/clients/by-phone/:phone, POST /admin/clients, GET /admin/clients/:id/appointments)"
    - "05-01: ProtectedRoute with roles prop, useAuthStore with user.role"
    - "05-02: AppLayout, Sidebar (already has /receptionist nav item)"
  provides:
    - "Receptionist.jsx: full receptionist interface page"
    - "ReceptionistBookingDialog.jsx: 3-step quick booking dialog"
    - "/receptionist route: RECEPTIONIST role guard + redirect on login"
  affects: []

tech-stack:
  added: []
  patterns:
    - "STATUS_COLORS/STATUS_LABELS/STATUS_TRANSITIONS copied into page file (not shared import)"
    - "AgendaSection, ClientSearchSection, AvailabilitySection as named sub-components within same file"
    - "RootRedirect inline component in App.jsx for role-based / routing"
    - "3-step dialog combining NewBookingDialog steps 2-4 into single scrollable step 2"

key-files:
  created:
    - frontend/src/pages/Receptionist.jsx
    - frontend/src/pages/ReceptionistBookingDialog.jsx
  modified:
    - frontend/src/App.jsx

decisions:
  - id: status-constants-copied
    choice: "Copied STATUS_COLORS/STATUS_LABELS/STATUS_TRANSITIONS into Receptionist.jsx rather than importing from Calendar.jsx"
    rationale: "Plan specified this explicitly — Calendar is a page file, not a shared component. Keeps files independent."
  - id: 3-step-vs-5-step
    choice: "Combined NewBookingDialog steps 2-4 (service, professional, date+slot) into single scrollable step 2"
    rationale: "Receptionist workflow optimized for speed — fewer clicks for common walk-in scenario"
  - id: root-redirect-inline
    choice: "RootRedirect as small inline component in App.jsx (not a separate file)"
    rationale: "Minimal component with single responsibility; no need to extract"
  - id: availabilityData-normalization
    choice: "Normalize availability response as `availabilityData?.data ?? availabilityData` to handle both wrapped and unwrapped shapes"
    rationale: "Defensive — consistent with how apiFetch returns data"

metrics:
  duration: "~32 min"
  completed: "2026-03-14"
  tasks-completed: 2
  tasks-total: 2
  lines-created: 1272
---

# Phase 8 Plan 1: Receptionist Interface Summary

**One-liner:** Focused receptionist page with today's agenda by professional, phone client lookup, availability checker, and 3-step quick booking dialog — RECEPTIONIST role routed at /receptionist with automatic redirect on login.

## What Was Built

### Receptionist.jsx (697 lines)

Single-page receptionist interface with three sections:

**Today's Agenda (top, full width)**
- Fetches all bookings via `useQuery(['receptionist-bookings'])` with `refetchInterval: 30000`
- Filters client-side to today's date (compares `booking.startTime` ISO date slice to today)
- Groups bookings by `professionalId`, displayed as CSS grid columns (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`)
- Each column has professional name header + booking cards sorted by startTime
- Booking cards styled with STATUS_COLORS background/border/text (same constants as Calendar.jsx)
- Clicking a card opens `BookingDetailDialog` with status transition buttons (PATCH `/admin/bookings/:id/status`)
- "No bookings scheduled for today" empty state

**Client Lookup (bottom-left card)**
- Phone input + Search button
- Calls `apiFetch('/admin/clients/by-phone/' + encodeURIComponent(phone))`
- On found: shows name, phone, email; fetches `/admin/clients/:id/appointments` to find most recent `startTime` for "Last visit: DD/MM/YYYY"
- On 404: "Client not found" message
- Loading/error states

**Check Availability (bottom-right card)**
- Service dropdown (active services), professional dropdown (filtered by service assignment), date input (default today)
- "Check Slots" button: POST `/admin/bookings/availability`
- Shows slot grid or reason message (NOT_WORKING, FULLY_BOOKED)
- "Select a professional to check slots" helper text when no professional selected

### ReceptionistBookingDialog.jsx (575 lines)

3-step dialog for quick booking creation:

**Step 1 — Client:** Phone lookup identical to NewBookingDialog step 1. Found client shows name+phone with Select button. 404 triggers inline registration form (name, phone, email optional).

**Step 2 — Service & Slot:** Single scrollable view with three progressive sections:
- Service cards (highlighted on selection, allows re-selection)
- Professional cards (appear after service selected, filtered by service assignment)
- Date input + slot grid (appear after professional selected, availability query enabled)
- "Next" button enabled only when all four (service, professional, date, slot) are selected

**Step 3 — Confirm:** Summary table (SummaryRow pattern from NewBookingDialog) + "Confirm Booking" button that POST pre-reserves then PATCH confirms, then calls `onBookingCreated()`.

Step indicator: "Step N of 3 — Client | Service & Slot | Confirm". Back button on steps 2 and 3. Full reset on dialog close.

### App.jsx changes

- Added `import Receptionist from '@/pages/Receptionist'`
- Added `import { Navigate }` from react-router-dom
- Added `RootRedirect` component: reads `useAuthStore(s => s.user)`, returns `<Navigate to="/receptionist" replace />` if role is RECEPTIONIST, otherwise renders `<Dashboard />`
- Root `/` path now uses `<RootRedirect />` instead of `<Dashboard />` directly
- Added RECEPTIONIST route group as sibling to ADMIN group inside AppLayout children

## Commits

| Hash    | Message                                                                              |
| ------- | ------------------------------------------------------------------------------------ |
| 85a618b | feat(08-01): receptionist page with today's agenda, client search, availability check |
| 2033bd9 | feat(08-01): 3-step booking dialog and /receptionist route wiring                    |

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Check

- [x] Receptionist user logs in -> redirected to /receptionist (not admin dashboard)
- [x] Today's agenda displays bookings grouped by professional columns with status colors
- [x] Clicking a booking shows details and allows status transitions
- [x] Client search by phone returns name + last visit date
- [x] Availability checker shows open slots for selected service/date/professional
- [x] Quick booking dialog completes in 3 steps: client, service+slot, confirm
- [x] Vite build passes with no errors (697+575 lines, build in 540ms)

## Next Phase Readiness

This is the final plan of Phase 8 (Receptionist Interface) and the final phase of v2.0 Frontend milestone.

**v2.0 is COMPLETE.** All phases 5-8 shipped:
- Phase 5: Auth, layout, sidebar, dashboard
- Phase 6: Services, professionals, working hours
- Phase 7: Calendar, clients, booking management
- Phase 8: Receptionist interface
