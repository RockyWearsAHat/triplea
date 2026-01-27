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
- **Triple A Muse** – the **front door** for the Triple A Music brand: a clean overview + routing hub that funnels users into Music (hosts) or Musician (performers).
  - Implementation note (current repo direction): Muse is an **in-between**. It can preview support offerings (rentals/services) and explain “what Triple A is”, but primary workflows live in Music (booking/tickets) and Musician (performer ops).

### Product Analogy (from owner - Jan 2026 Discord)

The owner made the following analogy that defines the product split:

- **Uber** = the customer app (people ordering rides)
- **Uber Driver** = the performer/driver app (people working)
- **Uber Eats** = the premium marketplace (like McDonald's delivering)

Applied to Triple A:

| App                   | Analogy     | Purpose                                                                                                                                                                                           |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Triple A Muse**     | Uber (DIY)  | "Put together your own event" - Select event type (wedding, funeral, cruise, party), select performers (drummer, pianist, vocalist), select venue, select packages. Like building your own order. |
| **Triple A Musician** | Uber Driver | "Work dashboard" - See incoming requests, accept/decline gigs, manage schedule, view earnings, track perks. Driver-app feel.                                                                      |
| **Triple A Music**    | Uber Eats   | "Premium showcase" - Curated events, promoted artists, ticket sales. Like McDonald's menu - you see what's on offer and buy tickets. Owner hand-picks what's featured.                            |

Key insight from owner: "Music is less important based on how it doesn't exist without Muse or Musician, but it's more important in that it will make more money than both of them combined based on the opportunities created by both of them."

**Priority order**: Muse > Musician > Music (per owner: "Muse is basically the top priority, then musician, then music")

**Brand meaning**: Triple A = **A**coustics, **A**capellas, **A**ccompaniments.

### Differentiation rules (must follow)

- **Triple A Music (Premium Marketplace / "Uber Eats")**
  - Job: curated events, promoted artists, ticket sales for events the owner promotes.
  - UI vibe: premium storefront - like McDonald's on Uber Eats ("see what's on the menu and buy").
  - Visual cues: featured events, curated artist spotlights, ticket purchase flow.
  - Key insight: "Music is where you get the Taco Bell delivered because you found the mainstream stuff you like."
  - Not for: rentals, lessons, embroidery — those belong in Muse.

- **Triple A Musician (Work Dashboard / "Uber Driver")**
  - Job: see upcoming obligations, accept/decline, manage profile + direct-request settings, respond to inbound requests.
  - UI vibe: work dashboard.
  - Visual cues: status cards, "today/this week" focus, requests inbox.
  - Potential future: musicians could "Rent Out Equipment on Muse" (community sourcing).

- **Triple A Muse (DIY Event Coordinator / "Uber") — TOP PRIORITY**
  - Job: **event coordinator flow** where users put together their own event.
  - Flow: Select event type (wedding, funeral, cruise, party, graduation) → Select performers (drummer, pianist, vocalist, MC, etc.) → Select preferred genre → Select local venue options → Select event setup packages.
  - UI vibe: step-by-step interactive form, like ordering a custom pizza.
  - Key insight: "Muse is like an event coordinator" and "you could put together an assortment of musicians such as drummers, pianists, sax players, singers.. (so you can get an uber to Taco Bell, the gas station, and the train station)"
  - Secondary features: instrument rentals, lessons.
  - Note: Muse is NOT for tickets. Tickets live in Music. But users can book artists on Muse.
  - Implementation: numbered steps with clear progression; keep explainer/mission copy at the BOTTOM.

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

Goal: Give musicians a clear view of their work, performance quality, perks, and access to rentals.

Core concepts:

- **Profile & rating**
  - View / edit musician profile (name, instruments, genres, bio).
  - See current average star rating and recent reviews.
- **Bookings & obligations**
  - List of upcoming and past gigs (time, location, payout, dress code, set list requirements).
  - Detail view for each booking, including contact info for the organizer.
  - Ability to accept/decline new bookings and confirm arrival / completion.
- **Instrument rentals** (moved from Muse)
  - Browse instruments and equipment available for rent.
  - Request rentals for upcoming gigs.
  - View rental terms, availability, and daily rates.
- **Perks & rewards**
  - View perks based on rating or loyalty tier (e.g., embroidery for branding, free/discounted instrument rental, rehearsal room credits).
  - Clear rules for how to unlock or keep perks.
- **Notifications**
  - New booking requests, changes to existing bookings.
  - Perk unlocks, rating changes, and important system messages.

### 2. Triple A Music (Consumer/Host app)

Goal: Serve as the public-facing ticket marketplace and host operations dashboard.

Core concepts:

- **Public concert browsing** (no login required)
  - Browse upcoming events and concerts.
  - View event details, venue info, and ticket availability.
  - Purchase tickets (general admission or assigned seating).
- **Ticket purchasing**
  - Simple checkout flow with platform fee.
  - Access codes for entry.
  - View purchased tickets in "My tickets" section.
- **Host dashboard** (logged-in customers)
  - Post events/gigs looking for talent.
  - Manage venue/stage listings.
  - Review applicants and send artist requests.
  - Toggle "Open For Tickets" per event.
- **Booking management**
  - List of upcoming and past events.
  - Status for each booking (requested, confirmed, in progress, completed, cancelled).
  - Messaging channel with musicians/venues.
- **Ratings & reviews**
  - Rate musicians and venues after events.
  - View historical ratings when choosing performers.

### 3. Triple A Muse (Brand Gateway & Funnel)

Goal: Be the brand front door that funnels users to the appropriate app (Music or Musician).

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
- **Note on instrument rentals**
  - Rentals are now handled in **Musician app**, not Muse
  - This keeps Muse as a pure funnel and gives performers direct access to gear

- **Unified user identity**
  - Same user can be a performer, customer, and service consumer.
  - Single account with roles/permissions determining what they can list, rent, or book.

## Owner Alignment (Jan 2026)

This section summarizes a direct conversation with the owner and is the current north-star for UX and product shape.

### Verified from Discord chat (source of truth)

These items are directly supported by `.github/discord-chat-history.md` and should be treated as current truth unless superseded by newer owner direction.

- **Domains:** use the `.org` domains now; `.com` can be added later and pointed to the same deployments.
- **Admin routing:** keep admin entry simple as **`/admin`** for now (admin subdomain/prefix is optional/aesthetic).
- **Review workflow:** prefer a **live, web-accessible dev environment** so the owner can review without installing/running locally.
- **Ticket vendor direction (Triple A Music):** the platform should support **ticket sales** for events (customer-facing ticket purchasing).
- **Open For Tickets toggle:** make ticket selling an **optional per-event setting** (e.g., “Open For Tickets”).
- **Ticket modes:** support at least two modes conceptually: **general admission (“at the door”)** and **assigned seating** (more complex / higher-cost).
- **Capacity source of truth:** **venue/location sets seat capacity**; ticket inventory is derived from that capacity (not set by artists).
- **Fees:** keep platform fees low and simple initially (fine to iterate later).
- **Future integrations:** external ticket vendor integrations can be explored later to avoid overselling and sync inventory.

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

### Notes on source-of-truth

- The Discord log currently captured in `.github/discord-chat-history.md` is mostly about domains, admin routing, and ticketing direction.
- The Muse “Uber Eats / Pizza Hut” positioning and detailed Muse UX rules below are still valid working guidance for UI quality, but if they conflict with the Discord log or newer owner direction, **prioritize the Discord log** and update this document accordingly.

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
