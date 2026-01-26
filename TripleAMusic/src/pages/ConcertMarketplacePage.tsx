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
                  {c.location?.id ? (
                    <img
                      src={`http://localhost:4000/api/public/locations/${c.location!.id}/images/0`}
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
