import { Link } from "@tanstack/react-router";
import { useAuth, type Role } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Gate
        title="Sign in to continue"
        body="This area is only available to signed-in Fixora members."
        action={<Button asChild className="gradient-brand border-0 text-primary-foreground"><Link to="/auth">Log in or sign up</Link></Button>}
      />
    );
  }

  if (role && !roles.includes(role)) {
    return (
      <Gate
        title="Wrong account type"
        body={`This dashboard is for ${roles.join(" / ")} accounts. You are signed in as a ${role}.`}
        action={
          <Button asChild variant="outline">
            <Link to={role === "provider" ? "/provider" : role === "admin" ? "/admin" : "/dashboard"}>
              Go to my dashboard
            </Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}

function Gate({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="gradient-brand mb-4 flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}
