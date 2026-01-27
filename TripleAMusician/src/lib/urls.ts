/**
 * URL utilities for Triple A Musician.
 * Re-exports from shared env module for environment-aware URLs.
 */
export {
  getServerOrigin,
  getApiBaseUrl,
  getMusicOrigin,
  getMusicianOrigin,
  getMuseOrigin,
  apiAssetUrl,
  openExternal,
  openMusic,
  openMusician,
  openMuse,
  openMusicRegister,
  openMusicianRegister,
} from "@shared/lib/env";

import {
  getApiBaseUrl,
  getServerOrigin,
  getMusicOrigin,
} from "@shared/lib/env";
import { TripleAApiClient } from "@shared";

/**
 * Create an API client instance with environment-aware base URL.
 */
export function createApiClient(): TripleAApiClient {
  return new TripleAApiClient({ baseUrl: getApiBaseUrl() });
}

/**
 * Get the full URL for an API asset path (e.g., location images).
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

// Convenience exports
export const API_BASE_URL = getApiBaseUrl();
export const SERVER_ORIGIN = getServerOrigin();
export const MUSIC_ORIGIN = getMusicOrigin();
