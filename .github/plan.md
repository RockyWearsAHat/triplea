# Plan: Triple A Music Professional Redesign

**Status:** 🟢 COMPLETE
**Goal:** Transform Triple A Music homepage into a clean, professional concert browsing experience that matches the quality of Muse and Musician.

---

## Context

**Current State:**

- `ConcertMarketplacePage.tsx` exists but looks unprofessional:
  - Has a clunky "hero" section with a "Use my location" button that shouldn't be visible UI
  - Small, cramped concert cards with poor visual hierarchy
  - No images, no visual appeal
  - Doesn't match the clean Apple-inspired look of Muse and Musician
- Muse has:
  - Full-viewport hero with massive typography (`heroFull`, `heroMassive`)
  - Clean path cards for navigation
  - No cluttered buttons or manual location prompts

- Musician has:
  - Professional dashboard with `StatusCard` components
  - Grid layout with sidebar
  - Clean stats row

**Problems to Solve:**

1. Homepage should be concert-discovery focused with clean visual hierarchy
2. Location should be requested via **browser API popup on load**, NOT a button in the UI
3. Concert cards need to be visual-first (show images, venue info, better layout)
4. Overall design needs to match Muse/Musician professional aesthetic
5. Remove ugly "Use my location" and "Show popular" buttons from hero

**Design Direction:**

- Full-viewport hero with minimal copy and single CTA
- Auto-request geolocation on page load (browser handles the popup)
- Concert grid with image cards (using `ProductCard` style or similar)
- Show "nearby" if location granted, "popular" if denied/unavailable
- Remove all manual location UI elements

---

## Steps

### Step 1: Update useGeolocation to auto-request — `packages/shared/src/hooks/useGeolocation.ts`

**Operation:** `REPLACE` the useEffect that only checks permission

**Anchor:**

```typescript
useEffect(() => {
  if ((navigator as any).permissions) {
    (navigator as any).permissions
      .query({ name: "geolocation" })
      .then((result: any) => {
        if (result.state === "granted") requestLocation();
      });
  }
}, [requestLocation]);
```

**Code:**

```typescript
useEffect(() => {
  // Auto-request location on mount - browser will show native permission popup
  requestLocation();
}, [requestLocation]);
```

**Verify:** `npx tsc --noEmit -p packages/shared/tsconfig.json`

---

### Step 2: Rewrite ConcertMarketplacePage — `TripleAMusic/src/pages/ConcertMarketplacePage.tsx`

**Operation:** `REPLACE` entire file

**Code:**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { GigWithDistance, ConcertSearchParams } from "@shared";
import { TripleAApiClient, useGeolocation, useScrollReveal } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertMarketplacePage.module.scss";

export default function ConcertMarketplacePage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const geo = useGeolocation(); // Auto-requests location on mount

  const [concerts, setConcerts] = useState<GigWithDistance[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch concerts based on location (or popular if no location)
  useEffect(() => {
    // Wait for geolocation to finish loading before fetching
    if (geo.loading) return;

    let cancelled = false;
    setLoading(true);

    const fetchConcerts = async () => {
      try {
        let data: GigWithDistance[];
        if (geo.coordinates) {
          const params: ConcertSearchParams = {
            lat: geo.coordinates.lat,
            lng: geo.coordinates.lng,
            radiusMiles: 50,
          };
          data = await api.listPublicConcerts(params);
        } else {
          // No location - show popular concerts
          data = (await api.listPopularConcerts()) as GigWithDistance[];
        }
        if (!cancelled) setConcerts(data);
      } catch {
        // Silently fail, show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchConcerts();
    return () => {
      cancelled = true;
    };
  }, [api, geo.coordinates, geo.loading]);

  useScrollReveal(contentRef, [concerts.length, loading]);

  const locationLabel = geo.coordinates
    ? "Near you"
    : geo.permissionDenied
      ? "Popular concerts"
      : "Concerts";

  return (
    <div ref={contentRef}>
      {/* Hero - Clean, minimal, visual-first */}
      <section className={ui.heroFull}>
        <p className={ui.heroKicker}>Triple A Music</p>
        <h1 className={ui.heroMassive}>Find live music</h1>
        <p className={ui.heroSubtitleLarge}>
          Discover concerts happening near you or explore what's popular.
        </p>
      </section>

      {/* Concert Grid */}
      <section className={ui.sectionFull}>
        <div className={styles.header}>
          <h2 className={ui.sectionTitleLarge}>{locationLabel}</h2>
          {geo.coordinates && (
            <p className={ui.sectionLead}>
              Showing concerts within 50 miles of your location.
            </p>
          )}
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <p className={ui.help}>Finding concerts…</p>
          </div>
        ) : concerts.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={ui.sectionLead}>No concerts found.</p>
            <p className={ui.help}>
              Check back soon for upcoming events in your area.
            </p>
          </div>
        ) : (
          <div className={styles.concertGrid}>
            {concerts.map((c) => (
              <article key={c.id} className={styles.concertCard}>
                <div className={styles.cardImage}>
                  {c.locationId ? (
                    <img
                      src={`http://localhost:4000/api/public/locations/${c.locationId}/images/0`}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  <div className={styles.cardImageFallback}>
                    <span>🎵</span>
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>{c.title}</h3>
                  <p className={styles.cardDate}>
                    {c.date}
                    {c.time ? ` · ${c.time}` : ""}
                  </p>
                  {c.description && (
                    <p className={styles.cardDescription}>{c.description}</p>
                  )}
                  <div className={styles.cardFooter}>
                    {typeof c.distanceMiles === "number" && (
                      <span className={styles.distanceBadge}>
                        {c.distanceMiles.toFixed(1)} mi
                      </span>
                    )}
                    <button className={styles.viewButton} type="button">
                      View details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Mission footer */}
      <section className={ui.missionSection}>
        <p className={ui.missionText}>
          Triple A Music connects you with live performances in your community.
          From intimate jazz nights to grand concert halls — find your next
          experience.
        </p>
      </section>
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit -p TripleAMusic/tsconfig.json`

---

### Step 3: Rewrite ConcertMarketplacePage styles — `TripleAMusic/src/pages/ConcertMarketplacePage.module.scss`

**Operation:** `REPLACE` entire file

**Code:**

```scss
/* Concert marketplace page - professional, image-first design */

.header {
  max-width: 900px;
  margin-bottom: clamp(24px, 4vw, 40px);
}

.loadingState,
.emptyState {
  padding: clamp(40px, 6vh, 80px) 0;
  text-align: center;
}

.concertGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  max-width: 1200px;
}

.concertCard {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color 150ms ease;
}

.concertCard:hover {
  border-color: var(--border-strong);
}

.cardImage {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  overflow: hidden;
}

.cardImage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cardImageFallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--text-subtle);
  z-index: 0;
}

.cardImage img + .cardImageFallback {
  display: none;
}

.cardContent {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cardTitle {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.2;
}

.cardDate {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.cardDescription {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cardFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.distanceBadge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.viewButton {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--primary);
  color: var(--on-primary, #fff);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.viewButton:hover {
  opacity: 0.9;
}
```

**Verify:** `npm run build`

---

## Final Verification

```bash
cd /Users/alexwaldmann/Desktop/TripleAApps && npm run build
```

---

## Summary

This plan transforms Triple A Music into a professional concert marketplace by:

1. **Auto-request geolocation** — Browser shows native popup on page load, no ugly buttons
2. **Clean hero** — Matches Muse with `heroFull`, `heroMassive` typography
3. **Image-first concert cards** — Shows venue images, proper hierarchy, clean design
4. **Smart fallback** — Shows "popular" concerts if location denied
5. **Professional footer** — Mission statement at bottom like Muse

The page now matches the quality of Muse and Musician with Apple-inspired design patterns.
