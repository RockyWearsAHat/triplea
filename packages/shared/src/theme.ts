// Simple shared design tokens

export const palette = {
  blue900: "#1C276E",
  blue200: "#ADB8E0",
  gold500: "#E59D0D",
  purple400: "#825ECA",
  purple900: "#4E238B",
  gray600: "#4B4E63",
  white: "#FFFFFF",
  black: "#000000",
} as const;

// Prefer CSS variables so app theming stays consistent even when UI uses inline styles.
export const colors = {
  primary: "var(--primary)",
  primaryDark: palette.blue900,
  background: "var(--bg)",
  surface: "var(--surface)",
  surfaceAlt: "var(--surface-2)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  accent: "var(--accent)",
  danger: "var(--taa-purple-400)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const typography = {
  fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`,
};
