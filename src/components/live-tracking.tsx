import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { distanceKm, etaMinutes } from "@/lib/slots";

export type TrackingBooking = {
  id: string;
  user_lat: number | null;
  user_lng: number | null;
  provider_lat: number | null;
  provider_lng: number | null;
  eta_minutes: number | null;
  tracking_active: boolean;
};

/** Subscribes to live updates for a single booking row. */
export function useLiveBooking(bookingId: string, initial: TrackingBooking) {
  const [row, setRow] = useState<TrackingBooking>(initial);

  useEffect(() => {
    setRow(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial.provider_lat,
    initial.provider_lng,
    initial.tracking_active,
    initial.eta_minutes,
    bookingId,
  ]);

  useEffect(() => {
    const channel = supabase
      .channel(`booking-track-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => setRow(payload.new as TrackingBooking),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId]);

  return row;
}

function project(
  point: [number, number],
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  const spanLat = Math.max(bounds.maxLat - bounds.minLat, 0.005);
  const spanLng = Math.max(bounds.maxLng - bounds.minLng, 0.005);
  const x = 10 + ((point[1] - bounds.minLng) / spanLng) * 80;
  const y = 90 - ((point[0] - bounds.minLat) / spanLat) * 80;
  return { x, y };
}

export function LiveTrackingMap({
  booking,
  providerName,
}: {
  booking: TrackingBooking;
  providerName: string;
}) {
  const user: [number, number] | null =
    booking.user_lat != null && booking.user_lng != null
      ? [booking.user_lat, booking.user_lng]
      : null;
  const provider: [number, number] | null =
    booking.provider_lat != null && booking.provider_lng != null
      ? [booking.provider_lat, booking.provider_lng]
      : null;

  const geometry = useMemo(() => {
    if (!user || !provider) return null;
    const bounds = {
      minLat: Math.min(user[0], provider[0]),
      maxLat: Math.max(user[0], provider[0]),
      minLng: Math.min(user[1], provider[1]),
      maxLng: Math.max(user[1], provider[1]),
    };
    return { u: project(user, bounds), p: project(provider, bounds) };
  }, [user?.[0], user?.[1], provider?.[0], provider?.[1]]);

  if (!user || !provider || !geometry) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Waiting for live location…
      </p>
    );
  }

  const dist = distanceKm(provider, user);
  const eta = booking.eta_minutes ?? etaMinutes(dist);
  const arrived = dist < 0.15;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <svg viewBox="0 0 100 100" className="h-56 w-full bg-secondary" role="img" aria-label="Live provider tracking map">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-border" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        <line
          x1={geometry.p.x}
          y1={geometry.p.y}
          x2={geometry.u.x}
          y2={geometry.u.y}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 2"
          className="text-primary"
        />
        <circle cx={geometry.u.x} cy={geometry.u.y} r="3" className="fill-destructive" />
        <circle cx={geometry.p.x} cy={geometry.p.y} r="4.5" className="fill-primary opacity-30">
          <animate attributeName="r" values="4.5;7;4.5" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <circle cx={geometry.p.x} cy={geometry.p.y} r="3" className="fill-primary" />
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Navigation className="size-4 text-primary" />
          {arrived ? `${providerName} has arrived` : `${providerName} is on the way`}
        </span>
        <span className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-4" /> {dist.toFixed(1)} km
          </span>
          <span className="flex items-center gap-1">
            <Timer className="size-4" /> ETA {arrived ? "now" : `${eta} min`}
          </span>
        </span>
      </div>
    </div>
  );
}
