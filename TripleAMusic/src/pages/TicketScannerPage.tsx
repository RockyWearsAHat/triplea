import { useEffect, useMemo, useState, useCallback } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import type { Gig, TicketScanResult } from "@shared";
import { useAuth, useSafeBack } from "@shared";
import { ArrowLeft } from "lucide-react";
import styles from "./TicketScannerPage.module.scss";
import { createApiClient } from "../lib/urls";

type ScanMode = "camera" | "manual";

interface ScanState {
  status: "idle" | "scanning" | "success" | "error";
  result?: TicketScanResult;
  message?: string;
}

export default function TicketScannerPage() {
  const { user } = useAuth();
  const goBack = useSafeBack("/manage");
  const api = useMemo(() => createApiClient(), []);

  const [myGigs, setMyGigs] = useState<Gig[]>([]);
  const [selectedGigId, setSelectedGigId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState<ScanMode>("camera");
  const [manualInput, setManualInput] = useState("");
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [admitting, setAdmitting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

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

  // Handle QR code scan from camera
  const handleCameraScan = useCallback(
    async (data: string) => {
      if (scanState.status === "scanning" || scanState.status === "success") {
        return; // Prevent multiple scans while processing
      }

      setCameraEnabled(false); // Pause camera while processing
      setScanState({ status: "scanning" });

      try {
        const result = await api.scanTicket(data, selectedGigId || undefined);

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
          // Re-enable camera after error
          setTimeout(() => setCameraEnabled(true), 2000);
        }
      } catch (err) {
        setScanState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to scan ticket",
        });
        // Re-enable camera after error
        setTimeout(() => setCameraEnabled(true), 2000);
      }
    },
    [api, selectedGigId, scanState.status],
  );

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
        setCameraEnabled(true); // Re-enable camera for next scan
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
    setCameraEnabled(true); // Re-enable camera
    setCameraError(null);
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
        <button
          className={styles.backButton}
          onClick={goBack}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className={styles.headerText}>
          <h1>🎫 Ticket Scanner</h1>
          <p>Scan and validate tickets for your events</p>
        </div>
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
              {cameraError ? (
                <div className={styles.cameraPlaceholder}>
                  <span className={styles.cameraIcon}>⚠️</span>
                  <p>{cameraError}</p>
                  <button
                    className={styles.resetButton}
                    onClick={() => {
                      setCameraError(null);
                      setCameraEnabled(true);
                    }}
                    style={{ marginTop: 12 }}
                  >
                    Try Again
                  </button>
                </div>
              ) : cameraEnabled && scanState.status !== "success" ? (
                <div className={styles.cameraContainer}>
                  <Scanner
                    onScan={(result) => {
                      if (result?.[0]?.rawValue) {
                        handleCameraScan(result[0].rawValue);
                      }
                    }}
                    onError={(error) => {
                      console.error("Camera error:", error);
                      const errorMessage =
                        error instanceof Error
                          ? error.message
                          : "Failed to access camera. Please check permissions.";
                      setCameraError(errorMessage);
                    }}
                    constraints={{
                      facingMode: "environment",
                    }}
                    styles={{
                      container: {
                        width: "100%",
                        maxWidth: 350,
                        margin: "0 auto",
                        borderRadius: 12,
                        overflow: "hidden",
                      },
                      video: {
                        borderRadius: 12,
                      },
                    }}
                    components={{
                      torch: true,
                    }}
                  />
                  <p className={styles.cameraNote}>
                    Point camera at ticket QR code
                  </p>
                </div>
              ) : (
                <div className={styles.cameraPlaceholder}>
                  <span className={styles.cameraIcon}>
                    {scanState.status === "scanning" ? "⏳" : "✅"}
                  </span>
                  <p>
                    {scanState.status === "scanning"
                      ? "Verifying ticket..."
                      : "Ticket scanned"}
                  </p>
                </div>
              )}
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
