import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock, Loader2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { COMMISSION_RATE, formatCurrency } from "@/lib/fixora";
import { slotLabel, todayISO, upcomingDates, type SlotRow } from "@/lib/slots";
import { DateStrip, SlotPicker } from "@/components/slot-picker";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import type { ServiceRow } from "@/components/service-card";

export const Route = createFileRoute("/book/$serviceId")({
  head: () => ({
    meta: [
      { title: "Confirm Your Booking — Fixora" },
      {
        name: "description",
        content:
          "Pick a live slot from the provider's real availability, review the price breakdown and confirm your Fixora booking.",
      },
      { property: "og:title", content: "Confirm Your Booking — Fixora" },
      { property: "og:description", content: "Choose a live slot and confirm your local service booking." },
    ],
  }),
  component: () => (
    <RequireRole roles={["user", "provider", "admin"]}>
      <BookingPage />
    </RequireRole>
  ),
});

function BookingPage() {
  const { serviceId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dates = useMemo(() => upcomingDates(10), []);
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const { data: service } = useQuery({
    queryKey: ["service", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .maybeSingle();
      if (error) throw error;
      return data as ServiceRow | null;
    },
  });

  const providerId = service?.provider_id ?? null;

  const { data: slots } = useQuery({
    queryKey: ["slots", providerId, date],
    enabled: Boolean(providerId && date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_slots")
        .select("id, provider_id, slot_date, start_time, end_time, status, booking_id")
        .eq("provider_id", providerId!)
        .eq("slot_date", date)
        .order("start_time");
      if (error) throw error;
      return data as SlotRow[];
    },
  });

  // Live availability — a slot booked by someone else disappears instantly.
  useEffect(() => {
    if (!providerId) return;
    const channel = supabase
      .channel(`slots-${providerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_slots", filter: `provider_id=eq.${providerId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["slots", providerId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [providerId, queryClient]);

  useEffect(() => {
    if (slot && !(slots ?? []).some((s) => s.id === slot.id && s.status === "available")) {
      setSlot(null);
    }
  }, [slots, slot]);

  const price = Number(service?.price ?? 0);
  const commission = useMemo(() => Math.round(price * COMMISSION_RATE), [price]);

  const shareLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location saved — you'll get live tracking");
      },
      () => toast.error("Couldn't get your location. You can still book."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first");
      if (!slot) throw new Error("Choose a time slot");
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        service_id: serviceId,
        slot_id: slot.id,
        booking_date: slot.slot_date,
        time_slot: slotLabel(slot),
        notes: notes.trim().slice(0, 500) || null,
        user_lat: coords?.lat ?? null,
        user_lng: coords?.lng ?? null,
      });
      if (error) {
        if (error.code === "23505" || /already booked/i.test(error.message))
          throw new Error("Slot already booked — choose another time.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Booking requested — the provider will confirm shortly");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
      void navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!service) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/services/$id" params={{ id: serviceId }}>
          <ArrowLeft className="size-4" /> Back to service
        </Link>
      </Button>

      <h1 className="text-3xl font-extrabold">Confirm your booking</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {service.title} · {service.provider_name} · {service.location}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="glass rounded-2xl p-6">
          <Label className="flex items-center gap-2">
            <CalendarDays className="size-4" /> Select a date
          </Label>
          <div className="mt-3">
            <DateStrip
              dates={dates}
              value={date}
              onChange={(d) => {
                setDate(d);
                setSlot(null);
              }}
            />
          </div>

          <Separator className="my-6" />

          <Label className="flex items-center gap-2">
            <Clock className="size-4" /> Select a time slot
          </Label>
          <div className="mt-3">
            {providerId ? (
              <SlotPicker
                slots={slots ?? []}
                selectedId={slot?.id ?? null}
                onSelect={setSlot}
                emptyMessage="No slots opened for this date. Try another day."
              />
            ) : (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                This provider hasn't published live availability yet.
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Availability updates live — booked slots disappear the moment someone takes them.
          </p>

          <Separator className="my-6" />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes for the provider (optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Flat number, landmark or a short description of the issue…"
            />
          </div>

          <Button variant="outline" className="mt-4 w-full" onClick={shareLocation}>
            <LocateFixed className="size-4" />
            {coords ? "Location shared for live tracking" : "Share my location for live tracking"}
          </Button>
        </Card>

        <Card className="glass h-fit rounded-2xl p-6">
          <h2 className="font-semibold">Price breakdown</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Service charge</dt>
              <dd>{formatCurrency(price - commission)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Platform fee (10%)</dt>
              <dd>{formatCurrency(commission)}</dd>
            </div>
            <Separator className="my-3" />
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatCurrency(price)}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl bg-secondary p-3 text-xs text-secondary-foreground">
            {new Date(`${date}T00:00:00`).toDateString()} ·{" "}
            {slot ? slotLabel(slot) : "No slot selected"}
          </div>

          <Button
            className="gradient-brand mt-5 w-full border-0 text-primary-foreground glow"
            size="lg"
            disabled={!slot || createBooking.isPending}
            onClick={() => createBooking.mutate()}
          >
            {createBooking.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirm booking
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Pay after the job is done. Reschedule anytime while pending.
          </p>
        </Card>
      </div>
    </div>
  );
}
