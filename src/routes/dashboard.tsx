import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Clock, IndianRupee, Star } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/fixora";
import { useAuth } from "@/lib/auth";
import { RequireRole } from "@/components/require-role";
import { DashboardHeader, StatCard, StatusBadge } from "@/components/dashboard-bits";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Bookings — Fixora Dashboard" },
      {
        name: "description",
        content: "Track your Fixora bookings, statuses and total spend in one place.",
      },
      { property: "og:title", content: "My Bookings — Fixora Dashboard" },
      { property: "og:description", content: "Your booking history and live status tracking." },
    ],
  }),
  component: () => (
    <RequireRole roles={["user", "provider", "admin"]}>
      <UserDashboard />
    </RequireRole>
  ),
});

type BookingWithService = {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  price: number;
  notes: string | null;
  created_at: string;
  service_id: string;
  services: { title: string; category: string; provider_name: string; location: string } | null;
};

function UserDashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookings } = useQuery({
    queryKey: ["bookings", "mine", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_date, time_slot, status, price, notes, created_at, service_id, services(title, category, provider_name, location)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BookingWithService[];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking cancelled");
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = bookings ?? [];
  const active = rows.filter((b) => ["pending", "accepted"].includes(b.status));
  const completed = rows.filter((b) => b.status === "completed");
  const spend = completed.reduce((sum, b) => sum + Number(b.price), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <DashboardHeader
        title={`Hi ${profile?.name?.split(" ")[0] || "there"} 👋`}
        subtitle="Your bookings, statuses and spend at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bookings" value={String(rows.length)} icon={CalendarCheck} />
        <StatCard label="Active" value={String(active.length)} hint="Pending or accepted" icon={Clock} />
        <StatCard label="Completed" value={String(completed.length)} icon={Star} />
        <StatCard label="Total spend" value={formatCurrency(spend)} hint="Completed jobs only" icon={IndianRupee} />
      </div>

      <h2 className="mt-10 text-xl font-bold">Booking history</h2>

      {rows.length === 0 ? (
        <Card className="glass mt-4 rounded-2xl p-12 text-center">
          <p className="font-semibold">No bookings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse services and lock in your first slot.
          </p>
          <Button asChild className="gradient-brand mt-5 border-0 text-primary-foreground">
            <Link to="/services">Browse services</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((b) => (
            <Card key={b.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{b.services?.title ?? "Service"}</h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {b.services?.provider_name} · {b.services?.location} ·{" "}
                    {new Date(b.booking_date).toDateString()} · {b.time_slot}
                  </p>
                  {b.notes && <p className="mt-2 text-sm text-muted-foreground">“{b.notes}”</p>}
                  {b.status === "accepted" && (
                    <p className="mt-2 text-xs font-medium text-primary">
                      Provider accepted your request — they'll arrive in your slot.
                    </p>
                  )}
                  {b.status === "rejected" && (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      Provider could not take this job. Try another slot or provider.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatCurrency(b.price)}</span>
                  {b.status === "completed" && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/services/$id" params={{ id: b.service_id }}>
                        Leave review
                      </Link>
                    </Button>
                  )}
                  {["pending", "accepted"].includes(b.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(b.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
