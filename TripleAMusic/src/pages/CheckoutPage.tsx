import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { CheckoutSession, FeeCalculationResult } from "@shared";
import { TripleAApiClient, useAuth } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./CheckoutPage.module.scss";
import { useCart } from "../context/CartContext";

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

  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

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
          : `Pay $${checkoutSession.fees.total.toFixed(2)}`}
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
  const { items, subtotal, itemCount, clearCart } = useCart();

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

  const api = useMemo(
    () => new TripleAApiClient({ baseUrl: "http://localhost:4000/api" }),
    [],
  );

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
        const result = await api.calculateFees(item.gigId, item.quantity);
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
        seatIds: item.seatIds,
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
                <span>Service fee (1%)</span>
                <span>${sessionFees.serviceFee.toFixed(2)}</span>
              </div>

              <div className={styles.feeRow}>
                <span>Payment processing</span>
                <span>${sessionFees.stripeFee.toFixed(2)}</span>
              </div>

              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalAmount}>
                  ${sessionFees.total.toFixed(2)}
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
                  <span>Service fee (1%)</span>
                  <span>
                    {fees && !feesLoading
                      ? `$${fees.serviceFee.toFixed(2)}`
                      : "..."}
                  </span>
                </div>

                <div className={styles.feeRow}>
                  <span>Payment processing</span>
                  <span>
                    {fees && !feesLoading
                      ? `$${fees.stripeFee.toFixed(2)}`
                      : "..."}
                  </span>
                </div>
              </>
            )}

            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={styles.totalAmount}>
                {fees && !feesLoading
                  ? `$${fees.total.toFixed(2)}`
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
              disabled={sessionLoading || !holderName.trim() || !email.trim()}
            >
              {sessionLoading
                ? "Loading..."
                : isFree
                  ? "Complete Order"
                  : fees
                    ? `Continue to Payment · $${fees.total.toFixed(2)}`
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
