import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Gig } from "@shared";
import { TripleAApiClient, Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertDetailPage.module.scss";
import { useCart } from "../context/CartContext";
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Minus,
  Plus,
  Check,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";

export default function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, updateQuantity, items } = useCart();
  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

  const [concert, setConcert] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ticket selection state
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  // Check if this concert is already in cart
  const inCart = items.find((item) => item.gigId === id);

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

  const handleAddToCart = () => {
    if (!concert) return;

    // If already in cart, update quantity; otherwise add new item
    if (inCart) {
      updateQuantity(concert.id, quantity);
    } else {
      addItem({
        gigId: concert.id,
        gigTitle: concert.title,
        gigDate: concert.date,
        gigTime: concert.time,
        locationName: concert.location?.name,
        locationId: concert.location?.id,
        ticketPrice: concert.ticketPrice ?? 0,
        quantity,
      });
    }

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
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
        <ChevronLeft size={18} />
        Back
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
                <Calendar size={18} className={styles.metaIcon} />
                <span>{formattedDate}</span>
              </div>
              {concert.time && (
                <div className={styles.metaRow}>
                  <Clock size={18} className={styles.metaIcon} />
                  <span>{concert.time}</span>
                </div>
              )}
              {concert.location?.name && (
                <div className={styles.metaRow}>
                  <MapPin size={18} className={styles.metaIcon} />
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
            <div className={styles.priceDisplay}>
              {isFree ? (
                <span className={styles.freeLabel}>Free</span>
              ) : (
                <>
                  <span className={styles.price}>${ticketPrice}</span>
                  <span className={styles.priceLabel}>/ ticket</span>
                </>
              )}
            </div>

            <div className={styles.quantitySelector}>
              <span className={styles.quantityLabel}>Tickets</span>
              <div className={styles.quantityControls}>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span className={styles.quantityValue}>{quantity}</span>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {!isFree && (
              <div className={styles.subtotalRow}>
                <span>Subtotal</span>
                <span className={styles.subtotalPrice}>
                  ${total.toFixed(2)}
                </span>
              </div>
            )}

            {inCart && (
              <div className={styles.inCartNotice}>
                <Check size={16} />
                <span>
                  {inCart.quantity} ticket{inCart.quantity > 1 ? "s" : ""} in
                  cart
                </span>
              </div>
            )}

            {inCart?.quantity === quantity ? (
              addedToCart ? (
                <div className={styles.matchedNotice}>
                  <Check size={16} />
                  Cart updated
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.purchaseButton}
                  onClick={() => navigate("/checkout")}
                >
                  Checkout
                  <ArrowRight size={18} />
                </button>
              )
            ) : (
              <button
                type="button"
                className={styles.purchaseButton}
                onClick={handleAddToCart}
              >
                {addedToCart ? (
                  <>
                    <Check size={18} />
                    Updated!
                  </>
                ) : inCart ? (
                  <>
                    <ShoppingCart size={18} />
                    Update to {quantity} ticket{quantity > 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} />
                    {isFree
                      ? "Add to cart"
                      : `Add to cart · $${total.toFixed(2)}`}
                  </>
                )}
              </button>
            )}

            <p className={styles.feeNote}>
              {isFree ? "No payment required" : "Fees calculated at checkout"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
