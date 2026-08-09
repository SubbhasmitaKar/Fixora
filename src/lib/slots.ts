export type SlotStatus = "available" | "booked" | "unavailable";

export type SlotRow = {
  id: string;
  provider_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  booking_id: string | null;
};

/** "09:00:00" -> "09:00" */
export function hhmm(time: string) {
  return time.slice(0, 5);
}

export function slotLabel(slot: Pick<SlotRow, "start_time" | "end_time">) {
  return `${hhmm(slot.start_time)} - ${hhmm(slot.end_time)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function prettyDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** Next `count` calendar days starting today, as ISO strings. */
export function upcomingDates(count = 10) {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function toMinutes(t: string) {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function toTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Split working hours into fixed-length slots. */
export function generateSlots(from: string, to: string, durationMinutes: number) {
  const start = toMinutes(from);
  const end = toMinutes(to);
  const out: { start_time: string; end_time: string }[] = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || durationMinutes <= 0) return out;
  for (let t = start; t + durationMinutes <= end; t += durationMinutes) {
    out.push({ start_time: toTime(t), end_time: toTime(t + durationMinutes) });
  }
  return out;
}

/** Rough haversine distance in km. */
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Average city driving speed used for ETA maths. */
export const AVG_SPEED_KMPH = 22;

export function etaMinutes(distance: number) {
  return Math.max(1, Math.round((distance / AVG_SPEED_KMPH) * 60));
}
