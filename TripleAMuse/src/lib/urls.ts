export const SERVER_ORIGIN = "http://localhost:4000";
export const API_BASE_URL = `${SERVER_ORIGIN}/api`;

export const MUSIC_ORIGIN = "http://localhost:5174";
export const MUSICIAN_ORIGIN = "http://localhost:5175";

export function openExternal(url: string) {
  window.open(url, "_blank", "noreferrer");
}

export function openMusic() {
  openExternal(MUSIC_ORIGIN);
}

export function openMusician() {
  openExternal(MUSICIAN_ORIGIN);
}

export function openMusicRegister() {
  openExternal(`${MUSIC_ORIGIN}/register`);
}

export function openMusicianRegister() {
  openExternal(`${MUSICIAN_ORIGIN}/register`);
}

export function apiAssetUrl(pathname?: string): string | undefined {
  if (!pathname) return undefined;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${SERVER_ORIGIN}${pathname}`;
}
