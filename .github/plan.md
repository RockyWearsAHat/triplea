# Research Report: Stripe Elements Styling & Codebase Context

**Status:** 📋 RESEARCH COMPLETE
**Date:** February 7, 2026
**Purpose:** Complete investigation of Stripe Elements styling, onboarding flows, and related SCSS patterns

---

## Executive Summary

This research gathered ALL relevant context for Stripe Elements styling across the Triple A Apps codebase. Key findings:

1. **CheckoutPage.tsx** uses inline `appearance` configuration for Stripe PaymentElement
2. **MusicianOnboardingPage.tsx** uses similar inline `appearance` for Stripe Connect onboarding
3. **Both configurations are duplicated** — same colors, same rules, violating DRY principle
4. **No shared Stripe appearance config exists** — opportunity to create reusable theme
5. **Shared SCSS primitives** provide `.input` styles that match Stripe Elements aesthetic
6. **CheckoutPage.module.scss** exists with custom form field styles

---

## 1. CheckoutPage.tsx (FULL FILE)

**Path:** `/Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic/src/pages/CheckoutPage.tsx`

**Lines:** 1-743 (full file provided in research)

### Key Stripe Elements Usage (Lines 4-21):

\`\`\`tsx
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
);
\`\`\`

### Stripe Elements Appearance Configuration (Lines 483-550):

\`\`\`tsx
<Elements
  stripe={stripePromise}
  options={{
    clientSecret: checkoutSession.clientSecret,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#E59D0D",
        colorBackground: "#0B0C10",
        colorText: "#FFFFFF",
        colorTextSecondary: "rgba(255, 255, 255, 0.72)",
        colorTextPlaceholder: "rgba(255, 255, 255, 0.55)",
        colorDanger: "#E59D0D",
        fontFamily: "system-ui, sans-serif",
        fontSizeBase: "15px",
        spacingUnit: "4px",
        borderRadius: "6px",
      },
      rules: {
        ".Block": {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
        },
        ".Input": {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          color: "#FFFFFF",
          borderColor: "rgba(255, 255, 255, 0.1)",
          fontSize: "15px",
          lineHeight: "1.4",
          padding: "10px 14px",
          borderRadius: "6px",
          minHeight: "40px",
        },
        ".Input--invalid": {
          borderColor: "#E59D0D",
          boxShadow: "0 0 0 3px rgba(229, 157, 13, 0.2)",
        },
        ".Input--complete": {
          borderColor: "rgba(255, 255, 255, 0.16)",
        },
        ".Input:focus": {
          borderColor: "#E59D0D",
          boxShadow: "0 0 0 3px rgba(229, 157, 13, 0.2)",
        },
        ".Input::placeholder": {
          color: "rgba(255, 255, 255, 0.55)",
          fontSize: "15px",
        },
        ".Label": {
          color: "rgba(255, 255, 255, 0.72)",
          fontSize: "13px",
          fontWeight: "500",
        },
        ".Tab": {
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          color: "#FFFFFF",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          fontSize: "13px",
          padding: "10px 12px",
          minHeight: "40px",
        },
        ".TabLabel": {
          fontSize: "13px",
          lineHeight: "1.2",
        },
        ".Tab:hover": {
          borderColor: "rgba(255, 255, 255, 0.16)",
        },
        ".Tab--selected": {
          borderColor: "#E59D0D",
          color: "#E59D0D",
        },
      },
    },
  }}
>
\`\`\`

### PaymentElement Usage (Lines 96-100):

\`\`\`tsx
<PaymentElement
  options={{
    layout: "tabs",
  }}
/>
\`\`\`

---

## 2. MusicianOnboardingPage.tsx (FULL FILE)

**Path:** `/Users/alexwaldmann/Desktop/TripleAApps/TripleAMusician/src/pages/MusicianOnboardingPage.tsx`

**Lines:** 1-562 (full file provided in research)

### Key Stripe Connect Usage (Lines 7-11):

\`\`\`tsx
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
\`\`\`

### Stripe Connect Appearance Configuration (Lines 191-267):

**⚠️ EXACT DUPLICATE OF CHECKOUTPAGE CONFIG:**

\`\`\`tsx
appearance: {
  theme: "night",
  variables: {
    colorPrimary: "#E59D0D",
    colorBackground: "#0B0C10",
    colorText: "#FFFFFF",
    colorTextSecondary: "rgba(255, 255, 255, 0.72)",
    colorTextPlaceholder: "rgba(255, 255, 255, 0.55)",
    colorDanger: "#E59D0D",
    fontFamily: "system-ui, sans-serif",
    fontSizeBase: "15px",
    spacingUnit: "4px",
    borderRadius: "6px",
  },
  rules: {
    ".Block": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      borderRadius: "6px",
    },
    ".Input": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      color: "#FFFFFF",
      borderColor: "rgba(255, 255, 255, 0.1)",
      fontSize: "15px",
      lineHeight: "1.4",
      padding: "10px 14px",
      borderRadius: "6px",
      minHeight: "40px",
    },
    ".Input--invalid": {
      borderColor: "#E59D0D",
      boxShadow: "0 0 0 3px rgba(229, 157, 13, 0.2)",
    },
    ".Input--complete": {
      borderColor: "rgba(255, 255, 255, 0.16)",
    },
    ".Input:focus": {
      borderColor: "#E59D0D",
      boxShadow: "0 0 0 3px rgba(229, 157, 13, 0.2)",
    },
    ".Input::placeholder": {
      color: "rgba(255, 255, 255, 0.55)",
      fontSize: "15px",
    },
    ".Label": {
      color: "rgba(255, 255, 255, 0.72)",
      fontSize: "13px",
      fontWeight: "500",
    },
    ".Tab": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      color: "#FFFFFF",
      borderColor: "rgba(255, 255, 255, 0.1)",
      borderRadius: "6px",
      fontSize: "13px",
      padding: "10px 12px",
      minHeight: "40px",
    },
    ".TabLabel": {
      fontSize: "13px",
      lineHeight: "1.2",
    },
    ".Tab:hover": {
      borderColor: "rgba(255, 255, 255, 0.16)",
    },
    ".Tab--selected": {
      borderColor: "#E59D0D",
      color: "#E59D0D",
    },
  },
},
\`\`\`

---

## 3. Shared SCSS Styles

### 3.1 global.scss (FULL FILE)

**Path:** `/Users/alexwaldmann/Desktop/TripleAApps/packages/shared/src/styles/global.scss`

**Key Token Definitions:**

\`\`\`scss
:root {
  /* Brand palette */
  --taa-blue-900: #1c276e;
  --taa-blue-200: #adb8e0;
  --taa-gold-500: #e59d0d;
  --taa-purple-400: #825eca;
  --taa-purple-900: #4e238b;
  --taa-gray-600: #4b4e63;
  --taa-white: #ffffff;
  --taa-black: #000000;

  /* Theme tokens (default: dark) */
  --bg: color-mix(in srgb, var(--taa-black) 94%, var(--app-glow));
  --text: var(--taa-white);
  --text-muted: color-mix(in srgb, var(--taa-white) 72%, var(--taa-gray-600));
  --text-subtle: color-mix(in srgb, var(--taa-white) 55%, var(--taa-gray-600));

  /* Flat surfaces */
  --surface: rgba(255, 255, 255, 0.04);
  --surface-2: rgba(255, 255, 255, 0.06);
  --surface-3: rgba(255, 255, 255, 0.08);
  --border: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.16);

  /* Primary actions only (gold) */
  --primary: var(--taa-gold-500);
  --primary-contrast: var(--taa-black);

  /* Typography scale */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 17px;

  --font: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}
\`\`\`

### 3.2 primitives.module.scss (RELEVANT SECTIONS)

**Path:** `/Users/alexwaldmann/Desktop/TripleAApps/packages/shared/src/styles/primitives.module.scss`

**Input Primitive (Lines 180-192):**

\`\`\`scss
.input {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.input:focus {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 35%, transparent);
}
\`\`\`

**Field/Label Primitives (Lines 194-208):**

\`\`\`scss
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.labelMuted {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
}
\`\`\`

---

## 4. CheckoutPage.module.scss (FULL FILE)

**Path:** `/Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic/src/pages/CheckoutPage.module.scss`

**Lines:** 1-467

### Custom Form Field Styles (Lines 406-435):

\`\`\`scss
.formField {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formField label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.formField input {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.formField input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(229, 157, 13, 0.15);
}

.formField input::placeholder {
  color: var(--text-muted);
}
\`\`\`

---

## 5. theme.ts (Shared Theme Tokens)

**Path:** `/Users/alexwaldmann/Desktop/TripleAApps/packages/shared/src/theme.ts`

**Full Contents:**

\`\`\`typescript
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
\`\`\`

---

## 6. Key Patterns & Mapping

### 6.1 Stripe Variables → CSS Tokens

| Stripe Variable | Current Value | CSS Token Equivalent |
|----------------|---------------|---------------------|
| colorPrimary | #E59D0D | var(--primary) |
| colorBackground | #0B0C10 | var(--bg) |
| colorText | #FFFFFF | var(--text) |
| colorTextSecondary | rgba(255, 255, 255, 0.72) | var(--text-muted) |
| colorTextPlaceholder | rgba(255, 255, 255, 0.55) | var(--text-subtle) |
| borderRadius | 6px | var(--radius-md) |

### 6.2 Stripe Input Styles Match Primitives

- padding: 10px 14px ✅ (exact match)
- borderColor: rgba(255, 255, 255, 0.1) ✅ (matches --border)
- backgroundColor: rgba(255, 255, 255, 0.04) ✅ (matches --surface)
- focus borderColor: #E59D0D ✅ (matches --primary)

---

## 7. Duplication Issue

Both CheckoutPage.tsx and MusicianOnboardingPage.tsx have **IDENTICAL** inline appearance configs (78 lines duplicated).

**Opportunity:** Create shared config at `/packages/shared/src/lib/stripeAppearance.ts`

---

## Files Referenced (Complete List)

1. /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic/src/pages/CheckoutPage.tsx (FULL - 743 lines)
2. /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic/src/pages/CheckoutPage.module.scss (FULL - 467 lines)
3. /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusician/src/pages/MusicianOnboardingPage.tsx (FULL - 562 lines)
4. /Users/alexwaldmann/Desktop/TripleAApps/packages/shared/src/styles/global.scss (FULL - 195 lines)
5. /Users/alexwaldmann/Desktop/TripleAApps/packages/shared/src/styles/primitives.module.scss (FULL - 1531 lines)
6. /Users/alexwaldmann/Desktop/TripleAApps/packages/shared/src/theme.ts (FULL - 43 lines)
7. /Users/alexwaldmann/Desktop/TripleAApps/TripleAMusic/src/pages/CartPage.tsx (fee calculations only)

---

**END OF RESEARCH REPORT**
