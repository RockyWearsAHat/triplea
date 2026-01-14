import React, { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AppFrame,
  AppShell,
  Button,
  ChatInbox,
  RequireAnyRole,
  RequireRole,
  spacing,
  useScrollReveal,
  useAuth,
} from "@shared";
import {
  NavLink,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import "./App.css";
import ui from "@shared/styles/primitives.module.scss";
import type { EmployeeRole, Permission, User, UserRole } from "@shared/types";
import {
  type EmployeeInviteSummary,
  TripleAApiClient,
} from "@shared/api/client";

type TagProps = {
  label: string;
};

function Tag({ label }: TagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: 999,
        backgroundColor: "#020617",
        border: "1px solid #1f2937",
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: "#e5e7eb",
      }}
    >
      {label}
    </span>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <h2
        data-reveal
        style={{
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function HomeDashboardPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    []
  );
  const { user } = useAuth();
  const navigate = useNavigate();

  const contentRef = React.useRef<HTMLDivElement | null>(null);
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
            (c): c is string => typeof c === "string" && c.trim().length > 0
          )
      )
    );
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }, [instruments]);

  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Bias the initial view toward a smaller, category-based list for smoother first paint.
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
        description: "Book coaching for instrument, voice, and production.",
        path: "/new-request?type=lessons",
      },
      {
        id: "stage",
        title: "Stage setup",
        description: "On-site crew for load-in, PA, lighting, and logistics.",
        path: "/new-request?type=stage",
      },
      {
        id: "delivery",
        title: "Delivery & pickup",
        description: "Transport instruments and gear to/from the venue.",
        path: "/new-request?type=delivery",
      },
    ],
    []
  );

  const [rentalsLimit, setRentalsLimit] = useState(12);
  useEffect(() => {
    setRentalsLimit(12);
  }, [selectedCategory]);

  const displayedInstruments = useMemo(
    () => visibleInstruments.slice(0, rentalsLimit),
    [visibleInstruments, rentalsLimit]
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

  const [deals, setDeals] = useState<Deal[]>([
    {
      id: "deal-starter",
      title: "Starter package",
      subtitle: "A simple kit you can customize.",
      items: [
        { kind: "service", id: "delivery" },
        { kind: "service", id: "stage" },
      ],
    },
    {
      id: "deal-backline",
      title: "Backline + delivery",
      subtitle: "Pick your gear, we handle logistics.",
      items: [{ kind: "service", id: "delivery" }],
    },
    {
      id: "deal-coaching",
      title: "Practice & prep",
      subtitle: "Gear plus coaching.",
      items: [{ kind: "service", id: "lessons" }],
    },
  ]);

  const [seededDeals, setSeededDeals] = useState(false);
  useEffect(() => {
    if (seededDeals) return;
    if (instruments.length === 0) return;
    const picks = instruments
      .filter((i) => i.available)
      .slice(0, 4)
      .map((i) => i.id);
    if (picks.length === 0) return;

    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === "deal-backline") {
          return {
            ...d,
            items: [
              { kind: "instrument", id: picks[0] },
              ...(picks[1]
                ? [{ kind: "instrument", id: picks[1] } as const]
                : []),
              { kind: "service", id: "delivery" },
            ],
          };
        }
        if (d.id === "deal-coaching") {
          return {
            ...d,
            items: [
              { kind: "instrument", id: picks[2] ?? picks[0] },
              { kind: "service", id: "lessons" },
            ],
          };
        }
        if (d.id === "deal-starter") {
          return {
            ...d,
            items: [
              { kind: "instrument", id: picks[3] ?? picks[1] ?? picks[0] },
              { kind: "service", id: "delivery" },
            ],
          };
        }
        return d;
      })
    );
    setSeededDeals(true);
  }, [instruments, seededDeals]);

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
        (i): i is { kind: "instrument"; id: string } => i.kind === "instrument"
      )
      .map((i) => dealInstrumentById(i.id)?.dailyRate ?? 0)
      .reduce((a, b) => a + b, 0);
  }

  function removeDealItem(dealId: string, index: number) {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, items: d.items.filter((_, i) => i !== index) }
          : d
      )
    );
  }

  function addDealItem(dealId: string, value: string) {
    const [kind, id] = value.split(":");
    if (!kind || !id) return;
    if (kind !== "instrument" && kind !== "service") return;
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              items: [...d.items, { kind: kind as DealItem["kind"], id }],
            }
          : d
      )
    );
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
      title="Triple A Muse"
      subtitle="Gear + services marketplace for musicians and organizers."
    >
      <div
        ref={contentRef}
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>Gear & services marketplace</p>
            <h2 className={ui.heroTitle}>Rent gear in minutes.</h2>
            <p className={ui.heroLead}>
              Pick a category, browse what’s available, and rent with delivery
              or pickup.
            </p>

            <div className={ui.heroActions}>
              <Button
                onClick={() =>
                  document
                    .getElementById("muse-rentals")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Browse rentals
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  document
                    .getElementById("muse-services")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Services
              </Button>
              {!user ? (
                <Button variant="ghost" onClick={() => navigate("/account")}>
                  Sign in
                </Button>
              ) : null}
            </div>
          </div>
        </section>

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
                  if (!user) {
                    navigate(`/account?next=${encodeURIComponent(s.path)}`);
                    return;
                  }
                  navigate(s.path);
                }}
              >
                {s.title}
              </Button>
            ))}
          </div>
        </div>

        <Section title="Featured rentals">
          {catalogBusy ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading...</p>
          ) : displayedInstruments.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              No items available.
            </p>
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
                  <p style={{ margin: 0, fontWeight: 600 }}>{item.name}</p>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                    {item.category} · ${item.dailyRate}/day
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: spacing.sm,
                      marginTop: spacing.xs,
                    }}
                  >
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(`/instruments/${encodeURIComponent(item.id)}`)
                      }
                    >
                      View
                    </Button>
                    <Button
                      disabled={!item.available}
                      onClick={() => {
                        const target = `/instruments/${encodeURIComponent(
                          item.id
                        )}?rent=1`;
                        if (!user) {
                          navigate(
                            `/account?next=${encodeURIComponent(target)}`
                          );
                          return;
                        }
                        navigate(target);
                      }}
                    >
                      Rent
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Deals">
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
                  i.kind === "instrument"
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
                    <p style={{ margin: 0, fontWeight: 650 }}>{deal.title}</p>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "#9ca3af",
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
                            borderRadius: 12,
                            padding: "10px 12px",
                            background:
                              "color-mix(in srgb, var(--surface) 85%, transparent)",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                margin: 0,
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
                                  margin: "4px 0 0",
                                  color: "#9ca3af",
                                  fontSize: 12,
                                }}
                              >
                                {line.meta}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => removeDealItem(deal.id, idx)}
                          >
                            Remove
                          </Button>
                        </div>
                      );
                    })}

                    <div
                      style={{
                        display: "flex",
                        gap: spacing.sm,
                        alignItems: "center",
                      }}
                    >
                      <select
                        aria-label="Add to deal"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          e.currentTarget.value = "";
                          addDealItem(deal.id, v);
                        }}
                        className={ui.input}
                        style={{ height: 40 }}
                      >
                        <option value="" disabled>
                          Add item…
                        </option>
                        <optgroup label="Rentals">
                          {instruments.slice(0, 80).map((i) => (
                            <option key={i.id} value={`instrument:${i.id}`}>
                              {i.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Services">
                          {serviceOptions.map((s) => (
                            <option key={s.id} value={`service:${s.id}`}>
                              {s.title}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: spacing.sm,
                      alignItems: "center",
                    }}
                  >
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                      Est. gear total: ${estimated.toFixed(0)}/day
                    </p>
                    <Button
                      variant="secondary"
                      disabled={!firstInstrument}
                      onClick={() => {
                        if (!firstInstrument) return;
                        navigate(
                          `/instruments/${encodeURIComponent(
                            firstInstrument.id
                          )}`
                        );
                      }}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <div id="muse-rentals" />
        <Section title="Rentals">
          {catalogError ? <p className={ui.error}>{catalogError}</p> : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.lg,
            }}
          >
            {catalogBusy ? (
              <p style={{ color: "#9ca3af", fontSize: 14 }}>
                Loading catalog...
              </p>
            ) : visibleInstruments.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 14 }}>
                No items available.
              </p>
            ) : (
              displayedInstruments.map((item) => (
                <div
                  key={item.id}
                  data-reveal
                  className={[ui.card, ui.cardPad].join(" ")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing.sm,
                  }}
                >
                  {item.imageUrl ? (
                    <div
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        backgroundColor:
                          "color-mix(in srgb, var(--surface) 70%, transparent)",
                      }}
                    >
                      <img
                        src={`http://localhost:4000${item.imageUrl}`}
                        alt={item.name}
                        style={{
                          width: "100%",
                          height: 140,
                          objectFit: "cover",
                          display: "block",
                        }}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  ) : null}
                  <p style={{ margin: 0, fontWeight: 600 }}>{item.name}</p>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                    {item.category} · ${item.dailyRate}/day
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: item.available ? "#9ca3af" : "#f87171",
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
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(`/instruments/${encodeURIComponent(item.id)}`)
                      }
                    >
                      View
                    </Button>
                    <Button
                      disabled={!item.available}
                      onClick={() => {
                        const target = `/instruments/${encodeURIComponent(
                          item.id
                        )}?rent=1`;
                        if (!user) {
                          navigate(
                            `/account?next=${encodeURIComponent(target)}`
                          );
                          return;
                        }
                        navigate(target);
                      }}
                    >
                      Rent
                    </Button>
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
                <p style={{ margin: 0, fontWeight: 600 }}>{s.title}</p>
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                  {s.description}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!user) {
                      navigate(`/account?next=${encodeURIComponent(s.path)}`);
                      return;
                    }
                    navigate(s.path);
                  }}
                >
                  {user ? "Request" : "Sign in to request"}
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Operations snapshot">
          <div data-reveal className={[ui.card, ui.cardPad].join(" ")}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: spacing.md,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                  Open requests
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 650 }}>
                  7
                </p>
                <p
                  style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}
                >
                  3 awaiting confirmation, 4 scheduled.
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                  Pickups today
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 650 }}>
                  2
                </p>
                <p
                  style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}
                >
                  Warehouse pickups.
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                  Deliveries today
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 650 }}>
                  3
                </p>
                <p
                  style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}
                >
                  1 club, 2 private events.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <section className={ui.hero} data-reveal>
          <div>
            <p className={ui.heroKicker}>What this is</p>
            <h2 className={ui.heroTitle}>
              Everything around the gig — handled.
            </h2>
            <p className={ui.heroLead}>
              Muse is the marketplace for the stuff that makes gigs happen:
              rentals, lessons, stage setup, and logistics.
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

function AdminDashboardPage() {
  const navigate = useNavigate();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    []
  );
  const { hasPermission } = useAuth();
  const canManageEmployees = hasPermission("manage_employees");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [invites, setInvites] = useState<EmployeeInviteSummary[]>([]);
  const [invitesBusy, setInvitesBusy] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);

  async function loadInvites() {
    if (!canManageEmployees) return;
    setInvitesError(null);
    setInvitesBusy(true);
    try {
      const data = await api.adminListEmployeeInvites();
      setInvites(data);
    } catch (e) {
      setInvitesError(e instanceof Error ? e.message : String(e));
    } finally {
      setInvitesBusy(false);
    }
  }

  async function createEmployeeInvite() {
    if (!canManageEmployees) {
      setInviteError("You do not have permission to manage employees.");
      return;
    }
    setInviteError(null);
    setInviteLink(null);
    setInviteBusy(true);
    try {
      const data = await api.adminCreateEmployeeInvite({
        email: inviteEmail,
        expiresInHours: 24,
        employeeRoles: [],
      });
      const link = `${window.location.origin}/invite?token=${encodeURIComponent(
        data.token
      )}`;
      setInviteLink(link);
      await loadInvites();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : String(e));
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!canManageEmployees) {
      setInvitesError("You do not have permission to manage employees.");
      return;
    }
    setInvitesError(null);
    setRevokeBusyId(inviteId);
    try {
      await api.adminRevokeEmployeeInvite(inviteId);
      await loadInvites();
    } catch (e) {
      setInvitesError(e instanceof Error ? e.message : String(e));
    } finally {
      setRevokeBusyId(null);
    }
  }

  useEffect(() => {
    if (!canManageEmployees) return;
    void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageEmployees]);

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Control access, employees, and high-level operations."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
        }}
      >
        <Section title="People & access">
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              Assign roles like operations, gear tech, and drivers to employees.
              This is where permission-based access will be managed.
            </p>
            <Button
              variant="secondary"
              style={{ alignSelf: "flex-start" }}
              onClick={() => navigate("/admin/users")}
            >
              Manage employees
            </Button>
          </div>
        </Section>

        <Section title="Employee onboarding">
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              flexDirection: "column",
              gap: spacing.md,
              maxWidth: 520,
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              Employees can only register via a private, expiring invite link.
              Admin accounts cannot be self-registered.
            </p>

            {!canManageEmployees ? (
              <p className={ui.error} style={{ margin: 0 }}>
                You do not have permission to invite employees.
              </p>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13 }}>Employee email</label>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="employee@company.com"
                style={{
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: 12,
                  border: "1px solid #374151",
                  backgroundColor: "#020617",
                  color: "white",
                }}
              />
            </div>

            {inviteError && (
              <p className={ui.error} style={{ margin: 0 }}>
                {inviteError}
              </p>
            )}

            <Button
              onClick={createEmployeeInvite}
              disabled={
                inviteBusy || !inviteEmail.trim() || !canManageEmployees
              }
            >
              {inviteBusy ? "Creating invite..." : "Create invite link"}
            </Button>

            {inviteLink && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                  Copy and email this link to the employee:
                </p>
                <input
                  readOnly
                  value={inviteLink}
                  style={{
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderRadius: 12,
                    border: "1px solid #374151",
                    backgroundColor: "#020617",
                    color: "white",
                  }}
                />
              </div>
            )}

            <div
              style={{
                height: 1,
                backgroundColor: "#1f2937",
                width: "100%",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                Recent invites
              </p>
              <Button
                variant="secondary"
                onClick={loadInvites}
                disabled={invitesBusy || !canManageEmployees}
              >
                {invitesBusy ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {invitesError && (
              <p className={ui.error} style={{ margin: 0 }}>
                {invitesError}
              </p>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "#9ca3af",
                        paddingBottom: 8,
                      }}
                    >
                      Email
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "#9ca3af",
                        paddingBottom: 8,
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "#9ca3af",
                        paddingBottom: 8,
                      }}
                    >
                      Expires
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "#9ca3af",
                        paddingBottom: 8,
                      }}
                    >
                      Created
                    </th>
                    <th style={{ paddingBottom: 8 }} />
                  </tr>
                </thead>
                <tbody>
                  {invites.length === 0 && !invitesBusy ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{ color: "#9ca3af", fontSize: 13 }}
                      >
                        No invites yet.
                      </td>
                    </tr>
                  ) : (
                    invites.map((inv) => {
                      const now = Date.now();
                      const expiresAtMs = Date.parse(inv.expiresAt);
                      const isExpired = Number.isFinite(expiresAtMs)
                        ? expiresAtMs < now
                        : false;

                      const status = inv.revokedAt
                        ? "Revoked"
                        : inv.usedAt
                        ? "Used"
                        : isExpired
                        ? "Expired"
                        : "Active";

                      const canRevoke = !inv.usedAt && !inv.revokedAt;

                      return (
                        <tr key={inv.id}>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid #1f2937",
                              fontSize: 13,
                            }}
                          >
                            {inv.email}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid #1f2937",
                              fontSize: 13,
                              color: "#9ca3af",
                            }}
                          >
                            {status}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid #1f2937",
                              fontSize: 13,
                              color: "#9ca3af",
                            }}
                          >
                            {new Date(inv.expiresAt).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid #1f2937",
                              fontSize: 13,
                              color: "#9ca3af",
                            }}
                          >
                            {new Date(inv.createdAt).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              borderTop: "1px solid #1f2937",
                              textAlign: "right",
                            }}
                          >
                            {canRevoke ? (
                              <Button
                                variant="secondary"
                                onClick={() => revokeInvite(inv.id)}
                                disabled={revokeBusyId === inv.id}
                              >
                                {revokeBusyId === inv.id
                                  ? "Revoking..."
                                  : "Revoke"}
                              </Button>
                            ) : (
                              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Section title="Operational overview">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: spacing.lg,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>Active employees</p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>5</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                3 on logistics, 2 on staging.
              </p>
            </div>
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                Open gear tickets
              </p>
              <p style={{ fontSize: 28, fontWeight: 600 }}>4</p>
              <p style={{ fontSize: 12, color: "#9ca3af" }}>
                2 for tonight, 2 this weekend.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function AdminUsersPage() {
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    []
  );

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .adminListUsers()
      .then((data) => setUsers(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api]);

  const allRoles: UserRole[] = [
    "customer",
    "musician",
    "teacher",
    "rental_provider",
    "admin",
  ];
  const allPermissions: Permission[] = [
    "view_admin_dashboard",
    "manage_employees",
    "view_musician_dashboard",
    "view_customer_dashboard",
    "view_employee_dashboard",
    "manage_gear_requests",
    "manage_venue_ads",
  ];
  const allEmployeeRoles: EmployeeRole[] = [
    "operations_manager",
    "gear_tech",
    "driver",
    "warehouse",
  ];

  function toggleInList<T extends string>(
    list: T[] | undefined,
    value: T
  ): T[] {
    const current = list ?? [];
    return current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
  }

  async function saveUser(u: User) {
    setSavingId(u.id);
    setError(null);
    try {
      const updated = await api.adminUpdateUser({
        id: u.id,
        roles: u.role,
        permissions: u.permissions ?? [],
        employeeRoles: u.employeeRoles ?? [],
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppShell
      title="User admin"
      subtitle="Assign roles, permissions, and employee job functions."
    >
      <div
        style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}
      >
        {loading && <p className={ui.help}>Loading users…</p>}
        {error && <p className={ui.error}>{error}</p>}
        {!loading && users.length === 0 && (
          <p className={ui.help}>No users found.</p>
        )}

        {users.map((u) => (
          <div key={u.id} className={[ui.card, ui.cardPad].join(" ")}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.md,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 260 }}>
                <p style={{ fontWeight: 600 }}>{u.name}</p>
                <p className={ui.help}>{u.email}</p>
                <p className={ui.help}>ID: {u.id}</p>
              </div>
              <Button
                variant="secondary"
                disabled={savingId === u.id}
                onClick={() => saveUser(u)}
              >
                {savingId === u.id ? "Saving…" : "Save"}
              </Button>
            </div>

            <div
              style={{
                marginTop: spacing.md,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: spacing.lg,
              }}
            >
              <div>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Roles</p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {allRoles.map((r) => (
                    <label
                      key={r}
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={u.role.includes(r)}
                        onChange={() =>
                          setUsers((prev) =>
                            prev.map((x) =>
                              x.id === u.id
                                ? { ...x, role: toggleInList(x.role, r) }
                                : x
                            )
                          )
                        }
                      />
                      <span style={{ fontSize: 13 }}>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Permissions</p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {allPermissions.map((p) => (
                    <label
                      key={p}
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={(u.permissions ?? []).includes(p)}
                        onChange={() =>
                          setUsers((prev) =>
                            prev.map((x) =>
                              x.id === u.id
                                ? {
                                    ...x,
                                    permissions: toggleInList(
                                      x.permissions ?? [],
                                      p
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                      />
                      <span style={{ fontSize: 13 }}>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>
                  Employee roles
                </p>
                <p className={ui.help} style={{ marginBottom: 8 }}>
                  Only relevant for internal employees.
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {allEmployeeRoles.map((er) => (
                    <label
                      key={er}
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={(u.employeeRoles ?? []).includes(er)}
                        onChange={() =>
                          setUsers((prev) =>
                            prev.map((x) =>
                              x.id === u.id
                                ? {
                                    ...x,
                                    employeeRoles: toggleInList(
                                      x.employeeRoles ?? [],
                                      er
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                      />
                      <span style={{ fontSize: 13 }}>{er}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function EmployeeDashboardPage() {
  return (
    <AppShell
      title="Employee dashboard"
      subtitle="Today's gear runs, pickups, and on-site jobs."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <Section title="Your tasks today">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            <div
              style={{
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            >
              <h3 style={{ fontWeight: 600 }}>Deliver backline to City Club</h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Pickup 17:00 · Load-in 17:30 · Contact: Jamie (musician).
              </p>
              <div
                style={{
                  display: "flex",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Button variant="secondary">Mark in progress</Button>
                <Button variant="ghost">View route</Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function NewRequestPage() {
  const { user, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [requestType, setRequestType] = useState<
    "gear" | "lessons" | "stage" | "delivery"
  >(
    (searchParams.get("type") as "gear" | "lessons" | "stage" | "delivery") ||
      "gear"
  );
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [city, setCity] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canRequest = hasAnyRole(["customer", "musician"]);

  useEffect(() => {
    if (!user) {
      const next = `${location.pathname}${location.search}`;
      navigate(`/account?next=${encodeURIComponent(next)}`);
      return;
    }
  }, [user, location.pathname, location.search, navigate]);

  return (
    <AppShell
      title="New request"
      subtitle="Tell us what you need for your gig or event."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          maxWidth: 640,
        }}
      >
        {!canRequest ? (
          <p className={ui.error} style={{ margin: 0 }}>
            Requests are available for customer and musician accounts.
          </p>
        ) : null}

        {submitted ? (
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            Request submitted (demo). Next step will be routing to ops/employee
            queues.
          </div>
        ) : null}

        <Section title="Service type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
            <Button
              variant={requestType === "gear" ? "primary" : "secondary"}
              onClick={() => setRequestType("gear")}
              disabled={!canRequest}
            >
              Gear / backline
            </Button>
            <Button
              variant={requestType === "lessons" ? "primary" : "secondary"}
              onClick={() => setRequestType("lessons")}
              disabled={!canRequest}
            >
              Lessons
            </Button>
            <Button
              variant={requestType === "stage" ? "primary" : "secondary"}
              onClick={() => setRequestType("stage")}
              disabled={!canRequest}
            >
              Stage setup
            </Button>
            <Button
              variant={requestType === "delivery" ? "primary" : "secondary"}
              onClick={() => setRequestType("delivery")}
              disabled={!canRequest}
            >
              Delivery & pickup
            </Button>
          </div>
        </Section>

        <Section title="Who are you?">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing.sm,
            }}
          >
            <Button>Musician / band</Button>
            <Button variant="secondary">Event organiser</Button>
          </div>
        </Section>

        <Section title="Event details">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: spacing.md,
            }}
          >
            <input
              placeholder="Event name or venue"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 12,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 12,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
            <input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 12,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
          </div>
        </Section>

        <Section title="What do you need?">
          <textarea
            placeholder="Backline, PA, lights, transport, on-site crew… give as much detail as you can."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            style={{
              minHeight: 120,
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
              resize: "vertical",
            }}
          />
        </Section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <Button
            disabled={!canRequest}
            onClick={() => {
              if (!canRequest) return;
              setSubmitted(true);
            }}
          >
            Submit request
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setEventName("");
              setEventDate("");
              setCity("");
              setDetails("");
              setSubmitted(false);
              setRequestType((searchParams.get("type") as any) || "gear");
            }}
          >
            Clear
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function RequestsPage() {
  return (
    <AppShell
      title="Requests"
      subtitle="Track gear, lessons, and logistics requests in one queue."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          <Tag label="All" />
          <Tag label="Pending" />
          <Tag label="Confirmed" />
          <Tag label="In progress" />
          <Tag label="Completed" />
        </div>

        {[1, 2, 3].map((id) => (
          <div
            key={id}
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: spacing.lg,
            }}
          >
            <div>
              <h3 style={{ fontWeight: 600 }}>
                Rooftop launch · Full PA + backline
              </h3>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Sat 22:00 · City centre · 150 guests
              </p>
              <p
                style={{
                  marginTop: spacing.xs,
                  color: "#9ca3af",
                  fontSize: 13,
                }}
              >
                Guitar amps, bass rig, 4 vocal mics, 2 monitor mixes, basic
                lighting.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
                minWidth: 200,
              }}
            >
              <div style={{ display: "flex", gap: spacing.xs }}>
                <Tag label="Pending" />
                <Tag label="Gear" />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: spacing.sm,
                  marginTop: spacing.sm,
                }}
              >
                <Button fullWidth>Confirm</Button>
                <Button variant="ghost" fullWidth>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function AccountPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);

      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        navigate(next);
        return;
      }

      navigate("/");
    } catch (err) {
      setError("Login failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Muse account"
      subtitle="Where performer, customer, and service-consumer roles come together."
    >
      {user ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
            maxWidth: 420,
          }}
        >
          <p>
            Signed in as <strong>{user.name}</strong> ({user.email})
          </p>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Roles: {user.role.join(", ")}
          </p>
          <Button
            variant="secondary"
            onClick={logout}
            style={{ alignSelf: "flex-start" }}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
          }}
        >
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Sign in to access admin and employee dashboards.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 13 }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: 999,
                border: "1px solid #374151",
                backgroundColor: "#020617",
                color: "white",
              }}
            />
          </div>
          {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/register")}
          >
            Create an account
          </Button>
        </form>
      )}
    </AppShell>
  );
}

function InstrumentDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    []
  );
  const { user, hasAnyRole } = useAuth();
  const navigate = useNavigate();

  const canRent = hasAnyRole(["customer", "musician"]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<{
    id: string;
    name: string;
    category: string;
    dailyRate: number;
    available: boolean;
  } | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(true);
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }

    api
      .getPublicInstrument(id)
      .then((found) => setItem(found))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [api, id]);

  const wantsRent = searchParams.get("rent") === "1";

  useEffect(() => {
    if (!wantsRent) return;
    if (user) return;

    const next = `${location.pathname}${location.search}`;
    navigate(`/account?next=${encodeURIComponent(next)}`);
  }, [wantsRent, user, location.pathname, location.search, navigate]);

  const startMs = startDate ? Date.parse(startDate) : NaN;
  const endMs = endDate ? Date.parse(endDate) : NaN;
  const days =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)))
      : null;

  if (loading) {
    return (
      <AppShell title="Instrument" subtitle="Loading...">
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading details...</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Instrument" subtitle="Error">
        <p className={ui.error}>{error}</p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Back
        </Button>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell title="Instrument" subtitle="Not found">
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Item not found.</p>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Back to browse
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={item.name}
      subtitle={`${item.category} · $${item.dailyRate}/day`}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.lg,
          maxWidth: 720,
        }}
      >
        <div
          style={{
            padding: spacing.lg,
            borderRadius: 12,
            backgroundColor: "#020617",
            border: "1px solid #1f2937",
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
          }}
        >
          <p
            style={{
              margin: 0,
              color: item.available ? "#9ca3af" : "#f87171",
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
              flexWrap: "wrap",
            }}
          >
            <Button variant="secondary" onClick={() => navigate("/")}>
              Back
            </Button>
            <Button
              disabled={!item.available}
              onClick={() => {
                const target = `/instruments/${encodeURIComponent(
                  item.id
                )}?rent=1`;
                if (!user) {
                  navigate(`/account?next=${encodeURIComponent(target)}`);
                  return;
                }
                navigate(target);
              }}
            >
              {user ? "Start rental" : "Sign in to rent"}
            </Button>
          </div>
        </div>

        {wantsRent ? (
          <div
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
            }}
          >
            {!user ? (
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                Sign in to request a rental.
              </p>
            ) : !canRent ? (
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
                Rentals are available for customer and musician accounts.
              </p>
            ) : (
              <>
                <p style={{ margin: 0, fontWeight: 600 }}>Rental request</p>
                <p
                  style={{
                    marginTop: spacing.xs,
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
                >
                  Select dates and fulfilment. Submitting will create a demo
                  request (no backend yet).
                </p>

                {submitError ? (
                  <p className={ui.error} style={{ margin: 0 }}>
                    {submitError}
                  </p>
                ) : null}

                {submitted ? (
                  <div
                    style={{
                      marginTop: spacing.md,
                      padding: spacing.md,
                      borderRadius: 12,
                      border: "1px solid #1f2937",
                      color: "#9ca3af",
                      fontSize: 14,
                    }}
                  >
                    Request submitted (demo). You can now continue browsing.
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: spacing.md,
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: spacing.md,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <label style={{ fontSize: 13 }}>Start date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: 12,
                          border: "1px solid #374151",
                          backgroundColor: "#020617",
                          color: "white",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <label style={{ fontSize: 13 }}>End date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: 12,
                          border: "1px solid #374151",
                          backgroundColor: "#020617",
                          color: "white",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <label style={{ fontSize: 13 }}>Fulfilment</label>
                      <select
                        value={fulfilment}
                        onChange={(e) =>
                          setFulfilment(e.target.value as "pickup" | "delivery")
                        }
                        style={{
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: 12,
                          border: "1px solid #374151",
                          backgroundColor: "#020617",
                          color: "white",
                        }}
                      >
                        <option value="pickup">Pickup</option>
                        <option value="delivery">Delivery</option>
                      </select>
                    </div>
                    {fulfilment === "delivery" ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <label style={{ fontSize: 13 }}>Delivery address</label>
                        <input
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Street, city"
                          style={{
                            padding: `${spacing.sm}px ${spacing.md}px`,
                            borderRadius: 12,
                            border: "1px solid #374151",
                            backgroundColor: "#020617",
                            color: "white",
                          }}
                        />
                      </div>
                    ) : null}

                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <label style={{ fontSize: 13 }}>Notes (optional)</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Pickup time, special handling, venue constraints..."
                        style={{
                          minHeight: 90,
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: 12,
                          border: "1px solid #374151",
                          backgroundColor: "#020617",
                          color: "white",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        gap: spacing.sm,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Button
                        onClick={() => {
                          setSubmitError(null);
                          if (!startDate || !endDate) {
                            setSubmitError(
                              "Please select a start and end date."
                            );
                            return;
                          }
                          if (
                            !Number.isFinite(startMs) ||
                            !Number.isFinite(endMs) ||
                            endMs < startMs
                          ) {
                            setSubmitError(
                              "End date must be on or after start date."
                            );
                            return;
                          }
                          if (
                            fulfilment === "delivery" &&
                            !deliveryAddress.trim()
                          ) {
                            setSubmitError("Please enter a delivery address.");
                            return;
                          }
                          setSubmitted(true);
                        }}
                      >
                        Submit rental request
                      </Button>
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>
                        {days
                          ? `Estimated total: $${(
                              days * item.dailyRate
                            ).toFixed(0)} (${days} day${days === 1 ? "" : "s"})`
                          : "Select dates to see estimate"}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [accountType, setAccountType] = React.useState<"musician" | "customer">(
    "customer"
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        roles: [accountType],
      });
      navigate("/");
    } catch (err) {
      setError("Registration failed. Please try a different email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Create account"
      subtitle="Unified identity across Triple A apps."
    >
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Account type</label>
          <select
            value={accountType}
            onChange={(e) =>
              setAccountType(e.target.value as "musician" | "customer")
            }
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          >
            <option value="customer">Customer / organiser</option>
            <option value="musician">Musician</option>
          </select>
          <p className={ui.help} style={{ margin: "6px 0 0 0" }}>
            Employees must use an invite link. Admins cannot self-register.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/account")}
        >
          Back to sign in
        </Button>
      </form>
    </AppShell>
  );
}

function InviteOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    []
  );

  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.registerWithInvite({ token, name, email, password });
      navigate("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Employee onboarding"
      subtitle="Use your private invite link to create an employee account."
    >
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Invite token</label>
          <input
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Email (must match invite)</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: 12,
              border: "1px solid #374151",
              backgroundColor: "#020617",
              color: "white",
            }}
          />
        </div>

        {error && <p className={ui.error}>{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create employee account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/account")}
        >
          Back to account
        </Button>
      </form>
    </AppShell>
  );
}

function NavBar() {
  const { user } = useAuth();
  return (
    <nav className={ui.nav}>
      <NavLink
        to="/"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Browse
      </NavLink>
      {user?.role.includes("admin") && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Admin
        </NavLink>
      )}
      {user?.role.includes("rental_provider") && (
        <NavLink
          to="/employee"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Employee
        </NavLink>
      )}
      {user && (
        <NavLink
          to="/messages"
          className={({ isActive }) =>
            [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
          }
        >
          Messages
        </NavLink>
      )}

      {user?.role.includes("customer") && (
        <>
          <NavLink
            to="/new-request"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            New request
          </NavLink>
          <NavLink
            to="/requests"
            className={({ isActive }) =>
              [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
            }
          >
            Requests
          </NavLink>
        </>
      )}
      <NavLink
        to="/account"
        className={({ isActive }) =>
          [ui.navLink, isActive ? ui.navLinkActive : ""].join(" ")
        }
      >
        Account
      </NavLink>
    </nav>
  );
}

function MessagesPage() {
  return (
    <AppShell
      title="Messages"
      subtitle="Inbox for client support and internal coordination."
    >
      <ChatInbox />
    </AppShell>
  );
}

function App() {
  return (
    <AppFrame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
          flex: 1,
          minHeight: 0,
        }}
      >
        <NavBar />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/" element={<HomeDashboardPage />} />
            <Route
              path="/instruments/:id"
              element={<InstrumentDetailsPage />}
            />
            <Route path="/new-request" element={<NewRequestPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route
              path="/messages"
              element={
                <RequireAnyRole
                  roles={["customer", "musician", "rental_provider", "admin"]}
                >
                  <MessagesPage />
                </RequireAnyRole>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireRole role="admin">
                  <AdminDashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole role="admin">
                  <AdminUsersPage />
                </RequireRole>
              }
            />
            <Route
              path="/employee"
              element={
                <RequireAnyRole roles={["rental_provider"]}>
                  <EmployeeDashboardPage />
                </RequireAnyRole>
              }
            />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite" element={<InviteOnboardingPage />} />
          </Routes>
        </div>
      </div>
    </AppFrame>
  );
}

export default App;
