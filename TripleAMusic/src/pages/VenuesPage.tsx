import React, { useEffect, useMemo, useState } from "react";
import type { Location } from "@shared";
import { Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient, getAssetUrl } from "../lib/urls";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./VenuesPage.module.scss";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function VenuesPage() {
  const api = useMemo(() => createApiClient(), []);

  const [venues, setVenues] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Venue creation
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueBusy, setVenueBusy] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listMyStageLocations()
      .then((data) => setVenues(data))
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  }, [api]);

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    setVenueError(null);
    setVenueBusy(true);
    try {
      const created = await api.createStageLocation({
        name: venueName,
        address: venueAddress,
        city: venueCity,
      });
      setVenues((prev) => [created, ...prev]);
      setVenueName("");
      setVenueAddress("");
      setVenueCity("");
    } catch (err) {
      setVenueError(
        err instanceof Error ? err.message : "Failed to create venue",
      );
    } finally {
      setVenueBusy(false);
    }
  }

  if (loading) {
    return (
      <HostDashboardShell title="Venues" subtitle="Loading...">
        <p className={ui.help}>Loading your venues...</p>
      </HostDashboardShell>
    );
  }

  return (
    <HostDashboardShell title="Venues" subtitle="Manage your event locations">
      <div className={styles.venuesTab}>
        {/* Add Venue Form */}
        <Section title="Add a Venue">
          <form
            onSubmit={handleCreateVenue}
            className={[ui.card, ui.cardPad].join(" ")}
          >
            <div className={styles.formRow}>
              <input
                placeholder="Venue name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className={ui.input}
                required
              />
              <input
                placeholder="Address"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className={ui.input}
              />
              <input
                placeholder="City"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                className={ui.input}
                required
              />
              <Button type="submit" disabled={venueBusy}>
                {venueBusy ? "Adding..." : "Add Venue"}
              </Button>
            </div>
            {venueError && <p className={ui.error}>{venueError}</p>}
          </form>
        </Section>

        {/* Venue List */}
        <Section title="Your Venues">
          {venues.length === 0 ? (
            <p className={ui.help}>No venues added yet.</p>
          ) : (
            <div className={styles.cardList}>
              {venues.map((v) => (
                <div key={v.id} className={[ui.card, ui.cardPad].join(" ")}>
                  <div className={styles.cardRow}>
                    <div className={styles.venueInfo}>
                      {v.imageUrl ? (
                        <img
                          src={getAssetUrl(v.imageUrl)}
                          alt=""
                          className={styles.venueThumb}
                        />
                      ) : (
                        <div className={styles.venueThumbPlaceholder}>🏛️</div>
                      )}
                      <div>
                        <p className={ui.cardTitle}>{v.name}</p>
                        <p className={ui.cardText}>
                          {v.address && `${v.address}, `}
                          {v.city}
                        </p>
                        {v.seatCapacity && (
                          <p className={ui.help}>Capacity: {v.seatCapacity}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </HostDashboardShell>
  );
}

export default VenuesPage;
