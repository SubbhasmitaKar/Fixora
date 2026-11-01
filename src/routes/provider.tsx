import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  CalendarCheck,
  IndianRupee,
  Plus,
  Star,
  Trash2,
  Ban,
  Check,
  Navigation,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_NAMES, LOCATIONS, formatCurrency } from "@/lib/fixora";
import {
  distanceKm,
  etaMinutes,
  generateSlots,
  hhmm,
  slotLabel,
  todayISO,
  upcomingDates,
  type SlotRow,
} from "@/lib/slots";
import { DateStrip } from "@/components/slot-picker";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import { DashboardHeader, StatCard, StatusBadge } from "@/components/dashboard-bits";
import { cn } from "@/lib/utils";
import type { ServiceRow } from "@/components/service-card";

export const Route = createFileRoute("/provider")({
  head: () => ({
    meta: [
      { title: "Provider Console — Fixora" },
      {
        name: "description",
        content:
          "Publish your working hours, manage time slots in real time, accept bookings, share live location and track earnings after the 10% Fixora commission.",
      },
      { property: "og:title", content: "Provider Console — Fixora" },
      {
        property: "og:description",
        content: "Availability, booking requests, live tracking and earnings for Fixora providers.",
      },
    ],
  }),
  component: () => (
    <RequireRole roles={["provider", "admin"]}>
      <ProviderDashboard />
    </RequireRole>
  ),
});

type ProviderBooking = {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  price: number;
  provider_earnings: number;
  commission: number;
  notes: string | null;
  user_lat: number | null;
  user_lng: number | null;
  provider_lat: number | null;
  provider_lng: number | null;
  eta_minutes: number | null;
  tracking_active: boolean;
  services: { title: string } | null;
};

const BOOKING_SELECT =
  "id, booking_date, time_slot, status, price, provider_earnings, commission, notes, user_lat, user_lng, provider_lat, provider_lng, eta_minutes, tracking_active, services(title)";

function ProviderDashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: services } = useQuery({
    queryKey: ["services", "mine", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("provider_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings", "provider", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(BOOKING_SELECT)
        .eq("provider_id", user!.id)
        .order("booking_date", { ascending: true });
      if (error) throw error;
      return data as unknown as ProviderBooking[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`provider-bookings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `provider_id=eq.${user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking updated");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing removed");
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = bookings ?? [];
  const upcoming = rows.filter((b) => ["pending", "accepted"].includes(b.status));
  const pending = rows.filter((b) => b.status === "pending");
  const completed = rows.filter((b) => b.status === "completed");
  const earnings = completed.reduce((s, b) => s + Number(b.provider_earnings), 0);
  const commissionPaid = completed.reduce((s, b) => s + Number(b.commission), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <DashboardHeader
        title="Provider console"
        subtitle={`${profile?.name || "Provider"} — availability, requests, live tracking and earnings.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Live listings"
          value={String(services?.length ?? 0)}
          icon={BriefcaseBusiness}
        />
        <StatCard
          label="Upcoming bookings"
          value={String(upcoming.length)}
          hint={`${pending.length} awaiting action`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Net earnings"
          value={formatCurrency(earnings)}
          hint="After 10% commission"
          icon={IndianRupee}
        />
        <StatCard
          label="Commission paid"
          value={formatCurrency(commissionPaid)}
          hint="Fixora platform fee"
          icon={Star}
        />
      </div>

      <Tabs defaultValue="availability" className="mt-10">
        <TabsList className="flex-wrap">
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="requests">Bookings</TabsTrigger>
          <TabsTrigger value="services">My services</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="availability" className="mt-5">
          <AvailabilityManager />
        </TabsContent>

        <TabsContent value="requests" className="mt-5 space-y-3">
          {rows.length === 0 && (
            <Card className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No booking requests yet. Publish slots so customers can book you.
            </Card>
          )}
          {rows.map((b) => (
            <Card key={b.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{b.services?.title ?? "Service"}</h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(`${b.booking_date}T00:00:00`).toDateString()} · {b.time_slot}
                  </p>
                  {b.notes && <p className="mt-2 text-sm text-muted-foreground">“{b.notes}”</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {formatCurrency(b.provider_earnings)} net
                  </span>
                  {b.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="gradient-brand border-0 text-primary-foreground"
                        onClick={() => setStatus.mutate({ id: b.id, status: "accepted" })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: b.id, status: "rejected" })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {b.status === "accepted" && (
                    <>
                      <TrackingControl booking={b} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus.mutate({ id: b.id, status: "completed" })}
                      >
                        Mark completed
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="services" className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {(services ?? []).length === 0 && (
              <Card className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
                You haven't listed a service yet.
              </Card>
            )}
            {(services ?? []).map((s) => (
              <Card key={s.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.category} · {s.location} · {formatCurrency(s.price)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ★ {Number(s.rating).toFixed(1)} ({s.review_count}) · {s.bookings_count}{" "}
                      bookings
                      {s.featured ? " · Featured" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeService.mutate(s.id)}
                    disabled={removeService.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <NewServiceForm />
        </TabsContent>

        <TabsContent value="earnings" className="mt-5">
          <Card className="glass rounded-2xl p-6">
            <h3 className="font-semibold">Earnings breakdown</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fixora keeps a flat 10% commission on every completed job.
            </p>
            <div className="mt-5 space-y-2">
              {completed.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed jobs yet.</p>
              )}
              {completed.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm"
                >
                  <span>{b.services?.title}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(b.price)} − {formatCurrency(b.commission)} fee ={" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(b.provider_earnings)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AvailabilityManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dates = useMemo(() => upcomingDates(14), []);
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("18:00");
  const [duration, setDuration] = useState("60");
  const [customStart, setCustomStart] = useState("10:00");
  const [customEnd, setCustomEnd] = useState("11:00");

  const { data: slots } = useQuery({
    queryKey: ["slots", user?.id, date],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_slots")
        .select("id, provider_id, slot_date, start_time, end_time, status, booking_id")
        .eq("provider_id", user!.id)
        .eq("slot_date", date)
        .order("start_time");
      if (error) throw error;
      return data as SlotRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-slots-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "provider_slots",
          filter: `provider_id=eq.${user.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ["slots"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["slots"] });
  };

  const addSlots = useMutation({
    mutationFn: async (rows: { start_time: string; end_time: string }[]) => {
      if (!user) throw new Error("Sign in first");
      if (rows.length === 0) throw new Error("Nothing to add — check your hours");
      const existing = new Set((slots ?? []).map((s) => hhmm(s.start_time)));
      const fresh = rows.filter((r) => !existing.has(r.start_time));
      if (fresh.length === 0) throw new Error("Those slots already exist for this date");
      const { error } = await supabase.from("provider_slots").insert(
        fresh.map((r) => ({
          provider_id: user.id,
          slot_date: date,
          start_time: r.start_time,
          end_time: r.end_time,
        })),
      );
      if (error) throw error;
      return fresh.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} slot${count > 1 ? "s" : ""} published`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSlot = useMutation({
    mutationFn: async (slot: SlotRow) => {
      if (slot.status === "booked")
        throw new Error("This slot is booked — reject the booking first");
      const next = slot.status === "available" ? "unavailable" : "available";
      const { error } = await supabase
        .from("provider_slots")
        .update({ status: next })
        .eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSlot = useMutation({
    mutationFn: async (slot: SlotRow) => {
      if (slot.status === "booked") throw new Error("This slot is booked — it can't be deleted");
      const { error } = await supabase.from("provider_slots").delete().eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = slots ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="glass rounded-2xl p-6">
        <h3 className="font-semibold">Slots for {new Date(`${date}T00:00:00`).toDateString()}</h3>
        <div className="mt-3">
          <DateStrip dates={dates} value={date} onChange={setDate} />
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No slots for this date yet. Generate them from your working hours →
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3",
                  s.status === "booked" && "border-primary/40 bg-primary/5",
                  s.status === "unavailable" && "border-border/60 bg-muted/40",
                )}
              >
                <div>
                  <p className="text-sm font-semibold">{slotLabel(s)}</p>
                  <p className="text-xs capitalize text-muted-foreground">{s.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={s.status === "booked" || toggleSlot.isPending}
                    onClick={() => toggleSlot.mutate(s)}
                  >
                    {s.status === "unavailable" ? (
                      <>
                        <Check className="size-4" /> Open
                      </>
                    ) : (
                      <>
                        <Ban className="size-4" /> Block
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={s.status === "booked" || removeSlot.isPending}
                    onClick={() => removeSlot.mutate(s)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="glass h-fit rounded-2xl p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <Plus className="size-4" /> Working hours
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Label>Slot length</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["30", "45", "60", "90", "120"].map((d) => (
                <SelectItem key={d} value={d}>
                  {d} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="gradient-brand mt-4 w-full border-0 text-primary-foreground"
          disabled={addSlots.isPending}
          onClick={() => addSlots.mutate(generateSlots(from, to, Number(duration)))}
        >
          Generate slots
        </Button>

        <div className="mt-6 border-t border-border/60 pt-5">
          <h4 className="text-sm font-semibold">Add a custom slot</h4>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              type="time"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <Input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
          <Button
            variant="outline"
            className="mt-3 w-full"
            disabled={addSlots.isPending}
            onClick={() => {
              if (customEnd <= customStart) {
                toast.error("End time must be after start time");
                return;
              }
              addSlots.mutate([{ start_time: customStart, end_time: customEnd }]);
            }}
          >
            Add slot
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Shares the provider's real location every few seconds while heading to the job. */
function TrackingControl({ booking }: { booking: ProviderBooking }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const watchId = useRef<number | null>(null);

  const push = async (lat: number, lng: number) => {
    const eta =
      booking.user_lat != null && booking.user_lng != null
        ? etaMinutes(distanceKm([lat, lng], [booking.user_lat, booking.user_lng]))
        : null;
    await supabase
      .from("bookings")
      .update({ provider_lat: lat, provider_lng: lng, eta_minutes: eta, tracking_active: true })
      .eq("id", booking.id);
  };

  useEffect(() => {
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const start = () => {
    if (booking.user_lat == null || booking.user_lng == null) {
      toast.error("Customer hasn't shared their location for this booking");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Location isn't supported on this device");
      return;
    }
    setBusy(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setBusy(false);
        void push(pos.coords.latitude, pos.coords.longitude).then(() =>
          queryClient.invalidateQueries({ queryKey: ["bookings"] }),
        );
      },
      () => {
        setBusy(false);
        toast.error("Couldn't read your location");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    toast.success("Live location sharing on — the customer can track you");
  };

  const stop = async () => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    await supabase.from("bookings").update({ tracking_active: false }).eq("id", booking.id);
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    toast.success("Live tracking stopped");
  };

  return booking.tracking_active ? (
    <Button size="sm" variant="outline" onClick={() => void stop()}>
      <Navigation className="size-4" /> Stop tracking
    </Button>
  ) : (
    <Button size="sm" variant="outline" disabled={busy} onClick={start}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
      Start live tracking
    </Button>
  );
}

function NewServiceForm() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORY_NAMES[0] ?? "Electrician");
  const [price, setPrice] = useState("999");
  const [location, setLocation] = useState(profile?.location || LOCATIONS[0] || "Bengaluru");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (title.trim().length < 5) throw new Error("Title must be at least 5 characters");
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0 || numericPrice > 100000)
        throw new Error("Enter a price between 1 and 100000");
      const { error } = await supabase.from("services").insert({
        provider_id: user.id,
        provider_name: profile?.name || "Fixora Partner",
        provider_bio: "Verified Fixora professional.",
        title: title.trim().slice(0, 120),
        category,
        price: numericPrice,
        location,
        description: description.trim().slice(0, 800),
        featured,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing published");
      setTitle("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass h-fit rounded-2xl p-6">
      <h3 className="flex items-center gap-2 font-semibold">
        <Plus className="size-4" /> Add a service
      </h3>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="s-title">Title</Label>
          <Input
            id="s-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Emergency electrical repair"
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_NAMES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-price">Price (₹)</Label>
          <Input
            id="s-price"
            type="number"
            min={1}
            max={100000}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-desc">Description</Label>
          <Textarea
            id="s-desc"
            rows={3}
            maxLength={800}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's included, how long it takes, any warranty…"
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
          <div>
            <p className="text-sm font-medium">Feature this listing</p>
            <p className="text-xs text-muted-foreground">Paid promotion — ranks above others.</p>
          </div>
          <Switch checked={featured} onCheckedChange={setFeatured} />
        </div>
        <Button
          className="gradient-brand w-full border-0 text-primary-foreground"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          Publish listing
        </Button>
      </div>
    </Card>
  );
}
