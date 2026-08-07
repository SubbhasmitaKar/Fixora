import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Sparkles, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const { user, role, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dashboardPath =
    role === "provider" ? "/provider" : role === "admin" ? "/admin" : "/dashboard";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    setOpen(false);
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="gradient-brand flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Fixora</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to={dashboardPath}>
                  <LayoutDashboard className="size-4" />
                  {profile?.name?.split(" ")[0] || "Dashboard"}
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Log in</Link>
              </Button>
              <Button asChild size="sm" className="gradient-brand border-0 text-primary-foreground glow">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-muted-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to={dashboardPath}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Button variant="outline" size="sm" className="mt-2" onClick={handleSignOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button
                asChild
                size="sm"
                className="gradient-brand mt-2 border-0 text-primary-foreground"
              >
                <Link to="/auth" onClick={() => setOpen(false)}>
                  Log in / Sign up
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-card/40">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="gradient-brand flex size-8 items-center justify-center rounded-lg text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="font-display text-lg font-bold">Fixora</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            A marketplace connecting households with verified local professionals — booked,
            tracked and paid for in one place.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Platform</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/services">Browse services</Link>
            </li>
            <li>
              <Link to="/how-it-works">How it works</Link>
            </li>
            <li>
              <Link to="/auth">Become a provider</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Trust &amp; safety</li>
            <li>10% platform commission</li>
            <li>support@fixora.app</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Fixora. Built as a full-stack demonstration product.
      </div>
    </footer>
  );
}
