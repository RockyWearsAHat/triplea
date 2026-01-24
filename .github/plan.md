# Plan: View Restructuring — Muse as Funnel, Music as Ticket Marketplace, Musician as Work Dashboard + Rentals

**Status:** 🔴 NOT STARTED
**Goal:** Restructure the three apps so that Muse is a brand advertisement/funnel, Music is a public ticket marketplace with host tools, and Musician is the performer work app with instrument rentals and gig applications

---

## Context

### User Clarification (Jan 24, 2026)

The user has clarified that the current app architecture doesn't match the intended purpose:

1. **Muse should NOT be a marketplace or service offering site** — It should be an **advertisement and funnel** to get users to the proper site (Music or Musician).

2. **Music (Triple A Music):**
   - **Non-logged-in users** should see upcoming concerts and buy tickets
   - **Logged-in users (hosts/customers)** get their controls as defined in documentation
   - This is the **consumer-facing ticket marketplace**

3. **Musician (Triple A Musician):**
   - Musicians can see **gigs that are hiring**, apply to gigs
   - See **communications/invites** to gigs
   - **This is where instrument rentals and equipment should live** (moved from Muse!)
   - Owner wants to work one-on-one with artists and venues

### Current State Analysis

**Muse (Currently):**

- Has instrument rentals, deals/bundles, services sections ❌ (should be funnel only)
- Has "Get started" buttons that open Music/Musician ✓ (good, keep this)
- Has rental categories, search, product cards ❌ (move to Musician)

**Music (Currently):**

- Has browse page with concerts ✓ (good)
- Has ticket purchasing ✓ (good)
- Non-logged-in can see events ✓ (good)
- Has host dashboard for logged-in customers ✓ (good)

**Musician (Currently):**

- Has dashboard, bookings, perks, gigs pages ✓ (good)
- NO instrument rentals ❌ (need to add)
- Has gig browsing and application ✓ (good)

### What Needs to Change

1. **Muse HomePage:** Strip down to pure brand landing + funnel CTAs
2. **Musician:** Add instrument rentals section (moved from Muse)
3. **Update copilot-instructions.md** to reflect this new architecture

---

## Steps

### Step 1: Transform Muse HomePage to pure funnel landing — `TripleAMuse/src/pages/HomePage.tsx`

**Operation:** `REPLACE`

**Anchor:**

```tsx
import { AppShell, Button, spacing, SearchBar } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import CategoryBar from "@shared/components/CategoryBar";
import ProductCard from "@shared/components/ProductCard";
import { useMemo, useRef, useState } from "react";
```

**Code:**

```tsx
import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useRef } from "react";
import {
  openMusic,
  openMusician,
  openMusicRegister,
  openMusicianRegister,
} from "../lib/urls";
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 2: Replace Muse HomePage body with funnel content — `TripleAMuse/src/pages/HomePage.tsx`

**Operation:** `REPLACE`

**Anchor:**

```tsx
export function HomePage() {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(
    () => ["All", "Strings", "Keyboards", "Drums", "Wind"],
    [],
  );
  const deals = useMemo(
    () => [
      {
        id: "starter",
        title: "Starter package",
        subtitle: "Essentials for a small gig",
        price: "$45/day",
      },
      {
        id: "backline",
        title: "Backline + delivery",
        subtitle: "Choose the gear — we handle transport",
        price: "$120/day",
      },
    ],
    [],
  );

  return (
    <AppShell title="Muse" subtitle="Everything around the gig — handled.">
      <div
        ref={contentRef}
        className={ui.stack}
        style={{ "--stack-gap": `${spacing.md}px` } as React.CSSProperties}
      >
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Get started</h2>
          <div className={ui.row} style={{ gap: 12, flexWrap: "wrap" }}>
            <Button onClick={() => window.open("/open/music", "_self")}>
              Host an event
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open("/open/musician", "_self")}
            >
              Join as performer
            </Button>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Deals & bundles</h2>
          <div className={ui.scroller}>
            {deals.map((d) => (
              <div
                key={d.id}
                className={[ui.card, ui.cardPad].join(" ")}
                style={{ minWidth: 260 }}
              >
                <p className={ui.cardTitle}>{d.title}</p>
                <p className={ui.cardText}>{d.subtitle}</p>
                <div
                  className={ui.rowBetween}
                  style={{ marginTop: spacing.sm }}
                >
                  <p className={ui.help}>{d.price}</p>
                  <Button variant="secondary">Customize</Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Instrument rentals</h2>
          <div style={{ marginTop: spacing.sm }}>
            <div style={{ marginBottom: spacing.sm }}>
              <SearchBar
                placeholder="Search instruments or categories…"
                onSearch={(q) => setQuery(q)}
              />
            </div>

            <CategoryBar
              categories={categories.map((c) => ({ id: c, label: c }))}
              active={category}
              onSelect={(id) => setCategory(id)}
            />

            <div
              style={{
                display: "grid",
                gap: spacing.md,
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                marginTop: spacing.md,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCard
                  key={i}
                  title={`Instrument ${i + 1}`}
                  subtitle="Daily rental"
                  price="$45"
                />
              ))}
            </div>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Services</h2>
          <div className={ui.scroller}>
            <div
              className={[ui.card, ui.cardPad].join(" ")}
              style={{ minWidth: 260 }}
            >
              <p className={ui.cardTitle}>Coaching</p>
              <p className={ui.cardText}>
                Find 1:1 lessons and workshops with experienced instructors.
              </p>
              <Button variant="secondary" style={{ marginTop: spacing.sm }}>
                Browse teachers
              </Button>
            </div>
            <div
              className={[ui.card, ui.cardPad].join(" ")}
              style={{ minWidth: 260 }}
            >
              <p className={ui.cardTitle}>Delivery & setup</p>
              <p className={ui.cardText}>
                We'll deliver gear and handle load-in for your event.
              </p>
              <Button variant="secondary" style={{ marginTop: spacing.sm }}>
                Request delivery
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default HomePage;
```

**Code:**

```tsx
export function HomePage() {
  const contentRef = useRef<HTMLDivElement | null>(null);

  return (
    <AppShell title="Triple A Muse" subtitle="Your gateway to live music">
      <div
        ref={contentRef}
        className={ui.stack}
        style={{ "--stack-gap": `${spacing.lg}px` } as React.CSSProperties}
      >
        {/* Hero / Brand Introduction */}
        <section className={ui.hero}>
          <div>
            <p className={ui.heroKicker}>Welcome to Triple A</p>
            <h2 className={ui.heroTitle}>
              Everything around the gig — handled.
            </h2>
            <p className={ui.heroLead}>
              Whether you're hosting an event or performing at one, Triple A
              connects artists with venues and gives everyone the tools they
              need to succeed.
            </p>

            <div className={ui.heroActions}>
              <Button onClick={openMusic}>Find concerts & buy tickets</Button>
              <Button variant="secondary" onClick={openMusician}>
                I'm a performer
              </Button>
            </div>
          </div>

          <div className={ui.featureGrid}>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>For Fans</p>
              <p className={ui.featureBody}>
                Discover upcoming concerts near you and buy tickets in seconds.
              </p>
            </div>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>For Hosts</p>
              <p className={ui.featureBody}>
                Post events, find artists, and manage bookings from one
                dashboard.
              </p>
            </div>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>For Artists</p>
              <p className={ui.featureBody}>
                Browse gigs, apply to perform, rent gear, and build your career.
              </p>
            </div>
          </div>
        </section>

        {/* Two Main Funnels */}
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Where are you headed?</h2>
          <div
            className={ui.grid}
            style={
              {
                "--grid-gap": `${spacing.lg}px`,
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              } as React.CSSProperties
            }
          >
            {/* Music Funnel (Consumers / Hosts) */}
            <div
              className={[ui.card, ui.cardPad, ui.stack].join(" ")}
              style={
                { "--stack-gap": `${spacing.md}px` } as React.CSSProperties
              }
            >
              <div>
                <p className={ui.cardTitle} style={{ fontSize: 20 }}>
                  Triple A Music
                </p>
                <p className={ui.cardText} style={{ marginTop: 8 }}>
                  The concert marketplace. Browse upcoming events, buy tickets,
                  or host your own.
                </p>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}
              >
                <li>See what's happening near you</li>
                <li>Purchase tickets to live events</li>
                <li>Post events and hire performers</li>
                <li>Manage your venue listings</li>
              </ul>
              <div
                className={ui.row}
                style={
                  { "--row-gap": `${spacing.sm}px` } as React.CSSProperties
                }
              >
                <Button onClick={openMusic}>Browse concerts</Button>
                <Button variant="secondary" onClick={openMusicRegister}>
                  Host an event
                </Button>
              </div>
            </div>

            {/* Musician Funnel (Performers) */}
            <div
              className={[ui.card, ui.cardPad, ui.stack].join(" ")}
              style={
                { "--stack-gap": `${spacing.md}px` } as React.CSSProperties
              }
            >
              <div>
                <p className={ui.cardTitle} style={{ fontSize: 20 }}>
                  Triple A Musician
                </p>
                <p className={ui.cardText} style={{ marginTop: 8 }}>
                  The performer's home base. Find work, rent gear, and manage
                  your career.
                </p>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}
              >
                <li>Browse open gigs and apply</li>
                <li>Rent instruments and equipment</li>
                <li>Manage your schedule and bookings</li>
                <li>Earn perks as you grow your rating</li>
              </ul>
              <div
                className={ui.row}
                style={
                  { "--row-gap": `${spacing.sm}px` } as React.CSSProperties
                }
              >
                <Button onClick={openMusician}>Open dashboard</Button>
                <Button variant="secondary" onClick={openMusicianRegister}>
                  Join as artist
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* About / Mission (at the bottom, per owner preference) */}
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>About Triple A</h2>
          <div className={[ui.card, ui.cardPad].join(" ")}>
            <p className={ui.cardText} style={{ maxWidth: 700 }}>
              Triple A works directly with artists and venues to make live music
              happen. We handle the logistics — from booking to equipment — so
              performers can focus on their craft and hosts can focus on their
              audience.
            </p>
            <p className={ui.help} style={{ marginTop: spacing.md }}>
              Questions? Reach out at <strong>contact@tripleamuse.org</strong>
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default HomePage;
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 3: Add Rentals page to Musician app — `TripleAMusician/src/App.tsx`

**Operation:** `INSERT_AFTER`

**Anchor:**

```tsx
function PerksPage() {
  return (
    <AppShell
      title="Perks center"
      subtitle="Track what you've unlocked and what's coming next."
    >
      <p className={ui.help} style={{ fontSize: 14 }}>
        This route is a good home for detailed perk tiers, progress bars, and
        redemption history.
      </p>
    </AppShell>
  );
}
```

**Code:**

```tsx
function RentalsPage() {
  const api = React.useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [instruments, setInstruments] = React.useState<
    Array<{
      id: string;
      name: string;
      category: string;
      dailyRate: number;
      available: boolean;
      imageUrl?: string;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("All");

  useScrollReveal(contentRef, [instruments.length, loading, category]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listPublicInstruments()
      .then((data) => {
        if (cancelled) return;
        setInstruments(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load instruments.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(instruments.map((i) => i.category))).sort();
    return ["All", ...cats];
  }, [instruments]);

  const filtered = React.useMemo(() => {
    if (category === "All") return instruments;
    return instruments.filter((i) => i.category === category);
  }, [instruments, category]);

  function apiImageUrl(pathname?: string): string | undefined {
    if (!pathname) return undefined;
    if (/^https?:\/\//i.test(pathname)) return pathname;
    return `http://localhost:4000${pathname}`;
  }

  return (
    <AppShell
      title="Instrument rentals"
      subtitle="Rent quality gear for your next gig."
    >
      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: spacing.md }}
      >
        <div
          className={ui.scroller}
          style={{ "--scroller-gap": "8px" } as React.CSSProperties}
        >
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? "secondary" : "ghost"}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className={ui.help}>Loading instruments...</p>
        ) : error ? (
          <p className={ui.error}>{error}</p>
        ) : filtered.length === 0 ? (
          <p className={ui.help}>No instruments available in this category.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: spacing.md,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {filtered.map((inst) => (
              <div
                key={inst.id}
                data-reveal
                className={[ui.card, ui.cardPad, ui.stack].join(" ")}
                style={{ "--stack-gap": "10px" } as React.CSSProperties}
              >
                <div className={[ui.media, ui.mediaSquare].join(" ")}>
                  {inst.imageUrl ? (
                    <img
                      src={apiImageUrl(inst.imageUrl)}
                      alt={inst.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className={ui.mediaPlaceholder}>{inst.category}</div>
                  )}
                </div>
                <div>
                  <p className={ui.cardTitle}>{inst.name}</p>
                  <p className={ui.cardText}>{inst.category}</p>
                </div>
                <div className={ui.rowBetween}>
                  <span className={ui.chip}>
                    {inst.available ? "Available" : "Unavailable"}
                  </span>
                  <p className={ui.help} style={{ margin: 0, fontWeight: 600 }}>
                    ${inst.dailyRate}/day
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={!inst.available}
                  fullWidth
                >
                  {inst.available ? "Request rental" : "Not available"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 4: Add Rentals route to Musician App routes — `TripleAMusician/src/App.tsx`

**Operation:** `INSERT_AFTER`

**Anchor:**

```tsx
<Route
  path="/gigs/:id"
  element={
    <RequireRole role="musician">
      <GigDetailPage />
    </RequireRole>
  }
/>
```

**Code:**

```tsx
<Route
  path="/rentals"
  element={
    <RequireRole role="musician">
      <RentalsPage />
    </RequireRole>
  }
/>
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 5: Add Rentals link to Musician NavBar — `TripleAMusician/src/App.tsx`

**Operation:** `INSERT_AFTER`

**Anchor:**

```tsx
<NavLink
  to="/gigs"
  className={({ isActive }) =>
    [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
  }
>
  Gigs
</NavLink>
```

**Code:**

```tsx
<NavLink
  to="/rentals"
  className={({ isActive }) =>
    [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
  }
>
  Rentals
</NavLink>
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 6: Update Music app default route to BrowsePage — `TripleAMusic/src/App.tsx`

The current default route is `DiscoveryPage` which focuses on musician discovery. For non-logged-in users, the primary experience should be browsing concerts.

**Operation:** `REPLACE`

**Anchor:**

```tsx
<Route path="/" element={<DiscoveryPage />} />
```

**Code:**

```tsx
<Route path="/" element={<BrowsePage />} />
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 7: Update copilot-instructions.md to reflect new architecture — `.github/copilot-instructions.md`

**Operation:** `REPLACE`

**Anchor:**

```markdown
### 3. Triple A Muse (Marketplace & services app)

Goal: Be the interactive, browse-first "front door" (web) for Triple A offerings and funnels.

Key positioning (as clarified by owner):

- Muse is the place for people who want Triple A's services directly (rentals/lessons/logistics).
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
  - Important nuance: logistics/setup are not "rental gear" (owner explicitly does not want to rent out speakers/mics).
  - Offer package plans that can be customized.
- **Unified user identity**
  - Same user can be a performer, customer, and service consumer.
  - Single account with roles/permissions determining what they can list, rent, or book.
```

**Code:**

```markdown
### 3. Triple A Muse (Brand Gateway & Funnel)

Goal: Be the **brand front door** that funnels users to the appropriate app (Music or Musician).

Key positioning (updated Jan 2026):

- Muse is **NOT a marketplace or service-offering site** — it is an advertisement and funnel.
- Users land here to understand what Triple A is and then get directed to the right app.
- Music is for consumers (fans buying tickets) and hosts (posting events, booking artists).
- Musician is for performers (gig applications, instrument rentals, career management).

Core concepts:

- **Brand landing page**
  - Clean, professional introduction to Triple A's services.
  - Explains the value proposition for fans, hosts, and artists.
- **Clear funnels**
  - Primary CTA: "Find concerts & buy tickets" → Opens Music
  - Secondary CTA: "I'm a performer" → Opens Musician
  - Additional paths for hosts wanting to post events
- **About/Mission section**
  - Placed at the bottom (per owner preference)
  - Explains that Triple A works directly with artists and venues
- **Unified user identity**
  - Same user can be a performer, customer, and service consumer.
  - Single account with roles/permissions determining what they can list, rent, or book.
- **Note on instrument rentals**
  - Rentals are now handled in **Musician app**, not Muse
  - This keeps Muse as a pure funnel and gives performers direct access to gear
```

**Verify:** File content matches expected changes

---

### Step 8: Update Musician app description in copilot-instructions — `.github/copilot-instructions.md`

**Operation:** `REPLACE`

**Anchor:**

```markdown
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
```

**Code:**

```markdown
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
- **Gig discovery & applications**
  - Browse open gigs posted by hosts/venues.
  - Apply to gigs with optional cover message.
  - Track application status and communications.
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
```

**Verify:** File content matches expected changes

---

### Step 9: Update Music app description in copilot-instructions — `.github/copilot-instructions.md`

**Operation:** `REPLACE`

**Anchor:**

```markdown
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
```

**Code:**

```markdown
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
- **Discovery & search**
  - Browse musicians by genre, location, rating, price range.
  - Filter by ensemble type (solo, band, DJ, etc.).
- **Booking management**
  - List of upcoming and past events.
  - Status for each booking (requested, confirmed, in progress, completed, cancelled).
  - Messaging channel with musicians/venues.
- **Ratings & reviews**
  - Rate musicians and venues after events.
  - View historical ratings when choosing performers.
```

**Verify:** File content matches expected changes

---

### Step 10: Clean up unused imports in Muse HomePage — `TripleAMuse/src/pages/HomePage.module.scss`

This file may no longer be needed after the HomePage simplification. Check if it's still imported.

**Operation:** `DELETE` (if unused after Step 1-2)

**Note:** Verify after Steps 1-2 whether HomePage.module.scss is still imported. If the new HomePage doesn't use it, it can be removed or left for future use.

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

## Summary of Changes

| App          | Before                                     | After                                              |
| ------------ | ------------------------------------------ | -------------------------------------------------- |
| **Muse**     | Marketplace with rentals, deals, services  | Pure brand landing + funnel to Music/Musician      |
| **Music**    | Default to DiscoveryPage (musician search) | Default to BrowsePage (concert listings + tickets) |
| **Musician** | Dashboard, gigs, bookings, perks           | + Rentals page with instrument browsing            |

## Verification Commands

```bash
# After all steps
cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build

# Test each app individually
cd /Users/alexwaldmann/Desktop/TripleAApps/TripleAMuse && pnpm dev
cd /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic && pnpm dev
cd /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusician && pnpm dev
```

**Verify:** Visual inspection — cards should not have heavy shadows

---

### Step 3: Remove gradient from hero section — `packages/shared/src/styles/primitives.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
/* Compact, card-first hero inspired by Apple/Uber: strong focus, minimal copy */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
  gap: 16px;
  align-items: stretch;
  padding: 18px;
  border-radius: var(--radius-lg);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-2) 88%, var(--accent) 6%),
    var(--surface)
  );
  border: 1px solid color-mix(in srgb, var(--border) 78%, var(--accent) 18%);
  box-shadow: var(--shadow-1);
}
```

**Code:**

```scss
/* Clean hero: flat surface, minimal styling, focus on content */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
  gap: 20px;
  align-items: stretch;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
}
```

**Verify:** Visual inspection — hero should be flat, not gradient

---

### Step 4: Simplify navigation to flat minimal style — `packages/shared/src/styles/primitives.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
.nav {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  width: 100%;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.navLink {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  border: 1px solid transparent;
  background: transparent;
}

.navLink:hover {
  background: var(--surface-2);
  color: var(--text);
}

.navLinkActive {
  color: var(--text);
  background: var(--surface-2);
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  box-shadow: none;
}
```

**Code:**

```scss
.nav {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  width: 100%;
}

.navLink {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  transition:
    color 120ms ease,
    background 120ms ease;
}

.navLink:hover {
  color: var(--text);
  background: var(--surface);
}

.navLinkActive {
  color: var(--text);
  background: var(--surface);
  font-weight: 600;
}
```

**Verify:** Visual inspection — navigation should be minimal, not pill-shaped

---

### Step 5: Flatten feature cards — `packages/shared/src/styles/primitives.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
.featureCard {
  position: relative;
  overflow: hidden;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: none;
}
```

**Code:**

```scss
.featureCard {
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--surface);
  border: 1px solid var(--border);
}
```

**Verify:** Visual inspection — feature cards should be clean rectangles

---

### Step 6: Remove accent tinting from chrome header — `packages/shared/src/styles/primitives.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
/* Top "app chrome" (brand + nav). Keeps the UI feeling like a real service. */
.chrome {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: calc(var(--page-pad) * -1) calc(var(--page-pad) * -1) 16px;
  padding: 14px var(--page-pad) 10px;
  border-radius: 0;
  border: 0;
  background: color-mix(in srgb, var(--bg) 92%, var(--surface));
  border-bottom: 1px solid var(--border);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

**Code:**

```scss
/* Top "app chrome" (brand + nav). Clean, minimal header. */
.chrome {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: calc(var(--page-pad) * -1) calc(var(--page-pad) * -1) 20px;
  padding: 16px var(--page-pad) 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
```

**Verify:** Visual inspection — header should be flat, same as page background

---

### Step 7: Simplify brand dot to just accent color — `packages/shared/src/styles/primitives.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
.brandDot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 92%, var(--primary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
```

**Code:**

```scss
.brandDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary);
}
```

**Verify:** Visual inspection — brand dot should be simple gold circle

---

### Step 8: Clean up card base class — `packages/shared/src/styles/primitives.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
}

.cardInteractive {
  composes: card;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.cardInteractive:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
```

**Code:**

```scss
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.cardInteractive {
  composes: card;
  cursor: pointer;
  transition: border-color 120ms ease;
}

.cardInteractive:hover {
  border-color: var(--border-strong);
}
```

**Verify:** Visual inspection — cards should be flat, no shadow, no background change on hover

---

### Step 9: Remove category bar active glow — `packages/shared/src/components/CategoryBar.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
/* Active button customization: rely on Button.secondary for visual weight; add gold outline */
.active {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent);
}
```

**Code:**

```scss
/* Active button: solid background, no glow */
.active {
  background: var(--surface-2);
  border-color: var(--border-strong);
}
```

**Verify:** Visual inspection — active category should be solid, not glowing

---

### Step 10: Simplify button hover states — `packages/shared/src/components/Button.module.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
.primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 92%, #000);
}

.secondary:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--border-strong);
}

.ghost:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface);
}
```

**Code:**

```scss
.primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 88%, #000);
}

.secondary:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.ghost:hover:not(:disabled) {
  color: var(--text);
}
```

**Verify:** Visual inspection — button hovers should be subtle, not dramatic

---

### Step 11: Simplify Muse HomePage — clearer action hierarchy — `TripleAMuse/src/pages/HomePage.tsx`

**Operation:** `REPLACE`

**Anchor:**

```tsx
<section className={ui.hero}>
  <div>
    <p className={ui.heroKicker}>Triple A Music</p>
    <h2 className={ui.heroTitle}>Find rentals, lessons, and support</h2>
    <p className={ui.heroLead}>
      Browse curated bundles, book a lesson, or request delivery and on-site
      help.
    </p>
    <div className={ui.heroActions}>
      <Button onClick={() => window.open("/open/music", "_self")}>
        I'm hosting an event
      </Button>
      <Button
        variant="secondary"
        onClick={() => window.open("/open/musician", "_self")}
      >
        I'm performing
      </Button>
      <Button variant="ghost">Rentals & support</Button>
    </div>
  </div>

  <div className={ui.featureGrid}>
    <div className={ui.featureCard}>
      <p className={ui.featureTitle}>Host workspace</p>
      <p className={ui.featureBody}>
        Post an event, request musicians, and track confirmations.
      </p>
    </div>
    <div className={ui.featureCard}>
      <p className={ui.featureTitle}>Performer workspace</p>
      <p className={ui.featureBody}>
        Manage your gigs, requests, and payments.
      </p>
    </div>
    <div className={ui.featureCard}>
      <p className={ui.featureTitle}>Realtime support</p>
      <p className={ui.featureBody}>
        Ask for rentals, coaching, delivery, or on-site help.
      </p>
    </div>
  </div>
</section>
```

**Code:**

```tsx
<section className={ui.section}>
  <h2 className={ui.sectionTitle}>Get started</h2>
  <div className={ui.row} style={{ gap: 12, flexWrap: "wrap" }}>
    <Button onClick={() => window.open("/open/music", "_self")}>
      Host an event
    </Button>
    <Button
      variant="secondary"
      onClick={() => window.open("/open/musician", "_self")}
    >
      Join as performer
    </Button>
  </div>
</section>
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 12: Simplify Musician Dashboard hero — `TripleAMusician/src/pages/DashboardPage.tsx`

**Operation:** `REPLACE`

**Anchor:**

```tsx
<div className={styles.header}>
  <div>
    <p className={ui.heroKicker}>Triple A roster</p>
    <h2 className={ui.heroTitle}>Welcome back.</h2>
    <p className={ui.heroLead}>
      Keep your availability clean, respond to requests, and stay ready.
    </p>
  </div>
</div>
```

**Code:**

```tsx
<div className={styles.header}>
  <div>
    <h2 className={ui.sectionTitle}>Your week</h2>
    <p className={ui.help}>Respond to requests and manage bookings.</p>
  </div>
</div>
```

**Verify:** `cd /Users/alexwaldmann/Desktop/TripleAApps && pnpm build`

---

### Step 13: Reduce border radius globally — `packages/shared/src/styles/global.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
```

**Code:**

```scss
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 10px;
```

**Verify:** Visual inspection — elements should feel tighter, more professional

---

### Step 14: Reduce surface transparency for cleaner look — `packages/shared/src/styles/global.scss`

**Operation:** `REPLACE`

**Anchor:**

```scss
/* Surfaces are derived from black + white alpha for a clean "tux" look */
--surface: rgba(255, 255, 255, 0.045);
--surface-2: rgba(255, 255, 255, 0.065);
--surface-3: rgba(255, 255, 255, 0.095);
--border: rgba(255, 255, 255, 0.11);
--border-strong: rgba(255, 255, 255, 0.18);
```

**Code:**

```scss
/* Flat surfaces — subtle differentiation, not layered glass */
--surface: rgba(255, 255, 255, 0.04);
--surface-2: rgba(255, 255, 255, 0.06);
--surface-3: rgba(255, 255, 255, 0.08);
--border: rgba(255, 255, 255, 0.1);
--border-strong: rgba(255, 255, 255, 0.16);
```

**Verify:** Visual inspection — surfaces should be more subtle

---

## Summary of Changes

| File                           | Change                                          |
| ------------------------------ | ----------------------------------------------- |
| `AppFrame.module.scss`         | Remove radial gradient glow background          |
| `global.scss`                  | Flatten shadow, reduce radii, simplify surfaces |
| `primitives.module.scss`       | Flatten hero, nav, chrome, cards, feature cards |
| `CategoryBar.module.scss`      | Remove active glow                              |
| `Button.module.scss`           | Subtle hover states                             |
| `HomePage.tsx` (Muse)          | Simplify hero to 2 clear CTAs                   |
| `DashboardPage.tsx` (Musician) | Simplify header                                 |

## Design Philosophy Applied

1. **One background color** — No gradients, no glows
2. **Border-defined containers** — Cards use borders, not shadows
3. **Minimal hover states** — Color change only, no lifts
4. **Clear action hierarchy** — Primary gold CTA, secondary for alternatives
5. **Scannable typography** — Section titles, help text, no hero kickers
6. **Professional restraint** — Less is more

---

## Post-Implementation Notes

After implementing these changes, the UI should feel:

- **Flat** — No layered/glass effects
- **Clean** — Consistent spacing, no visual noise
- **Professional** — Like a real service app (Stripe, Linear, Notion)
- **Guided** — Clear primary actions, obvious user flow

If additional elements still feel "shiny", apply the same principles:

1. Remove gradients → use solid colors
2. Remove shadows → use borders
3. Remove glows → use solid accent colors
4. Reduce hover effects → simple color changes only
