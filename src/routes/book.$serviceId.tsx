import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { COMMISSION_RATE, TIME_SLOTS, formatCurrency } from "@/lib/fixora";
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
          "Pick a date and time slot, review the price breakdown and confirm your Fixora service booking.",
      },
      { property: "og:title", content: "Confirm Your Booking — Fixora" },
      { property: "og:description", content: "Choose a slot and confirm your local service booking." },
    ],
  }),
  component: () => (
    <RequireRole roles={["user", "provider", "admin"]}>
      <BookingPage />
    </RequireRole>
  ),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BookingPage() {
  const { serviceId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

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

  const { data: takenSlots } = useQuery({
    queryKey: ["taken-slots", serviceId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("time_slot")
        .eq("service_id", serviceId)
        .eq("booking_date", date)
        .in("status", ["pending", "accepted", "completed"]);
      if (error) throw error;
      return (data ?? []).map((b) => b.time_slot);
    },
    enabled: Boolean(date),
  });

  const price = Number(service?.price ?? 0);
  const commission = useMemo(() => Math.round(price * COMMISSION_RATE), [price]);

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first");
      if (!slot) throw new Error("Choose a time slot");
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        service_id: serviceId,
        booking_date: date,
        time_slot: slot,
        notes: notes.trim().slice(0, 500) || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("That slot was just taken. Pick another one.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Booking requested — the provider will confirm shortly");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <CalendarDays className="size-4" /> Select a date
            </Label>
            <Input
              id="date"
              type="date"
              min={todayISO()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot(null);
              }}
            />
          </div>

          <Separator className="my-6" />

          <Label className="flex items-center gap-2">
            <Clock className="size-4" /> Select a time slot
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIME_SLOTS.map((s) => {
              const taken = (takenSlots ?? []).includes(s);
              const selected = slot === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={taken}
                  onClick={() => setSlot(s)}
                  className={
                    "rounded-xl border p-3 text-sm font-medium transition-colors " +
                    (taken
                      ? "cursor-not-allowed border-border/50 text-muted-foreground/50 line-through"
                      : selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50")
                  }
                >
                  {s}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Struck-through slots are already booked — Fixora blocks overlapping bookings.
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
            {date ? new Date(date).toDateString() : "No date"} · {slot ?? "No slot selected"}
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
            Pay after the job is done. Cancel free while pending.
          </p>
        </Card>
      </div>
    </div>
  );
}
