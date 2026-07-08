import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  permissions: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  can: (perm: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    const { data, error } = await supabase.rpc("my_permissions");
    if (error) {
      setPermissions([]);
      return;
    }
    setPermissions(((data ?? []) as { permission_key: string }[]).map((r) => r.permission_key));
  };

  useEffect(() => {
    // Set listener FIRST (avoid missed events), then read initial session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer the RPC to avoid deadlocks inside the callback.
        setTimeout(() => { void loadPermissions(); }, 0);
      } else {
        setPermissions([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void loadPermissions();
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    permissions,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    can: (perm) => permissions.includes(perm),
    refreshPermissions: loadPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
