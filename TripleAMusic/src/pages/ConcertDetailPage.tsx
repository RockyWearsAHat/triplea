import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Gig } from "@shared";
import { TripleAApiClient, Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertDetailPage.module.scss";

export default function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [concert, setConcert] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ticket purchase state
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchConcert = async () => {
      try {
        const data = await api.getPublicGig(id);
        if (!cancelled) setConcert(data);
      } catch (err) {
        if (!cancelled) setError("Concert not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchConcert();
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const handlePurchase = async () => {
    if (!concert) return;
    setPurchasing(true);
    // Simulate purchase - in production this would call a real API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setPurchasing(false);
    setPurchaseComplete(true);
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <p className={ui.help}>Loading concert details…</p>
      </div>
    );
  }

  if (error || !concert) {
    return (
      <div className={styles.errorState}>
        <h2 className={ui.sectionTitle}>Concert not found</h2>
        <p className={ui.help}>
          This concert may have been removed or doesn't exist.
        </p>
        <Button onClick={() => navigate("/")}>Back to concerts</Button>
      </div>
    );
  }

  const ticketPrice = concert.ticketPrice ?? 0;
  const isFree = ticketPrice === 0;
  const total = ticketPrice * quantity;

  // Format date nicely
  const formattedDate = new Date(concert.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (purchaseComplete) {
    return (
      <div className={styles.successState}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>
            {isFree ? "You're on the list!" : "Purchase complete!"}
          </h2>
          <p className={styles.successMessage}>
            {quantity} {quantity === 1 ? "ticket" : "tickets"} for{" "}
            <strong>{concert.title}</strong>
          </p>
          <div className={styles.ticketInfo}>
            <p className={styles.ticketDate}>{formattedDate}</p>
            {concert.time && (
              <p className={styles.ticketTime}>{concert.time}</p>
            )}
            {concert.location?.name && (
              <p className={styles.ticketVenue}>{concert.location.name}</p>
            )}
          </div>
          <p className={ui.help}>
            A confirmation email has been sent to your account.
          </p>
          <div className={styles.successActions}>
            <Button onClick={() => navigate("/")}>Find more events</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className={styles.layout}>
        {/* Hero image */}
        <div className={styles.heroImage}>
          {concert.location?.id ? (
            <img
              src={`http://localhost:4000/api/public/locations/${concert.location.id}/images/0`}
              alt=""
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <div className={styles.heroFallback}>
            <span>🎵</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.mainInfo}>
            <h1 className={styles.title}>{concert.title}</h1>

            <div className={styles.meta}>
              <div className={styles.metaRow}>
                <span className={styles.metaIcon}>📅</span>
                <span>{formattedDate}</span>
              </div>
              {concert.time && (
                <div className={styles.metaRow}>
                  <span className={styles.metaIcon}>🕐</span>
                  <span>{concert.time}</span>
                </div>
              )}
              {concert.location?.name && (
                <div className={styles.metaRow}>
                  <span className={styles.metaIcon}>📍</span>
                  <span>{concert.location.name}</span>
                </div>
              )}
            </div>

            {concert.description && (
              <div className={styles.description}>
                <h3 className={styles.sectionLabel}>About this event</h3>
                <p>{concert.description}</p>
              </div>
            )}

            {/* Venue Map */}
            {concert.location?.name &&
              import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
                <div className={styles.mapSection}>
                  <h3 className={styles.sectionLabel}>Venue location</h3>
                  <div className={styles.mapContainer}>
                    {concert.location.coordinates ? (
                      <iframe
                        title="Venue location map"
                        src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${concert.location.coordinates.lat},${concert.location.coordinates.lng}&zoom=15`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <iframe
                        title="Venue location map"
                        src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(concert.location.address ? `${concert.location.address}${concert.location.city ? `, ${concert.location.city}` : ""}` : `${concert.location.name}${concert.location.city ? `, ${concert.location.city}` : ""}`)}`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    )}
                  </div>
                  {concert.location.address && (
                    <p className={styles.mapAddress}>
                      {concert.location.address}
                      {concert.location.city && `, ${concert.location.city}`}
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* Ticket purchase card */}
          <div className={styles.purchaseCard}>
            <h3 className={styles.purchaseTitle}>Get tickets</h3>

            <div className={styles.priceDisplay}>
              {isFree ? (
                <span className={styles.freeLabel}>Free admission</span>
              ) : (
                <>
                  <span className={styles.price}>${ticketPrice}</span>
                  <span className={styles.priceLabel}>per ticket</span>
                </>
              )}
            </div>

            <div className={styles.quantitySelector}>
              <label className={styles.quantityLabel}>Quantity</label>
              <div className={styles.quantityControls}>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className={styles.quantityValue}>{quantity}</span>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10}
                >
                  +
                </button>
              </div>
            </div>

            {!isFree && (
              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalPrice}>${total.toFixed(2)}</span>
              </div>
            )}

            <button
              type="button"
              className={styles.purchaseButton}
              onClick={handlePurchase}
              disabled={purchasing}
            >
              {purchasing
                ? "Processing…"
                : isFree
                  ? "Reserve tickets"
                  : `Purchase for $${total.toFixed(2)}`}
            </button>

            <p
              className={ui.help}
              style={{ textAlign: "center", marginTop: 12 }}
            >
              {isFree
                ? "No payment required. You'll receive a confirmation email."
                : "Secure checkout powered by Triple A Music."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
