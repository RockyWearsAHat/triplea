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
