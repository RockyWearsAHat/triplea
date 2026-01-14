# Triple A Apps – Project Instructions

This project contains a suite of three related apps built with Vite and TypeScript, targeting both mobile and desktop, for web and (ideally) standalone builds.

## Overview

- **Triple A Musician** – like the “Uber Driver” app for performers.
- **Triple A Music** – like “Uber Eats” for customers/organizers booking musicians and venues.
- **Triple A Muse** – like “Uber” as a services marketplace used by both musicians and customers (rentals, lessons, stage/logistics services).

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

Goal: Act as a hybrid marketplace where performers and customers are both consumers of services, gear, and expertise.

Core concepts:

- **Instrument rental**
  - Browse instruments and equipment (e.g., guitars, keyboards, PA systems, lighting).
  - View rental terms, availability calendar, and pickup/delivery options.
- **Lessons & coaching**
  - Find teachers for instruments, voice, songwriting, production, and performance coaching.
  - Book 1:1 or group sessions (in-person or online).
- **Stage & event services**
  - Browse locations and services for stage setup, sound engineering, lighting, and logistics.
  - Request help setting up stages or complete event packages.
- **Unified user identity**
  - Same user can be a performer, customer, and service consumer.
  - Single account with roles/permissions determining what they can list, rent, or book.

## Cross-App Considerations

- **Overarching Product Split (Non-Negotiable)**

  - Each app has a distinct “job to be done”:
    - Musician = performer work app (ratings, gigs, obligations, perks).
    - Music = customer/organizer booking app (discover → request → confirm → manage event).
    - Muse = shared marketplace/services app (both performers and customers consume rentals/lessons/stage services).
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
- Keep shared logic in a dedicated shared package or folder (e.g. `packages/shared/`) if you later convert to a monorepo.
- Aim for clear separation of concerns: UI components, domain models, and API access should be modular and reusable.

This document is meant as a living brief. As the project evolves, update it with more specific UX flows, API contracts, and implementation details so collaborators (including your friend) can quickly understand the vision and structure.

# PLEASE VIEW ./github/conversation-discussing-app-needs.md FOR CONTEXT ON HOW THESE INSTRUCTIONS WERE DERIVED AND THE OVERALL GOAL OF THE APPLICATION.

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
