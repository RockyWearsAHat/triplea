import ui from "../styles/primitives.module.scss";
import styles from "./CategoryBar.module.scss";
import { Button } from "./Button";

type Category = {
  id: string;
  label: string;
  imageUrl?: string;
};

interface CategoryBarProps {
  categories: Category[];
  active?: string;
  onSelect?: (id: string) => void;
}

export function CategoryBar({
  categories,
  active,
  onSelect,
}: CategoryBarProps) {
  return (
    <div className={[ui.scroller, styles.categoryBar].join(" ")}>
      {categories.map((c) => (
        <Button
          key={c.id}
          variant={active === c.id ? "secondary" : "ghost"}
          onClick={() => onSelect?.(c.id)}
          size="sm"
        >
          {c.imageUrl ? (
            <img src={c.imageUrl} alt={c.label} className={styles.icon} />
          ) : null}
          {c.label}
        </Button>
      ))}
    </div>
  );
}

export default CategoryBar;
