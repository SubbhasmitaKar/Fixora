import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarCheck, IndianRupee, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/fixora";
import { RequireRole } from "@/components/require-role";
import { DashboardHeader, StatCard, StatusBadge } from "@/components/dashboard-bits";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Analytics — Fixora" },
      {
        name: "description",
        content: "Platform-wide analytics: users, listings, bookings and commission revenue on Fixora.",
      },
      { property: "og:title", content: "Admin Analytics — Fixora" },
      { property: "og:description", content: "Monitor Fixora marketplace health and revenue." },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin"]}>
      <AdminDashboard />
    </RequireRole>
  ),
});

type AdminBooking = {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  price: number;
  commission: number;
  services: { title: string; provider_name: string } | null;
};

function AdminDashboard() {
  const { data: bookings } = useQuery({
    queryKey: ["bookings", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_date, time_slot, status, price, commission, services(title, provider_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as AdminBooking[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const [users, services] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("services").select("id", { count: "exact", head: true }),
      ]);
      return { users: users.count ?? 0, services: services.count ?? 0 };
    },
  });

  const rows = bookings ?? [];
  const revenue = rows
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + Number(b.commission), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <DashboardHeader title="Admin analytics" subtitle="Marketplace health, activity and revenue." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={String(counts?.users ?? 0)} icon={Users} />
        <StatCard label="Listings" value={String(counts?.services ?? 0)} icon={BriefcaseBusiness} />
        <StatCard label="Bookings" value={String(rows.length)} hint="Latest 50" icon={CalendarCheck} />
        <StatCard label="Commission revenue" value={formatCurrency(revenue)} hint="Completed jobs" icon={IndianRupee} />
      </div>

      <h2 className="mt-10 text-xl font-bold">Recent bookings</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <Card className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No bookings on the platform yet.
          </Card>
        )}
        {rows.map((b) => (
          <Card key={b.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.services?.title ?? "Service"}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.services?.provider_name} · {new Date(b.booking_date).toDateString()} · {b.time_slot}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{formatCurrency(b.price)}</p>
                <p className="text-xs text-muted-foreground">fee {formatCurrency(b.commission)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
