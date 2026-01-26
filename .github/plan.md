# Plan: Apple-Inspired Bold Landing Pages

**Status:** � COMPLETE  
**Goal:** Transform landing pages to be bold, broad, and impactful with clear visual hierarchy — 1-3 focal points per viewport, Apple-style section breaks

---

## Context

**Root Problems Identified:**

1. **Small, insignificant UI** — Everything feels cramped with max-width: 720px containers
2. **Too many attention-grabbers** — Multiple sections competing for the eye
3. **Lack of visual boldness** — Title sizes are modest (22-28px), no commanding presence
4. **Dense multi-column layouts** — Hero uses grid columns instead of full-width impact
5. **Text-heavy sections** — Paragraphs where short impactful lines would work
6. **No clear section breaks** — Everything blends together

**Apple Design Principles to Apply:**

- **Full-width sections** — Each section breathes, fills the viewport
- **Massive typography** — Hero titles 48-80px, section titles 32-40px
- **1-3 focal points per viewport** — Don't overwhelm; guide the eye
- **Clear section breaks** — Distinct visual sections with generous padding
- **Visual > Text** — Short punchy lines, not paragraphs
- **Cards are large and prominent** — Not small cramped boxes

---

## Steps

### Step 1: Add Apple-inspired section primitives to shared styles

**File:** `packages/shared/src/styles/primitives.module.scss`  
**Operation:** `INSERT_AFTER` the `.gapLg` class

**Anchor:**

```scss
.gapLg {
  gap: 16px;
}
```

**Code:**

```scss
/* ══════════════════════════════════════════════════════════════════════════
   Apple-inspired Section Components
   Full-width sections with generous spacing, bold typography, clear hierarchy
   ══════════════════════════════════════════════════════════════════════════ */

/* Full-width section with generous vertical padding */
.sectionFull {
  width: 100%;
  padding: clamp(48px, 8vh, 96px) var(--page-pad);
}

.sectionFullCenter {
  composes: sectionFull;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Hero section - full viewport height, centered content */
.heroFull {
  min-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(32px, 6vh, 64px) var(--page-pad);
}

/* Massive hero title - the one thing you see first */
.heroMassive {
  margin: 0;
  font-size: clamp(48px, 8vw, 80px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  max-width: 14ch;
}

/* Secondary hero subtitle */
.heroSubtitleLarge {
  margin: 16px 0 0;
  font-size: clamp(18px, 2.5vw, 24px);
  color: var(--text-muted);
  max-width: 40ch;
  line-height: 1.4;
}

/* Section title - bold, large, commanding */
.sectionTitleLarge {
  margin: 0;
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

/* Section lead text */
.sectionLead {
  margin: 12px 0 0;
  font-size: clamp(16px, 2vw, 20px);
  color: var(--text-muted);
  max-width: 50ch;
}

/* Large action buttons for hero sections */
.heroActionsLarge {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 32px;
  justify-content: center;
}

/* Path cards - large clickable destinations */
.pathGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.pathCard {
  display: flex;
  flex-direction: column;
  padding: clamp(28px, 4vw, 40px);
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background 150ms ease;
  text-align: left;
}

.pathCard:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.pathCardTitle {
  margin: 0;
  font-size: clamp(22px, 2.5vw, 28px);
  font-weight: 650;
}

.pathCardDesc {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.5;
}

.pathCardAction {
  margin-top: auto;
  padding-top: 20px;
  color: var(--primary);
  font-weight: 500;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pathCardAction::after {
  content: "→";
  transition: transform 150ms ease;
}

.pathCard:hover .pathCardAction::after {
  transform: translateX(4px);
}

/* Product card row - grid layout */
.productRow {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
  max-width: var(--max-width);
}

/* Mission/footer section */
.missionSection {
  padding: clamp(40px, 6vh, 80px) var(--page-pad);
  text-align: center;
  border-top: 1px solid var(--border);
  margin-top: clamp(40px, 6vh, 80px);
}

.missionText {
  margin: 0 auto;
  max-width: 600px;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.6;
}
```

**Verify:** `npm run build 2>&1 | head -20`

---

### Step 2: Redesign Muse HomePage — Bold hero + clear path cards

**File:** `TripleAMuse/src/pages/HomePage.tsx`  
**Operation:** `REPLACE` (full file content)

**Code:**

```tsx
import { Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { openMusic, openMusician } from "../lib/urls";

export function HomePage() {
  return (
    <div>
      {/* Hero - Full viewport, one message */}
      <section className={ui.heroFull}>
        <p className={ui.heroKicker}>Triple A Music</p>
        <h1 className={ui.heroMassive}>Everything around the gig — handled.</h1>
        <p className={ui.heroSubtitleLarge}>
          Find concerts, book performers, or get on stage. One platform for live
          music.
        </p>
        <div className={ui.heroActionsLarge}>
          <Button size="lg" onClick={openMusic}>
            Browse concerts
          </Button>
        </div>
      </section>

      {/* Path Selection - Two clear destinations */}
      <section className={ui.sectionFullCenter}>
        <h2 className={ui.sectionTitleLarge}>Where are you headed?</h2>
        <p className={ui.sectionLead}>
          Choose your path into the Triple A ecosystem.
        </p>

        <div className={ui.pathGrid} style={{ marginTop: 40 }}>
          <div
            className={ui.pathCard}
            onClick={openMusic}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openMusic()}
          >
            <p className={ui.pathCardTitle}>For Hosts & Attendees</p>
            <p className={ui.pathCardDesc}>
              Discover concerts near you, buy tickets, or post your event and
              find the perfect performers.
            </p>
            <span className={ui.pathCardAction}>Open Triple A Music</span>
          </div>

          <div
            className={ui.pathCard}
            onClick={openMusician}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openMusician()}
          >
            <p className={ui.pathCardTitle}>For Performers</p>
            <p className={ui.pathCardDesc}>
              Find gigs, manage your schedule, rent instruments, and build your
              career.
            </p>
            <span className={ui.pathCardAction}>Open Triple A Musician</span>
          </div>
        </div>
      </section>

      {/* Mission - At the bottom */}
      <section className={ui.missionSection}>
        <p className={ui.missionText}>
          Triple A is the simplest way to organize live music — from instrument
          rentals and performer booking to event support and logistics.
        </p>
      </section>
    </div>
  );
}

export default HomePage;
```

**Verify:** `npm run build 2>&1 | head -20`

---

### Step 3: Add "lg" size variant to Button component

**File:** `packages/shared/src/components/Button.tsx`

Add `size?: "md" | "lg"` to the ButtonProps interface, and apply `styles.lg` class when size="lg".

**File:** `packages/shared/src/components/Button.module.scss`

Add after base button styles:

```scss
.lg {
  padding: 14px 28px;
  font-size: 16px;
  border-radius: var(--radius-md);
}
```

**Verify:** `npm run build 2>&1 | head -20`

---

### Step 4: Redesign Music DiscoveryPage — Bold header + clear search focus

**File:** `TripleAMusic/src/pages/DiscoveryPage.tsx`  
**Operation:** `REPLACE` (full file content)

Replace the AppShell wrapper with direct sections using the new Apple-inspired primitives:

- Large "Find Musicians" hero title (heroMassive class)
- Centered search bar as focal point
- Category bar underneath
- Results in spacious grid (productRow class)

**Verify:** `npm run build 2>&1 | head -20`

---

### Step 5: Redesign Musician DashboardPage — Bold greeting + clear metrics

**File:** `TripleAMusician/src/pages/DashboardPage.tsx`  
**Operation:** `REPLACE` (full file content)

Use Apple-inspired sections:

- Large "Your Week at a Glance" title (sectionTitleLarge class)
- Stats row as primary visual focal point
- Clean grid layout for content sections

**File:** `TripleAMusician/src/pages/DashboardPage.module.scss`  
**Operation:** `REPLACE` (full file content)

```scss
.statsRow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (max-width: 768px) {
  .statsRow {
    grid-template-columns: 1fr;
  }
}

.grid {
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr 300px;
  align-items: start;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.main {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.contentSection {
  padding: clamp(20px, 3vw, 28px);
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
}

.sidebar {
  padding: clamp(20px, 3vw, 28px);
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--border);
}

.quickActions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}
```

**Verify:** `npm run build 2>&1 | head -20`

---

## Verification Commands

After implementation:

```bash
cd /Users/alexwaldmann/Desktop/TripleAApps && npm run build 2>&1 | head -30
```

Visual checks:

- **Muse**: Full-height hero, massive title (48-80px), two large path cards
- **Music**: Bold "Find Musicians" title, centered search, spacious results grid
- **Musician**: Large "Your Week" title, prominent stats cards, clean content grid

---

## Summary

This plan transforms the landing pages to be:

1. **Bold** — Hero titles are 48-80px, section titles are 32-48px
2. **Broad** — Full-width sections that breathe (no cramped 720px containers)
3. **Focused** — 1-3 focal points per viewport (hero → CTA → path cards)
4. **Apple-inspired** — Clear section breaks, generous whitespace, visual hierarchy
5. **Clean** — Short punchy copy, not paragraphs of text
