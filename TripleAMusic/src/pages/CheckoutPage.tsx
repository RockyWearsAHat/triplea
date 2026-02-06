import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { CheckoutSession, FeeCalculationResult, Gig } from "@shared";
import { SeatSelector } from "@shared";
import type { SeatInfo, SectionInfo, TierInfo } from "@shared";
import { useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./CheckoutPage.module.scss";
import { useCart } from "../context/CartContext";
import { createApiClient } from "../lib/urls";

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
);

function CheckoutForm({
  checkoutSession,
  onSuccess,
  onError,
}: {
  checkoutSession: CheckoutSession;
  onSuccess: (confirmationCode: string) => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const api = useMemo(() => createApiClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      // Confirm the payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment(
        {
          elements,
          confirmParams: {
            return_url: window.location.origin + "/checkout/complete",
          },
          redirect: "if_required",
        },
      );

      if (stripeError) {
        setErrorMessage(
          stripeError.message || "Payment failed. Please try again.",
        );
        setProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Confirm payment on our server and create the ticket
        const result = await api.confirmPayment(
          checkoutSession.paymentIntentId,
        );
        onSuccess(result.ticket.confirmationCode);
      } else {
        setErrorMessage("Payment was not completed. Please try again.");
        setProcessing(false);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Payment failed. Please try again.";
      setErrorMessage(message);
      onError(message);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {errorMessage && (
        <p className={ui.error} style={{ marginTop: 16 }}>
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        className={styles.payButton}
        disabled={!stripe || processing}
      >
        {processing
          ? "Processing…"
          : `Pay $${(checkoutSession.fees.totalWithTax ?? checkoutSession.fees.total).toFixed(2)}`}
      </button>

      <button
        type="button"
        className={styles.cancelButton}
        onClick={() => navigate("/cart")}
        disabled={processing}
      >
        Back to Cart
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, itemCount, clearCart, updateSeatIds } = useCart();

  const checkoutItem = items[0];

  // Form state for customer info
  const [holderName, setHolderName] = useState("");
  const [email, setEmail] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fees state
  const [fees, setFees] = useState<FeeCalculationResult | null>(null);
  const [feesLoading, setFeesLoading] = useState(false);

  // Checkout session state
  const [checkoutSession, setCheckoutSession] =
    useState<CheckoutSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const api = useMemo(() => createApiClient(), []);

  const [checkoutGig, setCheckoutGig] = useState<Gig | null>(null);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [seatingError, setSeatingError] = useState<string | null>(null);
  const [seatingData, setSeatingData] = useState<{
    layout: {
      seats: SeatInfo[];
      sections: SectionInfo[];
      stagePosition?: "top" | "bottom" | "left" | "right";
    };
    tiers: TierInfo[];
  } | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [showSeatPicker, setShowSeatPicker] = useState(false);

  // Pre-fill form if user is logged in
  useEffect(() => {
    if (user) {
      setHolderName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !checkoutSession) {
      navigate("/cart", { replace: true });
    }
  }, [items.length, checkoutSession, navigate]);

  // Calculate fees when cart changes
  useEffect(() => {
    if (items.length === 0) {
      setFees(null);
      return;
    }

    // For now, just use the first item in cart (single-item checkout)
    // TODO: Support multi-item checkout
    const item = items[0];
    if (item.ticketPrice === 0) {
      setFees(null);
      return;
    }

    let cancelled = false;
    setFeesLoading(true);

    const fetchFees = async () => {
      try {
        const result = await api.calculateFees(
          item.gigId,
          item.quantity,
          item.tierId,
        );
        if (!cancelled) {
          setFees(result);
        }
      } catch {
        if (!cancelled) {
          setFees(null);
        }
      } finally {
        if (!cancelled) {
          setFeesLoading(false);
        }
      }
    };

    fetchFees();
    return () => {
      cancelled = true;
    };
  }, [api, items]);

  // Load gig + seating availability for reserved seating (single-item checkout)
  useEffect(() => {
    const item = checkoutItem;
    if (!item?.gigId) return;

    let cancelled = false;
    setCheckoutGig(null);
    setSeatingData(null);
    setSeatingError(null);
    setShowSeatPicker(false);
    setSelectedSeats(item.seatIds ?? []);

    async function load() {
      try {
        const gig = await api.getPublicGig(item.gigId);
        if (cancelled) return;
        setCheckoutGig(gig);

        if (gig.seatingType === "reserved" && gig.seatingLayoutId) {
          setSeatingLoading(true);
          try {
            const seatsData = await api.getAvailableSeats(item.gigId);
            if (cancelled) return;

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
            setShowSeatPicker(true);
          } catch (e) {
            if (cancelled) return;
            setSeatingError(
              e instanceof Error
                ? e.message
                : "Unable to load seating availability",
            );
          } finally {
            if (!cancelled) setSeatingLoading(false);
          }
        }
      } catch (e) {
        if (cancelled) return;
        setSeatingError(e instanceof Error ? e.message : String(e));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, checkoutItem?.gigId]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!holderName.trim()) {
      setFormError("Please enter your name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setFormError("Please enter a valid email address");
      return;
    }
    if (items.length === 0) {
      setFormError("Your cart is empty");
      return;
    }

    // Create checkout session
    const item = items[0]; // Single item for now

    const isReservedSeating = checkoutGig?.seatingType === "reserved";
    if (isReservedSeating) {
      if (!checkoutGig?.seatingLayoutId) {
        setFormError(
          "This event is reserved seating, but no seat map is configured yet.",
        );
        return;
      }
      if (!selectedSeats || selectedSeats.length !== item.quantity) {
        setFormError(
          `Please select exactly ${item.quantity} seat(s) before continuing.`,
        );
        return;
      }
    }

    setSessionLoading(true);
    setSessionError(null);

    try {
      const session = await api.createCheckoutSession({
        gigId: item.gigId,
        quantity: item.quantity,
        email: email.trim(),
        holderName: holderName.trim(),
        // Include tier and seat info if available
        tierId: item.tierId,
        seatIds: isReservedSeating ? selectedSeats : item.seatIds,
      });
      setCheckoutSession(session);
      setFormSubmitted(true);
    } catch (err) {
      setSessionError(
        err instanceof Error
          ? err.message
          : "Failed to create checkout session",
      );
    } finally {
      setSessionLoading(false);
    }
  };

  const handleSuccess = useCallback(
    (confirmationCode: string) => {
      clearCart();
      navigate(`/tickets/${confirmationCode}`, { replace: true });
    },
    [clearCart, navigate],
  );

  const handleError = useCallback((errorMessage: string) => {
    setSessionError(errorMessage);
  }, []);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (items.length === 0 && !checkoutSession) {
    return null;
  }

  // Show payment form after customer info is collected
  if (formSubmitted && checkoutSession) {
    const { fees: sessionFees, gig } = checkoutSession;
    const item = items[0];

    return (
      <div className={styles.container}>
        <div className={styles.layout}>
          {/* Order Summary */}
          <div className={styles.orderSummary}>
            <h1 className={styles.pageTitle}>Payment</h1>

            <div className={styles.eventCard}>
              <h2 className={styles.eventTitle}>{gig.title}</h2>
              <div className={styles.eventMeta}>
                <span>📅 {formatDate(gig.date)}</span>
                {gig.time && <span>🕐 {gig.time}</span>}
                {checkoutSession.location?.name && (
                  <span>📍 {checkoutSession.location.name}</span>
                )}
              </div>
            </div>

            <div className={styles.ticketInfo}>
              <div className={styles.ticketRow}>
                <span>Tickets</span>
                <span>{item?.quantity}×</span>
              </div>
              {item?.seatIds && item.seatIds.length > 0 && (
                <div className={styles.ticketRow}>
                  <span>Seats</span>
                  <span>{item.seatIds.join(", ")}</span>
                </div>
              )}
              <div className={styles.ticketRow}>
                <span>Ticket holder</span>
                <span>{holderName}</span>
              </div>
              <div className={styles.ticketRow}>
                <span>Email</span>
                <span>{email}</span>
              </div>
            </div>

            <div className={styles.feesBreakdown}>
              <h3 className={styles.feesTitle}>Order Total</h3>

              <div className={styles.feeRow}>
                <span>
                  Subtotal ({item?.quantity} ticket
                  {(item?.quantity ?? 0) > 1 ? "s" : ""})
                </span>
                <span>${sessionFees.subtotal.toFixed(2)}</span>
              </div>

              <div className={styles.feeRow}>
                <span>
                  Triple A Fee
                  {sessionFees.serviceFeeDisplay
                    ? ` (${sessionFees.serviceFeeDisplay}${sessionFees.feeChargeMode === "ticket" ? "/ticket" : ""})`
                    : ""}
                </span>
                <span>${sessionFees.serviceFee.toFixed(2)}</span>
              </div>

              <div className={styles.feeRowWithInfo}>
                <span className={styles.feeLabel}>
                  Taxes &amp; Fees
                  <button type="button" className={styles.infoButton}>
                    i
                    <span className={styles.tooltip}>
                      <span className={styles.tooltipRow}>
                        <span>Payment processing</span>
                        <span>${sessionFees.stripeFee.toFixed(2)}</span>
                      </span>
                      <span className={styles.tooltipRow}>
                        <span>Tax</span>
                        <span>${(sessionFees.tax ?? 0).toFixed(2)}</span>
                      </span>
                    </span>
                  </button>
                </span>
                <span>
                  ${(sessionFees.stripeFee + (sessionFees.tax ?? 0)).toFixed(2)}
                </span>
              </div>

              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalAmount}>
                  ${(sessionFees.totalWithTax ?? sessionFees.total).toFixed(2)}
                </span>
              </div>
            </div>

            <p className={styles.disclaimer}>
              Your tickets will be emailed to <strong>{email}</strong> after
              payment.
            </p>
          </div>

          {/* Payment Form */}
          <div className={styles.paymentSection}>
            <h2 className={styles.paymentTitle}>Payment Details</h2>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: checkoutSession.clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#E59D0D",
                    colorBackground: "#ffffff",
                    colorText: "#1a1a1a",
                    colorDanger: "#f87171",
                    fontFamily: "system-ui, sans-serif",
                    borderRadius: "8px",
                  },
                },
              }}
            >
              <CheckoutForm
                checkoutSession={checkoutSession}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </Elements>

            <div className={styles.securityNote}>
              <span className={styles.lockIcon}>🔒</span>
              <span>Secure payment powered by Stripe</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show customer info form
  const item = items[0];
  const isFree = (item?.ticketPrice ?? 0) === 0;
  const isReservedSeating = checkoutGig?.seatingType === "reserved";

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Order Summary */}
        <div className={styles.orderSummary}>
          <h1 className={styles.pageTitle}>Checkout</h1>

          {items.map((cartItem) => (
            <div key={cartItem.gigId} className={styles.eventCard}>
              <h2 className={styles.eventTitle}>{cartItem.gigTitle}</h2>
              <div className={styles.eventMeta}>
                <span>📅 {formatDate(cartItem.gigDate)}</span>
                {cartItem.gigTime && <span>🕐 {cartItem.gigTime}</span>}
                {cartItem.locationName && (
                  <span>📍 {cartItem.locationName}</span>
                )}
              </div>
              <p className={styles.eventTickets}>
                {cartItem.quantity} ticket{cartItem.quantity > 1 ? "s" : ""} × $
                {cartItem.ticketPrice.toFixed(2)}
              </p>
            </div>
          ))}

          <div className={styles.feesBreakdown}>
            <h3 className={styles.feesTitle}>Order Summary</h3>

            <div className={styles.feeRow}>
              <span>Subtotal ({itemCount} tickets)</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            {!isFree && (
              <>
                <div className={styles.feeRow}>
                  <span>
                    Triple A Fee
                    {fees?.serviceFeeDisplay
                      ? ` (${fees.serviceFeeDisplay}${fees.feeChargeMode === "ticket" ? "/ticket" : ""})`
                      : ""}
                  </span>
                  <span>
                    {fees && !feesLoading
                      ? `$${fees.serviceFee.toFixed(2)}`
                      : "..."}
                  </span>
                </div>

                <div className={styles.feeRowWithInfo}>
                  <span className={styles.feeLabel}>
                    Taxes &amp; Fees
                    <button type="button" className={styles.infoButton}>
                      i
                      <span className={styles.tooltip}>
                        <span className={styles.tooltipRow}>
                          <span>Payment processing</span>
                          <span>
                            {fees && !feesLoading
                              ? `$${fees.stripeFee.toFixed(2)}`
                              : "..."}
                          </span>
                        </span>
                        <span className={styles.tooltipRow}>
                          <span>Tax</span>
                          <span>
                            {fees && !feesLoading
                              ? `$${(fees.tax ?? 0).toFixed(2)}`
                              : "..."}
                          </span>
                        </span>
                      </span>
                    </button>
                  </span>
                  <span>
                    {fees && !feesLoading
                      ? `$${(fees.stripeFee + (fees.tax ?? 0)).toFixed(2)}`
                      : "..."}
                  </span>
                </div>
              </>
            )}

            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={styles.totalAmount}>
                {fees && !feesLoading
                  ? `$${(fees.totalWithTax ?? fees.total).toFixed(2)}`
                  : feesLoading
                    ? "..."
                    : `$${subtotal.toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Info Form */}
        <div className={styles.paymentSection}>
          <h2 className={styles.paymentTitle}>Your Information</h2>
          <p className={styles.formSubtitle}>
            We'll send your tickets to this email address.
          </p>

          {isReservedSeating && (
            <div
              className={[ui.card, ui.cardPad].join(" ")}
              style={{ marginBottom: 16 }}
            >
              <div
                className={ui.stack}
                style={{ "--stack-gap": "10px" } as any}
              >
                <div>
                  <p className={ui.sectionTitle} style={{ margin: 0 }}>
                    Select seats
                  </p>
                  <p className={ui.help} style={{ marginTop: 4 }}>
                    Choose exactly {item.quantity} seat
                    {item.quantity > 1 ? "s" : ""} for this event.
                  </p>
                </div>

                {seatingError ? (
                  <p className={ui.error} style={{ margin: 0 }}>
                    {seatingError}
                  </p>
                ) : seatingLoading ? (
                  <p className={ui.help} style={{ margin: 0 }}>
                    Loading seat map...
                  </p>
                ) : seatingData ? (
                  <>
                    {showSeatPicker ? (
                      <SeatSelector
                        seats={seatingData.layout.seats}
                        sections={seatingData.layout.sections}
                        tiers={seatingData.tiers}
                        selectedSeats={selectedSeats}
                        onSelectionChange={(seatIds: string[]) => {
                          const next = seatIds.slice(0, item.quantity);
                          setSelectedSeats(next);
                          updateSeatIds(item.gigId, next);
                        }}
                        maxSeats={item.quantity}
                        stagePosition={seatingData.layout.stagePosition}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.payButton}
                        onClick={() => setShowSeatPicker(true)}
                      >
                        Choose seats
                      </button>
                    )}

                    {selectedSeats.length > 0 && (
                      <p className={ui.help} style={{ margin: 0 }}>
                        Selected: {selectedSeats.join(", ")}
                      </p>
                    )}

                    {selectedSeats.length !== item.quantity && (
                      <p className={ui.error} style={{ margin: 0 }}>
                        Select {item.quantity - selectedSeats.length} more seat
                        {item.quantity - selectedSeats.length === 1 ? "" : "s"}
                        to continue.
                      </p>
                    )}
                  </>
                ) : (
                  <p className={ui.help} style={{ margin: 0 }}>
                    Seat selection is required for this event.
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className={styles.customerForm}>
            <div className={styles.formField}>
              <label htmlFor="holderName">Full name</label>
              <input
                id="holderName"
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Name on tickets"
                disabled={sessionLoading}
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
                disabled={sessionLoading}
              />
            </div>

            {(formError || sessionError) && (
              <p className={ui.error}>{formError || sessionError}</p>
            )}

            <button
              type="submit"
              className={styles.payButton}
              disabled={
                sessionLoading ||
                !holderName.trim() ||
                !email.trim() ||
                (isReservedSeating && selectedSeats.length !== item.quantity)
              }
            >
              {sessionLoading
                ? "Loading..."
                : isFree
                  ? "Complete Order"
                  : fees
                    ? `Continue to Payment · $${(fees.totalWithTax ?? fees.total).toFixed(2)}`
                    : "Continue to Payment"}
            </button>

            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => navigate("/cart")}
              disabled={sessionLoading}
            >
              Back to Cart
            </button>
          </form>

          <div className={styles.securityNote}>
            <span className={styles.lockIcon}>🔒</span>
            <span>Your information is secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
