/**
 * Environment-aware URL configuration for Triple A Apps.
 *
 * Detects Netlify deployment and constructs URLs accordingly:
 * - Local dev: uses localhost ports (5173, 5174, 5175, 4000)
 * - Netlify: uses subdomains (muse., music., musician.) on the site URL
 *
 * The server API is either localhost:4000 or /.netlify/functions/api on Netlify.
 */

// Check if we're running on Netlify (browser-side only)
const isNetlify =
  typeof window !== "undefined"
    ? window.location.hostname.includes("netlify") ||
      import.meta.env.VITE_NETLIFY === "true"
    : false;

const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/, "");

// Base Netlify domain (will be set via VITE_NETLIFY_SITE_NAME or detected)
const getNetlifySiteName = (): string => {
  if (typeof window === "undefined") return "triplea.netlify.app";

  // Browser: detect from current URL or use env var
  const hostname = window.location.hostname;
  // Extract base site name from subdomains like muse.triplea.netlify.app
  const match = hostname.match(
    /(?:muse\.|music\.|musician\.)?(.+\.netlify\.app)/,
  );
  if (match) return match[1]!;
  // Fallback to env var
  return import.meta.env.VITE_NETLIFY_SITE_NAME || "triplea.netlify.app";
};

// Determine which app we're currently in (for relative API calls on Netlify)
const getCurrentApp = (): "muse" | "music" | "musician" | null => {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  if (hostname.startsWith("muse.")) return "muse";
  if (hostname.startsWith("music.")) return "music";
  if (hostname.startsWith("musician.")) return "musician";
  // Local dev: determine by port
  const port = window.location.port;
  if (port === "5173") return "music"; // Music is the default/main
  if (port === "5174") return "musician";
  if (port === "5175") return "muse";
  return null;
};

// URL generators
export const getServerOrigin = (): string => {
  const override = import.meta.env.VITE_SERVER_ORIGIN;
  if (override) return normalizeOrigin(override);
  if (isNetlify) return "";
  return "http://localhost:4000";
};

export const getApiBaseUrl = (): string => {
  if (isNetlify) {
    // On Netlify, /api/* is redirected to the function
    return "/api";
  }
  const origin = getServerOrigin();
  if (!origin) return "/api";
  return `${origin}/api`;
};

export const getMuseOrigin = (): string => {
  const override = import.meta.env.VITE_MUSE_ORIGIN;
  if (override) return normalizeOrigin(override);
  if (isNetlify) {
    const siteName = getNetlifySiteName();
    return `https://muse.${siteName}`;
  }
  return "http://localhost:5175";
};

export const getMusicOrigin = (): string => {
  const override = import.meta.env.VITE_MUSIC_ORIGIN;
  if (override) return normalizeOrigin(override);
  if (isNetlify) {
    const siteName = getNetlifySiteName();
    return `https://music.${siteName}`;
  }
  return "http://localhost:5173";
};

export const getMusicianOrigin = (): string => {
  const override = import.meta.env.VITE_MUSICIAN_ORIGIN;
  if (override) return normalizeOrigin(override);
  if (isNetlify) {
    const siteName = getNetlifySiteName();
    return `https://musician.${siteName}`;
  }
  return "http://localhost:5174";
};

/**
 * Convert a server-relative pathname to a full URL.
 * On Netlify, assets are served through the /api redirect.
 */
export const apiAssetUrl = (pathname?: string): string | undefined => {
  if (!pathname) return undefined;
  // If already a full URL, return as-is
  if (/^https?:\/\//i.test(pathname)) return pathname;

  const origin = getServerOrigin();
  if (isNetlify) {
    // Netlify: /api/* is redirected to the function
    // If pathname starts with /api, use as-is; otherwise prepend /api
    if (pathname.startsWith("/api")) return pathname;
    return `/api${pathname}`;
  }
  return `${origin}${pathname}`;
};

// Helper to open external URLs
export const openExternal = (url: string): void => {
  window.open(url, "_blank", "noreferrer");
};

export const openMusic = (): void => openExternal(getMusicOrigin());
export const openMusician = (): void => openExternal(getMusicianOrigin());
export const openMuse = (): void => openExternal(getMuseOrigin());

export const openMusicRegister = (): void =>
  openExternal(`${getMusicOrigin()}/register`);
export const openMusicianRegister = (): void =>
  openExternal(`${getMusicianOrigin()}/register`);

// Export detection utilities
export const isNetlifyEnv = isNetlify;
export const currentApp = getCurrentApp();

// All allowed origins for CORS
export const getAllowedOrigins = (): string[] => {
  const origins = new Set<string>();

  // Always allow current origin (prevents false negatives in useSafeBack)
  if (typeof window !== "undefined") origins.add(window.location.origin);

  // Explicit app origins (works for custom domains)
  origins.add(getMusicOrigin());
  origins.add(getMusicianOrigin());
  origins.add(getMuseOrigin());

  // Netlify subdomain pattern (deploy previews / netlify.app)
  if (isNetlify) {
    const siteName = getNetlifySiteName();
    origins.add(`https://muse.${siteName}`);
    origins.add(`https://music.${siteName}`);
    origins.add(`https://musician.${siteName}`);
    origins.add(`https://${siteName}`);
  }

  // Local dev convenience
  origins.add("http://localhost:5173");
  origins.add("http://localhost:5174");
  origins.add("http://localhost:5175");

  // Remove any empty strings
  origins.delete("");

  return Array.from(origins);
};
