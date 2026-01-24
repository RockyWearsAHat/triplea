import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.scss";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth,
  leftIcon,
  style,
  className,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "secondary"
      ? styles.secondary
      : variant === "ghost"
        ? styles.ghost
        : styles.primary;

  const sizeClass =
    size === "sm" ? styles.sm : size === "lg" ? styles.lg : styles.md;

  const fullWidthClass = fullWidth ? styles.fullWidth : "";

  return (
    <button
      className={[
        styles.button,
        variantClass,
        sizeClass,
        fullWidthClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
}
