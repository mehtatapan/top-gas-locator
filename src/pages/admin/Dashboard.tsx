import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, Megaphone, Gamepad2, DollarSign, Store } from "lucide-react";

interface Counts {
  tickets_open: number;
  promotions_active: number;
  gaming_periods_open: number;
  pnl_entries: number;
  stores: number;
}

export default function AdminDashboard() {
  const { user, permissions } = useAuth();
  const [counts, setCounts] = useState<Counts>({ tickets_open: 0, promotions_active: 0, gaming_periods_open: 0, pnl_entries: 0, stores: 0 });

  useEffect(() => {
    (async () => {
      const [t, p, g, pn, s] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting"]),
        supabase.from("promotions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("gaming_periods").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("pnl_entries").select("id", { count: "exact", head: true }),
        supabase.from("stores").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      setCounts({
        tickets_open: t.count ?? 0,
        promotions_active: p.count ?? 0,
        gaming_periods_open: g.count ?? 0,
        pnl_entries: pn.count ?? 0,
        stores: s.count ?? 0,
      });
    })();
  }, []);

  const stat = (label: string, value: number, Icon: React.ComponentType<{ className?: string }>) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">{user?.email}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stat("Open tickets", counts.tickets_open, Ticket)}
        {stat("Active promotions", counts.promotions_active, Megaphone)}
        {stat("Open gaming periods", counts.gaming_periods_open, Gamepad2)}
        {stat("P&L entries", counts.pnl_entries, DollarSign)}
        {stat("Active stores", counts.stores, Store)}
      </div>

      <Card>
        <CardHeader><CardTitle>Your access</CardTitle></CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No permissions assigned yet. An administrator needs to grant you a role.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.map((p) => (
                <span key={p} className="rounded bg-muted px-2 py-1 text-xs font-mono">{p}</span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
