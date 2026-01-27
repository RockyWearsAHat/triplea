import { useEffect, useMemo, useState } from "react";
import type { Instrument } from "@shared";
import { CategoryBar, ProductCard, Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./HomePage.module.scss";
import {
  createApiClient,
  getAssetUrl,
  openMusic,
  openMusician,
} from "../lib/urls";

/* ══════════════════════════════════════════════════════════════════════════
   Triple A Muse - "DIY Event Coordinator" (TOP PRIORITY APP)
   
   From owner (Discord):
   "Muse is like an event coordinator, select 'wedding, funeral, cruise, party, 
   graduation' and then check mark select 'Drummer, or pianist, or vocalist, or 
   Master of Ceremonies blah blah' you'll select the artists you want then select 
   'local venue options' then select 'event set up packages, speakers, etc' you 
   can select 'preferred genre'.."
   
   "Muse is where you would put it together yourself"
   "you could put together an assortment of musicians such as drummers, pianists, 
   sax players, singers.. (so you can get an uber to Taco Bell, the gas station, 
   and the train station)"
   
   This is WHERE YOU PUT IT TOGETHER YOURSELF
   Music is the premium "McDonald's menu" for promoted artists/events
   ══════════════════════════════════════════════════════════════════════════ */

// Event types - the FIRST thing users select
const EVENT_TYPES = [
  { id: "wedding", label: "Wedding", icon: "💒" },
  { id: "funeral", label: "Memorial", icon: "🕊️" },
  { id: "cruise", label: "Cruise", icon: "🚢" },
  { id: "party", label: "Party", icon: "🎉" },
  { id: "graduation", label: "Graduation", icon: "🎓" },
  { id: "corporate", label: "Corporate", icon: "💼" },
];

// Performer types - users select which performers they need
const PERFORMER_TYPES = [
  { id: "drummer", label: "Drummer", icon: "🥁" },
  { id: "pianist", label: "Pianist", icon: "🎹" },
  { id: "vocalist", label: "Vocalist", icon: "🎤" },
  { id: "saxophonist", label: "Sax Player", icon: "🎷" },
  { id: "guitarist", label: "Guitarist", icon: "🎸" },
  { id: "violinist", label: "Violinist", icon: "🎻" },
  { id: "dj", label: "DJ", icon: "🎧" },
  { id: "mc", label: "MC / Host", icon: "📢" },
];

// Genre preferences
const GENRES = [
  { id: "jazz", label: "Jazz" },
  { id: "classical", label: "Classical" },
  { id: "pop", label: "Pop" },
  { id: "rnb", label: "R&B" },
  { id: "gospel", label: "Gospel" },
  { id: "rock", label: "Rock" },
  { id: "country", label: "Country" },
  { id: "latin", label: "Latin" },
];

// Instrument rental categories
const INSTRUMENT_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "drums", label: "Drums" },
  { id: "brass", label: "Brass" },
  { id: "strings", label: "Strings" },
  { id: "keyboard", label: "Keys" },
  { id: "guitar", label: "Guitars" },
];

// Service packages
const SERVICE_PACKAGES = [
  {
    id: "basic",
    name: "Basic Setup",
    desc: "Sound check & coordination",
    price: 150,
  },
  {
    id: "standard",
    name: "Standard Package",
    desc: "Setup, sound, basic lighting",
    price: 350,
  },
  {
    id: "premium",
    name: "Full Production",
    desc: "Complete event production & on-site support",
    price: 750,
  },
];

export function HomePage() {
  const api = useMemo(() => createApiClient(), []);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  // Event coordinator state
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedPerformers, setSelectedPerformers] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // Rentals state
  const [rentalCategory, setRentalCategory] = useState("all");

  useEffect(() => {
    api
      .getMarketplaceCatalog()
      .then((data) => setInstruments(data.instruments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const togglePerformer = (id: string) => {
    setSelectedPerformers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGenre = (id: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredInstruments = useMemo(() => {
    return instruments.filter(
      (inst) =>
        rentalCategory === "all" ||
        (inst.category ?? "").toLowerCase().includes(rentalCategory),
    );
  }, [instruments, rentalCategory]);

  const canGetQuote =
    selectedEvent && selectedPerformers.size > 0 && selectedPackage;

  return (
    <div className={styles.page}>
      {/* Hero */}
      <header className={styles.hero}>
        <p className={styles.kicker}>Triple A Muse</p>
        <h1 className={styles.heroTitle}>Plan your event</h1>
        <p className={styles.heroSubtitle}>
          Select your occasion, choose your performers, and we'll handle the
          rest.
        </p>
      </header>

      {/* Step 1: Event Type */}
      <section className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>1</span>
          <div>
            <h2 className={styles.sectionTitle}>What's the occasion?</h2>
            <p className={styles.sectionSubtitle}>Select your event type</p>
          </div>
        </div>
        <div className={styles.chipGrid}>
          {EVENT_TYPES.map((evt) => (
            <button
              key={evt.id}
              className={`${styles.eventChip} ${selectedEvent === evt.id ? styles.chipSelected : ""}`}
              onClick={() => setSelectedEvent(evt.id)}
            >
              <span className={styles.chipIcon}>{evt.icon}</span>
              <span className={styles.chipLabel}>{evt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Step 2: Performers */}
      <section className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>2</span>
          <div>
            <h2 className={styles.sectionTitle}>Who do you need?</h2>
            <p className={styles.sectionSubtitle}>
              Select all performers you want
            </p>
          </div>
        </div>
        <div className={styles.chipGrid}>
          {PERFORMER_TYPES.map((p) => (
            <button
              key={p.id}
              className={`${styles.performerChip} ${selectedPerformers.has(p.id) ? styles.chipSelected : ""}`}
              onClick={() => togglePerformer(p.id)}
            >
              <span className={styles.chipIcon}>{p.icon}</span>
              <span className={styles.chipLabel}>{p.label}</span>
              {selectedPerformers.has(p.id) && (
                <span className={styles.chipCheck}>✓</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Step 3: Genre Preference */}
      <section className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>3</span>
          <div>
            <h2 className={styles.sectionTitle}>Preferred genre</h2>
            <p className={styles.sectionSubtitle}>
              Optional — helps us match the right artists
            </p>
          </div>
        </div>
        <div className={styles.genreGrid}>
          {GENRES.map((g) => (
            <button
              key={g.id}
              className={`${styles.genreChip} ${selectedGenres.has(g.id) ? styles.chipSelected : ""}`}
              onClick={() => toggleGenre(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      {/* Step 4: Event Package */}
      <section className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>4</span>
          <div>
            <h2 className={styles.sectionTitle}>Event setup package</h2>
            <p className={styles.sectionSubtitle}>
              Logistics & production support
            </p>
          </div>
        </div>
        <div className={styles.packageGrid}>
          {SERVICE_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              className={`${styles.packageCard} ${selectedPackage === pkg.id ? styles.packageSelected : ""}`}
              onClick={() => setSelectedPackage(pkg.id)}
            >
              <h3 className={styles.packageName}>{pkg.name}</h3>
              <p className={styles.packageDesc}>{pkg.desc}</p>
              <span className={styles.packagePrice}>From ${pkg.price}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Quote CTA */}
      <section className={styles.ctaSection}>
        <Button
          variant="primary"
          size="lg"
          disabled={!canGetQuote}
          onClick={() => alert("Quote request submitted!")}
        >
          {canGetQuote ? "Get a Quote" : "Complete selections above"}
        </Button>
        {canGetQuote && (
          <p className={styles.ctaHint}>
            {selectedPerformers.size} performer
            {selectedPerformers.size > 1 ? "s" : ""} selected
          </p>
        )}
      </section>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Instrument Rentals Section */}
      <section className={styles.rentalSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Instrument Rentals</h2>
          <p className={styles.sectionSubtitle}>
            Professional gear for your performance
          </p>
        </div>

        <CategoryBar
          categories={INSTRUMENT_CATEGORIES}
          active={rentalCategory}
          onSelect={(id) => setRentalCategory(id)}
        />

        {loading ? (
          <div className={styles.loadingState}>
            <p className={ui.help}>Loading instruments…</p>
          </div>
        ) : filteredInstruments.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={ui.help}>No instruments found</p>
          </div>
        ) : (
          <div className={styles.productGrid}>
            {filteredInstruments.slice(0, 6).map((inst) => (
              <ProductCard
                key={inst.id}
                id={inst.id}
                title={inst.name}
                subtitle={inst.category}
                price={inst.dailyRate ? `$${inst.dailyRate}/day` : undefined}
                imageUrl={
                  inst.imageUrl ? getAssetUrl(inst.imageUrl) : undefined
                }
                onPrimary={() => alert(`View details for ${inst.name}`)}
              />
            ))}
          </div>
        )}

        {filteredInstruments.length > 6 && (
          <div className={styles.viewAllRow}>
            <button className={styles.viewAllBtn}>
              View all {filteredInstruments.length} instruments →
            </button>
          </div>
        )}
      </section>

      {/* App Funnels */}
      <section className={styles.funnelSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Explore Triple A</h2>
        </div>

        <div className={styles.funnelGrid}>
          <article
            className={styles.funnelCard}
            onClick={openMusic}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => e.key === "Enter" && openMusic()}
          >
            <div className={styles.funnelIcon}>🎫</div>
            <div className={styles.funnelContent}>
              <h3 className={styles.funnelName}>Triple A Music</h3>
              <p className={styles.funnelDesc}>
                Browse curated events and buy tickets to see top performers.
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
            <div className={styles.funnelIcon}>🎸</div>
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
          Everything around the gig — handled.
        </h2>
        <p className={styles.missionText}>
          Triple A is the simplest way to organize live music. From finding the
          right performers to coordinating logistics, we help you create
          unforgettable experiences.
        </p>
        <p className={styles.missionBrand}>
          <strong>Acoustics · Acapellas · Accompaniments</strong>
        </p>
      </footer>
    </div>
  );
}

export default HomePage;
