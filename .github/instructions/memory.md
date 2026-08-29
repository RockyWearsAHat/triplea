# triplea — Living Codebase Notes

This file is the **living memory** for this repository.

Goal: keep a compact, accurate, _high-signal_ reference so future work does **not** require repeatedly rescanning the entire tree.

## One-paragraph overview

Triple A Apps is a three-app suite (Muse, Musician, Music) built with Vite + TypeScript + React, targeting responsive web and PWA. Muse is the DIY event coordinator / front door. Musician is the performer work dashboard. Music is the premium marketplace / music label. All three share a backend (Node/Express + MongoDB) and a common design system in `packages/shared`.

## Top-level layout

```
TripleAMuse/          # Vite + React app — DIY event coordinator (top priority)
TripleAMusician/      # Vite + React app — performer work dashboard
TripleAMusic/         # Vite + React app — premium marketplace / ticket sales
packages/shared/      # Shared types, API client, design tokens, primitives
server/               # Node/Express + MongoDB backend (all three apps)
.github/              # Agents, instructions, plan.md, bugs.md, plan_todos.md
```

## Build system

- Root `package.json` has workspace scripts: `npm run dev:muse`, `npm run dev:musician`, `npm run dev:music`, `npm run dev:server`
- Each app: `vite build` / `vite dev`
- Shared: `packages/shared` built with tsc; consumed via workspace alias

## Key subsystems

- **packages/shared/src/styles/global.scss** — CSS custom property tokens (colors, spacing, typography, radius, shadow)
- **packages/shared/src/styles/primitives.module.scss** — shared UI primitives (`.card`, `.input`, `.chip`, `.section`, `.hero`, etc.)
- **packages/shared/src/api/client.ts** — API client shared by all three frontends
- **server/src/models/** — Mongoose models: User, MusicianProfile, Booking, Gig, Instrument, Location, TicketSeat, Perk
- **server/src/routes/** — Express route handlers organized by domain

## Design tokens (critical)

- Never hardcode colors. Use `var(--token)` from `global.scss`.
- `--primary` / `var(--taa-gold-500)` `#E59D0D` — primary actions ONLY (buttons, key emphasis)
- `--accent` — per-app accent color (set in each app's root, NOT gold)
- `--surface`, `--border`, `--text`, `--text-muted` — for cards, dividers, copy
- Full token map is documented in `Style.agent.md`

## Demo seed users (password: `test`)

```
admin@admin.com     — admin role
music@music.com     — customer/host
musician@music.com  — musician
muse@music.com      — general user
```

Seeded only when `SEED_DEMO_DATA=true`.

## Tests

- TDD discipline: docs → tests → implementation (see `instructions/tdd.md`)
- Run targeted tests first, then broaden
- Test files live alongside source or in `server/src/__tests__/`

## Seating layout editor + AI analysis

- **Feature:** Host uploads a venue floor plan image → Qwen 2.5 VL analyzes it → returns zone suggestions (stage, seating_zone, aisle, entrance as % bounding boxes) → editor displays overlays → user accepts zones → seat rows are auto-generated within each zone.
- **Route:** `POST /api/seating/layouts/:layoutId/analyze-image` in `server/src/routes/seating.ts` (~line 1125)
- **Image resize:** `sharp@0.34.5` resizes image to ≤ 800 px before base64 encoding. Without this, a 4K image = 6–12 MB base64 — kills context window, causes 5–10 min generation + bad coordinates.
- **Transport:** `http.request` (Node.js built-in) with 12-min hard timeout. NOT global `fetch()` — undici's 300 s `bodyTimeout` would kill the call.
- **Coordinate system:** xPct/yPct = top-left corner as 0–100 integer % of image dimensions.
- **Qwen edge case:** Model sometimes returns 0.0–1.0 fractions instead of integers. Server auto-multiplies by 100 when max coordinate ≤ 1.0.
- **Full reference:** `.github/instructions/seating-ai.md`
- **Editor:** `TripleAMusic/src/pages/SeatLayoutEditorPage.tsx` — Photoshop-style layout (top bar, left tool strip, canvas, right panel, status bar)

## Known issues / TODOs

- Update this file whenever a significant architectural change is made.
- See `.github/plan_todos.md` for in-progress / pending work items (requires user go-ahead before any agent picks them up).
