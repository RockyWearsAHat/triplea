import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Gig } from "@shared";
import { TripleAApiClient, Button, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertDetailPage.module.scss";

export default function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Form fields for guest checkout
  const [holderName, setHolderName] = useState("");
  const [email, setEmail] = useState("");

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

  // Pre-fill form if user is logged in
  useEffect(() => {
    if (user) {
      setHolderName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handlePurchase = async () => {
    if (!concert) return;

    // Validate form
    if (!holderName.trim()) {
      setPurchaseError("Please enter your name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setPurchaseError("Please enter a valid email address");
      return;
    }

    setPurchasing(true);
    setPurchaseError(null);

    try {
      const result = await api.purchaseTickets({
        gigId: concert.id,
        quantity,
        email: email.trim(),
        holderName: holderName.trim(),
      });

      // Redirect to confirmation page
      navigate(`/tickets/${result.ticket.confirmationCode}`);
    } catch (err) {
      setPurchaseError(
        err instanceof Error
          ? err.message
          : "Purchase failed. Please try again.",
      );
      setPurchasing(false);
    }
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
                    <iframe
                      title="Venue location map"
                      src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(concert.location.address ? `${concert.location.name}, ${concert.location.address}${concert.location.city ? `, ${concert.location.city}` : ""}` : `${concert.location.name}${concert.location.city ? `, ${concert.location.city}` : ""}`)}&zoom=15`}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
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

            {/* Checkout form */}
            <div className={styles.checkoutForm}>
              <div className={styles.formField}>
                <label htmlFor="holderName">Your name</label>
                <input
                  id="holderName"
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Full name on ticket"
                  disabled={purchasing}
                />
              </div>
              <div className={styles.formField}>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Where to send your tickets"
                  disabled={purchasing}
                />
              </div>
            </div>

            {purchaseError && (
              <p className={ui.error} style={{ marginBottom: 12 }}>
                {purchaseError}
              </p>
            )}

            <button
              type="button"
              className={styles.purchaseButton}
              onClick={handlePurchase}
              disabled={purchasing || !holderName.trim() || !email.trim()}
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
                : "Secure checkout powered by Stripe."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
