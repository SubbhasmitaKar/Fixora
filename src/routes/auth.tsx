import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Sparkles, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LOCATIONS } from "@/lib/fixora";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or Sign up — Fixora" },
      {
        name: "description",
        content:
          "Create a Fixora customer or provider account to book local services or start selling your own.",
      },
      { property: "og:title", content: "Log in or Sign up — Fixora" },
      {
        property: "og:description",
        content: "Join Fixora as a customer or a verified service provider.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);
const nameSchema = z.string().trim().min(2, "Enter your full name").max(80);

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && role) {
      void navigate({
        to: role === "provider" ? "/provider" : role === "admin" ? "/admin" : "/dashboard",
        replace: true,
      });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="aurora relative min-h-[80vh]">
      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
        <div className="mb-6 text-center">
          <span className="gradient-brand mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
            <Sparkles className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Welcome to Fixora</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book trusted services, or start earning as a provider.
          </p>
        </div>

        <Card className="glass rounded-2xl p-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-5">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-5">
              <SignupForm />
            </TabsContent>
          </Tabs>

          <GoogleButton />
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to Fixora's terms.{" "}
          <Link to="/how-it-works" className="underline">
            How it works
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error || !data.url) {
      toast.error(error?.message ?? "Google sign-in could not be started.");
      setBusy(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Continue with Google
      </Button>
    </>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message);
      return;
    }
    if (!password) {
      toast.error("Enter your password");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsedEmail.data,
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="gradient-brand w-full border-0 text-primary-foreground"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Log in
      </Button>
    </form>
  );
}

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState(LOCATIONS[0] ?? "Bengaluru");
  const [role, setRole] = useState<"user" | "provider">("user");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedName = nameSchema.safeParse(name);
    if (!parsedName.success) {
      toast.error(parsedName.error.issues[0]?.message);
      return;
    }
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      toast.error(parsedEmail.error.issues[0]?.message);
      return;
    }
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      toast.error(parsedPassword.error.issues[0]?.message);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail.data,
      password: parsedPassword.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: parsedName.data, role, location },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setSent(true);
      toast.success("Check your email to confirm your account");
      return;
    }
    toast.success("Account created!");
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border/60 p-5 text-center text-sm">
        <p className="font-semibold">Confirm your email</p>
        <p className="mt-1 text-muted-foreground">
          We sent a confirmation link to <span className="font-medium">{email}</span>. Click it to
          activate your Fixora account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>I want to join as</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "user", label: "Customer", icon: User },
              { value: "provider", label: "Provider", icon: Wrench },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={
                "flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors " +
                (role === opt.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40")
              }
            >
              <opt.icon className="size-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-name">Full name</Label>
        <Input
          id="signup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Aarav Sharma"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
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

      <Button
        type="submit"
        disabled={busy}
        className="gradient-brand w-full border-0 text-primary-foreground"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create account
      </Button>
    </form>
  );
}
