import { useEffect, useMemo, useState, useCallback } from "react";
import type { Gig, TicketScanResult } from "@shared";
import { TripleAApiClient, useAuth } from "@shared";
import styles from "./TicketScannerPage.module.scss";

type ScanMode = "camera" | "manual";

interface ScanState {
  status: "idle" | "scanning" | "success" | "error";
  result?: TicketScanResult;
  message?: string;
}

export default function TicketScannerPage() {
  const { user } = useAuth();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [myGigs, setMyGigs] = useState<Gig[]>([]);
  const [selectedGigId, setSelectedGigId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("manual");
  const [manualInput, setManualInput] = useState("");
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [admitting, setAdmitting] = useState(false);

  // Stats for the selected event
  const [stats, setStats] = useState<{
    total: number;
    valid: number;
    used: number;
  } | null>(null);

  // Fetch user's gigs (events they can scan tickets for)
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoading(true);

    const fetchGigs = async () => {
      try {
        const data = await api.listMyGigs();
        if (!cancelled) {
          // Filter to only public concerts
          const concerts = data.filter((g) => g.gigType === "public-concert");
          setMyGigs(concerts);
          if (concerts.length > 0) {
            setSelectedGigId(concerts[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch gigs", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGigs();
    return () => {
      cancelled = true;
    };
  }, [api, user]);

  // Fetch stats when gig changes
  useEffect(() => {
    if (!selectedGigId) {
      setStats(null);
      return;
    }

    let cancelled = false;

    const fetchStats = async () => {
      try {
        const data = await api.getGigTickets(selectedGigId);
        if (!cancelled) {
          setStats({
            total: data.stats.total,
            valid: data.stats.valid,
            used: data.stats.used,
          });
        }
      } catch {
        // Ignore - stats are optional
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [api, selectedGigId]);

  const handleScan = useCallback(async () => {
    if (!manualInput.trim()) return;

    setScanState({ status: "scanning" });

    try {
      const result = await api.scanTicket(
        manualInput.trim(),
        selectedGigId || undefined,
      );

      if (result.valid) {
        setScanState({
          status: "success",
          result,
          message: "Ticket verified successfully!",
        });
      } else {
        setScanState({
          status: "error",
          result,
          message: result.message || "Invalid ticket",
        });
      }
    } catch (err) {
      setScanState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to scan ticket",
      });
    }
  }, [api, manualInput, selectedGigId]);

  const handleAdmit = useCallback(async () => {
    if (!scanState.result?.ticket?.id) return;

    setAdmitting(true);

    try {
      await api.markTicketUsed(scanState.result.ticket.id);

      setScanState((prev) => ({
        ...prev,
        message: "Guest admitted successfully!",
      }));

      // Update stats
      setStats((prev) =>
        prev
          ? {
              ...prev,
              valid: prev.valid - (scanState.result?.ticket?.quantity || 1),
              used: prev.used + (scanState.result?.ticket?.quantity || 1),
            }
          : null,
      );

      // Reset after a delay
      setTimeout(() => {
        setScanState({ status: "idle" });
        setManualInput("");
      }, 2000);
    } catch (err) {
      setScanState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to admit guest",
      });
    } finally {
      setAdmitting(false);
    }
  }, [api, scanState.result]);

  const handleReset = useCallback(() => {
    setScanState({ status: "idle" });
    setManualInput("");
  }, []);

  const selectedGig = myGigs.find((g) => g.id === selectedGigId);

  if (!user) {
    return (
      <div className={styles.errorState}>
        <h2>Authentication Required</h2>
        <p>Please log in to access the ticket scanner.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🎫 Ticket Scanner</h1>
        <p>Scan and validate tickets for your events</p>
      </div>

      {/* Event selector */}
      <div className={styles.eventSelector}>
        <label>Select Event</label>
        <select
          value={selectedGigId}
          onChange={(e) => setSelectedGigId(e.target.value)}
        >
          <option value="">All Events</option>
          {myGigs.map((gig) => (
            <option key={gig.id} value={gig.id}>
              {gig.title} - {new Date(gig.date).toLocaleDateString()}
            </option>
          ))}
        </select>

        {selectedGig && (
          <div className={styles.selectedEvent}>
            <span className={styles.eventIcon}>🎵</span>
            <div className={styles.eventInfo}>
              <h3>{selectedGig.title}</h3>
              <p>
                {new Date(selectedGig.date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {selectedGig.time && ` at ${selectedGig.time}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scanner section */}
      <div className={styles.scannerSection}>
        <div className={styles.scannerTabs}>
          <button
            className={`${styles.scannerTab} ${scanMode === "camera" ? styles.active : ""}`}
            onClick={() => setScanMode("camera")}
          >
            📷 Camera
          </button>
          <button
            className={`${styles.scannerTab} ${scanMode === "manual" ? styles.active : ""}`}
            onClick={() => setScanMode("manual")}
          >
            ⌨️ Manual Entry
          </button>
        </div>

        <div className={styles.scannerBody}>
          {scanMode === "camera" ? (
            <div className={styles.cameraScanner}>
              <div className={styles.cameraPlaceholder}>
                <span className={styles.cameraIcon}>📷</span>
                <p>Camera scanner coming soon</p>
              </div>
              <p className={styles.cameraNote}>
                For now, please use manual entry to paste the QR code data.
              </p>
            </div>
          ) : (
            <div className={styles.manualEntry}>
              <div className={styles.inputGroup}>
                <label>QR Code Data</label>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste the QR code data here (JSON format from ticket)"
                  disabled={scanState.status === "scanning"}
                />
              </div>
              <button
                className={styles.scanButton}
                onClick={handleScan}
                disabled={
                  !manualInput.trim() || scanState.status === "scanning"
                }
              >
                {scanState.status === "scanning"
                  ? "Verifying..."
                  : "Verify Ticket"}
              </button>
            </div>
          )}

          {/* Scan result */}
          {scanState.status !== "idle" && scanState.status !== "scanning" && (
            <div
              className={`${styles.scanResult} ${
                scanState.status === "success" ? styles.success : styles.error
              }`}
            >
              <div className={styles.resultIcon}>
                {scanState.status === "success" ? "✅" : "❌"}
              </div>
              <h3 className={styles.resultTitle}>
                {scanState.status === "success"
                  ? "Valid Ticket"
                  : "Invalid Ticket"}
              </h3>
              <p className={styles.resultMessage}>{scanState.message}</p>

              {scanState.result?.ticket && (
                <div className={styles.ticketDetails}>
                  <h4>Ticket Details</h4>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Confirmation</span>
                    <span className={styles.value}>
                      {scanState.result.ticket.confirmationCode}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Name</span>
                    <span className={styles.value}>
                      {scanState.result.ticket.holderName}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Quantity</span>
                    <span className={styles.value}>
                      {scanState.result.ticket.quantity}{" "}
                      {scanState.result.ticket.quantity === 1
                        ? "ticket"
                        : "tickets"}
                    </span>
                  </div>
                  {scanState.result.gig && (
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Event</span>
                      <span className={styles.value}>
                        {scanState.result.gig.title}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.resultActions}>
                {scanState.status === "success" &&
                  scanState.result?.ticket?.status === "valid" && (
                    <button
                      className={styles.admitButton}
                      onClick={handleAdmit}
                      disabled={admitting}
                    >
                      {admitting ? "Admitting..." : "✓ Admit Guest"}
                    </button>
                  )}
                <button className={styles.resetButton} onClick={handleReset}>
                  Scan Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total Tickets</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.valid}</div>
            <div className={styles.statLabel}>Remaining</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.used}</div>
            <div className={styles.statLabel}>Admitted</div>
          </div>
        </div>
      )}
    </div>
  );
}
