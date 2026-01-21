# Triple A Apps – Project Instructions

This document is a living brief. Keep it updated as product decisions are made.

## Current North Star (Jan 2026)

The apps must feel like **real services**: clean, professional, guided, and **visual-first**.

Non-negotiables from current context:

- **Each app must be clearly differentiated** at a glance.
  - Distinct purpose, distinct navigation, distinct visual identity.
  - Users should never wonder “what app am I in?” or “what page is this?”
- **Visual > text**.
  - Prefer images, cards, and clear hierarchy over paragraphs.
  - Text should be short labels + microcopy that guides the next action.
- **Trust-building UI**.
  - Consistent spacing, consistent components, clear primary actions.
  - Avoid "demo-ish" blocks of text; make the UI self-explanatory.
- **Professional visual language (no "hobby" UI)**.
  - Avoid glass/blur, heavy gradients, exaggerated shadows, and hover “lift” effects.
  - Prefer flatter surfaces, thin borders, restrained radii, and crisp typography.
  - Gold is for primary actions + important emphasis only.

## Design System Contract (Apple-inspired)

These rules exist to keep all three apps looking like real, professional services.

- **Single source of truth**: Use shared tokens + primitives from `packages/shared`.
  - Prefer `packages/shared/src/styles/global.scss` CSS variables for colors/surfaces/text.
  - Prefer `packages/shared/src/styles/primitives.module.scss` classes (`ui.card`, `ui.input`, `ui.help`, `ui.error`, `ui.section`, `ui.sectionTitle`, `ui.chip`).
- **No hardcoded UI colors in pages**: Avoid inline hex colors like `#020617`, `#374151`, `#9ca3af`, `#f87171` in app screens.
  - If something needs a new color/state, add a token (CSS variable) or a shared primitive class.
- **Gold discipline**: `#E59D0D` is reserved for primary actions and key emphasis only.
  - App identity (nav active, accents) should use the per-app accent (`--accent` / `--app-accent`), not gold.
- **Calm surfaces**: Prefer subtle borders and flat surfaces over loud contrasts.
  - Avoid dark “demo blocks” with thick borders; use cards with consistent padding.
- **Typography & spacing**: Short labels + microcopy; whitespace-first layout.
  - Avoid long paragraphs near the top of screens (especially in Muse).
  - Keep forms consistent: label → input → help/error.
- **Use real images** wherever possible.
  - Instruments and locations are already seeded with images and exposed via public image endpoints.
  - Frontends should display these images by default (not optional “later”).

This project contains a suite of three related apps built with Vite and TypeScript, targeting both mobile and desktop, for web and (ideally) standalone builds.

## Overview

- **Triple A Musician** – like the “Uber Driver” app for performers.
- **Triple A Music** – like “Uber Eats” for customers/organizers booking musicians and venues.
- **Triple A Muse** – like an “Uber Eats”-style web hub: interactive browse-first surface for Triple A offerings (rentals + services), plus clear funnels to Music (customers) and Musician (performers).
  - Implementation note (current repo direction): Muse is a **portal-first funnel**. It can preview inventory/services, but primary flows should route users into Music (hosts) or Musician (performers) rather than implementing a full marketplace checkout inside Muse.

### Differentiation rules (must follow)

- **Triple A Music (Hosts/Organizers)**
  - Job: post stages/locations, create gigs, discover/request musicians, manage bookings.
  - UI vibe: booking marketplace.
  - Visual cues: stage/location imagery, performer cards, “post gig” and “manage gigs” CTAs.

- **Triple A Musician (Performers)**
  - Job: see upcoming obligations, accept/decline, manage profile + direct-request settings, respond to inbound requests.
  - UI vibe: work dashboard.
  - Visual cues: status cards, “today/this week” focus, requests inbox.

- **Triple A Muse (Rentals & Services)**
  - Job: browse rentals/services and funnel users to the right app.
  - UI vibe: storefront.
  - Visual cues: strong catalog cards with images, category browsing, deals.
  - Implementation note: keep Muse **preview + funnels** by default; avoid blurring responsibilities with Music (booking) or Musician (performer ops).

The repository is organized into three sub-projects:

- `TripleAMusician/`
- `TripleAMusic/`
- `TripleAMuse/`

Each sub-project is intended to be a separate Vite + TypeScript app, sharing a common design system and types where possible.

## Tech Stack

- **Build tooling:** Vite
- **Language:** TypeScript
- **Target platforms:**
  - Responsive web (mobile + desktop)
  - Standalone builds (PWA, and/or wrappers such as Tauri/Electron for desktop and Capacitor for mobile)

> Note: These instructions assume a typical Vite + TypeScript SPA setup. I would like to use react for the UI layer.

## App Descriptions & Core Features

### 1. Triple A Musician (Performer app)

Goal: Give musicians a clear view of their work, performance quality, and perks.

Core concepts:

- **Profile & rating**
  - View / edit musician profile (name, instruments, genres, bio).
  - See current average star rating and recent reviews.
- **Bookings & obligations**
  - List of upcoming and past gigs (time, location, payout, dress code, set list requirements).
  - Detail view for each booking, including contact info for the organizer.
  - Ability to accept/decline new bookings and confirm arrival / completion.
- **Perks & rewards**
  - View perks based on rating or loyalty tier (e.g., embroidery for branding, free/discounted instrument rental, rehearsal room credits).
  - Clear rules for how to unlock or keep perks.
- **Notifications**
  - New booking requests, changes to existing bookings.
  - Perk unlocks, rating changes, and important system messages.

### 2. Triple A Music (Customer/Organizer app)

Goal: Help customers discover musicians and locations, then book them for events.

Core concepts:

- **Discovery & search**
  - Browse musicians by genre, location, rating, price range.
  - Filter by ensemble type (solo, band, DJ, etc.).
- **Event setup & booking**
  - Define event details (date, time, venue, budget, special requests).
  - See available musicians and locations that match.
  - Request and confirm bookings; view price estimates and final quotes.
- **Booking management**
  - List of upcoming and past events.
  - Status for each booking (requested, confirmed, in progress, completed, cancelled).
  - Messaging channel with musicians/venues.
- **Ratings & reviews**
  - Rate musicians and venues after events.
  - View historical ratings when choosing performers.

### 3. Triple A Muse (Marketplace & services app)

Goal: Be the interactive, browse-first "front door" (web) for Triple A offerings and funnels.

Key positioning (as clarified by owner):

- Muse is the place for people who want Triple A’s services directly (rentals/lessons/logistics).
- Music is the official consumer marketplace to book musicians/venues for events (customers should generally end up there).
- Musician is the performer onboarding + work app (sign up to perform; payout setup; profile; gigs/workflow).

Core concepts:

- **Instrument rental**
  - Browse instruments and equipment (e.g., guitars, keyboards, PA systems, lighting).
  - View rental terms, availability calendar, and pickup/delivery options.
- **Lessons & coaching**
  - Find teachers for instruments, voice, songwriting, production, and performance coaching.
  - Book 1:1 or group sessions (in-person or online).
- **Stage & event services**
  - "Logistics" here is service work (event coordination): decorations, acoustics, security coordination, on-site support, etc.
  - Important nuance: logistics/setup are not “rental gear” (owner explicitly does not want to rent out speakers/mics).
  - Offer package plans that can be customized.
- **Unified user identity**
  - Same user can be a performer, customer, and service consumer.
  - Single account with roles/permissions determining what they can list, rent, or book.

## Owner Alignment (Jan 2026)

This section summarizes a direct conversation with the owner and is the current north-star for UX and product shape.

### What the owner asked for (high signal)

- **Muse should feel like Uber Eats / Pizza Hut**:
  - Interactive and self-explanatory when read top-to-bottom.
  - Offerings up front with simple labels and intuitive layout.
  - Less “explaining” at the top; the explainer belongs at the bottom.
- **Category bar for rentals**:
  - Instruments should be front-and-center with a category chip bar.
- **Deals / package plans** (Pizza Hut “deals” model):
  - Curated packages (e.g., logistics bundles) that users can customize.
  - Users can remove items and modify what’s included.
- **Funnel strategy / cross-app relationships**:
  - Muse should advertise and link to:
    - Triple A Music (consumer marketplace: find musicians/venues for weddings/cruises/funerals, etc.).
    - Triple A Musician (performer sign-up / onboarding and performer work app).
  - Music + Musician should be installable “apps”; their websites can be more mission/marketing oriented.
- **Tiering**:
  - Rentals = entry-level.
  - Lessons = step up.
  - Logistics/performance services = highest tier.
- **Inventory reality check**:
  - Owner currently has instruments (drums, trumpets, violins, clarinets, electric/acoustic guitars, keyboards/pianos).
  - Pricing can be placeholders initially; owner expects to edit later.
- **Brand assets**:
  - Owner has a logo to provide (email/text).

### UX rules to follow in Muse (non-negotiable)

- Make Muse **browse-first**: categories + featured rows + deals/packages first.
- Keep the interface clean and uncluttered:
  - Default to fewer cards on first paint and expand via interaction.
  - Avoid long explanatory blocks near the top.
- Put "Everything around the gig — handled." and the explanatory mission copy at the bottom.
- Keep labels simple (one- to two-word category/service labels where possible).

### Clarifications / assumptions for implementation

- Logistics packages are service bundles (event-coordinator style), not gear rentals.
- If rentals are shown, focus on the owner’s actual rentable inventory and do not invent unrelated rental categories.
- The overall system still supports a marketplace (Music) and performer workflow (Musician), but Muse’s job is to funnel users to the right app.

## Cross-App Considerations

- **Overarching Product Split (Non-Negotiable)**
  - Each app has a distinct “job to be done”:
    - Musician = performer onboarding + work app (profile, gigs, obligations, perks).
    - Music = consumer marketplace (discover → request → confirm → manage event).
    - Muse = interactive web hub for rentals/lessons/logistics + funnels to Music/Musician.
  - Muse should not become a second “Music” marketplace UI; it should advertise/route users to the right experience.
  - When implementing pages, copy, nav, and access controls, do not blur these responsibilities across apps.
  - Admin/employee operations support the whole ecosystem, but should not change the above product split.

- **Shared Design System**
  - Common UI components (buttons, forms, navigation) and theme across all three apps.
  - Shared typography, color palette, and spacing for a cohesive brand.

- **Shared Types & APIs**
  - Central definitions for core entities: `User`, `MusicianProfile`, `Booking`, `Event`, `Instrument`, `Location`, `Perk`.
  - Reuse API client utilities across apps (authentication, bookings, payments).

- **Authentication & Accounts**
  - Unified sign-in system (email/password, social login, or magic links).
  - Role-based access: musicians, customers, admins, teachers, rental providers.

- **Admin & Moderation**
  - Dedicated admin view/dashboard for managing all users and content.
  - Create, edit, and deactivate employee and musician accounts.
  - Moderate profiles, listings, reviews, and reported content.
  - Create and assign subcontractor tasks (e.g., delivering music supplies, transporting instruments, on-site support) and track their status.

  - **Employee onboarding rule:** employees must never be able to invite other employees (invite creation/revocation is admin-only behavior).

- **Platform Strategy**
  - Design all UIs mobile-first, then enhance for larger screens.
  - Ensure PWA capabilities (offline basics, installable on mobile/desktop) as a baseline.
  - Optionally wrap each app:
    - Desktop: Tauri or Electron.
    - Mobile: Capacitor or similar.

## Development Guidelines

- Use Vite + TypeScript for each app under its respective folder.
- Keep shared logic in a dedicated shared package or folder (e.g. `packages/shared/`).
- Aim for clear separation of concerns: UI components, domain models, and API access should be modular and reusable.
- Avoid multi-thousand-line React files.
  - Prefer `src/pages/*` for route-level screens and `src/components/*` for reusable UI.
  - Prefer small hooks/utilities (`src/lib/*`, `src/hooks/*`) over repeating logic inline.

## UI Implementation Guidelines (working rules)

- Prefer shared primitives/components over per-page inline styling.
- Each app should set an explicit app identity for theming (e.g., app-specific accent/glow).
- Default aesthetic: flat, professional, service-provider UI (minimal gradients/shadows; restrained rounding).
- Use image-first cards:
  - Muse: instruments must show images.
  - Music: locations/stages should show images when available.
  - Musician: use a strong, clean dashboard layout; avoid long copy.
- Every page should have a clear title that describes the page (not just the app name).

## Demo & Seeding Expectations

- Demo users must always exist when `SEED_DEMO_DATA=true` with password `test`:
  - `admin@admin.com`
  - `music@music.com`
  - `musician@music.com`
  - `muse@music.com`
- Seeded instruments and locations include images.
  - Public endpoints provide `imageUrl` and image binary routes (e.g. `/api/public/instruments/:id/images/0`).

This document is meant as a living brief. As the project evolves, update it with more specific UX flows, API contracts, and implementation details so collaborators (including your friend) can quickly understand the vision and structure.

# PLEASE VIEW ./github/discord-chat-history.md FOR THE ACTUAL CONVERSATION(S) THAT LED TO THE THESE INSTRUCTIONS BEING DERIVED AND THE OVERALL GOAL OF THE APPLICATION. IF THERE ARE CONFLICTIONS WITH THE MOST RECENT CHAT HISTORY, PLEASE PRIORITIZE THE CHAT HISTORY MARKDOWN DOCUMENT AND UPDATE THE COPILOT INSTRUCTIONS IN ACCORDANCE. ANYTHING NOT MENTIONED IN THE CHAT HISTORY BUT WRITTEN HERE SHOULD BE CONSIDERED SECONDARY AND SUBJECT TO CHANGE BASED ON THE CHAT HISTORY, HOWEVER NOT IMMEDIATLEY INCORRECT. JUST NOTE THIS IS A WORKING DOCUMENT AND THINGS CHANGE, YOU MAY EDIT THIS DOCUMENT AS NEEDED BASED ON THE CHAT HISTORY AND NEW INSTRUCTIONS FROM THE USER, HOWEVER BE VERY CAREFUL ABOUT REMOVING THINGS THAT MAY BE "UNNECESSARY" BECAUSE THEY WERE NOT MENTIONED IN THE CHAT HISTORY. IF YOU ARE UNSURE, PLEASE ASK THE USER FOR CLARIFICATION. THANK YOU!

The color palette I would like to use is:

- Dark Blue Accent #1C276E
- Light Blue Accent #ADB8E0
- Gold Accent #E59D0D
- Light Purple Accent #825ECA
- Dark Purple Accent #4E238B
- Gray Neutral Main #4B4E63
- White Main (Light Mode) #FFFFFF
- Black Main (Dark Mode) #000000

The gold is what should be used to highlight primary actions and important information. The blues and purples can be used for secondary actions and borders, double borders #4B4E63, backgrounds, and accents [as their names imply]. The gray neutral is for text and less prominent elements. The white and black are for the main backgrounds in light and dark modes, respectively. The other main color should be the default text color in that color mode (e.g. dark mode has black backgrounds with white text).
