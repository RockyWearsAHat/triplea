import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GigWithDistance, ConcertSearchParams } from "@shared";
import { useGeolocation, useScrollReveal } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertMarketplacePage.module.scss";
import {
  createApiClient,
  getAssetUrl,
  getMuseOrigin,
  getMusicianOrigin,
} from "../lib/urls";

/* ══════════════════════════════════════════════════════════════════════════
   Triple A Music - Premium Concert Marketplace
   
   Vision from owner: Like "Uber Eats" / "McDonald's Menu"
   - Premium showcase of promoted artists and venues
   - Curated, not DIY (that's Muse)
   - Ticket sales for Triple A Music promoted artists prioritized
   - Clean, premium branding feel
   ══════════════════════════════════════════════════════════════════════════ */

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

  // Split concerts into featured (first 3) and others for "premium" feel
  const featuredConcerts = concerts.slice(0, 3);
  const moreConcerts = concerts.slice(3);

  return (
    <div ref={contentRef}>
      {/* Hero - Premium branding, clean */}
      <section className={styles.heroSection}>
        <p className={ui.heroKicker}>Triple A Music</p>
        <h1 className={styles.heroTitle}>The best live music</h1>
        <p className={styles.heroSubtitle}>
          Curated events, top performers, seamless tickets.
        </p>
      </section>

      {/* Featured Concerts - Premium showcase */}
      {!loading && featuredConcerts.length > 0 && (
        <section className={styles.featuredSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Featured events</h2>
            <p className={styles.sectionSubtitle}>
              Hand-picked by Triple A Music
            </p>
          </div>
          <div className={styles.featuredGrid}>
            {featuredConcerts.map((c) => (
              <article
                key={c.id}
                className={styles.featuredCard}
                onClick={() => navigate(`/concerts/${c.id}`)}
              >
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
                  <div className={styles.featuredBadge}>Featured</div>
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
                    <button className={styles.viewButton} type="button">
                      Get tickets
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* More Events Grid */}
      <section className={ui.sectionFull}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {geo.coordinates ? "Near you" : "All events"}
          </h2>
          {geo.coordinates && (
            <p className={styles.sectionSubtitle}>
              Sorted by distance from your location
            </p>
          )}
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <p className={ui.help}>Finding concerts…</p>
          </div>
        ) : moreConcerts.length === 0 && featuredConcerts.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={ui.sectionLead}>No concerts found.</p>
            <p className={ui.help}>
              Check back soon for upcoming events in your area.
            </p>
          </div>
        ) : moreConcerts.length === 0 ? null : (
          <div className={styles.concertGrid}>
            {moreConcerts.map((c) => (
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

      {/* Funnel to other apps */}
      <section className={styles.crossAppSection}>
        <div className={styles.crossAppGrid}>
          <div
            className={styles.crossAppCard}
            onClick={() => window.open(getMuseOrigin(), "_blank")}
          >
            <h3 className={styles.crossAppTitle}>Plan your own event?</h3>
            <p className={styles.crossAppDesc}>
              Use Triple A Muse to assemble your own lineup — select performers,
              packages, and venues.
            </p>
            <span className={styles.crossAppAction}>Open Muse →</span>
          </div>
          <div
            className={styles.crossAppCard}
            onClick={() => window.open(getMusicianOrigin(), "_blank")}
          >
            <h3 className={styles.crossAppTitle}>Are you a performer?</h3>
            <p className={styles.crossAppDesc}>
              Join Triple A Musician to find gigs, manage requests, and grow
              your career.
            </p>
            <span className={styles.crossAppAction}>Join as musician →</span>
          </div>
        </div>
      </section>

      {/* Mission footer */}
      <section className={ui.missionSection}>
        <p className={ui.missionText}>
          Triple A Music is where the community's best performers meet the best
          events. Premium experiences, seamless tickets.
        </p>
      </section>
    </div>
  );
}
