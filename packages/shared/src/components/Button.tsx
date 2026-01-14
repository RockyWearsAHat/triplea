import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.scss";

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
  className,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "secondary"
      ? styles.secondary
      : variant === "ghost"
      ? styles.ghost
      : styles.primary;

  const fullWidthClass = fullWidth ? styles.fullWidth : "";

  return (
    <button
      className={[styles.button, variantClass, fullWidthClass, className]
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
