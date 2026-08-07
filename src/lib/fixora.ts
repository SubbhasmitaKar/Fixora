import {
  Zap,
  Wrench,
  GraduationCap,
  Sparkles,
  SprayCan,
  Snowflake,
  Hammer,
  type LucideIcon,
} from "lucide-react";

export const COMMISSION_RATE = 0.1;

export type Category = {
  name: string;
  icon: LucideIcon;
  blurb: string;
};

export const CATEGORIES: Category[] = [
  { name: "Electrician", icon: Zap, blurb: "Wiring, repairs & safety checks" },
  { name: "Plumber", icon: Wrench, blurb: "Leaks, fittings & drainage" },
  { name: "Tutor", icon: GraduationCap, blurb: "Academics & spoken English" },
  { name: "Beautician", icon: Sparkles, blurb: "Salon & bridal at home" },
  { name: "Cleaner", icon: SprayCan, blurb: "Deep cleaning & upholstery" },
  { name: "AC Technician", icon: Snowflake, blurb: "Service, gas & installation" },
  { name: "Carpenter", icon: Hammer, blurb: "Custom builds & repairs" },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

export const LOCATIONS = [
  "Bengaluru",
  "Chennai",
  "Delhi",
  "Hyderabad",
  "Jaipur",
  "Mumbai",
  "Pune",
];

export const TIME_SLOTS = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00",
];

export const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function formatCurrency(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function categoryIcon(name: string): LucideIcon {
  return CATEGORIES.find((c) => c.name === name)?.icon ?? Sparkles;
}
