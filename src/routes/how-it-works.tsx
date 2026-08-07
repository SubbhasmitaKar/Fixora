import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Fixora Works — Booking, Providers & Commission" },
      {
        name: "description",
        content:
          "Understand the Fixora booking lifecycle, provider onboarding, review system and the flat 10% platform commission.",
      },
      { property: "og:title", content: "How Fixora Works" },
      {
        property: "og:description",
        content: "From search to completed job: the Fixora booking lifecycle explained.",
      },
    ],
  }),
  component: HowItWorks,
});

const CUSTOMER_STEPS = [
  { n: "01", t: "Search & filter", d: "Filter by category, city, budget and minimum rating to shortlist providers." },
  { n: "02", t: "Pick a slot", d: "Choose a date and a two-hour window. Taken slots are hidden automatically." },
  { n: "03", t: "Track status", d: "Your booking moves pending → accepted → completed, live in your dashboard." },
  { n: "04", t: "Rate the job", d: "Leave a 1–5 star review that updates the provider's public rating instantly." },
];

const PROVIDER_STEPS = [
  { n: "01", t: "Create a provider account", d: "Pick the Provider role at signup to unlock the provider console." },
  { n: "02", t: "List your services", d: "Set title, category, price, city and description. Mark one as featured to promote it." },
  { n: "03", t: "Accept requests", d: "Approve or reject incoming bookings and mark jobs complete when done." },
  { n: "04", t: "Get paid", d: "Fixora keeps 10%; your earnings dashboard shows the exact payout per booking." },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold sm:text-5xl">
        How <span className="gradient-text">Fixora</span> works
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        A two-sided marketplace: customers get reliable local help, providers get demand and a
        clear payout. Here is the full lifecycle.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-bold">For customers</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CUSTOMER_STEPS.map((s) => (
            <Card key={s.n} className="glass rounded-2xl p-5">
              <span className="gradient-text font-display text-2xl font-extrabold">{s.n}</span>
              <h3 className="mt-2 font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">For providers</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROVIDER_STEPS.map((s) => (
            <Card key={s.n} className="glass rounded-2xl p-5">
              <span className="gradient-text font-display text-2xl font-extrabold">{s.n}</span>
              <h3 className="mt-2 font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="glass mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl p-8 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold">Ready to try it?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse live listings or create an account in under a minute.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/services">Browse services</Link>
          </Button>
          <Button asChild className="gradient-brand border-0 text-primary-foreground">
            <Link to="/auth">
              Create account <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
