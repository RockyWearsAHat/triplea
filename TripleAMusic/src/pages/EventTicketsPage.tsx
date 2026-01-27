import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import { createApiClient } from "../lib/urls";
import { HostDashboardShell } from "../components/HostDashboardShell";
import styles from "./EventTicketsPage.module.scss";
import {
  Ticket,
  Mail,
  Gift,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Send,
  Users,
  DollarSign,
} from "lucide-react";

interface TicketData {
  id: string;
  confirmationCode: string;
  quantity: number;
  holderName: string;
  email: string;
  totalPaid: number;
  status: string;
  usedAt: string | null;
  createdAt: string;
  tierName?: string;
  seatAssignments?: Array<{
    seatId: string;
    section: string;
    row: string;
    seatNumber: string;
  }>;
  isComped?: boolean;
  issuedByHost?: boolean;
}

interface TicketStats {
  total: number;
  valid: number;
  used: number;
  cancelled: number;
  revenue: number;
}

interface GigData {
  id: string;
  title: string;
  date: string;
  time?: string;
  ticketPrice?: number;
}

interface TierData {
  id: string;
  name: string;
  price: number;
  capacity: number;
  sold: number;
  remaining: number;
  available: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { className: string; icon: React.ReactNode; label: string }
  > = {
    valid: {
      className: styles.badgeValid,
      icon: <CheckCircle2 size={12} />,
      label: "Valid",
    },
    used: {
      className: styles.badgeUsed,
      icon: <CheckCircle2 size={12} />,
      label: "Used",
    },
    cancelled: {
      className: styles.badgeCancelled,
      icon: <XCircle size={12} />,
      label: "Cancelled",
    },
    expired: {
      className: styles.badgeExpired,
      icon: <Clock size={12} />,
      label: "Expired",
    },
  };
  const c = config[status] || config.valid;
  return (
    <span className={`${styles.badge} ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function IssueTicketModal({
  gigId,
  tiers,
  defaultPrice,
  onClose,
  onSuccess,
}: {
  gigId: string;
  tiers: TierData[];
  defaultPrice: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const api = useMemo(() => createApiClient(), []);
  const [email, setEmail] = useState("");
  const [holderName, setHolderName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [tierId, setTierId] = useState("");
  const [isComp, setIsComp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.issueTicket({
        gigId,
        email,
        holderName,
        quantity,
        tierId: tierId || undefined,
        isComp,
        sendEmail,
        note: note || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue ticket");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTier = tiers.find((t) => t.id === tierId);
  const pricePerTicket = isComp ? 0 : (selectedTier?.price ?? defaultPrice);
  const total = pricePerTicket * quantity;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            <Gift size={20} /> Issue Tickets
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={ui.field}>
            <label className={ui.label}>Recipient Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={ui.input}
              placeholder="guest@example.com"
              required
            />
            <p className={ui.help}>
              The ticket will be sent to this email address
            </p>
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Name on Ticket *</label>
            <input
              type="text"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className={ui.input}
              placeholder="John Doe"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={ui.field}>
              <label className={ui.label}>Quantity</label>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className={ui.input}
              />
            </div>

            {tiers.length > 0 && (
              <div className={ui.field}>
                <label className={ui.label}>Ticket Tier</label>
                <select
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value)}
                  className={ui.input}
                >
                  <option value="">General Admission</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (${t.price} - {t.remaining} left)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={styles.ticketTypeToggle}>
            <label className={styles.toggleOption}>
              <input
                type="radio"
                name="ticketType"
                checked={isComp}
                onChange={() => setIsComp(true)}
              />
              <div className={styles.toggleContent}>
                <Gift size={16} />
                <span>Complimentary (Free)</span>
              </div>
            </label>
            <label className={styles.toggleOption}>
              <input
                type="radio"
                name="ticketType"
                checked={!isComp}
                onChange={() => setIsComp(false)}
              />
              <div className={styles.toggleContent}>
                <DollarSign size={16} />
                <span>Paid (${pricePerTicket})</span>
              </div>
            </label>
          </div>

          <div className={ui.field}>
            <label className={ui.label}>Personal Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={ui.input}
              placeholder="Thanks for being a VIP guest!"
              rows={2}
            />
          </div>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <span>Send ticket email to recipient</span>
          </label>

          {error && <p className={ui.error}>{error}</p>}

          <div className={styles.modalSummary}>
            <div className={styles.summaryRow}>
              <span>Tickets</span>
              <span>
                {quantity}x {isComp ? "Comp" : `$${pricePerTicket}`}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Total</strong>
              <strong>{isComp ? "Free" : `$${total.toFixed(2)}`}</strong>
            </div>
          </div>

          <div className={styles.modalActions}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Issuing..." : "Issue Ticket"}
              <Send size={14} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EventTicketsPage() {
  const { gigId } = useParams<{ gigId: string }>();
  const navigate = useNavigate();
  useAuth(); // Ensure user is authenticated
  const api = useMemo(() => createApiClient(), []);

  const [loading, setLoading] = useState(true);
  const [gig, setGig] = useState<GigData | null>(null);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!gigId) return;

    setLoading(true);
    Promise.all([
      api.getGig(gigId).catch(() => null),
      api.getGigTickets(gigId).catch(() => ({ tickets: [], stats: null })),
      api.getGigTicketTiers(gigId).catch(() => ({ tiers: [] })),
    ])
      .then(([gigData, ticketData, tierData]) => {
        if (gigData) {
          setGig({
            id: gigData.id,
            title: gigData.title,
            date: gigData.date,
            time: gigData.time,
            ticketPrice: gigData.ticketPrice,
          });
        }
        setTickets(ticketData.tickets);
        setStats(ticketData.stats);
        setTiers(tierData.tiers);
      })
      .finally(() => setLoading(false));
  }, [api, gigId]);

  // Refresh tickets
  async function refreshTickets() {
    if (!gigId) return;
    const data = await api.getGigTickets(gigId);
    setTickets(data.tickets);
    setStats(data.stats);
  }

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.holderName.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.confirmationCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  // Ticket actions
  async function handleResendEmail(ticketId: string) {
    setActionLoading(ticketId);
    try {
      await api.resendTicketEmail(ticketId);
      alert("Email resent successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelTicket(ticketId: string) {
    if (!confirm("Are you sure you want to cancel this ticket?")) return;

    setActionLoading(ticketId);
    try {
      await api.cancelTicket(ticketId, { sendEmail: true });
      await refreshTickets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel ticket");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <HostDashboardShell title="Event Tickets" subtitle="Loading...">
        <p className={ui.help}>Loading ticket data...</p>
      </HostDashboardShell>
    );
  }

  if (!gig) {
    return (
      <HostDashboardShell title="Event Not Found" subtitle="">
        <p className={ui.error}>Could not find this event.</p>
        <Button onClick={() => navigate("/my-gigs")}>Back to My Gigs</Button>
      </HostDashboardShell>
    );
  }

  return (
    <HostDashboardShell
      title={`Tickets: ${gig.title}`}
      subtitle={`${gig.date}${gig.time ? ` at ${gig.time}` : ""}`}
    >
      <div className={styles.page}>
        {/* Stats Overview */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Ticket size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>{stats.total}</span>
                <span className={styles.statLabel}>Total Tickets</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <CheckCircle2 size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>{stats.valid}</span>
                <span className={styles.statLabel}>Valid</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Users size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>{stats.used}</span>
                <span className={styles.statLabel}>Checked In</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <DollarSign size={20} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  ${stats.revenue.toLocaleString()}
                </span>
                <span className={styles.statLabel}>Revenue</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className={styles.actionsBar}>
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={ui.input}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={ui.input}
          >
            <option value="all">All Statuses</option>
            <option value="valid">Valid</option>
            <option value="used">Used</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Button
            variant="primary"
            onClick={() => setShowIssueModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={14} /> Issue Ticket
          </Button>
        </div>

        {/* Tickets List */}
        <div className={styles.ticketList}>
          {filteredTickets.length === 0 ? (
            <div className={styles.emptyState}>
              <Ticket size={48} />
              <p>No tickets found</p>
              {tickets.length === 0 ? (
                <Button
                  variant="primary"
                  onClick={() => setShowIssueModal(true)}
                >
                  Issue First Ticket
                </Button>
              ) : (
                <p className={ui.help}>Try adjusting your filters</p>
              )}
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const isExpanded = expandedTicketId === ticket.id;
              const isLoading = actionLoading === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className={`${styles.ticketCard} ${isExpanded ? styles.expanded : ""}`}
                >
                  <div
                    className={styles.ticketHeader}
                    onClick={() =>
                      setExpandedTicketId(isExpanded ? null : ticket.id)
                    }
                  >
                    <div className={styles.ticketMain}>
                      <div className={styles.ticketInfo}>
                        <span className={styles.holderName}>
                          {ticket.holderName}
                        </span>
                        <span className={styles.ticketEmail}>
                          {ticket.email}
                        </span>
                      </div>
                      <div className={styles.ticketMeta}>
                        <span className={styles.confirmationCode}>
                          {ticket.confirmationCode}
                        </span>
                        <span className={styles.ticketQty}>
                          {ticket.quantity}x ticket
                          {ticket.quantity > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className={styles.ticketRight}>
                      <div className={styles.ticketBadges}>
                        <StatusBadge status={ticket.status} />
                        {ticket.isComped && (
                          <span
                            className={`${styles.badge} ${styles.badgeComp}`}
                          >
                            <Gift size={12} /> Comp
                          </span>
                        )}
                        {ticket.issuedByHost && (
                          <span
                            className={`${styles.badge} ${styles.badgeIssued}`}
                          >
                            <Send size={12} /> Issued
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={styles.ticketBody}>
                      <div className={styles.ticketDetails}>
                        <div className={styles.detailRow}>
                          <span>Created</span>
                          <span>
                            {new Date(ticket.createdAt).toLocaleDateString()}{" "}
                            {new Date(ticket.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {ticket.usedAt && (
                          <div className={styles.detailRow}>
                            <span>Checked In</span>
                            <span>
                              {new Date(ticket.usedAt).toLocaleDateString()}{" "}
                              {new Date(ticket.usedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                        {ticket.tierName && (
                          <div className={styles.detailRow}>
                            <span>Tier</span>
                            <span>{ticket.tierName}</span>
                          </div>
                        )}
                        <div className={styles.detailRow}>
                          <span>Total Paid</span>
                          <span>
                            {ticket.totalPaid === 0
                              ? "Free"
                              : `$${ticket.totalPaid.toFixed(2)}`}
                          </span>
                        </div>
                        {ticket.seatAssignments &&
                          ticket.seatAssignments.length > 0 && (
                            <div className={styles.detailRow}>
                              <span>Seats</span>
                              <span>
                                {ticket.seatAssignments
                                  .map((s) => `${s.row}${s.seatNumber}`)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                      </div>

                      <div className={styles.ticketActions}>
                        {ticket.status === "valid" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendEmail(ticket.id)}
                              disabled={isLoading}
                            >
                              <Mail size={14} />
                              Resend Email
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelTicket(ticket.id)}
                              disabled={isLoading}
                              style={{ color: "var(--error)" }}
                            >
                              <XCircle size={14} />
                              Cancel Ticket
                            </Button>
                          </>
                        )}
                        {ticket.status === "cancelled" && (
                          <span className={ui.help}>
                            This ticket has been cancelled
                          </span>
                        )}
                        {ticket.status === "used" && (
                          <span className={ui.help}>
                            Checked in at{" "}
                            {ticket.usedAt &&
                              new Date(ticket.usedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Issue Ticket Modal */}
        {showIssueModal && (
          <IssueTicketModal
            gigId={gigId!}
            tiers={tiers}
            defaultPrice={gig.ticketPrice ?? 0}
            onClose={() => setShowIssueModal(false)}
            onSuccess={refreshTickets}
          />
        )}
      </div>
    </HostDashboardShell>
  );
}
