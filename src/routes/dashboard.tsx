import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Clock, IndianRupee, Star, Navigation, X, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/fixora";
import { slotLabel, todayISO, upcomingDates, type SlotRow } from "@/lib/slots";
import { DateStrip, SlotPicker } from "@/components/slot-picker";
import { LiveTrackingMap, useLiveBooking, type TrackingBooking } from "@/components/live-tracking";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import { DashboardHeader, StatCard, StatusBadge } from "@/components/dashboard-bits";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Bookings — Fixora Dashboard" },
      {
        name: "description",
        content:
          "Track your Fixora bookings live, reschedule to any open slot and follow your provider on the map.",
      },
      { property: "og:title", content: "My Bookings — Fixora Dashboard" },
      {
        property: "og:description",
        content: "Your bookings, rescheduling and live provider tracking.",
      },
    ],
  }),
  component: () => (
    <RequireRole roles={["user", "provider", "admin"]}>
      <UserDashboard />
    </RequireRole>
  ),
});

type BookingWithService = TrackingBooking & {
  booking_date: string;
  time_slot: string;
  status: string;
  price: number;
  notes: string | null;
  created_at: string;
  service_id: string;
  provider_id: string | null;
  slot_id: string | null;
  services: { title: string; category: string; provider_name: string; location: string } | null;
};

const SELECT =
  "id, booking_date, time_slot, status, price, notes, created_at, service_id, provider_id, slot_id, user_lat, user_lng, provider_lat, provider_lng, eta_minutes, tracking_active, services(title, category, provider_name, location)";

function UserDashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookings } = useQuery({
    queryKey: ["bookings", "mine", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(SELECT)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BookingWithService[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-bookings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled — the slot is open again");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = bookings ?? [];
  const upcoming = rows.filter((b) => ["pending", "accepted"].includes(b.status));
  const past = rows.filter((b) => !["pending", "accepted"].includes(b.status));
  const completed = rows.filter((b) => b.status === "completed");
  const spend = completed.reduce((sum, b) => sum + Number(b.price), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <DashboardHeader
        title={`Hi ${profile?.name?.split(" ")[0] || "there"} 👋`}
        subtitle="Upcoming jobs, live tracking and one-tap rescheduling."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bookings" value={String(rows.length)} icon={CalendarCheck} />
        <StatCard
          label="Upcoming"
          value={String(upcoming.length)}
          hint="Pending or accepted"
          icon={Clock}
        />
        <StatCard label="Completed" value={String(completed.length)} icon={Star} />
        <StatCard
          label="Total spend"
          value={formatCurrency(spend)}
          hint="Completed jobs only"
          icon={IndianRupee}
        />
      </div>

      <h2 className="mt-10 text-xl font-bold">Upcoming bookings</h2>
      {upcoming.length === 0 ? (
        <Card className="glass mt-4 rounded-2xl p-12 text-center">
          <p className="font-semibold">Nothing scheduled</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse services and lock in a live slot.
          </p>
          <Button asChild className="gradient-brand mt-5 border-0 text-primary-foreground">
            <Link to="/services">Browse services</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {upcoming.map((b) => (
            <BookingCard key={b.id} booking={b} onCancel={() => cancel.mutate(b.id)} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold">History</h2>
          <div className="mt-4 space-y-3">
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
}: {
  booking: BookingWithService;
  onCancel?: () => void;
}) {
  const live = useLiveBooking(booking.id, booking);
  const canChange = ["pending", "accepted"].includes(booking.status);

  return (
    <Card className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{booking.services?.title ?? "Service"}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.services?.provider_name} · {booking.services?.location} ·{" "}
            {new Date(`${booking.booking_date}T00:00:00`).toDateString()} · {booking.time_slot}
          </p>
          {booking.notes && <p className="mt-2 text-sm text-muted-foreground">“{booking.notes}”</p>}
          {booking.status === "accepted" && !live.tracking_active && (
            <p className="mt-2 text-xs font-medium text-primary">
              Provider accepted — tracking starts when they head out.
            </p>
          )}
          {booking.status === "rejected" && (
            <p className="mt-2 text-xs font-medium text-destructive">
              Provider could not take this job. Choose another time or provider.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{formatCurrency(booking.price)}</span>
          {booking.status === "completed" && (
            <Button asChild size="sm" variant="outline">
              <Link to="/services/$id" params={{ id: booking.service_id }}>
                Leave review
              </Link>
            </Button>
          )}
          {canChange && booking.provider_id && <RescheduleDialog booking={booking} />}
          {canChange && onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              <X className="size-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {live.tracking_active && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Navigation className="size-4 text-primary" /> Live tracking
          </p>
          <LiveTrackingMap
            booking={live}
            providerName={booking.services?.provider_name ?? "Your provider"}
          />
        </div>
      )}
    </Card>
  );
}

function RescheduleDialog({ booking }: { booking: BookingWithService }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const dates = useMemo(() => upcomingDates(10), []);
  const [date, setDate] = useState(
    booking.booking_date >= todayISO() ? booking.booking_date : todayISO(),
  );
  const [selected, setSelected] = useState<SlotRow | null>(null);

  const { data: slots } = useQuery({
    queryKey: ["slots", booking.provider_id, date],
    enabled: open && Boolean(booking.provider_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_slots")
        .select("id, provider_id, slot_date, start_time, end_time, status, booking_id")
        .eq("provider_id", booking.provider_id!)
        .eq("slot_date", date)
        .order("start_time");
      if (error) throw error;
      return data as SlotRow[];
    },
  });

  const available = (slots ?? []).filter(
    (s) => s.status === "available" || s.id === booking.slot_id,
  );

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Pick a new slot");
      const { error } = await supabase
        .from("bookings")
        .update({ slot_id: selected.id })
        .eq("id", booking.id);
      if (error) {
        if (/already booked/i.test(error.message) || error.code === "23505")
          throw new Error("Slot already booked — choose another time.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Booking rescheduled — your old slot is free again");
      setOpen(false);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <RefreshCw className="size-4" /> Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>
            Only open slots are shown. Your current slot frees up automatically.
          </DialogDescription>
        </DialogHeader>
        <DateStrip
          dates={dates}
          value={date}
          onChange={(d) => {
            setDate(d);
            setSelected(null);
          }}
        />
        <SlotPicker
          slots={available}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          emptyMessage="No open slots on this date. Choose another time."
        />
        <Button
          className="gradient-brand mt-2 w-full border-0 text-primary-foreground"
          disabled={!selected || reschedule.isPending}
          onClick={() => reschedule.mutate()}
        >
          {selected ? `Move to ${slotLabel(selected)}` : "Choose another time"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
