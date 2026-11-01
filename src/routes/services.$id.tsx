import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Star, Crown, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { categoryIcon, formatCurrency } from "@/lib/fixora";
import { useAuth } from "@/lib/auth";
import type { ServiceRow } from "@/components/service-card";

export const Route = createFileRoute("/services/$id")({
  head: () => ({
    meta: [
      { title: "Service Details — Fixora" },
      {
        name: "description",
        content:
          "See provider details, pricing, ratings and customer reviews before booking a local service on Fixora.",
      },
      { property: "og:title", content: "Service Details — Fixora" },
      {
        property: "og:description",
        content: "Provider profile, pricing and verified customer reviews.",
      },
    ],
  }),
  component: ServiceDetail,
});

type Review = {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
};

function ServiceDetail() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: service, isLoading } = useQuery({
    queryKey: ["service", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as ServiceRow | null;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, author_name, rating, comment, created_at, user_id")
        .eq("service_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to leave a review");
      const { error } = await supabase.from("reviews").upsert(
        {
          user_id: user.id,
          service_id: id,
          rating,
          comment: comment.trim().slice(0, 600),
          author_name: profile?.name || "Customer",
        },
        { onConflict: "user_id,service_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — your review is live");
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["reviews", id] });
      void queryClient.invalidateQueries({ queryKey: ["service", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-muted-foreground">Loading service…</div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Service not found</h1>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/services">Back to services</Link>
        </Button>
      </div>
    );
  }

  const Icon = categoryIcon(service.category);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/services">
          <ArrowLeft className="size-4" /> All services
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="glass rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="gradient-brand flex size-14 items-center justify-center rounded-2xl text-primary-foreground">
                  <Icon className="size-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-bold sm:text-3xl">{service.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="secondary">{service.category}</Badge>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" /> {service.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="size-3.5 fill-warning text-warning" />
                      <span className="font-semibold text-foreground">
                        {Number(service.rating).toFixed(1)}
                      </span>
                      ({service.review_count} reviews)
                    </span>
                    <span>{service.bookings_count} bookings</span>
                  </div>
                </div>
              </div>
              {service.featured && (
                <Badge className="gradient-brand border-0 text-primary-foreground">
                  <Crown className="size-3" /> Featured
                </Badge>
              )}
            </div>

            <Separator className="my-6" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              About this service
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{service.description}</p>
          </Card>

          <Card className="glass rounded-2xl p-6">
            <h2 className="font-semibold">Provider</h2>
            <div className="mt-4 flex items-start gap-4">
              <span className="gradient-brand flex size-12 items-center justify-center rounded-full text-lg font-bold text-primary-foreground">
                {service.provider_name.charAt(0)}
              </span>
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  {service.provider_name}
                  <ShieldCheck className="size-4 text-success" />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(service as ServiceRow & { provider_bio?: string }).provider_bio ||
                    "Verified Fixora professional."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="glass rounded-2xl p-6">
            <h2 className="font-semibold">Ratings &amp; reviews</h2>

            {user ? (
              <div className="mt-4 rounded-xl border border-border/60 p-4">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Leave a review
                </Label>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                      <Star
                        className={
                          n <= rating
                            ? "size-6 fill-warning text-warning"
                            : "size-6 text-muted-foreground"
                        }
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  className="mt-3"
                  rows={3}
                  maxLength={600}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the service?"
                />
                <Button
                  className="gradient-brand mt-3 border-0 text-primary-foreground"
                  size="sm"
                  disabled={submitReview.isPending || comment.trim().length < 3}
                  onClick={() => submitReview.mutate()}
                >
                  Post review
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary underline">
                  Sign in
                </Link>{" "}
                to leave a review.
              </p>
            )}

            <div className="mt-6 space-y-4">
              {(reviews ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No reviews yet — be the first.</p>
              )}
              {(reviews ?? []).map((r) => (
                <div key={r.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{r.author_name}</p>
                    <span className="flex items-center gap-1 text-xs">
                      <Star className="size-3.5 fill-warning text-warning" /> {r.rating}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="glass h-fit rounded-2xl p-6 lg:sticky lg:top-24">
          <p className="text-sm text-muted-foreground">Starting at</p>
          <p className="text-3xl font-extrabold">{formatCurrency(service.price)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Includes a 10% Fixora platform fee — no hidden charges.
          </p>
          <Button
            className="gradient-brand mt-5 w-full border-0 text-primary-foreground glow"
            size="lg"
            onClick={() => {
              if (!user) {
                toast.info("Sign in to book this service");
                void navigate({ to: "/auth" });
                return;
              }
              void navigate({ to: "/book/$serviceId", params: { serviceId: service.id } });
            }}
          >
            Book Now
          </Button>
          <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
            <li>• Free cancellation while pending</li>
            <li>• Verified &amp; background-checked provider</li>
            <li>• Live status tracking in your dashboard</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
