import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAllowedOrigins } from "../lib/env";

/**
 * Returns a function that safely navigates back in browser history.
 *
 * If the previous page was on the same origin or a configured sister host,
 * it uses navigate(-1). Otherwise, it navigates to the fallback route.
 *
 * @param fallback - The fallback route if back navigation is unsafe (default: "/")
 */
export function useSafeBack(fallback: string = "/"): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    const referrer = document.referrer;

    // No referrer means direct navigation or privacy settings block it
    if (!referrer) {
      navigate(fallback);
      return;
    }

    try {
      const referrerUrl = new URL(referrer);
      const currentOrigin = window.location.origin;
      const allowedOrigins = getAllowedOrigins();

      // Check if referrer is same origin
      if (referrerUrl.origin === currentOrigin) {
        navigate(-1);
        return;
      }

      // Check if referrer is a sister host
      if (allowedOrigins.includes(referrerUrl.origin)) {
        navigate(-1);
        return;
      }

      // Referrer is from an external site, use fallback
      navigate(fallback);
    } catch {
      // Invalid URL, use fallback
      navigate(fallback);
    }
  }, [navigate, fallback]);
}

export default useSafeBack;
