import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Ticket } from "@shared";
import { Button } from "@shared";
import styles from "./TicketConfirmationPage.module.scss";
import { createApiClient } from "../lib/urls";

// QR Code library - we'll use a canvas-based approach
function generateQRCodeSVG(data: string, size: number = 200): string {
  // Simple QR code generation using a library or inline implementation
  // For production, use a library like 'qrcode' or 'qrcode.react'
  // This is a placeholder that creates a data URL
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

export default function TicketConfirmationPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient(), []);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [gig, setGig] = useState<Ticket["gig"] | null>(null);
  const [location, setLocation] = useState<Ticket["location"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // QR code state
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ticket data
  useEffect(() => {
    if (!code) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchTicket = async () => {
      try {
        const data = await api.getTicketByConfirmationCode(code);
        if (!cancelled) {
          setTicket(data.ticket);
          setGig(data.gig);
          setLocation(data.location);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ticket not found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTicket();
    return () => {
      cancelled = true;
    };
  }, [api, code]);

  // Fetch and refresh QR code
  const fetchQrCode = useCallback(async () => {
    if (!ticket || ticket.status !== "valid") return;

    setQrLoading(true);
    setQrError(null);

    try {
      const result = await api.getTicketQrCode(
        ticket.id,
        ticket.confirmationCode,
      );
      setQrPayload(result.qrPayload);
      setQrExpiresAt(new Date(result.expiresAt));
    } catch (err) {
      setQrError(
        err instanceof Error ? err.message : "Failed to generate QR code",
      );
    } finally {
      setQrLoading(false);
    }
  }, [api, ticket]);

  // Initial QR fetch and auto-refresh
  useEffect(() => {
    if (!ticket || ticket.status !== "valid") return;

    fetchQrCode();

    // Auto-refresh QR every 25 seconds (before 30s expiry)
    refreshTimerRef.current = setInterval(() => {
      fetchQrCode();
    }, 25000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [ticket, fetchQrCode]);

  // Countdown timer
  useEffect(() => {
    if (!qrExpiresAt) return;

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.floor((qrExpiresAt.getTime() - Date.now()) / 1000),
      );
      setQrCountdown(remaining);
    };

    updateCountdown();
    countdownTimerRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [qrExpiresAt]);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <p>Loading ticket...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className={styles.errorState}>
        <h2>Ticket not found</h2>
        <p>{error || "This ticket may have been removed or doesn't exist."}</p>
        <Button onClick={() => navigate("/")}>Back to concerts</Button>
      </div>
    );
  }

  const isFree = ticket.pricePerTicket === 0;
  const formattedDate = gig?.date
    ? new Date(gig.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const statusLabel = {
    valid: "Valid",
    used: "Used",
    cancelled: "Cancelled",
    expired: "Expired",
  }[ticket.status];

  const qrUrl = qrPayload ? generateQRCodeSVG(qrPayload) : null;

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className={styles.ticketCard}>
        <div className={styles.ticketHeader}>
          <h1>🎵 Your Ticket</h1>
          <p>
            {ticket.quantity} {ticket.quantity === 1 ? "ticket" : "tickets"}
          </p>
          <div className={styles.confirmationCode}>
            <label>Confirmation Code</label>
            <span>{ticket.confirmationCode}</span>
          </div>
        </div>

        <div className={styles.ticketBody}>
          {/* Status badge */}
          <div style={{ textAlign: "center" }}>
            <span className={`${styles.statusBadge} ${styles[ticket.status]}`}>
              {ticket.status === "valid" && "✓"}
              {ticket.status === "used" && "✓"}
              {ticket.status === "cancelled" && "✕"}
              {statusLabel}
            </span>
          </div>

          {/* QR Code section */}
          {ticket.status === "valid" && (
            <div className={styles.qrSection}>
              <div className={styles.qrWrapper}>
                <div className={styles.qrCode}>
                  {qrLoading && <span>Generating...</span>}
                  {qrError && <span className={styles.qrError}>{qrError}</span>}
                  {qrUrl && !qrLoading && (
                    <img
                      src={qrUrl}
                      alt="Ticket QR Code"
                      width={200}
                      height={200}
                    />
                  )}
                </div>
              </div>
              {qrExpiresAt && !qrError && (
                <p className={styles.qrExpiry}>
                  Refreshes in{" "}
                  <span className={styles.countdown}>{qrCountdown}s</span>
                </p>
              )}
            </div>
          )}

          {/* Used ticket overlay */}
          {ticket.status === "used" && (
            <div className={`${styles.qrSection} ${styles.usedOverlay}`}>
              <div className={styles.qrWrapper}>
                <div className={styles.qrCode} style={{ opacity: 0.3 }}>
                  <span style={{ fontSize: 48, color: "#666" }}>🎫</span>
                </div>
              </div>
              {ticket.usedAt && (
                <p className={styles.qrExpiry}>
                  Used on {new Date(ticket.usedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Holder name */}
          <div className={styles.holderName}>
            <label>Ticket Holder</label>
            <span>{ticket.holderName}</span>
          </div>

          {/* Event details */}
          {gig && (
            <div className={styles.eventDetails}>
              <h2>{gig.title}</h2>
              {formattedDate && (
                <div className={styles.detailRow}>
                  <span className={styles.icon}>📅</span>
                  <span>{formattedDate}</span>
                </div>
              )}
              {gig.time && (
                <div className={styles.detailRow}>
                  <span className={styles.icon}>🕐</span>
                  <span>{gig.time}</span>
                </div>
              )}
              {location?.name && (
                <div className={styles.detailRow}>
                  <span className={styles.icon}>📍</span>
                  <span>
                    {location.name}
                    {location.city && `, ${location.city}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Order details */}
          <div className={styles.orderDetails}>
            <h3>Order Details</h3>
            <div className={styles.orderRow}>
              <span>Tickets</span>
              <span>
                {ticket.quantity}x{" "}
                {isFree ? "Free" : `$${ticket.pricePerTicket.toFixed(2)}`}
              </span>
            </div>
            <div className={`${styles.orderRow} ${styles.total}`}>
              <span>Total</span>
              <span>{isFree ? "Free" : `$${ticket.totalPaid.toFixed(2)}`}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className={styles.instructions}>
            {ticket.status === "valid" ? (
              <>
                <strong>Present this QR code at the venue for entry.</strong>
                <br />
                The code rotates every 30 seconds for your security.
              </>
            ) : ticket.status === "used" ? (
              <>This ticket has been scanned and used for entry.</>
            ) : (
              <>This ticket is no longer valid.</>
            )}
          </div>

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate("/")}>
              Find more events
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
