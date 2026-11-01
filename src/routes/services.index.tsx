import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_NAMES, LOCATIONS } from "@/lib/fixora";
import { ServiceCard, type ServiceRow } from "@/components/service-card";
import { Skeleton } from "@/components/ui/skeleton";

type ServicesSearch = { category?: string | undefined };

export const Route = createFileRoute("/services/")({
  validateSearch: (search: Record<string, unknown>): ServicesSearch => ({
    category: typeof search["category"] === "string" ? search["category"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Browse Local Services — Fixora" },
      {
        name: "description",
        content:
          "Search and filter verified local services by category, city, price and rating. Book electricians, plumbers, tutors, beauticians and more.",
      },
      { property: "og:title", content: "Browse Local Services — Fixora" },
      {
        property: "og:description",
        content:
          "Filter hundreds of verified local professionals by category, city, price and rating.",
      },
    ],
  }),
  component: ServicesPage,
});

const SORTS = [
  { value: "rating", label: "Top rated" },
  { value: "popular", label: "Most booked" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

function ServicesPage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [location, setLocation] = useState("all");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState("rating");

  const activeCategory = category ?? "all";

  const { data, isLoading } = useQuery({
    queryKey: ["services", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("active", true);
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  const results = useMemo(() => {
    let rows = (data ?? []).filter((s) => {
      if (activeCategory !== "all" && s.category !== activeCategory) return false;
      if (location !== "all" && s.location !== location) return false;
      if (Number(s.price) > maxPrice) return false;
      if (Number(s.rating) < Number(minRating)) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const hay =
          `${s.title} ${s.description} ${s.category} ${s.provider_name} ${s.location}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "price_asc") return Number(a.price) - Number(b.price);
      if (sort === "price_desc") return Number(b.price) - Number(a.price);
      if (sort === "popular") return b.bookings_count - a.bookings_count;
      return Number(b.featured) - Number(a.featured) || Number(b.rating) - Number(a.rating);
    });

    return rows;
  }, [data, activeCategory, location, maxPrice, minRating, q, sort]);

  function setCategory(value: string) {
    void navigate({
      to: "/services",
      search: value === "all" ? {} : { category: value },
      replace: true,
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Find your service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {results.length} service{results.length === 1 ? "" : "s"} available across{" "}
        {LOCATIONS.length} cities.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="glass h-fit rounded-2xl p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="size-4" /> Filters
          </div>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={activeCategory} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORY_NAMES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {LOCATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Max price: ₹{maxPrice.toLocaleString("en-IN")}</Label>
              <Slider
                value={[maxPrice]}
                min={500}
                max={5000}
                step={100}
                onValueChange={(v) => setMaxPrice(v[0] ?? 5000)}
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum rating</Label>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any rating</SelectItem>
                  <SelectItem value="4">4.0+</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                  <SelectItem value="4.8">4.8+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setQ("");
                setLocation("all");
                setMaxPrice(5000);
                setMinRating("0");
                setCategory("all");
              }}
            >
              Reset filters
            </Button>
          </div>
        </Card>

        <div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search services, providers or cities…"
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <Card className="glass mt-6 rounded-2xl p-12 text-center">
              <p className="font-semibold">No services match those filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try widening your budget or clearing the category filter.
              </p>
            </Card>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
