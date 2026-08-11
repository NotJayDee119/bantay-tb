import { useCallback, useState } from "react";
import { resolveBarangay, type ResolvedArea } from "../lib/nearestBarangay";

/**
 * The user's barangay, from the device GPS, on explicit request only.
 *
 * Never fires on mount. A health app that throws a location prompt at you the
 * moment a page loads gets denied by reflex, and the denial is sticky — the
 * user then can't grant it later without digging through browser settings. So
 * the request is tied to a button the user presses when they actually want
 * "my area" answered.
 *
 * Coordinates stay on the device. What leaves this hook is a barangay name,
 * which is the granularity every other part of the system already works in;
 * the raw fix is never stored, sent to Supabase, or put in a chatbot prompt.
 */

export type GeoStatus =
  | "idle"
  | "locating"
  | "ready"
  /** Permission refused, or previously refused and still blocked. */
  | "denied"
  /** No geolocation API — insecure origin or an old browser. */
  | "unsupported"
  /** A fix came back, but from outside Davao City. */
  | "outside"
  | "error";

export interface GeoState {
  status: GeoStatus;
  area: ResolvedArea | null;
  /** Reported accuracy of the fix, in metres. Worth showing when it's poor. */
  accuracyM: number | null;
  message: string | null;
}

const IDLE: GeoState = {
  status: "idle",
  area: null,
  accuracyM: null,
  message: null,
};

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(IDLE);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({
        status: "unsupported",
        area: null,
        accuracyM: null,
        message:
          "This browser can't share a location. Type your barangay name instead.",
      });
      return;
    }

    setState({ ...IDLE, status: "locating" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const area = resolveBarangay(latitude, longitude);
        if (!area) {
          setState({
            status: "outside",
            area: null,
            accuracyM: accuracy ?? null,
            message:
              "You appear to be outside Davao City, so there's no barangay to match. Type a barangay name instead.",
          });
          return;
        }
        setState({
          status: "ready",
          area,
          accuracyM: accuracy ?? null,
          message: null,
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState({
          status: denied ? "denied" : "error",
          area: null,
          accuracyM: null,
          message: denied
            ? "Location permission was declined. You can still ask about a barangay by name."
            : "Couldn't get a location fix. Try again, or name your barangay in the question.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        // A five-minute-old fix is fine at barangay granularity and saves the
        // GPS warm-up on repeat questions.
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, []);

  const clear = useCallback(() => setState(IDLE), []);

  return { ...state, request, clear };
}
