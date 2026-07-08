import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const forgot = mode === "forgot";
  const signup = mode === "signup";

  if (session) {
    const from = (location.state as { from?: string })?.from ?? "/admin";
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (forgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      setBusy(false);
      if (error) return toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      toast({ title: "Check your email", description: "We sent a password reset link." });
      setMode("signin");
      return;
    }
    if (signup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setBusy(false);
      if (error) return toast({ title: "Sign-up failed", description: error.message, variant: "destructive" });
      toast({ title: "Account created", description: "Check your email to confirm, then sign in." });
      setMode("signin");
      return;
    }
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) return toast({ title: "Sign-in failed", description: error, variant: "destructive" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <img src="/android-chrome-192x192.png" alt="VT Gas & Market" className="mx-auto mb-2 h-12 w-12 rounded-full" />
          <h1 className="text-xl font-bold">VT Gas & Market Admin</h1>
          <p className="text-sm text-muted-foreground">
            {forgot ? "Reset your password" : signup ? "Create an admin account" : "Sign in to continue"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          {!forgot && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={signup ? "new-password" : "current-password"} minLength={8} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : forgot ? "Send reset link" : signup ? "Create account" : "Sign in"}
          </Button>
          <div className="flex flex-col gap-1 text-center text-sm">
            {!signup && (
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode(forgot ? "signin" : "forgot")}>
                {forgot ? "Back to sign in" : "Forgot password?"}
              </button>
            )}
            {!forgot && (
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode(signup ? "signin" : "signup")}>
                {signup ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
            )}
          </div>
          <div className="pt-2 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to site</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
