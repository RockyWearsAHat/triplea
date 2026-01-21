import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, Button, spacing, useScrollReveal, useAuth } from "@shared";
import { useNavigate } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { TripleAApiClient } from "@shared/api/client";
import { Tag } from "../components/Tag";
import { Section } from "../components/Section";
import {
  API_BASE_URL,
  apiAssetUrl,
  openMusicRegister,
  openMusicianRegister,
} from "../lib/urls";

export function PortalPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: API_BASE_URL }),
    [],
  );
  const { user } = useAuth();
  const navigate = useNavigate();

  function requestInMuse() {
    if (user) {
      navigate("/messages");
      return;
    }
    navigate("/account?next=/messages");
  }

  const contentRef = useRef<HTMLDivElement | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<
    Array<{
      id: string;
      name: string;
      category: string;
      dailyRate: number;
      available: boolean;
      imageUrl?: string;
    }>
  >([]);

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        instruments
          .map((i) => i.category)
          .filter(
            (c): c is string => typeof c === "string" && c.trim().length > 0,
          ),
      ),
    );
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [instruments]);

  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    if (selectedCategory !== "All") return;
    if (instruments.length <= 18) return;
    if (categories.length === 0) return;
    setSelectedCategory(categories[0]);
  }, [categories, instruments.length, selectedCategory]);

  const visibleInstruments = useMemo(() => {
    if (selectedCategory === "All") return instruments;
    return instruments.filter((i) => i.category === selectedCategory);
  }, [instruments, selectedCategory]);

  const serviceOptions = useMemo(
    () => [
      {
        id: "lessons",
        title: "Lessons",
        description: "Coaching for instrument, voice, and production.",
      },
      {
        id: "stage",
        title: "Event support",
        description:
          "On-site coordination: load-in, timelines, and crew support.",
      },
      {
        id: "delivery",
        title: "Delivery & pickup",
        description: "We bring your rental to the venue and back.",
      },
    ],
    [],
  );

  const [rentalsLimit, setRentalsLimit] = useState(12);
  useEffect(() => {
    setRentalsLimit(12);
  }, [selectedCategory]);

  const displayedInstruments = useMemo(
    () => visibleInstruments.slice(0, rentalsLimit),
    [visibleInstruments, rentalsLimit],
  );

  type DealItem =
    | { kind: "instrument"; id: string }
    | { kind: "service"; id: string };

  type Deal = {
    id: string;
    title: string;
    subtitle: string;
    items: DealItem[];
  };

  const deals = useMemo<Deal[]>(() => {
    const picks = instruments
      .filter((i) => i.available)
      .slice(0, 4)
      .map((i) => i.id);

    return [
      {
        id: "deal-starter",
        title: "Starter package",
        subtitle: "A small bundle to request in Muse.",
        items: [
          ...(picks[0]
            ? ([{ kind: "instrument", id: picks[0] }] as const)
            : []),
          { kind: "service", id: "delivery" },
        ],
      },
      {
        id: "deal-backline",
        title: "Backline + delivery",
        subtitle: "Pick your gear, we handle delivery.",
        items: [
          ...(picks[1]
            ? ([{ kind: "instrument", id: picks[1] }] as const)
            : []),
          ...(picks[2]
            ? ([{ kind: "instrument", id: picks[2] }] as const)
            : []),
          { kind: "service", id: "delivery" },
        ],
      },
      {
        id: "deal-coaching",
        title: "Practice & prep",
        subtitle: "Rental + lessons.",
        items: [
          ...(picks[3]
            ? ([{ kind: "instrument", id: picks[3] }] as const)
            : []),
          { kind: "service", id: "lessons" },
        ],
      },
    ];
  }, [instruments]);

  function dealInstrumentById(id: string) {
    return instruments.find((i) => i.id === id);
  }

  function dealServiceById(id: string) {
    return serviceOptions.find((s) => s.id === id);
  }

  function dealLine(item: DealItem): { title: string; meta?: string } {
    if (item.kind === "instrument") {
      const inst = dealInstrumentById(item.id);
      return {
        title: inst?.name ?? "Rental item",
        meta: inst ? `${inst.category} · $${inst.dailyRate}/day` : undefined,
      };
    }
    const svc = dealServiceById(item.id);
    return {
      title: svc?.title ?? "Service",
      meta: "Request",
    };
  }

  function dealEstimatedDailyTotal(deal: Deal): number {
    return deal.items
      .filter(
        (i): i is { kind: "instrument"; id: string } => i.kind === "instrument",
      )
      .map((i) => dealInstrumentById(i.id)?.dailyRate ?? 0)
      .reduce((a, b) => a + b, 0);
  }

  useScrollReveal(contentRef, [
    displayedInstruments.length,
    deals.length,
    catalogBusy,
    selectedCategory,
  ]);

  useEffect(() => {
    setCatalogError(null);
    setCatalogBusy(true);
    api
      .getMarketplaceCatalog()
      .then((c) => setInstruments(c.instruments))
      .catch((e) => setCatalogError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCatalogBusy(false));
  }, [api]);

  return (
    <AppShell
      title="Portal"
      subtitle="Browse rentals and services. Use Music/Musician for booking workflows."
    >
      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Triple A Muse</p>
            <h2 className={ui.heroTitle}>Rentals & services, made simple.</h2>
            <p className={ui.heroLead}>
              Explore gear, lessons, and event support. When you’re ready to
              book musicians/venues or manage performer work, jump into the
              dedicated apps.
            </p>

            <div className={ui.heroActions}>
              <Button
                onClick={() =>
                  document
                    .getElementById("muse-funnel")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Choose a path
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  document
                    .getElementById("muse-preview")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Browse rentals
              </Button>
              <Button variant="ghost" onClick={requestInMuse}>
                Request rentals/services
              </Button>
              {!user ? (
                <Button variant="ghost" onClick={() => navigate("/account")}>
                  Sign in
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <div id="muse-funnel" />
        <Section title="Where should you go?">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: spacing.lg,
            }}
          >
            <div
              className={[ui.card, ui.cardPad].join(" ")}
              data-reveal
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
              }}
            >
              <Tag label="Hosts & organizers" />
              <p style={{ fontWeight: 650 }}>Triple A Music</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Create events, book musicians/venues, and manage bookings.
              </p>
              <Button variant="secondary" onClick={openMusicRegister}>
                Open Music
              </Button>
            </div>

            <div
              className={[ui.card, ui.cardPad].join(" ")}
              data-reveal
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
              }}
            >
              <Tag label="Performers" />
              <p style={{ fontWeight: 650 }}>Triple A Musician</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Your work hub: requests, schedule, and payout workflow.
              </p>
              <Button variant="secondary" onClick={openMusicianRegister}>
                Open Musician
              </Button>
            </div>

            <div
              className={[ui.card, ui.cardPad].join(" ")}
              data-reveal
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
              }}
            >
              <Tag label="Rentals & services" />
              <p style={{ fontWeight: 650 }}>Stay in Muse</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Request rentals, lessons, delivery, and event support.
              </p>
              <Button variant="secondary" onClick={requestInMuse}>
                Request in Muse
              </Button>
            </div>
          </div>
        </Section>

        <div
          data-reveal
          style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}
        >
          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              overflowX: "auto",
              paddingBottom: spacing.xs,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Button
              variant={selectedCategory === "All" ? "secondary" : "ghost"}
              onClick={() => setSelectedCategory("All")}
            >
              All rentals
            </Button>
            {categories.map((c) => (
              <Button
                key={c}
                variant={selectedCategory === c ? "secondary" : "ghost"}
                onClick={() => setSelectedCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              gap: spacing.sm,
              overflowX: "auto",
              paddingBottom: spacing.xs,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {serviceOptions.map((s) => (
              <Button
                key={s.id}
                variant="ghost"
                onClick={() => {
                  document
                    .getElementById("muse-services")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {s.title}
              </Button>
            ))}
          </div>
        </div>

        <div id="muse-preview" />
        <Section title="Preview gear">
          {catalogError ? <p className={ui.error}>{catalogError}</p> : null}
          {catalogBusy ? (
            <p className={ui.help}>Loading...</p>
          ) : displayedInstruments.length === 0 ? (
            <p className={ui.help}>No items available.</p>
          ) : (
            <div
              style={{
                display: "flex",
                gap: spacing.lg,
                overflowX: "auto",
                paddingBottom: spacing.xs,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {displayedInstruments.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  data-reveal
                  className={[ui.card, ui.cardPad].join(" ")}
                  style={{
                    minWidth: 260,
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                  }}
                >
                  <div className={[ui.media, ui.mediaSquare].join(" ")}>
                    {item.imageUrl ? (
                      <img
                        src={apiAssetUrl(item.imageUrl)}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <p style={{ fontWeight: 600 }}>{item.name}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    {item.category} · ${item.dailyRate}/day
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      marginTop: spacing.xs,
                    }}
                  >
                    <Button variant="secondary" onClick={requestInMuse}>
                      Request rental
                    </Button>
                    {!user ? (
                      <Button
                        variant="ghost"
                        onClick={() => navigate("/account?next=/messages")}
                      >
                        Sign in to request
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div id="muse-services" />
        <Section title="Services">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.lg,
            }}
          >
            {serviceOptions.map((s) => (
              <div
                key={s.id}
                data-reveal
                className={[ui.card, ui.cardPad].join(" ")}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing.sm,
                }}
              >
                <Tag label="Service" />
                <p style={{ fontWeight: 650 }}>{s.title}</p>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {s.description}
                </p>
                <Button variant="secondary" onClick={requestInMuse}>
                  Request
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <div id="muse-deals" />
        <Section title="Packages">
          <div
            style={{
              display: "flex",
              gap: spacing.lg,
              overflowX: "auto",
              paddingBottom: spacing.xs,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {deals.map((deal) => {
              const estimated = dealEstimatedDailyTotal(deal);
              const firstInstrument = deal.items.find(
                (i): i is { kind: "instrument"; id: string } =>
                  i.kind === "instrument",
              );

              return (
                <div
                  key={deal.id}
                  data-reveal
                  className={[ui.card, ui.cardPad].join(" ")}
                  style={{
                    minWidth: 320,
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 650 }}>{deal.title}</p>
                    <p
                      style={{
                        marginTop: 6,
                        color: "var(--text-muted)",
                        fontSize: 13,
                      }}
                    >
                      {deal.subtitle}
                    </p>
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {deal.items.map((item, idx) => {
                      const line = dealLine(item);
                      return (
                        <div
                          key={`${item.kind}:${item.id}:${idx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: spacing.sm,
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            padding: "10px 12px",
                            background: "var(--surface)",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {line.title}
                            </p>
                            {line.meta ? (
                              <p
                                style={{
                                  marginTop: 4,
                                  color: "var(--text-muted)",
                                  fontSize: 12,
                                }}
                              >
                                {line.meta}
                              </p>
                            ) : null}
                          </div>
                          <Tag label="Included" />
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      Est. gear total: ${estimated.toFixed(0)}/day
                    </p>
                    <Button
                      variant="secondary"
                      disabled={!firstInstrument}
                      onClick={requestInMuse}
                    >
                      Request this package
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="More gear (preview)">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.lg,
            }}
          >
            {catalogBusy ? (
              <p className={ui.help}>Loading catalog...</p>
            ) : visibleInstruments.length === 0 ? (
              <p className={ui.help}>No items available.</p>
            ) : (
              displayedInstruments.map((item, idx) => (
                <div
                  key={item.id}
                  data-reveal={idx < 6 ? true : undefined}
                  className={[ui.card, ui.cardPad].join(" ")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                  }}
                >
                  <div className={[ui.media, ui.mediaSquare].join(" ")}>
                    {item.imageUrl ? (
                      <img
                        src={apiAssetUrl(item.imageUrl)}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <p style={{ fontWeight: 600 }}>{item.name}</p>
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    {item.category} · ${item.dailyRate}/day
                  </p>
                  <p
                    style={{
                      color: item.available
                        ? "var(--text-muted)"
                        : "var(--taa-purple-400)",
                      fontSize: 13,
                    }}
                  >
                    {item.available ? "Available" : "Unavailable"}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      marginTop: spacing.sm,
                    }}
                  >
                    <Button variant="secondary" onClick={requestInMuse}>
                      Request rental
                    </Button>
                    {!user ? (
                      <Button
                        variant="ghost"
                        onClick={() => navigate("/account?next=/messages")}
                      >
                        Sign in to request
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          {!catalogBusy && visibleInstruments.length > rentalsLimit ? (
            <div data-reveal style={{ marginTop: spacing.md }}>
              <Button
                variant="secondary"
                onClick={() => setRentalsLimit((n) => n + 12)}
              >
                Show more
              </Button>
            </div>
          ) : null}
        </Section>

        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>What this is</p>
            <h2 className={ui.heroTitle}>
              Everything around the gig — handled.
            </h2>
            <p className={ui.heroLead}>
              Muse is the marketplace for the stuff that makes gigs happen:
              rentals, lessons, delivery, and event support.
            </p>
          </div>

          <div className={ui.featureGrid}>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Transparent rentals</p>
              <p className={ui.featureBody}>
                See daily rates, availability, and pickup/delivery options.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Lessons & coaching</p>
              <p className={ui.featureBody}>
                Book 1:1 or group sessions — voice, instruments, production.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Stage & logistics</p>
              <p className={ui.featureBody}>
                Delivery, crew, and event support when you need it.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
