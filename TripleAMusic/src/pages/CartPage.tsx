import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FeeCalculationResult } from "@shared";
import { Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./CartPage.module.scss";
import { useCart } from "../context/CartContext";
import { createApiClient, getAssetUrl } from "../lib/urls";
import {
  ShoppingCart,
  Calendar,
  Clock,
  MapPin,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ChevronLeft,
  Armchair,
  Tag,
} from "lucide-react";

export default function CartPage() {
  const navigate = useNavigate();
  const { items, itemCount, subtotal, updateQuantity, removeItem } = useCart();

  // Fee calculation state (only taxes need server call)
  const [fees, setFees] = useState<FeeCalculationResult | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  const api = useMemo(() => createApiClient(), []);

  // Client-side fee calculation (instant, no loading)
  // Triple A Fee: $1/ticket (flat) - this is the platform service fee
  const PLATFORM_FEE_PER_TICKET = 100; // cents
  const STRIPE_FEE_PERCENT = 0.029;
  const STRIPE_FEE_FIXED = 30; // cents

  const clientFees = useMemo(() => {
    if (items.length === 0) return null;
    const item = items[0];
    if (item.ticketPrice === 0) return null;

    const subtotalCents = Math.round(item.ticketPrice * 100 * item.quantity);
    const serviceFee = PLATFORM_FEE_PER_TICKET * item.quantity;
    const desiredAmount = subtotalCents + serviceFee;
    const total = Math.ceil(
      (desiredAmount + STRIPE_FEE_FIXED) / (1 - STRIPE_FEE_PERCENT),
    );
    const stripeFee = total - desiredAmount;

    return {
      subtotal: subtotalCents / 100,
      serviceFee: serviceFee / 100,
      stripeFee: stripeFee / 100,
      total: total / 100,
      serviceFeeDisplay: "$1",
      feeChargeMode: "ticket" as const,
    };
  }, [items]);

  // Fetch only tax from server (async)
  useEffect(() => {
    if (items.length === 0 || !clientFees) {
      setFees(null);
      return;
    }

    const item = items[0];
    if (item.ticketPrice === 0) {
      setFees(null);
      return;
    }

    let cancelled = false;
    setTaxLoading(true);

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
          setTaxLoading(false);
        }
      }
    };

    fetchFees();
    return () => {
      cancelled = true;
    };
  }, [api, items, clientFees]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <ShoppingCart size={48} strokeWidth={1.5} />
          </div>
          <h2>Your cart is empty</h2>
          <p className={ui.help}>
            Browse concerts and add tickets to your cart.
          </p>
          <Button onClick={() => navigate("/")}>Browse Concerts</Button>
        </div>
      </div>
    );
  }

  // Service fee display info (from client calculation, instant)
  const feeDisplay = clientFees?.serviceFeeDisplay ?? "$1";
  const isPerTicket = clientFees?.feeChargeMode === "ticket";

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={() => navigate("/")}>
        <ChevronLeft size={18} />
        Continue shopping
      </button>

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Cart</h1>
        <span className={styles.itemCount}>
          {itemCount} ticket{itemCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className={styles.layout}>
        {/* Cart Items */}
        <div className={styles.cartItems}>
          {items.map((item) => (
            <div key={item.gigId} className={styles.cartItem}>
              <div className={styles.itemImage}>
                {item.locationId ? (
                  <img
                    src={getAssetUrl(
                      `/api/public/locations/${item.locationId}/images/0`,
                    )}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
                <div className={styles.imageFallback}>🎵</div>
              </div>

              <div className={styles.itemContent}>
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemTitle}>{item.gigTitle}</h3>
                  <div className={styles.itemMeta}>
                    <span className={styles.metaItem}>
                      <Calendar size={14} />
                      {formatDate(item.gigDate)}
                    </span>
                    {item.gigTime && (
                      <span className={styles.metaItem}>
                        <Clock size={14} />
                        {item.gigTime}
                      </span>
                    )}
                    {item.locationName && (
                      <span className={styles.metaItem}>
                        <MapPin size={14} />
                        {item.locationName}
                      </span>
                    )}
                    {item.tierName && (
                      <span className={styles.metaItem}>
                        <Tag size={14} />
                        {item.tierName}
                      </span>
                    )}
                    {item.seatIds && item.seatIds.length > 0 && (
                      <span className={styles.metaItem}>
                        <Armchair size={14} />
                        Seats: {item.seatIds.join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.itemPricing}>
                  <span className={styles.unitPrice}>
                    ${item.ticketPrice.toFixed(2)} each
                  </span>
                </div>
              </div>

              <div className={styles.itemActions}>
                <div className={styles.quantityControls}>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={() =>
                      updateQuantity(item.gigId, item.quantity - 1)
                    }
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span className={styles.quantityValue}>{item.quantity}</span>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={() =>
                      updateQuantity(item.gigId, item.quantity + 1)
                    }
                    disabled={item.quantity >= 10}
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className={styles.itemSubtotal}>
                  ${(item.ticketPrice * item.quantity).toFixed(2)}
                </span>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removeItem(item.gigId)}
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Sidebar */}
        <div className={styles.orderSummary}>
          <h2 className={styles.summaryTitle}>Summary</h2>

          <div className={styles.summaryRows}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRowStacked}>
              <div className={styles.feeMain}>
                <span>Triple A Fee</span>
                <span>${clientFees?.serviceFee.toFixed(2) ?? "0.00"}</span>
              </div>
              {isPerTicket && (
                <span className={styles.feeSubtext}>{feeDisplay}/ticket</span>
              )}
            </div>
            <div className={styles.summaryRowWithInfo}>
              <span className={styles.feeLabel}>
                Taxes &amp; Fees
                <button type="button" className={styles.infoButton}>
                  i
                  <span className={styles.tooltip}>
                    <span className={styles.tooltipRow}>
                      <span>Payment processing</span>
                      <span>${clientFees?.stripeFee.toFixed(2) ?? "0.00"}</span>
                    </span>
                    <span className={styles.tooltipRow}>
                      <span>Tax</span>
                      <span
                        className={taxLoading ? styles.taxLoading : undefined}
                      >
                        ${(fees?.tax ?? 0).toFixed(2)}
                      </span>
                    </span>
                  </span>
                </button>
              </span>
              <span className={taxLoading ? styles.taxLoading : undefined}>
                ${((clientFees?.stripeFee ?? 0) + (fees?.tax ?? 0)).toFixed(2)}
              </span>
            </div>
          </div>

          <div className={styles.summaryTotal}>
            <span>Total</span>
            <span
              className={`${styles.totalAmount} ${taxLoading ? styles.taxLoading : ""}`}
            >
              ${((clientFees?.total ?? subtotal) + (fees?.tax ?? 0)).toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            className={styles.checkoutButton}
            onClick={() => navigate("/checkout")}
          >
            Checkout
            <ArrowRight size={18} />
          </button>

          <p className={styles.disclaimer}>
            Tax is estimated from the event location.
          </p>
        </div>
      </div>
    </div>
  );
}
