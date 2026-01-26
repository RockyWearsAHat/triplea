import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Gig, TicketTier } from "@shared";
import { TripleAApiClient, Button, SeatSelector } from "@shared";
import type { SeatInfo, SectionInfo, TierInfo } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./ConcertDetailPage.module.scss";
import { useCart, type CartItem } from "../context/CartContext";
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
  Armchair,
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

  // Seating state
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [seatingData, setSeatingData] = useState<{
    layout: {
      seats: SeatInfo[];
      sections: SectionInfo[];
      stagePosition?: "top" | "bottom" | "left" | "right";
    };
    tiers: TierInfo[];
  } | null>(null);
  const [showSeatPicker, setShowSeatPicker] = useState(false);

  // Check if this concert is already in cart
  const inCart = items.find((item) => item.gigId === id);

  // Is this a reserved seating event?
  const isReservedSeating = concert?.seatingType === "reserved";
  const hasTiers = concert?.hasTicketTiers && ticketTiers.length > 0;

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchConcert = async () => {
      try {
        const data = await api.getPublicGig(id);
        if (!cancelled) setConcert(data);

        // Fetch ticket tiers if available
        if (data.hasTicketTiers) {
          try {
            const tiersData = await api.getGigTicketTiers(id);
            if (!cancelled) {
              setTicketTiers(tiersData.tiers as TicketTier[]);
              // Pre-select first available tier
              const firstAvailable = tiersData.tiers.find(
                (t) => t.available && t.remaining > 0,
              );
              if (firstAvailable) {
                setSelectedTier(firstAvailable.id);
              }
            }
          } catch {
            // Tiers not available
          }
        }

        // Fetch seating data if reserved seating
        if (data.seatingType === "reserved" && data.seatingLayoutId) {
          try {
            const seatsData = await api.getAvailableSeats(id);
            if (!cancelled && seatsData.layout) {
              setSeatingData({
                layout: {
                  seats: seatsData.layout.seats as SeatInfo[],
                  sections: seatsData.layout.sections as SectionInfo[],
                  stagePosition: seatsData.layout.stagePosition as
                    | "top"
                    | "bottom"
                    | "left"
                    | "right",
                },
                tiers: seatsData.tiers as TierInfo[],
              });
            }
          } catch {
            // Seating not available
          }
        }
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

  // Get the effective ticket price
  const getEffectivePrice = () => {
    if (selectedTier && hasTiers) {
      const tier = ticketTiers.find((t) => t.id === selectedTier);
      return tier?.price ?? concert?.ticketPrice ?? 0;
    }
    return concert?.ticketPrice ?? 0;
  };

  const handleAddToCart = () => {
    if (!concert) return;

    const effectivePrice = getEffectivePrice();
    const qty = isReservedSeating ? selectedSeats.length : quantity;

    if (qty <= 0) return;

    // If already in cart, update quantity; otherwise add new item
    if (inCart) {
      updateQuantity(concert.id, qty);
    } else {
      addItem({
        gigId: concert.id,
        gigTitle: concert.title,
        gigDate: concert.date,
        gigTime: concert.time,
        locationName: concert.location?.name,
        locationId: concert.location?.id,
        ticketPrice: effectivePrice,
        quantity: qty,
        // Include tier/seat info for checkout
        tierId: selectedTier || undefined,
        tierName: selectedTierInfo?.name,
        seatIds: isReservedSeating ? selectedSeats : undefined,
      } as CartItem);
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

  const ticketPrice = getEffectivePrice();
  const isFree = ticketPrice === 0;
  const total =
    ticketPrice * (isReservedSeating ? selectedSeats.length : quantity);
  const effectiveQuantity = isReservedSeating ? selectedSeats.length : quantity;

  // Get selected tier info
  const selectedTierInfo = selectedTier
    ? ticketTiers.find((t) => t.id === selectedTier)
    : null;

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
            {/* Tier Selection */}
            {hasTiers && (
              <div className={styles.tierSection}>
                <h3 className={styles.sectionLabel}>Select ticket type</h3>
                <div className={styles.tierList}>
                  {ticketTiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`${styles.tierOption} ${selectedTier === tier.id ? styles.tierSelected : ""} ${!tier.available ? styles.tierSoldOut : ""}`}
                      onClick={() => tier.available && setSelectedTier(tier.id)}
                      disabled={!tier.available}
                    >
                      <div className={styles.tierInfo}>
                        <span className={styles.tierName}>{tier.name}</span>
                        {tier.description && (
                          <span className={styles.tierDescription}>
                            {tier.description}
                          </span>
                        )}
                      </div>
                      <div className={styles.tierPriceCol}>
                        <span className={styles.tierPrice}>${tier.price}</span>
                        {!tier.available ? (
                          <span className={styles.tierSoldOutLabel}>
                            Sold out
                          </span>
                        ) : (
                          tier.capacity !== null &&
                          tier.capacity !== undefined && (
                            <span className={styles.tierRemaining}>
                              {tier.capacity - (tier.sold || 0)} left
                            </span>
                          )
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.priceDisplay}>
              {isFree ? (
                <span className={styles.freeLabel}>Free</span>
              ) : (
                <>
                  <span className={styles.price}>${ticketPrice}</span>
                  <span className={styles.priceLabel}>/ ticket</span>
                  {selectedTierInfo && (
                    <span className={styles.tierTag}>
                      {selectedTierInfo.name}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Seat Selection for Reserved Seating */}
            {isReservedSeating && seatingData ? (
              <div className={styles.seatSelectionSection}>
                <div className={styles.seatSelectionHeader}>
                  <h3 className={styles.sectionLabel}>
                    <Armchair size={18} />
                    Select your seats
                  </h3>
                  {selectedSeats.length > 0 && (
                    <span className={styles.selectedCount}>
                      {selectedSeats.length} seat
                      {selectedSeats.length > 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>

                {showSeatPicker ? (
                  <SeatSelector
                    seats={seatingData.layout.seats}
                    sections={seatingData.layout.sections}
                    tiers={seatingData.tiers}
                    selectedSeats={selectedSeats}
                    onSelectSeat={(seatId) => {
                      if (selectedSeats.includes(seatId)) {
                        setSelectedSeats((prev) =>
                          prev.filter((id) => id !== seatId),
                        );
                      } else if (selectedSeats.length < 10) {
                        setSelectedSeats((prev) => [...prev, seatId]);
                      }
                    }}
                    maxSelectable={10}
                    stagePosition={seatingData.layout.stagePosition}
                    className={styles.seatSelector}
                  />
                ) : (
                  <Button
                    onClick={() => setShowSeatPicker(true)}
                    className={styles.chooseSeatButton}
                  >
                    <Armchair size={18} />
                    Choose seats on map
                  </Button>
                )}

                {selectedSeats.length > 0 && (
                  <div className={styles.selectedSeatsList}>
                    <span className={styles.selectedSeatsLabel}>Selected:</span>
                    {selectedSeats.map((seatId) => {
                      const seat = seatingData.layout.seats.find(
                        (s) => s.id === seatId,
                      );
                      return (
                        <span key={seatId} className={styles.selectedSeatChip}>
                          {seat?.row}
                          {seat?.number}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSeats((prev) =>
                                prev.filter((id) => id !== seatId),
                              )
                            }
                            className={styles.removeSeatBtn}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Standard Quantity Selector for General Admission */
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
            )}

            {!isFree && effectiveQuantity > 0 && (
              <div className={styles.subtotalRow}>
                <span>
                  Subtotal ({effectiveQuantity} ticket
                  {effectiveQuantity > 1 ? "s" : ""})
                </span>
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

            {/* Disable add to cart if reserved seating and no seats selected */}
            {isReservedSeating && selectedSeats.length === 0 ? (
              <div className={styles.selectSeatsPrompt}>
                <Armchair size={18} />
                Select seats to continue
              </div>
            ) : inCart?.quantity === effectiveQuantity ? (
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
                    Update to {effectiveQuantity} ticket
                    {effectiveQuantity > 1 ? "s" : ""}
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
