import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Ticket } from "@shared";
import { Button, useAuth } from "@shared";
import styles from "./MyTicketsPage.module.scss";
import { createApiClient, getAssetUrl } from "../lib/urls";

type TabFilter = "upcoming" | "past" | "all";

export default function MyTicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const api = useMemo(() => createApiClient(), []);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("upcoming");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchTickets = async () => {
      try {
        const data = await api.getMyTickets();
        if (!cancelled) {
          setTickets(data.tickets);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load tickets",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTickets();
    return () => {
      cancelled = true;
    };
  }, [api, user, navigate]);

  // Filter tickets based on tab
  const filteredTickets = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return tickets.filter((ticket) => {
      if (!ticket.gig?.date) return activeTab === "all";

      const eventDate = new Date(ticket.gig.date);
      eventDate.setHours(0, 0, 0, 0);

      switch (activeTab) {
        case "upcoming":
          return eventDate >= now && ticket.status === "valid";
        case "past":
          return eventDate < now || ticket.status === "used";
        case "all":
        default:
          return true;
      }
    });
  }, [tickets, activeTab]);

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <p>Loading your tickets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <h2>Unable to load tickets</h2>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Tickets</h1>
        <p>View and manage your event tickets</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "upcoming" ? styles.active : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          Upcoming
        </button>
        <button
          className={`${styles.tab} ${activeTab === "past" ? styles.active : ""}`}
          onClick={() => setActiveTab("past")}
        >
          Past
        </button>
        <button
          className={`${styles.tab} ${activeTab === "all" ? styles.active : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All
        </button>
      </div>

      {filteredTickets.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎫</div>
          <h2>
            {activeTab === "upcoming"
              ? "No upcoming tickets"
              : activeTab === "past"
                ? "No past tickets"
                : "No tickets yet"}
          </h2>
          <p>
            {activeTab === "upcoming"
              ? "Your upcoming event tickets will appear here."
              : activeTab === "past"
                ? "Your past event tickets will appear here."
                : "Browse concerts and get your first ticket!"}
          </p>
          <Button onClick={() => navigate("/")}>Find concerts</Button>
        </div>
      ) : (
        <div className={styles.ticketsList}>
          {filteredTickets.map((ticket) => {
            const formattedDate = ticket.gig?.date
              ? new Date(ticket.gig.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : null;

            const statusLabel = {
              valid: "Valid",
              used: "Used",
              cancelled: "Cancelled",
              expired: "Expired",
            }[ticket.status];

            return (
              <div
                key={ticket.id}
                className={`${styles.ticketCard} ${ticket.status === "used" ? styles.used : ""}`}
                onClick={() => navigate(`/tickets/${ticket.confirmationCode}`)}
              >
                <div className={styles.ticketCardInner}>
                  <div className={styles.ticketImage}>
                    {ticket.location?.id ? (
                      <img
                        src={getAssetUrl(
                          `/api/public/locations/${ticket.location.id}/images/0`,
                        )}
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (
                            e.target as HTMLImageElement
                          ).parentElement!.innerHTML =
                            '<div class="' +
                            styles.imagePlaceholder +
                            '">🎵</div>';
                        }}
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>🎵</div>
                    )}
                  </div>

                  <div className={styles.ticketInfo}>
                    <h3 className={styles.ticketTitle}>
                      {ticket.gig?.title || "Event"}
                      <span
                        className={`${styles.statusChip} ${styles[ticket.status]}`}
                      >
                        {statusLabel}
                      </span>
                    </h3>
                    <div className={styles.ticketMeta}>
                      {formattedDate && (
                        <div className={styles.metaRow}>
                          <span className={styles.icon}>📅</span>
                          <span>
                            {formattedDate}
                            {ticket.gig?.time && ` at ${ticket.gig.time}`}
                          </span>
                        </div>
                      )}
                      {ticket.location?.name && (
                        <div className={styles.metaRow}>
                          <span className={styles.icon}>📍</span>
                          <span>
                            {ticket.location.name}
                            {ticket.location.city &&
                              `, ${ticket.location.city}`}
                          </span>
                        </div>
                      )}
                      <div className={styles.metaRow}>
                        <span className={styles.icon}>🎫</span>
                        <span>{ticket.confirmationCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.ticketActions}>
                    <div className={styles.ticketQuantity}>
                      <span>{ticket.quantity}</span>
                      {ticket.quantity === 1 ? "ticket" : "tickets"}
                    </div>
                    <button className={styles.viewButton}>View</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
