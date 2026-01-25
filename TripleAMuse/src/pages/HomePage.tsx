import { AppShell, Button, spacing } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { useRef } from "react";
import {
  openMusic,
  openMusician,
  openMusicRegister,
  openMusicianRegister,
} from "../lib/urls";

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
        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Triple A Music</p>
            <h2 className={ui.heroTitle}>Everything around the gig — handled.</h2>
            <p className={ui.heroLead}>
              A clean hub that points you to the right workspace — whether you
              want to host, perform, or request support.
            </p>

            <div className={ui.heroActions}>
              <Button onClick={openMusic}>Browse concerts</Button>
              <Button variant="secondary" onClick={openMusicRegister}>
                Host an event
              </Button>
            </div>
          </div>

          <div>
            <div className={[ui.card, ui.cardPad].join(" ")}>
              <p className={ui.cardTitle}>For performers</p>
              <p className={ui.cardText}>
                Find gigs, manage your schedule, and rent instruments for your
                next set.
              </p>
              <div className={ui.row} style={{ gap: 8 }}>
                <Button onClick={openMusician}>Open dashboard</Button>
                <Button variant="secondary" onClick={openMusicianRegister}>
                  Join as artist
                </Button>
              </div>
            </div>
          </div>
        </section>

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
          <h2 className={ui.sectionTitle}>Where are you headed?</h2>
          <div className={ui.featureGrid}>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>Find concerts</p>
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

        {/* About / Mission (at the bottom, per owner preference) */}
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>About Triple A</h2>
          <div className={[ui.card, ui.cardPad].join(" ")}>
            <p className={ui.cardText} style={{ maxWidth: 700 }}>
              Triple A is the simplest way to organize live music — from
              instrument rentals and performer booking to event support and
              logistics.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default HomePage;
