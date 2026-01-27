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

// Legacy exports for backwards compatibility
export const SERVER_ORIGIN = getServerOrigin();
export const API_BASE_URL = getApiBaseUrl();
export const MUSIC_ORIGIN = getMusicOrigin();
export const MUSICIAN_ORIGIN = getMusicianOrigin();
