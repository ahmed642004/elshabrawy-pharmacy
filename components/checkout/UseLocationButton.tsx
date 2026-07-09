"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LocateFixed, MapPin, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { getBrowserPosition, reverseGeocode, type GeoError, type GeoFix, type ReverseGeocodeResult } from "@/lib/geolocation";

// Geolocation support never changes during a session, so this "subscription"
// never fires — useSyncExternalStore just gives a hydration-safe way to read
// a browser-only API (server snapshot is always false, avoiding a mismatch).
const noopSubscribe = () => () => {};
const getServerSnapshot = () => false;
function getClientSnapshot(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator && window.isSecureContext;
}

interface UseLocationButtonProps {
  captured: { accuracyM: number } | null;
  onCaptured: (fix: GeoFix, geocoded: ReverseGeocodeResult | null) => void;
  onCleared: () => void;
}

export default function UseLocationButton({ captured, onCaptured, onCleared }: UseLocationButtonProps) {
  const t = useTranslations("checkout.geo");
  const locale = useLocale();
  const supported = useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GeoError | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const fix = await getBrowserPosition();
      const geocoded = await reverseGeocode(fix, locale);
      onCaptured(fix, geocoded);
    } catch (err) {
      setError(err as GeoError);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  if (captured) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] border border-secondary-100 bg-secondary-50 px-3.5 py-2.5 text-[13px] text-neutral-700">
        <MapPin className="h-4 w-4 shrink-0 text-secondary-600" />
        <span className="flex-1">{t("captured", { accuracy: Math.round(captured.accuracyM) })}</span>
        <button
          type="button"
          onClick={onCleared}
          aria-label={t("clearLocation")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white hover:text-neutral-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" variant="outlined" size="md" disabled={loading} onClick={handleClick} className="w-fit">
        <LocateFixed className="h-4 w-4" />
        {loading ? t("locating") : t("useMyLocation")}
      </Button>
      {error && <div className="text-xs text-danger-500">{t(error)}</div>}
    </div>
  );
}
