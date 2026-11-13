import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Role = "user" | "provider" | "admin";

export type Profile = {
  id: string;
  name: string;
  email: string;
  location: string;
  phone: string | null;
  profession: string;
  working_days: number[];
  working_hours_start: string;
  working_hours_end: string;
  slot_duration_minutes: number;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const authRevision = useRef(0);

  const loadDetails = useCallback(async (userId: string) => {
    const [profileResult, roleResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, name, email, location, phone, profession, working_days, working_hours_start, working_hours_end, slot_duration_minutes",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle(),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (roleResult.error) throw roleResult.error;

    return {
      profile: (profileResult.data as Profile | null) ?? null,
      role: (roleResult.data?.role as Role | undefined) ?? "user",
    };
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const revision = ++authRevision.current;
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setTimeout(() => {
        void loadDetails(nextSession.user.id)
          .then((details) => {
            if (!active || revision !== authRevision.current) return;
            setProfile(details.profile);
            setRole(details.role);
          })
          .catch((error: unknown) => {
            if (!active || revision !== authRevision.current) return;
            setProfile(null);
            setRole(null);
            toast.error(error instanceof Error ? error.message : "Could not load your account.");
          })
          .finally(() => {
            if (active && revision === authRevision.current) setLoading(false);
          });
      }, 0);
    });

    return () => {
      active = false;
      authRevision.current += 1;
      sub.subscription.unsubscribe();
    };
  }, [loadDetails]);

  const refresh = useCallback(async () => {
    if (!session?.user) return;
    const details = await loadDetails(session.user.id);
    setProfile(details.profile);
    setRole(details.role);
  }, [session, loadDetails]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      role,
      loading,
      refresh,
      signOut,
    }),
    [session, profile, role, loading, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
