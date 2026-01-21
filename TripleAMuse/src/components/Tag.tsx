import { spacing } from "@shared";

type TagProps = {
  label: string;
};

export function Tag({ label }: TagProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: 999,
        backgroundColor: "var(--surface-2)",
        border: "1px solid var(--border)",
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {label}
    </span>
  );
}
