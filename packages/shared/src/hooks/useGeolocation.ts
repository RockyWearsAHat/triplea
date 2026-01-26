import { useState, useEffect, useCallback } from "react";

export interface GeolocationState {
  coordinates: { lat: number; lng: number } | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
}

export function useGeolocation(): GeolocationState & {
  requestLocation: () => void;
} {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    loading: false,
    permissionDenied: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          error: null,
          loading: false,
          permissionDenied: false,
        });
      },
      (error) => {
        const permissionDenied = error.code === error.PERMISSION_DENIED;
        setState({
          coordinates: null,
          error: permissionDenied
            ? "Location access denied. Enable location to see nearby concerts."
            : "Unable to retrieve your location",
          loading: false,
          permissionDenied,
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    // Auto-request location on mount - browser will show native permission popup
    requestLocation();
  }, [requestLocation]);

  return { ...state, requestLocation };
}
