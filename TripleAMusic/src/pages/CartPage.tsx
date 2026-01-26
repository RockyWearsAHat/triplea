import { useNavigate } from "react-router-dom";
import { Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./CartPage.module.scss";
import { useCart } from "../context/CartContext";
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
} from "lucide-react";

export default function CartPage() {
  const navigate = useNavigate();
  const { items, itemCount, subtotal, updateQuantity, removeItem } = useCart();

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
                    src={`http://localhost:4000/api/public/locations/${item.locationId}/images/0`}
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
            <div className={styles.summaryRow}>
              <span>Service fee</span>
              <span className={styles.calculated}>At checkout</span>
            </div>
          </div>

          <div className={styles.summaryTotal}>
            <span>Estimated total</span>
            <span>${subtotal.toFixed(2)}+</span>
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
            Final total calculated at checkout
          </p>
        </div>
      </div>
    </div>
  );
}
