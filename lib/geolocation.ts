// Client-side only — both functions are called from browser event handlers.

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

export type GeoError = "unsupported" | "denied" | "unavailable" | "timeout";

export function getBrowserPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    // Geolocation exists only in secure contexts (HTTPS / localhost).
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.geolocation) {
      reject("unsupported" satisfies GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      (err) =>
        reject(
          (err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable") satisfies GeoError,
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export interface ReverseGeocodeResult {
  street: string; // best-effort "road, suburb" line — user refines it
  city: string; // city/town/state fallback chain
  governorate: string; // OSM "state" (Egypt's governorate) — used for the delivery-area gate
}

// Nominatim (OpenStreetMap). Free, no key, CORS-enabled. Fair-use policy is
// fine at our volume (one call per explicit button tap). This is the ONLY
// provider-specific function — swap the body to Google/Mapbox later without
// touching any caller.
export async function reverseGeocode(fix: GeoFix, locale: string): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${fix.lat}&lon=${fix.lng}&accept-language=${locale}&zoom=18`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const street = [a.road, a.neighbourhood ?? a.suburb].filter(Boolean).join(", ");
    const city = a.city ?? a.town ?? a.village ?? a.state ?? "";
    const governorate = a.state ?? "";
    if (!street && !city) return null;
    return { street, city, governorate };
  } catch {
    return null; // coords are still useful without a readable address
  }
}

// Governorates the pharmacy delivers to. Matched loosely against the
// reverse-geocoded governorate/city because Nominatim localizes those fields
// to the requested language, so both the English and Arabic names must hit.
// "جيزة" also covers "الجيزة"; "قاهرة" covers "القاهرة".
const DELIVERY_AREA_TOKENS = ["cairo", "giza", "قاهرة", "جيزة"];

// Whether a captured location is inside the delivery area.
//   true  — governorate/city matches Cairo or Giza
//   false — resolved to somewhere else (block the order)
//   null  — couldn't determine (reverse geocode failed); caller should fail
//           open rather than reject a possibly-valid address
export function isWithinDeliveryArea(geo: ReverseGeocodeResult | null): boolean | null {
  if (!geo) return null;
  const haystack = `${geo.governorate} ${geo.city}`.toLowerCase();
  if (!haystack.trim()) return null;
  return DELIVERY_AREA_TOKENS.some((token) => haystack.includes(token));
}
