import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Gamepad2, Lock, Plus, Unlock } from "lucide-react";

type PeriodStatus = "open" | "closed";
type TxnType = "cash_in" | "payout" | "adjustment";
const TXN_TYPES: TxnType[] = ["cash_in", "payout", "adjustment"];

interface StoreLite { id: string; name: string }
interface Period {
  id: string;
  store_id: string;
  period_start: string;
  period_end: string | null;
  status: PeriodStatus;
  notes: string | null;
  created_at: string;
  stores?: { id: string; name: string } | null;
}
interface Txn {
  id: string;
  period_id: string;
  machine_id: string | null;
  type: string;
  amount: number;
  occurred_at: string;
  notes: string | null;
}
interface ManualPayout {
  id: string;
  period_id: string;
  amount: number;
  reason: string | null;
  paid_at: string;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function GamingPage() {
  const qc = useQueryClient();
  const { can, user } = useAuth();
  const canOpen = can("gaming.open_period");
  const canClose = can("gaming.close_period");
  const canTxn = can("gaming.record_txn");

  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<PeriodStatus | "all">("all");
  const [opening, setOpening] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const storesQ = useQuery({
    queryKey: ["stores-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as StoreLite[];
    },
  });

  const periodsQ = useQuery({
    queryKey: ["admin", "gaming-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gaming_periods")
        .select("id, store_id, period_start, period_end, status, notes, created_at, stores(id, name)")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as unknown as Period[];
    },
  });

  const filtered = useMemo(() => {
    return (periodsQ.data ?? []).filter((p) => {
      if (storeFilter !== "all" && p.store_id !== storeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [periodsQ.data, storeFilter, statusFilter]);

  const closePeriod = useMutation({
    mutationFn: async (p: Period) => {
      const { error } = await supabase
        .from("gaming_periods")
        .update({ status: "closed", period_end: new Date().toISOString(), closed_by: user?.id ?? null })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Period closed" });
      qc.invalidateQueries({ queryKey: ["admin", "gaming-periods"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const reopenPeriod = useMutation({
    mutationFn: async (p: Period) => {
      const { error } = await supabase
        .from("gaming_periods").update({ status: "open", period_end: null }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Period reopened" });
      qc.invalidateQueries({ queryKey: ["admin", "gaming-periods"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const selected = filtered.find((p) => p.id === selectedId)
    ?? (periodsQ.data ?? []).find((p) => p.id === selectedId)
    ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gaming</h1>
          <p className="text-sm text-muted-foreground">
            Track gaming machine periods, cash-ins, payouts and manual disbursements per store.
          </p>
        </div>
        {canOpen && (
          <Button onClick={() => setOpening(true)}>
            <Plus className="mr-2 h-4 w-4" /> Open period
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {(storesQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PeriodStatus | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Period start</TableHead>
              <TableHead>Period end</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periodsQ.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {periodsQ.error && (
              <TableRow><TableCell colSpan={5} className="text-center text-destructive">{(periodsQ.error as Error).message}</TableCell></TableRow>
            )}
            {!periodsQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <Gamepad2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No gaming periods yet.</p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(p.id)}>
                <TableCell className="font-medium">{p.stores?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.period_start)}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.period_end)}</TableCell>
                <TableCell>
                  {p.status === "open"
                    ? <Badge>Open</Badge>
                    : <Badge variant="outline">Closed</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                  {p.status === "open" && canClose && (
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm("Close this period?")) closePeriod.mutate(p);
                    }}>
                      <Lock className="mr-1 h-3.5 w-3.5" /> Close
                    </Button>
                  )}
                  {p.status === "closed" && canOpen && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Reopen this period?")) reopenPeriod.mutate(p);
                    }}>
                      <Unlock className="mr-1 h-3.5 w-3.5" /> Reopen
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {opening && (
        <OpenPeriodDialog
          stores={storesQ.data ?? []}
          userId={user?.id ?? null}
          onClose={() => setOpening(false)}
          onSaved={() => {
            setOpening(false);
            qc.invalidateQueries({ queryKey: ["admin", "gaming-periods"] });
          }}
        />
      )}

      {selected && (
        <PeriodDrawer
          period={selected}
          canTxn={canTxn}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function OpenPeriodDialog({
  stores, userId, onClose, onSaved,
}: { stores: StoreLite[]; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (!storeId) throw new Error("Select a store");
      const { error } = await supabase.from("gaming_periods").insert({
        store_id: storeId,
        period_start: new Date().toISOString(),
        status: "open",
        opened_by: userId,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Period opened" });
      onSaved();
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open gaming period</DialogTitle>
          <DialogDescription>
            Starts a new period timed to now. Record cash-ins and payouts against it, then close when done.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Opening…" : "Open period"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PeriodDrawer({
  period, canTxn, onClose,
}: { period: Period; canTxn: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const closed = period.status === "closed";

  const txnsQ = useQuery({
    queryKey: ["gaming-txns", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gaming_transactions")
        .select("id, period_id, machine_id, type, amount, occurred_at, notes")
        .eq("period_id", period.id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Txn[];
    },
  });

  const payoutsQ = useQuery({
    queryKey: ["gaming-payouts", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gaming_manual_payouts")
        .select("id, period_id, amount, reason, paid_at")
        .eq("period_id", period.id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as ManualPayout[];
    },
  });

  const totals = useMemo(() => {
    const txns = txnsQ.data ?? [];
    const payouts = payoutsQ.data ?? [];
    const cashIn = txns.filter((t) => t.type === "cash_in").reduce((s, t) => s + Number(t.amount), 0);
    const machinePayouts = txns.filter((t) => t.type === "payout").reduce((s, t) => s + Number(t.amount), 0);
    const adjustments = txns.filter((t) => t.type === "adjustment").reduce((s, t) => s + Number(t.amount), 0);
    const manual = payouts.reduce((s, p) => s + Number(p.amount), 0);
    const net = cashIn - machinePayouts - manual + adjustments;
    return { cashIn, machinePayouts, adjustments, manual, net };
  }, [txnsQ.data, payoutsQ.data]);

  const [txnForm, setTxnForm] = useState({ type: "cash_in" as TxnType, machine_id: "", amount: "", notes: "" });
  const [payoutForm, setPayoutForm] = useState({ amount: "", reason: "" });

  const addTxn = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(txnForm.amount);
      if (!isFinite(amt) || amt === 0) throw new Error("Amount must be a non-zero number");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("gaming_transactions").insert({
        period_id: period.id,
        type: txnForm.type,
        amount: amt,
        machine_id: txnForm.machine_id.trim() || null,
        notes: txnForm.notes.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Transaction recorded" });
      setTxnForm({ type: "cash_in", machine_id: "", amount: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["gaming-txns", period.id] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addPayout = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(payoutForm.amount);
      if (!isFinite(amt) || amt <= 0) throw new Error("Amount must be positive");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("gaming_manual_payouts").insert({
        period_id: period.id,
        amount: amt,
        reason: payoutForm.reason.trim() || null,
        paid_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Manual payout recorded" });
      setPayoutForm({ amount: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["gaming-payouts", period.id] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{period.stores?.name} — {fmt(period.period_start)}</SheetTitle>
          <SheetDescription>
            Status: {closed ? "Closed" : "Open"}
            {period.period_end && ` · Ended ${fmt(period.period_end)}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Cash in" value={fmtMoney(totals.cashIn)} />
          <SummaryCard label="Machine payouts" value={fmtMoney(totals.machinePayouts)} />
          <SummaryCard label="Manual payouts" value={fmtMoney(totals.manual)} />
          <SummaryCard label="Net" value={fmtMoney(totals.net)} highlight />
        </div>

        <Tabs defaultValue="txns" className="mt-6">
          <TabsList>
            <TabsTrigger value="txns">Transactions</TabsTrigger>
            <TabsTrigger value="payouts">Manual payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="txns" className="space-y-4">
            {canTxn && !closed && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Select value={txnForm.type} onValueChange={(v) => setTxnForm((f) => ({ ...f, type: v as TxnType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TXN_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Machine ID" value={txnForm.machine_id}
                    onChange={(e) => setTxnForm((f) => ({ ...f, machine_id: e.target.value }))} />
                  <Input type="number" step="0.01" placeholder="Amount" value={txnForm.amount}
                    onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} />
                  <Input placeholder="Notes" value={txnForm.notes}
                    onChange={(e) => setTxnForm((f) => ({ ...f, notes: e.target.value }))} />
                  <Button onClick={() => addTxn.mutate()} disabled={addTxn.isPending}>
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Machine</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(txnsQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No transactions</TableCell></TableRow>
                  )}
                  {(txnsQ.data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground">{fmt(t.occurred_at)}</TableCell>
                      <TableCell><Badge variant="outline">{t.type.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{t.machine_id ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmtMoney(Number(t.amount))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.notes ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            {canTxn && !closed && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input type="number" step="0.01" placeholder="Amount" value={payoutForm.amount}
                    onChange={(e) => setPayoutForm((f) => ({ ...f, amount: e.target.value }))} />
                  <Input className="sm:col-span-2" placeholder="Reason" value={payoutForm.reason}
                    onChange={(e) => setPayoutForm((f) => ({ ...f, reason: e.target.value }))} />
                  <Button onClick={() => addPayout.mutate()} disabled={addPayout.isPending}>
                    <Plus className="mr-1 h-4 w-4" /> Record
                  </Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payoutsQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No manual payouts</TableCell></TableRow>
                  )}
                  {(payoutsQ.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">{fmt(p.paid_at)}</TableCell>
                      <TableCell>{p.reason ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmtMoney(Number(p.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {period.notes && (
          <div className="mt-6 rounded border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium">Notes</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{period.notes}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-primary/5 border-primary/40" : "bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
