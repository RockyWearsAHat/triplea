import { useEffect, useMemo, useState } from "react";
import type { Instrument, Location } from "@shared";
import { ProductCard, Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./HomePage.module.scss";
import {
  createApiClient,
  getAssetUrl,
  openMusic,
  openMusician,
} from "../lib/urls";
import {
  Music,
  Mic2,
  Calendar,
  Guitar,
  GraduationCap,
  Users,
  ArrowRight,
  Star,
  Sparkles,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════════
   Triple A Muse - Promotional Landing / Service Hub
   
   This is the front door to Triple A. It should feel like a professional
   service website that showcases what Triple A offers and funnels users
   to the right app:
   
   - Music: Browse curated events, buy tickets, see premium artists
   - Musician: Join as a performer, manage gigs, grow your career
   - Muse: Book services directly (rentals, lessons, event coordination)
   ══════════════════════════════════════════════════════════════════════════ */

// Service offerings
const SERVICES = [
  {
    id: "events",
    icon: <Calendar size={28} />,
    title: "Event Coordination",
    description:
      "From weddings to corporate events — we connect you with the perfect performers and handle the logistics.",
    cta: "Plan an Event",
    link: "/plan",
  },
  {
    id: "musicians",
    icon: <Mic2 size={28} />,
    title: "Live Performers",
    description:
      "Curated musicians for any occasion. Solo artists, bands, DJs, and more — vetted and ready to perform.",
    cta: "Browse Artists",
    link: "music",
  },
  {
    id: "rentals",
    icon: <Guitar size={28} />,
    title: "Instrument Rentals",
    description:
      "Professional gear when you need it. Drums, keyboards, guitars, brass, and more available for rent.",
    cta: "View Inventory",
    link: "/rentals",
  },
  {
    id: "lessons",
    icon: <GraduationCap size={28} />,
    title: "Music Lessons",
    description:
      "Learn from professionals. One-on-one or group sessions for all skill levels and instruments.",
    cta: "Find a Teacher",
    link: "/lessons",
  },
];

// Featured reasons to choose Triple A
const FEATURES = [
  {
    icon: <Star size={20} />,
    title: "Vetted Professionals",
    description: "Every musician is reviewed and rated by real clients.",
  },
  {
    icon: <Users size={20} />,
    title: "End-to-End Support",
    description: "From booking to event day, we've got you covered.",
  },
  {
    icon: <Sparkles size={20} />,
    title: "Premium Equipment",
    description: "Professional-grade instruments and sound systems.",
  },
];

export function HomePage() {
  const api = useMemo(() => createApiClient(), []);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getMarketplaceCatalog(), api.listPublicLocations()])
      .then(([catalog, locs]) => {
        setInstruments(catalog.instruments);
        setLocations(locs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <header className={styles.hero}>
        <p className={styles.kicker}>Triple A Music Services</p>
        <h1 className={styles.heroTitle}>
          Live music, <span className={styles.heroHighlight}>made simple.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Whether you're planning an event, looking to perform, or need
          professional gear — we've got you covered.
        </p>
        <div className={styles.heroCta}>
          <Button variant="primary" size="lg" onClick={openMusic}>
            Explore Events
          </Button>
          <Button variant="secondary" size="lg" onClick={openMusician}>
            Join as Performer
          </Button>
        </div>
      </header>

      {/* Services Grid */}
      <section className={styles.servicesSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>What we offer</h2>
          <p className={styles.sectionSubtitle}>
            Everything around the gig — handled.
          </p>
        </div>
        <div className={styles.servicesGrid}>
          {SERVICES.map((service) => (
            <article
              key={service.id}
              className={styles.serviceCard}
              onClick={() => {
                if (service.link === "music") {
                  openMusic();
                } else {
                  window.location.href = service.link;
                }
              }}
            >
              <div className={styles.serviceIcon}>{service.icon}</div>
              <h3 className={styles.serviceTitle}>{service.title}</h3>
              <p className={styles.serviceDesc}>{service.description}</p>
              <span className={styles.serviceCta}>
                {service.cta} <ArrowRight size={14} />
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* Features Strip */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresGrid}>
          {FEATURES.map((feature, i) => (
            <div key={i} className={styles.featureItem}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Venues Preview */}
      {locations.length > 0 && (
        <section className={styles.previewSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Featured Venues</h2>
            <p className={styles.sectionSubtitle}>
              Beautiful spaces ready for your next event
            </p>
          </div>
          <div className={styles.venueGrid}>
            {locations.slice(0, 4).map((loc) => (
              <article
                key={loc.id}
                className={styles.venueCard}
                onClick={openMusic}
              >
                <div className={styles.venueImageWrapper}>
                  {loc.imageUrl ? (
                    <img
                      src={getAssetUrl(loc.imageUrl)}
                      alt={loc.name}
                      className={styles.venueImage}
                    />
                  ) : (
                    <div className={styles.venueImageFallback}>🏛️</div>
                  )}
                </div>
                <div className={styles.venueInfo}>
                  <h3 className={styles.venueName}>{loc.name}</h3>
                  <p className={styles.venueCity}>{loc.city}</p>
                  {loc.seatCapacity && (
                    <p className={styles.venueCapacity}>
                      Up to {loc.seatCapacity} guests
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className={styles.previewCta}>
            <Button variant="ghost" onClick={openMusic}>
              View all venues →
            </Button>
          </div>
        </section>
      )}

      {/* Instrument Rentals Preview */}
      {!loading && instruments.length > 0 && (
        <section className={styles.previewSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Instrument Rentals</h2>
            <p className={styles.sectionSubtitle}>
              Professional gear for your performance
            </p>
          </div>
          <div className={styles.productGrid}>
            {instruments.slice(0, 4).map((inst) => (
              <ProductCard
                key={inst.id}
                id={inst.id}
                title={inst.name}
                subtitle={inst.category}
                price={inst.dailyRate ? `$${inst.dailyRate}/day` : undefined}
                imageUrl={
                  inst.imageUrl ? getAssetUrl(inst.imageUrl) : undefined
                }
                onPrimary={() => (window.location.href = "/rentals")}
              />
            ))}
          </div>
          <div className={styles.previewCta}>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/rentals")}
            >
              View all instruments →
            </Button>
          </div>
        </section>
      )}

      {/* App Funnels */}
      <section className={styles.funnelSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Get Started</h2>
        </div>
        <div className={styles.funnelGrid}>
          <article
            className={styles.funnelCard}
            onClick={openMusic}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === "Enter" && openMusic()}
          >
            <div className={styles.funnelIcon}>
              <Music size={32} />
            </div>
            <div className={styles.funnelContent}>
              <h3 className={styles.funnelName}>Triple A Music</h3>
              <p className={styles.funnelDesc}>
                Browse curated events, buy tickets, and discover top performers.
              </p>
            </div>
            <span className={styles.funnelArrow}>→</span>
          </article>

          <article
            className={styles.funnelCard}
            onClick={openMusician}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === "Enter" && openMusician()}
          >
            <div className={styles.funnelIcon}>
              <Mic2 size={32} />
            </div>
            <div className={styles.funnelContent}>
              <h3 className={styles.funnelName}>Triple A Musician</h3>
              <p className={styles.funnelDesc}>
                Join as a performer. Manage gigs, accept requests, grow your
                career.
              </p>
            </div>
            <span className={styles.funnelArrow}>→</span>
          </article>
        </div>
      </section>

      {/* Mission Footer */}
      <footer className={styles.missionFooter}>
        <h2 className={styles.missionTitle}>
          <strong>Acoustics</strong> · <strong>Acapellas</strong> ·{" "}
          <strong>Accompaniments</strong>
        </h2>
        <p className={styles.missionText}>
          Triple A is the simplest way to bring live music to your life. From
          finding the right performers to coordinating logistics, we help create
          unforgettable experiences.
        </p>
      </footer>
    </div>
  );
}

export default HomePage;
