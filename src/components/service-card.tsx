import { Link } from "@tanstack/react-router";
import { MapPin, Star, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { categoryIcon, formatCurrency } from "@/lib/fixora";

export type ServiceRow = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  location: string;
  rating: number;
  review_count: number;
  bookings_count: number;
  featured: boolean;
  provider_name: string;
  provider_id?: string | null;
};

export function ServiceCard({ service }: { service: ServiceRow }) {
  const Icon = categoryIcon(service.category);

  return (
    <Card className="glass group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "var(--gradient-soft)" }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="gradient-brand flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col items-end gap-1">
          {service.featured && (
            <Badge className="gradient-brand border-0 text-primary-foreground">
              <Crown className="size-3" /> Featured
            </Badge>
          )}
          <Badge variant="secondary">{service.category}</Badge>
        </div>
      </div>

      <div className="relative space-y-1">
        <h3 className="text-base font-semibold leading-snug">{service.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
      </div>

      <div className="relative mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="size-3.5 fill-warning text-warning" />
            <span className="font-semibold text-foreground">
              {Number(service.rating).toFixed(1)}
            </span>
            ({service.review_count})
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" />
            {service.location}
          </span>
          <span>{service.bookings_count} booked</span>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <div>
            <p className="text-lg font-bold">{formatCurrency(service.price)}</p>
            <p className="text-xs text-muted-foreground">by {service.provider_name}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/services/$id" params={{ id: service.id }}>
              View
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
