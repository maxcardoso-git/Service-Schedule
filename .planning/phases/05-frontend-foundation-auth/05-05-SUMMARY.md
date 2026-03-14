---
phase: 05
plan: 05
subsystem: frontend-layout
tags: [react, react-router, tanstack-query, lucide-react, shadcn, layout, navigation, dashboard]
one-liner: "Role-filtered sidebar navigation (Admin vs Receptionist), AppLayout shell, and Dashboard with 4 live stat cards"

dependency-graph:
  requires: ["05-04"]
  provides: ["AppLayout", "Sidebar", "Header", "Dashboard"]
  affects: ["05-06", "05-07"]

tech-stack:
  added: []
  patterns:
    - NavLink with end prop for exact Dashboard match
    - Nested ProtectedRoute inside AppLayout for role guards
    - useQuery for dashboard stats fetch with loading/error states

file-tracking:
  created:
    - frontend/src/components/layout/AppLayout.jsx
    - frontend/src/components/layout/Sidebar.jsx
    - frontend/src/components/layout/Header.jsx
    - frontend/src/pages/admin/Dashboard.jsx
  modified:
    - frontend/src/App.jsx

decisions:
  - id: D-05-05-1
    what: "NavLink end prop on Dashboard path '/'"
    why: "Without end, Dashboard link stays active on all sub-routes (e.g. /admin/users)"
    impact: "Active state highlighting works correctly for all routes"

metrics:
  duration: "1m 19s"
  completed: "2026-03-14"
---

# Phase 05 Plan 05: Layout + Dashboard Summary

## What Was Built

Role-filtered application shell with AppLayout (Sidebar + Header + Outlet), and a Dashboard page fetching live stats from the API.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AppLayout, Sidebar, Header components | 3935666 | AppLayout.jsx, Sidebar.jsx, Header.jsx |
| 2 | Dashboard page + router update | fa1cf28 | Dashboard.jsx, App.jsx |

## Key Decisions Made

1. **NavLink `end` prop on Dashboard:** The root path `/` requires `end` so the Dashboard link isn't perpetually active for all child routes.
2. **Nested ProtectedRoute pattern:** `/admin/users` uses a second `ProtectedRoute` with `roles={['ADMIN']}` nested inside the outer `ProtectedRoute` + `AppLayout` layout hierarchy — matches the composability pattern established in 05-04.
3. **`useAuthStore.getState().logout()` in Header:** Imperative access (not reactive selector) matches the pattern established in 05-04 for logout and apiFetch operations.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm run build` passes with 0 errors on all task completions
- `grep "useQuery"` found in Dashboard.jsx
- `grep "AppLayout"` found in App.jsx
- Build output: 403 kB JS, 28 kB CSS

## Next Phase Readiness

- AppLayout shell is ready for all subsequent admin pages (05-06 onwards)
- Dashboard stat cards will populate once API endpoint is confirmed working
- `/admin/users` placeholder route is wired and role-guarded, ready for full Users page
