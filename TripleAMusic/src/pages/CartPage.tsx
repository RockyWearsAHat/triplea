import { useNavigate } from "react-router-dom";
import { Button } from "@shared";
import ui from "@shared/styles/primitives.module.scss";
import styles from "./CartPage.module.scss";
import { useCart } from "../context/CartContext";

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
          <span className={styles.emptyIcon}>🎫</span>
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
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Your Cart</h1>
        <p className={styles.itemCount}>
          {itemCount} ticket{itemCount !== 1 ? "s" : ""}
        </p>
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

              <div className={styles.itemDetails}>
                <h3 className={styles.itemTitle}>{item.gigTitle}</h3>
                <div className={styles.itemMeta}>
                  <span>📅 {formatDate(item.gigDate)}</span>
                  {item.gigTime && <span>🕐 {item.gigTime}</span>}
                  {item.locationName && <span>📍 {item.locationName}</span>}
                </div>
                <p className={styles.itemPrice}>
                  ${item.ticketPrice.toFixed(2)} per ticket
                </p>
              </div>

              <div className={styles.itemActions}>
                <div className={styles.quantityControls}>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={() =>
                      updateQuantity(item.gigId, item.quantity - 1)
                    }
                  >
                    −
                  </button>
                  <span className={styles.quantityValue}>{item.quantity}</span>
                  <button
                    type="button"
                    className={styles.quantityButton}
                    onClick={() =>
                      updateQuantity(item.gigId, item.quantity + 1)
                    }
                    disabled={item.quantity >= 10}
                  >
                    +
                  </button>
                </div>
                <p className={styles.itemSubtotal}>
                  ${(item.ticketPrice * item.quantity).toFixed(2)}
                </p>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removeItem(item.gigId)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Sidebar */}
        <div className={styles.orderSummary}>
          <h2 className={styles.summaryTitle}>Order Summary</h2>

          <div className={styles.summaryRow}>
            <span>Subtotal ({itemCount} tickets)</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          <div className={styles.summaryRow}>
            <span>Service fee (1%)</span>
            <span className={styles.feePlaceholder}>
              Calculated at checkout
            </span>
          </div>

          <div className={styles.summaryRow}>
            <span>Payment processing</span>
            <span className={styles.feePlaceholder}>
              Calculated at checkout
            </span>
          </div>

          <div className={styles.summaryTotal}>
            <span>Estimated Total</span>
            <span className={styles.totalAmount}>${subtotal.toFixed(2)}+</span>
          </div>

          <button
            type="button"
            className={styles.checkoutButton}
            onClick={() => navigate("/checkout")}
          >
            Proceed to Checkout
          </button>

          <button
            type="button"
            className={styles.continueButton}
            onClick={() => navigate("/")}
          >
            Continue Shopping
          </button>

          <p className={styles.disclaimer}>
            Final fees will be calculated on the checkout page.
          </p>
        </div>
      </div>
    </div>
  );
}
