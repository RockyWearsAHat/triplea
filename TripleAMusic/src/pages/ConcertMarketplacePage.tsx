import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GigWithDistance, ConcertSearchParams } from "@shared";
import { useGeolocation, useScrollReveal } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertMarketplacePage.module.scss";
import { createApiClient, getAssetUrl } from "../lib/urls";

export default function ConcertMarketplacePage() {
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const geo = useGeolocation(); // Auto-requests location on mount

  const [concerts, setConcerts] = useState<GigWithDistance[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch concerts - always show all, sorted by distance if location available
  useEffect(() => {
    // Wait for geolocation to finish loading before fetching
    if (geo.loading) return;

    let cancelled = false;
    setLoading(true);

    const fetchConcerts = async () => {
      try {
        // Always fetch concerts, passing location if available for distance sorting
        const params: ConcertSearchParams | undefined = geo.coordinates
          ? {
              lat: geo.coordinates.lat,
              lng: geo.coordinates.lng,
              // No radiusMiles = show all concerts, just sorted by distance
            }
          : undefined;
        const data = await api.listPublicConcerts(params);
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

  const locationLabel = geo.coordinates ? "Concerts near you" : "All concerts";

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
              Sorted by distance from your location.
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
                      src={getAssetUrl(
                        `/api/public/locations/${c.location!.id}/images/0`,
                      )}
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
                  <div className={styles.cardMeta}>
                    <p className={styles.cardDate}>
                      {c.date}
                      {c.time ? ` · ${c.time}` : ""}
                    </p>
                    <p className={styles.cardVenue}>
                      {c.location?.name ?? "Venue TBA"}
                    </p>
                  </div>
                  <p className={styles.cardDescription}>
                    {c.description ?? "More details coming soon."}
                  </p>
                  <div className={styles.cardFooter}>
                    <div className={styles.footerLeft}>
                      {c.ticketPrice !== undefined && c.ticketPrice > 0 ? (
                        <span className={styles.priceBadge}>
                          ${c.ticketPrice}
                        </span>
                      ) : (
                        <span className={styles.freeBadge}>Free</span>
                      )}
                    </div>
                    <button
                      className={styles.viewButton}
                      type="button"
                      onClick={() => navigate(`/concerts/${c.id}`)}
                    >
                      Get tickets
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
