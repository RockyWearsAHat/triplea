/**
 * Stripe Elements / Connect appearance derived from CSS custom properties.
 *
 * Instead of hardcoding hex values in every Stripe `appearance` config,
 * this module reads the live CSS tokens from `global.scss` at runtime and
 * builds the Stripe `Appearance` object automatically.
 *
 * Usage (Stripe Elements – CheckoutPage):
 *   import { getStripeElementsAppearance } from "@shared";
 *   <Elements stripe={stripePromise} options={{ clientSecret, appearance: getStripeElementsAppearance() }}>
 *
 * Usage (Stripe Connect – MusicianOnboardingPage):
 *   import { getStripeConnectAppearance } from "@shared";
 *   loadConnectAndInitialize({ ..., appearance: getStripeConnectAppearance() })
 */

// ── helpers ──────────────────────────────────────────────────────────

/** Read a CSS custom property from :root (computed on documentElement). */
function css(prop: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(prop)
    .trim();
}

/**
 * Resolve a CSS variable value.
 * If the raw value still contains `var(` (e.g. `--primary: var(--taa-gold-500)`),
 * fall back to a provided default so Stripe always gets an actual color string.
 */
function resolve(prop: string, fallback: string): string {
  const raw = css(prop);
  if (!raw || raw.startsWith("var(") || raw.startsWith("color-mix("))
    return fallback;
  return raw;
}

// ── token reader ─────────────────────────────────────────────────────

/**
 * Read all relevant CSS tokens from the current DOM and return them
 * as a flat object. Values that can't be resolved at runtime fall back
 * to the SCSS defaults so Stripe never receives an empty string.
 */
function getTokens() {
  return {
    // Colors
    primary: resolve("--primary", "#E59D0D"),
    bg: resolve("--bg", "#0B0C10"),
    text: resolve("--text", "#FFFFFF"),
    textMuted: resolve("--text-muted", "rgba(255, 255, 255, 0.72)"),
    textSubtle: resolve("--text-subtle", "rgba(255, 255, 255, 0.55)"),
    surface: resolve("--surface", "rgba(255, 255, 255, 0.04)"),
    border: resolve("--border", "rgba(255, 255, 255, 0.1)"),
    borderStrong: resolve("--border-strong", "rgba(255, 255, 255, 0.16)"),
    error: resolve("--error", "#ef4444"),
    focus: resolve("--focus", "#E59D0D"),

    // Typography
    font: resolve(
      "--font",
      "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
    ),
    textBase: resolve("--text-base", "15px"),
    textSm: resolve("--text-sm", "13px"),

    // Shape
    radiusMd: resolve("--radius-md", "6px"),
  };
}

// ── public API ───────────────────────────────────────────────────────

/**
 * Build the `appearance` object for `@stripe/react-stripe-js` `<Elements>`.
 * Reads CSS custom properties from global.scss at call time.
 */
export function getStripeElementsAppearance() {
  const t = getTokens();

  return {
    theme: "night" as const,
    variables: {
      colorPrimary: t.primary,
      colorBackground: t.bg,
      colorText: t.text,
      colorTextSecondary: t.textMuted,
      colorTextPlaceholder: t.textSubtle,
      colorDanger: t.error,
      fontFamily: t.font,
      fontSizeBase: t.textBase,
      spacingUnit: "4px",
      borderRadius: t.radiusMd,
    },
    rules: {
      ".Block": {
        backgroundColor: t.surface,
        borderColor: t.border,
        borderRadius: t.radiusMd,
      },
      ".Input": {
        backgroundColor: t.surface,
        color: t.text,
        borderColor: t.border,
        fontSize: t.textBase,
        lineHeight: "1.4",
        padding: "10px 14px",
        borderRadius: t.radiusMd,
        border: `1px solid ${t.border}`,
        outline: "none",
      },
      ".Input--invalid": {
        borderColor: t.error,
        boxShadow: `0 0 0 3px ${withAlpha(t.error, 0.35)}`,
      },
      ".Input--complete": {
        borderColor: t.border,
      },
      ".Input:focus": {
        borderColor: t.focus,
        boxShadow: `0 0 0 3px ${withAlpha(t.focus, 0.35)}`,
        outline: "none",
      },
      ".Input::placeholder": {
        color: t.textSubtle,
        fontSize: t.textBase,
      },
      ".Label": {
        color: t.textMuted,
        fontSize: t.textSm,
        fontWeight: "500",
      },
      ".Tab": {
        backgroundColor: t.surface,
        color: t.text,
        borderColor: t.border,
        borderRadius: t.radiusMd,
        fontSize: t.textSm,
        padding: "10px 12px",
        minHeight: "40px",
      },
      ".TabLabel": {
        fontSize: t.textSm,
        lineHeight: "1.2",
      },
      ".Tab:hover": {
        borderColor: t.borderStrong,
      },
      ".Tab--selected": {
        borderColor: t.primary,
        color: t.primary,
      },
    },
  };
}

/**
 * Build the `appearance` object for `@stripe/connect-js`
 * (`loadConnectAndInitialize`). Stripe Connect uses completely different
 * variable names than Elements.
 */
export function getStripeConnectAppearance() {
  const t = getTokens();

  // Stripe Connect is scaling everything up - try smaller base values
  return {
    overlays: "drawer" as const,
    variables: {
      colorPrimary: t.primary,
      colorBackground: t.bg,
      colorText: t.text,
      fontFamily: t.font,
      fontSizeBase: "13px", // Much smaller to compensate for Stripe's scaling
      fontSizeSm: "11px",
      fontSizeXs: "10px",
      fontSizeLg: "14px",
      spacingUnit: "2px", // Smaller spacing unit
      borderRadius: t.radiusMd,
    },
  };
}

// ── utilities ────────────────────────────────────────────────────────

/**
 * Attempt to add an alpha channel to a color string.
 * Handles hex (#RRGGBB), rgb(), and rgba() formats.
 * Falls back to wrapping in rgba() if parsing fails.
 */
function withAlpha(color: string, alpha: number): string {
  // Already has alpha
  if (color.startsWith("rgba(")) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }

  // rgb(r, g, b)
  const rgbMatch = color.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }

  // Hex (#RRGGBB or #RGB)
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Fallback: can't parse, just return a semi-transparent version
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
