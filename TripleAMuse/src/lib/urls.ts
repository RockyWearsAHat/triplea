/**
 * URL utilities for Triple A Muse.
 * Re-exports from shared env module for environment-aware URLs.
 */
export {
  getServerOrigin as SERVER_ORIGIN_FN,
  getApiBaseUrl as API_BASE_URL_FN,
  getMusicOrigin as MUSIC_ORIGIN_FN,
  getMusicianOrigin as MUSICIAN_ORIGIN_FN,
  getMuseOrigin as MUSE_ORIGIN_FN,
  apiAssetUrl,
  openExternal,
  openMusic,
  openMusician,
  openMuse,
  openMusicRegister,
  openMusicianRegister,
} from "@shared/lib/env";

import {
  getServerOrigin,
  getApiBaseUrl,
  getMusicOrigin,
  getMusicianOrigin,
} from "@shared/lib/env";
import { TripleAApiClient } from "@shared";

/**
 * Create an API client instance with environment-aware base URL.
 */
export function createApiClient(): TripleAApiClient {
  return new TripleAApiClient({ baseUrl: getApiBaseUrl() });
}

/**
 * Get the full URL for an API asset path (e.g., instrument images).
 */
export function getAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = getServerOrigin();
  // On Netlify, origin is empty and we use relative paths
  if (!origin) {
    return path.startsWith("/api") ? path : `/api${path}`;
  }
  return `${origin}${path}`;
}

// Legacy exports for backwards compatibility
export const SERVER_ORIGIN = getServerOrigin();
export const API_BASE_URL = getApiBaseUrl();
export const MUSIC_ORIGIN = getMusicOrigin();
export const MUSICIAN_ORIGIN = getMusicianOrigin();
