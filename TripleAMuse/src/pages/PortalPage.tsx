import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AppShell,
  Button,
  spacing,
  useScrollReveal,
  useAuth,
  cx,
} from "@shared";
import { useNavigate } from "react-router-dom";
import ui from "@shared/styles/primitives.module.scss";
import { TripleAApiClient } from "@shared/api/client";
import {
  API_BASE_URL,
  apiAssetUrl,
  openMusic,
  openMusician,
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

  const stackLgStyle = useMemo(
    () => ({ "--stack-gap": `${spacing.lg}px` }) as CSSProperties,
    [],
  );

  const gridLgStyle = useMemo(
    () => ({ "--grid-gap": `${spacing.lg}px` }) as CSSProperties,
    [],
  );

  const stackSmStyle = useMemo(
    () => ({ "--stack-gap": `${spacing.sm}px` }) as CSSProperties,
    [],
  );

  const previewInstruments = useMemo(() => {
    const base = instruments.filter((i) => i.available);
    const filtered =
      selectedCategory === "All"
        ? base
        : base.filter((i) => i.category === selectedCategory);
    return filtered.slice(0, 10);
  }, [instruments, selectedCategory]);

  const heroImageUrl = useMemo(() => {
    const firstWithImage = instruments.find((i) => i.available && i.imageUrl);
    return apiAssetUrl(firstWithImage?.imageUrl);
  }, [instruments]);

  const serviceOptions = useMemo(
    () => [
      {
        id: "lessons",
        title: "Coaching",
        description:
          "1:1 or group sessions for instrument, voice, and production.",
      },
      {
        id: "support",
        title: "On-site support",
        description: "Coordination for load-in, timelines, and day-of details.",
      },
      {
        id: "delivery",
        title: "Delivery run",
        description: "Pickup and drop-off for rentals — venue or doorstep.",
      },
    ],
    [],
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
        subtitle: "A quick request with the essentials — tweak what you need.",
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
        subtitle: "Choose the gear — we handle the transport.",
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
        subtitle: "Rental + coaching to get performance-ready.",
        items: [
          ...(picks[3]
            ? ([{ kind: "instrument", id: picks[3] }] as const)
            : []),
          { kind: "service", id: "lessons" },
        ],
      },
    ];
  }, [instruments]);

  const [dealRemoved, setDealRemoved] = useState<Record<string, string[]>>({});

  function dealKey(item: DealItem): string {
    return `${item.kind}:${item.id}`;
  }

  function isDealItemRemoved(dealId: string, item: DealItem): boolean {
    return (dealRemoved[dealId] ?? []).includes(dealKey(item));
  }

  function toggleDealItem(dealId: string, item: DealItem) {
    setDealRemoved((prev) => {
      const key = dealKey(item);
      const next = new Set(prev[dealId] ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, [dealId]: Array.from(next) };
    });
  }

  function resetDeal(dealId: string) {
    setDealRemoved((prev) => {
      const { [dealId]: _, ...rest } = prev;
      return rest;
    });
  }

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
    previewInstruments.length,
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
      title="Muse"
      subtitle="Start here for the brand overview and quick entry points."
    >
      <div ref={contentRef} className={ui.stack} style={stackLgStyle}>
        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Triple A Music</p>
            <h2 className={ui.heroTitle}>Where live music gets organized.</h2>
            <p className={ui.heroLead}>
              Pick a workspace to jump in fast. Hosting an event? Running your
              performer workflow? Need rentals or day-of support? Start here.
            </p>

            <div className={ui.heroActions}>
              <Button onClick={openMusic}>I’m hosting an event</Button>
              <Button variant="secondary" onClick={openMusician}>
                I’m performing
              </Button>
              <Button variant="ghost" onClick={requestInMuse}>
                Rentals & support
              </Button>
              {!user ? (
                <Button variant="ghost" onClick={() => navigate("/account")}>
                  Sign in
                </Button>
              ) : null}
            </div>
          </div>

          <div className={cx(ui.media, ui.mediaWide)}>
            {heroImageUrl ? (
              <img src={heroImageUrl} alt="Catalog preview" loading="lazy" />
            ) : (
              <div className={ui.mediaPlaceholder}>Catalog</div>
            )}
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle} data-reveal>
            What you get
          </h2>
          <div className={ui.featureGrid} data-reveal>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>Host workspace</p>
              <p className={ui.featureBody}>
                Build an event, request musicians, and track confirmations in
                one place.
              </p>
            </div>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>Performer workspace</p>
              <p className={ui.featureBody}>
                Keep your availability clean, respond to requests, and manage
                your week.
              </p>
            </div>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>Tickets when you need them</p>
              <p className={ui.featureBody}>
                Turn on ticketing per event; inventory follows the venue’s
                capacity.
              </p>
            </div>
            <div className={ui.featureCard}>
              <p className={ui.featureTitle}>Support layer</p>
              <p className={ui.featureBody}>
                Rentals, coaching, delivery, and day-of help — requested through
                Muse.
              </p>
            </div>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle} data-reveal>
            Choose a workspace
          </h2>
          <div className={cx(ui.grid, ui.gridCards)} style={gridLgStyle}>
            <div
              className={cx(ui.card, ui.cardPad, ui.stack)}
              data-reveal
              style={stackSmStyle}
            >
              <span className={ui.chip}>Host</span>
              <p className={ui.cardTitle}>Run the event</p>
              <p className={ui.cardText}>
                Create the gig, request musicians, manage bookings, and
                optionally sell tickets.
              </p>
              <Button variant="secondary" onClick={openMusic}>
                Open Host Console
              </Button>
            </div>

            <div
              className={cx(ui.card, ui.cardPad, ui.stack)}
              data-reveal
              style={stackSmStyle}
            >
              <span className={ui.chip}>Performer</span>
              <p className={ui.cardTitle}>Run your week</p>
              <p className={ui.cardText}>
                Handle requests fast, keep your schedule accurate, and stay
                ready.
              </p>
              <Button variant="secondary" onClick={openMusician}>
                Open Performer Console
              </Button>
            </div>

            <div
              className={cx(ui.card, ui.cardPad, ui.stack)}
              data-reveal
              style={stackSmStyle}
            >
              <span className={ui.chip}>Support</span>
              <p className={ui.cardTitle}>Request rentals or help</p>
              <p className={ui.cardText}>
                Ask for rentals, coaching, delivery, or coordination — we’ll
                follow up.
              </p>
              <Button variant="secondary" onClick={requestInMuse}>
                Open Support Inbox
              </Button>
            </div>
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle} data-reveal>
            Instrument rentals
          </h2>

          {catalogError ? <p className={ui.error}>{catalogError}</p> : null}
          {catalogBusy ? <p className={ui.help}>Loading…</p> : null}

          {categories.length > 0 ? (
            <div
              data-reveal
              className={ui.scroller}
              style={{ "--scroller-gap": "8px" } as CSSProperties}
            >
              <Button
                variant={selectedCategory === "All" ? "secondary" : "ghost"}
                onClick={() => setSelectedCategory("All")}
              >
                All
              </Button>
              {categories.slice(0, 10).map((c) => (
                <Button
                  key={c}
                  variant={selectedCategory === c ? "secondary" : "ghost"}
                  onClick={() => setSelectedCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          ) : null}

          {!catalogBusy && previewInstruments.length === 0 ? (
            <p className={ui.help}>No items available right now.</p>
          ) : (
            <div className={ui.scroller}>
              {previewInstruments.map((item) => (
                <div
                  key={item.id}
                  data-reveal
                  className={cx(ui.card, ui.cardPad, ui.stack)}
                  style={{ ...(stackSmStyle as CSSProperties), minWidth: 260 }}
                >
                  <div className={cx(ui.media, ui.mediaSquare)}>
                    {item.imageUrl ? (
                      <img
                        src={apiAssetUrl(item.imageUrl)}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className={ui.mediaPlaceholder}>Rental</div>
                    )}
                  </div>
                  <p className={ui.cardTitle}>{item.name}</p>
                  <p className={ui.cardText}>
                    {item.category} · ${item.dailyRate}/day
                  </p>
                  <Button variant="secondary" onClick={requestInMuse}>
                    Request rental
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle} data-reveal>
            Services
          </h2>
          <div className={cx(ui.grid, ui.gridCards)} style={gridLgStyle}>
            {serviceOptions.map((s) => (
              <div
                key={s.id}
                data-reveal
                className={cx(ui.card, ui.cardPad, ui.stack)}
                style={stackSmStyle}
              >
                <span className={ui.chip}>Service</span>
                <p className={ui.cardTitle}>{s.title}</p>
                <p className={ui.cardText}>{s.description}</p>
                <Button variant="secondary" onClick={requestInMuse}>
                  Request service
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle} data-reveal>
            Bundles
          </h2>
          <div className={ui.scroller}>
            {deals.map((deal) => {
              const visibleItems = deal.items.filter(
                (item) => !isDealItemRemoved(deal.id, item),
              );

              const estimated = dealEstimatedDailyTotal({
                ...deal,
                items: visibleItems,
              });

              const firstInstrument = deal.items.find(
                (i): i is { kind: "instrument"; id: string } =>
                  i.kind === "instrument",
              );

              return (
                <div
                  key={deal.id}
                  data-reveal
                  className={cx(ui.card, ui.cardPad, ui.stack)}
                  style={{ ...(stackSmStyle as CSSProperties), minWidth: 340 }}
                >
                  <div>
                    <p className={ui.cardTitle}>{deal.title}</p>
                    <p className={ui.cardText} style={{ marginTop: 6 }}>
                      {deal.subtitle}
                    </p>
                  </div>

                  <div
                    className={ui.stack}
                    style={{ "--stack-gap": "8px" } as CSSProperties}
                  >
                    {deal.items.map((item, idx) => {
                      const line = dealLine(item);
                      const removed = isDealItemRemoved(deal.id, item);
                      return (
                        <div
                          key={`${item.kind}:${item.id}:${idx}`}
                          className={ui.lineItem}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p className={ui.lineItemTitle}>{line.title}</p>
                            {line.meta ? (
                              <p className={ui.lineItemMeta}>{line.meta}</p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant={removed ? "secondary" : "ghost"}
                            onClick={() => toggleDealItem(deal.id, item)}
                            style={{ minHeight: 30, padding: "6px 10px" }}
                          >
                            {removed ? "Add" : "Remove"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className={ui.rowBetween}>
                    <p className={ui.help} style={{ fontSize: 13 }}>
                      Est. gear total: ${estimated.toFixed(0)}/day
                    </p>
                    <div
                      className={ui.row}
                      style={{ "--row-gap": "8px" } as CSSProperties}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => resetDeal(deal.id)}
                        disabled={!dealRemoved[deal.id]?.length}
                        style={{ minHeight: 34, padding: "7px 10px" }}
                      >
                        Reset
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!firstInstrument}
                        onClick={requestInMuse}
                      >
                        Send request
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Why this page exists</p>
            <h2 className={ui.heroTitle}>One brand. Three workspaces.</h2>
            <p className={ui.heroLead}>
              Muse is the entry point. Jump into hosting or performing, and use
              the support inbox when you need rentals, coaching, delivery, or
              on-site help.
            </p>
          </div>

          <div className={ui.featureGrid}>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Clear entry points</p>
              <p className={ui.featureBody}>
                Pick Host or Performer and get to work immediately.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Real inventory</p>
              <p className={ui.featureBody}>
                Browse actual instruments with images and day rates.
              </p>
            </div>
            <div className={ui.featureCard} data-reveal>
              <p className={ui.featureTitle}>Human support</p>
              <p className={ui.featureBody}>
                Send a request and we coordinate the details with you.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
