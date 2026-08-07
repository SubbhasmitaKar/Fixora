import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BriefcaseBusiness, CalendarCheck, IndianRupee, Plus, Star, Trash2 } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import { DashboardHeader, StatCard, StatusBadge } from "@/components/dashboard-bits";
import type { ServiceRow } from "@/components/service-card";

export const Route = createFileRoute("/provider")({
  head: () => ({
    meta: [
      { title: "Provider Console — Fixora" },
      {
        name: "description",
        content:
          "Manage your service listings, accept or reject booking requests and track earnings after the 10% Fixora commission.",
      },
      { property: "og:title", content: "Provider Console — Fixora" },
      { property: "og:description", content: "Listings, booking requests and earnings for Fixora providers." },
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
  services: { title: string } | null;
};

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
        .select("id, booking_date, time_slot, status, price, provider_earnings, commission, notes, services(title)")
        .eq("provider_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProviderBooking[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking updated");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
  const pending = rows.filter((b) => b.status === "pending");
  const completed = rows.filter((b) => b.status === "completed");
  const earnings = completed.reduce((s, b) => s + Number(b.provider_earnings), 0);
  const commissionPaid = completed.reduce((s, b) => s + Number(b.commission), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <DashboardHeader
        title="Provider console"
        subtitle={`${profile?.name || "Provider"} — manage listings, requests and earnings.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live listings" value={String(services?.length ?? 0)} icon={BriefcaseBusiness} />
        <StatCard label="Total bookings" value={String(rows.length)} hint={`${pending.length} awaiting action`} icon={CalendarCheck} />
        <StatCard label="Net earnings" value={formatCurrency(earnings)} hint="After 10% commission" icon={IndianRupee} />
        <StatCard label="Commission paid" value={formatCurrency(commissionPaid)} hint="Fixora platform fee" icon={Star} />
      </div>

      <Tabs defaultValue="requests" className="mt-10">
        <TabsList>
          <TabsTrigger value="requests">Booking requests</TabsTrigger>
          <TabsTrigger value="services">My services</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-5 space-y-3">
          {rows.length === 0 && (
            <Card className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No booking requests yet. Add a listing to start receiving jobs.
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
                    {new Date(b.booking_date).toDateString()} · {b.time_slot}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus.mutate({ id: b.id, status: "completed" })}
                    >
                      Mark completed
                    </Button>
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
                      ★ {Number(s.rating).toFixed(1)} ({s.review_count}) · {s.bookings_count} bookings
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
