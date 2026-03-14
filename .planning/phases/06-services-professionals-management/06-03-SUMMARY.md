---
phase: 06-services-professionals-management
plan: 03
subsystem: ui
tags: [react, tanstack-query, shadcn, working-hours, professionals, dialog, switch]

# Dependency graph
requires:
  - phase: 06-02
    provides: Professionals.jsx CRUD page, controlled dialog pattern, row action button pattern
  - phase: 04-admin-api
    provides: PUT /admin/professionals/:id/working-hours endpoint (replaceWorkingHours)
provides:
  - WorkingHoursDialog component in Professionals.jsx
  - Weekly working hours grid (Mon-Sun) with per-day toggle and time inputs
  - PUT /admin/professionals/:id/working-hours called on save with enabled days only
  - Clock button in professional row Actions column
affects:
  - 07-scheduling-ui (availability engine reads workingHours — now configurable via admin UI)
  - 08-receptionist-ui (receptionist needs professionals' hours to show available slots)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - WorkingHoursDialog: load-on-open via apiFetch inside useState side-effect, defaultHours() factory for reset
    - DAY_DISPLAY_ORDER array controls Mon-first display while preserving 0-6 dayOfWeek values
    - Client-side time validation (startTime >= endTime string comparison for HH:MM format)
    - Filter-before-send pattern: only enabled days sent in PUT payload

key-files:
  created: []
  modified:
    - frontend/src/pages/admin/Professionals.jsx

key-decisions:
  - "DAY_DISPLAY_ORDER [1,2,3,4,5,6,0] drives render order (Mon first) without changing stored dayOfWeek values"
  - "defaultHours() factory function ensures each dialog open starts with clean state (no stale day data)"
  - "Client-side HH:MM string comparison suffices for startTime < endTime validation (format is always HH:MM from type=time input)"
  - "Only enabled days included in PUT payload — backend does full replacement so disabled days are implicitly removed"

patterns-established:
  - "Working hours grid pattern: DAY_LABELS + DAY_DISPLAY_ORDER + per-index state array + Switch + type=time inputs"

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 6 Plan 03: Working Hours Dialog Summary

**WorkingHoursDialog with Mon-Sun weekly grid — per-day enable/disable Switch, time range inputs, pre-load from GET /:id, and PUT /working-hours save with client-side validation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T15:07:43Z
- **Completed:** 2026-03-14T15:10:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `WorkingHoursDialog` component added to `Professionals.jsx` — controlled dialog receiving `professional` prop
- 7-row weekly grid displayed Mon→Sun (dayOfWeek 1-6, then 0) with day label, Switch toggle, start time, dash separator, end time
- Existing working hours loaded via `apiFetch('/admin/professionals/:id')` when dialog opens; days with no entry default to disabled/09:00-18:00
- Client-side validation: for each enabled day, startTime must be strictly before endTime (HH:MM string comparison)
- Save mutation: PUT `/admin/professionals/:id/working-hours` with `{ hours: [{dayOfWeek, startTime, endTime}] }` — disabled days excluded
- Clock icon button added to each professional row, triggering `setHoursProf(professional)`
- On success: invalidateQueries(['professionals']), toast.success, dialog closes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add WorkingHoursDialog to Professionals page** - `36a944b` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `frontend/src/pages/admin/Professionals.jsx` - Added DAY_LABELS, DAY_DISPLAY_ORDER, defaultHours factory, WorkingHoursDialog component, hoursProf state, Clock button in Actions column, WorkingHoursDialog render

## Decisions Made

- `DAY_DISPLAY_ORDER = [1,2,3,4,5,6,0]` drives display order (Monday first, Sunday last) without changing the stored `dayOfWeek` integer values (0=Sunday remains 0 throughout).
- `defaultHours()` is a factory function (not a constant) to ensure each dialog open receives a fresh mutable array — avoids shared reference bugs.
- Client-side `startTime >= endTime` string comparison is valid for `HH:MM` inputs from `<input type="time">` since the format is always zero-padded and lexicographic order matches time order.
- Only enabled days are sent in the PUT payload. The backend `replaceWorkingHours` does a full replacement (delete-then-insert), so disabled days are removed implicitly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Working hours are now fully configurable via admin UI
- Phase 7 (scheduling UI) can rely on workingHours data being populated by admins
- Availability engine has correct data source for generating booking slots

---
*Phase: 06-services-professionals-management*
*Completed: 2026-03-14*
