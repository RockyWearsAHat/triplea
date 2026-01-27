/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Netlify detection
  readonly VITE_NETLIFY?: string;
  readonly VITE_NETLIFY_SITE_NAME?: string;

  // URL overrides (optional - auto-detected on Netlify)
  readonly VITE_SERVER_ORIGIN?: string;
  readonly VITE_MUSIC_ORIGIN?: string;
  readonly VITE_MUSICIAN_ORIGIN?: string;
  readonly VITE_MUSE_ORIGIN?: string;

  // Stripe
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;

  // Google Maps
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
