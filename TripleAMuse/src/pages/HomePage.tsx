import { AppShell, Button, spacing, SearchBar } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import CategoryBar from "@shared/components/CategoryBar";
import ProductCard from "@shared/components/ProductCard";
import { useMemo, useRef, useState } from "react";

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
        <section className={ui.hero}>
          <div>
            <p className={ui.heroKicker}>Triple A Music</p>
            <h2 className={ui.heroTitle}>Find rentals, lessons, and support</h2>
            <p className={ui.heroLead}>
              Browse curated bundles, book a lesson, or request delivery and
              on-site help.
            </p>
            <div className={ui.heroActions}>
              <Button onClick={() => window.open("/open/music", "_self")}>
                I’m hosting an event
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open("/open/musician", "_self")}
              >
                I’m performing
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
                We’ll deliver gear and handle load-in for your event.
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
