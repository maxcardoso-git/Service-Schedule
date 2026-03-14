---
phase: 05
plan: 03
subsystem: frontend-infrastructure
tags: [vite, react, tailwindcss, shadcn-ui, jsx]

dependency-graph:
  requires: ["05-01"]
  provides: ["frontend project scaffold", "Tailwind v4 CSS pipeline", "shadcn/ui components", "path alias @/", "API proxy"]
  affects: ["05-04", "05-05", "05-06", "05-07"]

tech-stack:
  added:
    - vite@8.0.0
    - react@19
    - "@vitejs/plugin-react@6"
    - tailwindcss@4.2.1
    - "@tailwindcss/vite@4.2.1"
    - react-router-dom@7
    - "@tanstack/react-query@5"
    - zustand@5
    - lucide-react
    - class-variance-authority
    - clsx
    - tailwind-merge
    - sonner
    - "@base-ui/react"
    - tw-animate-css
    - "@fontsource-variable/geist"
    - shadcn@4.0.6
  patterns:
    - CSS-first Tailwind v4 configuration via @import in app.css
    - shadcn/ui base-nova style with JSX (no TypeScript)
    - Path alias @/ via Vite resolve.alias + jsconfig.json
    - API proxy /api -> localhost:3100 in development

key-files:
  created:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/vite.config.js
    - frontend/jsconfig.json
    - frontend/components.json
    - frontend/index.html
    - frontend/src/app.css
    - frontend/src/lib/utils.js
    - frontend/src/components/ui/button.jsx
    - frontend/src/components/ui/card.jsx
    - frontend/src/components/ui/input.jsx
    - frontend/src/components/ui/label.jsx
  modified:
    - frontend/src/main.jsx
    - frontend/src/App.jsx

decisions:
  - id: legacy-peer-deps
    choice: "--legacy-peer-deps for @tailwindcss/vite install"
    rationale: "@tailwindcss/vite@4.2.1 declares peer dep on vite ^5||^6||^7 but works fine with Vite 8; upstream hasn't updated peer dep range yet"
  - id: shadcn-style
    choice: "base-nova style (shadcn default)"
    rationale: "shadcn init --defaults selected base-nova; no tsx since jsx: false in config"
  - id: shadcn-add-overwrite
    choice: "npx shadcn@latest add ... -o (overwrite flag)"
    rationale: "--force is not a valid flag in shadcn@4.0.6; -o overwrites existing files"

metrics:
  duration: "~3 min"
  tasks-completed: 2
  completed: "2026-03-14"
---

# Phase 5 Plan 3: Frontend Scaffold (Vite + Tailwind v4 + shadcn/ui) Summary

**One-liner:** Vite 8 + React 19 project with Tailwind v4 CSS-first config, shadcn/ui base-nova components (Button/Card/Input/Label), @/ path alias, and /api proxy to backend port 3100.

## What Was Built

The complete frontend project foundation under `frontend/`:

- **Vite 8 + React 19** project created via `npm create vite@latest`
- **Tailwind v4** installed via `@tailwindcss/vite` plugin (CSS-first, no `tailwind.config.js`)
- **`frontend/src/app.css`** — `@import 'tailwindcss'` + `@theme inline` with full shadcn token set + `:root` CSS variables in oklch
- **`frontend/src/lib/utils.js`** — exports `cn()` using clsx + tailwind-merge
- **`frontend/components.json`** — shadcn config (base-nova style, jsx, cssVariables, alias @/)
- **shadcn/ui components** — button.jsx, card.jsx, input.jsx, label.jsx (all JSX, no TypeScript)
- **`frontend/vite.config.js`** — Tailwind plugin, @/ alias, port 5173, proxy /api -> localhost:3100
- **`frontend/jsconfig.json`** — paths for editor alias resolution
- **`frontend/src/App.jsx`** — entrypoint with Tailwind layout and shadcn Button smoke test
- **Build verified:** `npm run build` produces dist/ in 953ms, 46 modules transformed

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create Vite project with all dependencies | ea11bb3 | package.json, vite.config.js, jsconfig.json |
| 2 | Tailwind v4 + shadcn/ui setup | 552b19a | src/app.css, src/lib/utils.js, components.json, ui/*.jsx |

## Decisions Made

1. **`--legacy-peer-deps` for Tailwind/shadcn installs** — `@tailwindcss/vite@4.2.1` and `shadcn@4` run their own `npm install` internally. Solution: pre-install all deps with `--legacy-peer-deps`, then use shadcn CLI for file generation only.

2. **shadcn base-nova style** — Default style from `shadcn init --defaults`. Button uses `@base-ui/react/button` as primitive; no custom theme override needed at scaffold stage.

3. **JSX (no TypeScript)** — `tsx: false` in components.json matches project's pure JS approach throughout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@tailwindcss/vite` peer dep conflict with Vite 8**

- **Found during:** Task 1
- **Issue:** `@tailwindcss/vite@4.2.1` declares `peerDependencies: { vite: "^5.2.0 || ^6 || ^7" }` but Vite 8 was installed by `npm create vite@latest`. Standard `npm install` failed.
- **Fix:** Used `--legacy-peer-deps` for all installs; the plugin is functionally compatible with Vite 8 (build succeeds).
- **Files modified:** frontend/package-lock.json

**2. [Rule 3 - Blocking] `shadcn init --force` failed; shadcn internal npm install conflict**

- **Found during:** Task 2
- **Issue:** `npx shadcn@latest init --defaults --force` ran `npm install` internally without `--legacy-peer-deps`, hitting the same Vite 8 peer dep conflict. Components were not generated.
- **Fix:** Pre-installed shadcn's required deps (`tw-animate-css`, `@base-ui/react`, `@fontsource-variable/geist`) with `--legacy-peer-deps`. Then ran `npx shadcn@latest add button card input label -o` which only writes files (no secondary npm install).
- **Files modified:** frontend/package.json, components.json created correctly

**3. [Rule 1 - Bug] `--force` not valid flag for `shadcn add`**

- **Found during:** Task 2
- **Issue:** `npx shadcn@latest add button card input label --force` returned `error: unknown option '--force'`. shadcn@4.0.6 uses `-o` (overwrite) instead.
- **Fix:** Used `-o` flag instead.

## Next Phase Readiness

- **05-04 and beyond** can import from `@/components/ui/*` and `@/lib/utils`
- All routing, query, and state libraries installed (react-router-dom, @tanstack/react-query, zustand)
- Proxy configured: `/api/*` → `localhost:3100` during `npm run dev`
- Build pipeline verified end-to-end
