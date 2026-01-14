import type { ButtonHTMLAttributes, ReactNode } from "react";
import { colors, radii, spacing, typography } from "../theme";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  fullWidth,
  leftIcon,
  style,
  ...rest
}: ButtonProps) {
  const base: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    borderRadius: radii.md,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    borderWidth: 1,
    borderStyle: "solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    cursor: "pointer",
    fontWeight: 500,
    transition:
      "background-color 150ms ease, color 150ms ease, border-color 150ms ease, transform 80ms ease",
    width: fullWidth ? "100%" : undefined,
  };

  let variantStyles: React.CSSProperties;
  switch (variant) {
    case "secondary":
      variantStyles = {
        backgroundColor: "transparent",
        color: colors.text,
        borderColor: colors.textMuted,
      };
      break;
    case "ghost":
      variantStyles = {
        backgroundColor: "transparent",
        color: colors.textMuted,
        borderColor: "transparent",
      };
      break;
    case "primary":
    default:
      variantStyles = {
        backgroundColor: colors.primary,
        color: colors.text,
        borderColor: colors.primaryDark,
      };
      break;
  }

  const hover: React.CSSProperties = {
    transform: "translateY(-1px)",
  };

  return (
    <button
      style={{
        ...base,
        ...variantStyles,
        ...style,
      }}
      onMouseEnter={(e) => {
        Object.assign((e.currentTarget as HTMLButtonElement).style, hover);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
}
