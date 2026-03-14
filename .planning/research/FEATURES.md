# Feature Landscape: Scheduling Admin & Receptionist Interfaces (v2.0)

**Domain:** Beauty salon scheduling platform — admin dashboard + receptionist interface
**Researched:** 2026-03-13
**Overall confidence:** MEDIUM-HIGH
**Context:** Backend API fully shipped (v1.0). This research covers the frontend layer only.

---

## Table Stakes

Features users expect. Missing any of these = product feels incomplete or unprofessional.

### Admin Interface

| Feature | Why Expected | Complexity | Backend Support | Notes |
|---------|--------------|------------|-----------------|-------|
| **Calendar view (day + week)** | Core mental model for scheduling — admins think in calendar, not lists | High | `GET /api/bookings` returns bookings with startTime/endTime | Most complex UI component. Day and week views are essential; month view is secondary. Need to render bookings as blocks on a time grid, per-professional columns. |
| **Booking list with filters** | Need to find/manage bookings by status, date range, professional, client | Medium | `GET /api/bookings` supports query params | Filters: status (PRE_RESERVED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW), date range, professional, client. Complement to calendar view. |
| **Create booking manually** | Walk-ins, phone bookings | Medium | `POST /api/bookings`, `PATCH /:id/confirm` | Flow: select client (search or create) -> pick service -> pick professional -> pick slot -> confirm. Multi-step form or wizard. |
| **Cancel booking** | Cancellations happen daily | Low | `PATCH /api/bookings/:id/cancel` exists | Confirmation dialog, update calendar in real-time. |
| **Services CRUD** | Admin must manage what salon offers | Medium | `POST/PUT/PATCH /api/admin/services` exist | Table view with inline edit or modal. Fields: name, duration, price, active toggle, professional assignment. |
| **Professionals CRUD** | Manage staff roster | Medium | Full CRUD at `/api/admin/professionals` | Table view. Fields: name, contact info, active toggle, assigned services. |
| **Professional-service assignment** | Control who does what | Low | `POST/DELETE /api/admin/professionals/:id/services` | Multi-select chips UI on professional edit form. |
| **Working hours management** | Define when each professional is available | Medium | `PUT /api/admin/professionals/:id/working-hours` | Visual weekly grid (Mon-Sun) with start/end time per day. This is where admins spend significant time. |
| **Client list with search** | Look up clients, view history | Low-Medium | `GET /api/clients/by-phone/:phone`, `GET /api/clients/:id/appointments` | Search by phone (primary). Paginated list. Click to see appointment history. **Gap: no `GET /api/clients` list endpoint exists.** |
| **Client registration** | Add walk-in clients | Low | `POST /api/clients` exists | Simple form: name (required), phone (required), email (optional). |
| **Login page + session management** | Security baseline | Medium | `POST /api/admin/auth/login` returns JWT | Login form, JWT storage, auto-redirect on expiry, logout. |
| **Role-based access control** | Admin vs receptionist see different things | Medium | **Gap: AdminUser has no `role` field** | Need schema migration to add role. Frontend route guards + conditional nav. |
| **Booking status transitions** | Mark as completed, no-show at end of day | Low-Medium | **Gap: no generic status transition endpoint** | Need `PATCH /api/bookings/:id/status` or extend confirm/cancel pattern. States: CONFIRMED->COMPLETED, CONFIRMED->NO_SHOW. |

### Receptionist Interface

| Feature | Why Expected | Complexity | Backend Support | Notes |
|---------|--------------|------------|-----------------|-------|
| **Today's agenda view** | Receptionist needs at-a-glance daily schedule | Medium | `GET /api/bookings` filtered by date | Timeline showing all bookings for today, grouped or split by professional. Simpler than full calendar — single day, focused layout. |
| **Quick booking flow** | Speed is key for phone/walk-in bookings | Medium | `POST /api/bookings` + `PATCH /:id/confirm` | Streamlined 3-step flow: (1) client phone lookup, (2) service + slot picker, (3) confirm. Fewer clicks than admin. |
| **Client search by phone** | Phone is the primary identifier at front desk | Low | `GET /api/clients/by-phone/:phone` exists | Phone input with mask, auto-search on complete number. Show client name + last visit date. |
| **Slot availability check** | "When can I come in?" is the #1 question | Low | `POST /api/bookings/availability` exists | Show available times for selected service. Professional optional. |
| **Arrival check-in indicator** | Know which clients have arrived | Low | Status field on booking | Visual marker (e.g., highlight row) when client checks in. Simple toggle. |

---

## Differentiators

Features that improve the experience noticeably. Not expected, but valued.

| Feature | Value Proposition | Complexity | Backend Support | Notes |
|---------|-------------------|------------|-----------------|-------|
| **Dashboard KPI cards** | Revenue today, booking count, no-show rate, occupancy % | Medium | **Gap: needs aggregation endpoint** `GET /api/admin/dashboard/stats` | Admin-only. 4-5 metric cards at top of dashboard. Very high perceived value, moderate backend work. |
| **Color-coded booking statuses on calendar** | Instant visual status recognition | Low | Status enum exists in BookingStatus | PRE_RESERVED=yellow, CONFIRMED=blue, COMPLETED=green, CANCELLED=gray, NO_SHOW=red. Pure frontend. |
| **Drag-and-drop reschedule on calendar** | Intuitive rescheduling without forms | High | **Gap: needs reschedule endpoint** `PUT /api/bookings/:id` | Calendar libraries (FullCalendar, etc.) support this natively. High UX impact. Requires new API endpoint. |
| **Quick client history popup** | See last 5 visits without navigating away | Low | `GET /api/clients/:id/appointments` exists | Popover/tooltip on client name. No page change. Fast context. |
| **Professional utilization view** | See how busy each professional is today/week | Medium | Derived from bookings + working hours | Percentage bar per professional. Helps admin balance load. |
| **Booking notes** | Internal notes per appointment (preferences, special requests) | Low | `notes` field exists on Booking model | Simple textarea on booking form. Already supported in schema. |
| **Bulk working hours template** | "Apply Monday schedule to all weekdays" | Low | Extend existing working hours PUT | Common UX pattern. Saves significant admin setup time. |
| **Payment status badge on bookings** | See if booking is paid at a glance | Low | Payment model linked to Booking (1:1) | Small badge/icon on booking card/row. PIX status: PENDING/PAID/CANCELLED. |
| **Print daily agenda** | Paper backup for front desk | Low | Pure client-side (CSS print) | Still common in Brazilian salons. Simple print stylesheet for today's view. |
| **Responsive layout (tablet)** | Receptionist often uses tablet at front desk | Medium | N/A (frontend only) | Not full mobile — tablet landscape is the priority form factor for receptionists. |

---

## Anti-Features

Features to explicitly NOT build in v2.0. Common in salon software but wrong for this project/stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Online client self-booking portal** | The AI agent (via OrchestratorAI) IS the self-booking interface. A separate portal duplicates the booking channel and creates sync issues. | All client-facing booking goes through OrchestratorAI AI agents. Admin/receptionist interfaces are staff-only. |
| **SMS/WhatsApp notification system** | Infrastructure complexity (SMS gateways, WhatsApp Business API), per-message cost, and OrchestratorAI already handles client communication. | Defer entirely. OrchestratorAI agents communicate with clients through existing channels. |
| **Loyalty/rewards program** | Scope creep. Adds models, complex UI, business rules with unclear ROI at this stage. | Visit count is derivable from appointment history. Build loyalty in v3+ if validated. |
| **Inventory/product management** | This is a scheduling system, not a retail POS. Product inventory is a different product domain. | Out of scope entirely. Use separate retail system if salon sells products. |
| **Financial reports / accounting** | Complex domain (taxes, expenses, profit margins). Payment is simulated PIX only. | Show simple revenue summary derived from bookings. No expense tracking, no tax calculations. |
| **Multi-location support** | Single salon deployment. Multi-location adds tenant isolation throughout every query and every UI. | Keep single-tenant. Architecture allows adding later but do not build now. |
| **Staff payroll / commission** | HR/payroll is a separate domain with legal/tax implications. | Show service counts per professional for manual payroll calculation. |
| **Automated marketing** | Email campaigns, birthday messages, re-engagement — separate product category entirely. | Not in scope. |
| **Complex recurring appointments** | Weekly standing appointments with exception handling is deceptively complex (holidays, conflicts, cancellation of one instance vs series). | Support single bookings only. Receptionist manually books recurring clients each visit. |
| **Waitlist management** | Adds a full state machine (waitlist -> offered -> accepted/declined -> booked) with timeout logic. | v3+ consideration. Receptionist manually calls next client when slot opens. |
| **Real-time WebSocket updates** | Adds infrastructure layer (WebSocket server, connection management, reconnection logic). Two concurrent users (admin + receptionist) do not justify the complexity. | Use polling or manual refresh. If needed later, add as incremental upgrade. |
| **Dynamic/surge pricing** | Adds UX complexity, confuses AI conversations, requires complex pricing rules engine. | Single price per service. Period. |

---

## Feature Dependencies

```
Auth + Roles (AdminUser.role) ──────────────────────────┐
                                                         v
                                            ┌─── Role-Based Routing ───┐
                                            v                           v
                                       Admin Shell                 Receptionist Shell
                                            |                           |
                    ┌───────────────────────┼──────────┐               |
                    v                       v          v               v
             Services CRUD          Professionals   Calendar      Today's Agenda
                    |                CRUD + Hours    View (d/w)     (single day)
                    |                       |          |               |
                    v                       v          v               v
             Service-Professional    Working Hours   Booking       Quick Booking
             Assignment              Weekly Grid    Management     Flow
                                                       |               |
                                                       v               v
                                                  Client Search ◄──────┘
                                                  + Registration
                                                       |
                                                       v
                                                  Client History
                                                  + Booking Details
```

**Key dependency chains:**

1. **Auth + Role must come first** — everything requires login, role determines which shell loads
2. **Services + Professionals before Calendar** — calendar booking forms need service/professional data for dropdowns
3. **Calendar is the admin centerpiece** — most admin time is spent here
4. **Today's Agenda is the receptionist centerpiece** — simplified calendar derivative
5. **Client search is shared** — used by both admin and receptionist during booking creation
6. **Working hours before slot availability** — slots are computed from working hours minus existing bookings

---

## Backend Gaps (New Endpoints/Schema Changes Required)

| Gap | What's Needed | Priority | Blocks |
|-----|---------------|----------|--------|
| AdminUser role field | Add `role` enum (ADMIN, RECEPTIONIST) to AdminUser model + migration | **Critical** | All role-based routing |
| Client list endpoint | `GET /api/clients` with pagination, search by name/phone | **High** | Admin client management page |
| Client update endpoint | `PUT /api/clients/:id` | Medium | Client profile editing |
| Generic status transition | `PATCH /api/bookings/:id/status` (body: `{status}`) or individual endpoints per transition | **High** | Marking completed / no-show |
| Reschedule endpoint | `PUT /api/bookings/:id` (change startTime, endTime, professionalId) | Medium | Drag-drop reschedule, edit booking |
| Dashboard aggregation | `GET /api/admin/dashboard/stats` (counts, revenue by period) | Medium | KPI dashboard cards |
| Receptionist user creation | Admin CRUD for AdminUser (create receptionist accounts) | **High** | Receptionist can't use system without account |

---

## MVP Recommendation

### Must Ship (Table Stakes) — ordered by dependency

1. **Auth + role system** — AdminUser.role migration, login page, JWT session, role-based routing
2. **Admin user management** — create/edit receptionist accounts (admin only)
3. **Services CRUD UI** — table view with create/edit/deactivate
4. **Professionals CRUD + working hours** — table view, service assignment, weekly schedule grid
5. **Calendar view (day + week)** — per-professional columns, booking blocks, status colors
6. **Booking creation flow** — client search/create -> service -> professional -> slot -> confirm
7. **Booking status management** — confirm, cancel, complete, no-show transitions
8. **Client search + registration + history** — phone search, quick registration, appointment list
9. **Receptionist today view** — simplified daily agenda grouped by professional
10. **Receptionist quick booking** — streamlined 3-step flow optimized for speed

### Should Ship (High-value, Low-effort Differentiators)

11. **Color-coded booking statuses** — pure frontend, zero backend work
12. **Booking notes field** — schema already supports it, just add textarea
13. **Payment status badge** — data already linked, just display it
14. **Quick client history popup** — endpoint exists, add popover UI
15. **Dashboard KPI cards** — needs one aggregation endpoint, high perceived value

### Defer to Post-MVP

- Drag-and-drop rescheduling (needs new endpoint + complex interaction)
- Professional utilization analytics (derived metrics, secondary value)
- Responsive tablet layout (optimize later based on actual usage)
- Print daily agenda (CSS only but low priority)
- Bulk working hours template (convenience, not critical)

---

## Sources

- [10 Must-Have Features in Salon Software Management for 2026 - Zylu](https://zylu.co/10-must-have-features-salon-software-management-2026/)
- [Top Salon Software Features for 2026 | Zylu](https://zylu.co/top-salon-software-features-2026/)
- [Top 7 Features Every Salon Software Must Have in 2026](https://salon360app.com/business-management/7-features-every-salon-software-must-have-in-2026/)
- [10 Must-Have Salon Software Features | Mangomint](https://www.mangomint.com/blog/salon-software-features/)
- [9 Essential Online Booking System Features | Booknetic](https://www.booknetic.com/blog/essential-online-booking-system-features)
- [9 Best Salon Software in 2026 | TheSalonBusiness](https://thesalonbusiness.com/best-salon-software/)
- [Essential Features of Appointment Booking Software | Queueme](https://queueme.io/blog/Essential-Features-of-an-Appointment-Booking-Software.html)
- [Zenoti Salon Management Software](https://www.zenoti.com/salon-management-software)
- [9 Essential Beauty Salon Management Software Picks 2026](https://www.salonbookingsystem.com/salon-booking-system-blog/best-beauty-salon-management-software/)

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Admin table stakes | HIGH | Universal across Zenoti, Fresha, Square, Mangomint — every salon platform has these |
| Receptionist table stakes | HIGH | Well-established front-desk workflow patterns |
| Differentiators | MEDIUM | Based on competitive analysis + UX best practices |
| Anti-features | HIGH | Clear project context (AI agent is the client channel, not a web portal) |
| Backend gaps | HIGH | Direct analysis of existing Prisma schema + route files |
| MVP ordering | MEDIUM-HIGH | Based on dependency analysis; could shift based on team priorities |

---
*Research completed: 2026-03-13*
