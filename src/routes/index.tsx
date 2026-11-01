import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CalendarCheck, IndianRupee, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/fixora";
import { ServiceCard, type ServiceRow } from "@/components/service-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fixora — Book Trusted Local Services Instantly" },
      {
        name: "description",
        content:
          "Book verified electricians, plumbers, tutors, beauticians, cleaners and more near you. Transparent pricing, real ratings, instant booking.",
      },
      { property: "og:title", content: "Fixora — Book Trusted Local Services Instantly" },
      {
        property: "og:description",
        content:
          "A local services marketplace with verified providers, instant booking and live status tracking.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: featured } = useQuery({
    queryKey: ["services", "recommended"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("active", true)
        .order("featured", { ascending: false })
        .order("rating", { ascending: false })
        .order("bookings_count", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="aurora relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
              <BadgeCheck className="size-3.5 text-primary" />
              Every provider is identity-verified
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Book Trusted Services <span className="gradient-text">Instantly</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Electricians, plumbers, tutors, beauticians and more — compare real ratings, lock a
              time slot and track your booking from request to completion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="gradient-brand border-0 text-primary-foreground glow"
              >
                <Link to="/services">
                  <Search className="size-4" /> Find a service
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">
                  Become a provider <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                { k: "4,200+", v: "Jobs completed" },
                { k: "4.7★", v: "Average rating" },
                { k: "7", v: "Cities live" },
              ].map((s) => (
                <div key={s.v} className="glass rounded-xl p-4">
                  <dt className="text-xl font-bold">{s.k}</dt>
                  <dd className="text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative hidden lg:block">
            <Card className="glass rounded-3xl p-6">
              <p className="text-sm font-semibold text-muted-foreground">Popular right now</p>
              <div className="mt-4 space-y-3">
                {(featured ?? []).slice(0, 4).map((s) => (
                  <Link
                    key={s.id}
                    to="/services/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.category} · {s.location}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <Star className="size-3.5 fill-warning text-warning" />
                      {Number(s.rating).toFixed(1)}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Browse by category</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Seven verticals, hundreds of vetted professionals.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/services">
              All services <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.name}
              to="/services"
              search={{ category: c.name }}
              className="glass group rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="gradient-brand flex size-11 items-center justify-center rounded-xl text-primary-foreground">
                <c.icon className="size-5" />
              </span>
              <p className="mt-4 font-semibold">{c.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recommended */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">Recommended for you</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked by featured placement, rating and total bookings.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(featured ?? []).map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: CalendarCheck,
              title: "No double bookings",
              body: "Slots lock the moment they're taken, so a provider is never assigned to two jobs at once.",
            },
            {
              icon: BadgeCheck,
              title: "Verified providers",
              body: "Ratings come only from customers who actually booked, keeping reviews honest.",
            },
            {
              icon: IndianRupee,
              title: "Transparent economics",
              body: "Fixora takes a flat 10% commission; providers see their exact payout on every job.",
            },
          ].map((f) => (
            <Card key={f.title} className="glass rounded-2xl p-6">
              <span className="gradient-brand flex size-10 items-center justify-center rounded-xl text-primary-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
