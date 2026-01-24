import styles from "./ProductCard.module.scss";
import ui from "../styles/primitives.module.scss";

interface ProductCardProps {
  id?: string;
  title: string;
  subtitle?: string;
  price?: string | number;
  imageUrl?: string;
  onPrimary?: () => void;
  variant?: "compact" | "featured";
}

export function ProductCard({
  title,
  subtitle,
  price,
  imageUrl,
  onPrimary,
  variant = "compact",
}: ProductCardProps) {
  return (
    <div
      className={[
        styles.productCard,
        variant === "featured" ? styles.featured : "",
      ].join(" ")}
    >
      <div className={styles.media}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} />
        ) : (
          <div className={ui.mediaPlaceholder}>Image</div>
        )}
      </div>

      <div style={{ padding: 12 }}>
        <p className={ui.cardTitle}>{title}</p>
        {subtitle ? <p className={ui.cardText}>{subtitle}</p> : null}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <p className={ui.help} style={{ margin: 0 }}>
            {price ? (typeof price === "number" ? `$${price}` : price) : ""}
          </p>
          <button className={styles.primary} onClick={onPrimary} type="button">
            View
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
