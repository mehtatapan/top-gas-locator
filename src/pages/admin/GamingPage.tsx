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
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Gamepad2, Lock, Pencil, Plus, Trash2, Unlock } from "lucide-react";

type PeriodStatus = "open" | "closed";
type EntryType = "gaming_machine" | "kiosk_add" | "bank_deposit" | "cash_on_side" | "manual_payout";

const ENTRY_LABELS: Record<EntryType, string> = {
  gaming_machine: "Money from Gaming Machines",
  kiosk_add: "Money added to Kiosk",
  bank_deposit: "Bank Deposit",
  cash_on_side: "Cash on Side",
  manual_payout: "Manual Payout",
};

interface StoreLite { id: string; name: string }
interface Period {
  id: string;
  store_id: string;
  period_start: string;
  period_end: string | null;
  status: PeriodStatus;
  starting_kiosk_amount: number;
  ending_kiosk_amount: number | null;
  notes: string | null;
  created_at: string;
  stores?: { id: string; name: string } | null;
}
interface Entry {
  id: string;
  period_id: string;
  entry_type: EntryType;
  amount: number;
  kiosk_current: number | null;
  bank_deposit_split: number | null;
  cash_on_side_split: number | null;
  kiosk_added_split: number | null;
  notes: string | null;
  reason: string | null;
  occurred_at: string;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
const fmtDT = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

// datetime-local <-> ISO helpers
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string) => new Date(s).toISOString();

function computeTotals(period: Period, entries: Entry[]) {
  const gaming = entries.filter((e) => e.entry_type === "gaming_machine");
  const totalGaming = gaming.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalKioskAdded =
    entries.filter((e) => e.entry_type === "kiosk_add").reduce((s, e) => s + Number(e.amount || 0), 0) +
    gaming.reduce((s, e) => s + Number(e.kiosk_added_split || 0), 0);
  const totalBankDeposit =
    entries.filter((e) => e.entry_type === "bank_deposit").reduce((s, e) => s + Number(e.amount || 0), 0) +
    gaming.reduce((s, e) => s + Number(e.bank_deposit_split || 0), 0);
  const totalCashOnSide =
    entries.filter((e) => e.entry_type === "cash_on_side").reduce((s, e) => s + Number(e.amount || 0), 0) +
    gaming.reduce((s, e) => s + Number(e.cash_on_side_split || 0), 0);
  const totalManualPayout = entries.filter((e) => e.entry_type === "manual_payout").reduce((s, e) => s + Number(e.amount || 0), 0);

  // Most recent kiosk snapshot (from gaming_machine entries)
  const sortedGaming = [...gaming].sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
  const mostRecentKiosk = sortedGaming[0]?.kiosk_current;
  const kioskNow = period.status === "closed" && period.ending_kiosk_amount != null
    ? Number(period.ending_kiosk_amount)
    : (mostRecentKiosk != null ? Number(mostRecentKiosk) : 0);

  const net = totalGaming + kioskNow - totalKioskAdded - Number(period.starting_kiosk_amount || 0);
  const accountedFor = totalBankDeposit + totalCashOnSide;
  const unaccounted = net - accountedFor; // positive = missing cash

  return { totalGaming, totalKioskAdded, totalBankDeposit, totalCashOnSide, totalManualPayout, kioskNow, net, accountedFor, unaccounted };
}

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
  const [closingPeriod, setClosingPeriod] = useState<Period | null>(null);

  const storesQ = useQuery({
    queryKey: ["stores-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as StoreLite[];
    },
  });

  const periodsQ = useQuery({
    queryKey: ["admin", "gaming-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gaming_periods")
        .select("id, store_id, period_start, period_end, status, starting_kiosk_amount, ending_kiosk_amount, notes, created_at, stores(id, name)")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as unknown as Period[];
    },
  });

  const entriesAllQ = useQuery({
    queryKey: ["admin", "gaming-entries-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gaming_entries")
        .select("id, period_id, entry_type, amount, kiosk_current, bank_deposit_split, cash_on_side_split, kiosk_added_split, notes, reason, occurred_at");
      if (error) throw error;
      return data as Entry[];
    },
  });

  const entriesByPeriod = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entriesAllQ.data ?? []) {
      const arr = map.get(e.period_id) ?? [];
      arr.push(e);
      map.set(e.period_id, arr);
    }
    return map;
  }, [entriesAllQ.data]);

  const filtered = useMemo(() => {
    return (periodsQ.data ?? []).filter((p) => {
      if (storeFilter !== "all" && p.store_id !== storeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [periodsQ.data, storeFilter, statusFilter]);

  const reopenPeriod = useMutation({
    mutationFn: async (p: Period) => {
      const { error } = await supabase
        .from("gaming_periods").update({ status: "open", period_end: null, ending_kiosk_amount: null }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Period reopened" });
      qc.invalidateQueries({ queryKey: ["admin", "gaming-periods"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const selected = (periodsQ.data ?? []).find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gaming</h1>
          <p className="text-sm text-muted-foreground">
            Track gaming machine periods with kiosk balances, deposits and cash reconciliation per store.
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

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Running Net</TableHead>
              <TableHead className="text-right">Unaccounted</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periodsQ.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!periodsQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <Gamepad2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No gaming periods yet.</p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const t = computeTotals(p, entriesByPeriod.get(p.id) ?? []);
              const unaccounted = t.unaccounted > 0.005;
              return (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedId(p.id)}>
                  <TableCell className="font-medium">{p.stores?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDT(p.period_start)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDT(p.period_end)}</TableCell>
                  <TableCell>
                    {p.status === "open" ? <Badge>Open</Badge> : <Badge variant="outline">Closed</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(t.net)}</TableCell>
                  <TableCell className={`text-right font-mono ${unaccounted ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {unaccounted ? fmtMoney(t.unaccounted) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {p.status === "open" && canClose && (
                      <Button size="sm" variant="outline" onClick={() => setClosingPeriod(p)}>
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
              );
            })}
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

      {closingPeriod && (
        <ClosePeriodDialog
          period={closingPeriod}
          userId={user?.id ?? null}
          onClose={() => setClosingPeriod(null)}
          onSaved={() => {
            setClosingPeriod(null);
            qc.invalidateQueries({ queryKey: ["admin", "gaming-periods"] });
          }}
        />
      )}

      {selected && (
        <PeriodDrawer
          period={selected}
          canTxn={canTxn}
          canClose={canClose}
          onClose={() => setSelectedId(null)}
          onRequestClosePeriod={() => setClosingPeriod(selected)}
        />
      )}
    </div>
  );
}

/* ---------------- Open Period ---------------- */
function OpenPeriodDialog({
  stores, userId, onClose, onSaved,
}: { stores: StoreLite[]; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [storeId, setStoreId] = useState<string>(stores[0]?.id ?? "");
  const [startAt, setStartAt] = useState<string>(toLocalInput(new Date().toISOString()));
  const [startingKiosk, setStartingKiosk] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (!storeId) throw new Error("Select a store");
      const amt = parseFloat(startingKiosk);
      if (!isFinite(amt) || amt < 0) throw new Error("Enter a valid starting kiosk amount");
      const { error } = await supabase.from("gaming_periods").insert({
        store_id: storeId,
        period_start: fromLocalInput(startAt),
        status: "open",
        opened_by: userId,
        starting_kiosk_amount: amt,
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
          <DialogDescription>Set the start date and starting kiosk cash.</DialogDescription>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <Label>Starting kiosk amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={startingKiosk} onChange={(e) => setStartingKiosk(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

/* ---------------- Close Period ---------------- */
function ClosePeriodDialog({
  period, userId, onClose, onSaved,
}: { period: Period; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [endAt, setEndAt] = useState<string>(toLocalInput(period.period_end ?? new Date().toISOString()));
  const [endingKiosk, setEndingKiosk] = useState<string>(period.ending_kiosk_amount != null ? String(period.ending_kiosk_amount) : "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const amt = parseFloat(endingKiosk);
      if (!isFinite(amt) || amt < 0) throw new Error("Enter a valid ending kiosk amount");
      const { error } = await supabase.from("gaming_periods").update({
        status: "closed",
        period_end: fromLocalInput(endAt),
        ending_kiosk_amount: amt,
        closed_by: userId,
      }).eq("id", period.id);
      if (error) throw error;
      toast({ title: "Period closed" });
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
          <DialogTitle>Close gaming period</DialogTitle>
          <DialogDescription>Enter the ending date and the cash currently in the kiosk.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>End date</Label>
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div>
            <Label>Ending kiosk amount</Label>
            <Input type="number" step="0.01" min="0" placeholder="0.00" value={endingKiosk} onChange={(e) => setEndingKiosk(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Closing…" : "Close period"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Period Drawer ---------------- */
function PeriodDrawer({
  period, canTxn, canClose, onClose, onRequestClosePeriod,
}: {
  period: Period;
  canTxn: boolean;
  canClose: boolean;
  onClose: () => void;
  onRequestClosePeriod: () => void;
}) {
  const qc = useQueryClient();
  const closed = period.status === "closed";
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const entriesQ = useQuery({
    queryKey: ["gaming-entries", period.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gaming_entries")
        .select("id, period_id, entry_type, amount, kiosk_current, bank_deposit_split, cash_on_side_split, kiosk_added_split, notes, reason, occurred_at")
        .eq("period_id", period.id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const totals = useMemo(() => computeTotals(period, entriesQ.data ?? []), [period, entriesQ.data]);
  const unaccounted = totals.unaccounted > 0.005;

  const delEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gaming_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entry deleted" });
      qc.invalidateQueries({ queryKey: ["gaming-entries", period.id] });
      qc.invalidateQueries({ queryKey: ["admin", "gaming-entries-all"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{period.stores?.name} — {fmtDT(period.period_start)}</SheetTitle>
          <SheetDescription>
            {closed ? "Closed" : "Open"} · Starting kiosk {fmtMoney(Number(period.starting_kiosk_amount || 0))}
            {period.period_end && ` · Ended ${fmtDT(period.period_end)}`}
            {period.ending_kiosk_amount != null && ` · Ending kiosk ${fmtMoney(Number(period.ending_kiosk_amount))}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          {canTxn && (
            <Button size="sm" variant="outline" onClick={() => setEditingPeriod(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit period
            </Button>
          )}
          {!closed && canClose && (
            <Button size="sm" onClick={onRequestClosePeriod}>
              <Lock className="mr-1 h-3.5 w-3.5" /> Close period
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="Gaming machines" value={fmtMoney(totals.totalGaming)} />
          <SummaryCard label="Kiosk added" value={fmtMoney(totals.totalKioskAdded)} />
          <SummaryCard label="Bank deposits" value={fmtMoney(totals.totalBankDeposit)} />
          <SummaryCard label="Cash on side" value={fmtMoney(totals.totalCashOnSide)} />
          <SummaryCard label="Manual payouts" value={fmtMoney(totals.totalManualPayout)} />
          <SummaryCard label={closed ? "Ending kiosk" : "Kiosk (most recent)"} value={fmtMoney(totals.kioskNow)} />
          <SummaryCard label="Running net" value={fmtMoney(totals.net)} highlight />
          <SummaryCard
            label="Cash unaccounted"
            value={unaccounted ? fmtMoney(totals.unaccounted) : "—"}
            tone={unaccounted ? "danger" : undefined}
          />
        </div>

        {unaccounted && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              Bank deposits + cash on side ({fmtMoney(totals.accountedFor)}) is less than the running net ({fmtMoney(totals.net)}).
              Missing: <span className="font-semibold">{fmtMoney(totals.unaccounted)}</span>.
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <h3 className="font-semibold">Entries</h3>
          {canTxn && (
            <Button size="sm" onClick={() => setAddingEntry(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add entry
            </Button>
          )}
        </div>

        <div className="mt-2 rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entriesQ.isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!entriesQ.isLoading && (entriesQ.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No entries yet</TableCell></TableRow>
              )}
              {(entriesQ.data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDT(e.occurred_at)}</TableCell>
                  <TableCell><Badge variant="outline">{ENTRY_LABELS[e.entry_type]}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(Number(e.amount))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.entry_type === "gaming_machine" && (
                      <div className="space-y-0.5">
                        <div>Kiosk now: <span className="font-mono">{fmtMoney(Number(e.kiosk_current ?? 0))}</span></div>
                        {(e.bank_deposit_split || e.cash_on_side_split || e.kiosk_added_split) ? (
                          <div>
                            Split — Bank {fmtMoney(Number(e.bank_deposit_split ?? 0))} · Side {fmtMoney(Number(e.cash_on_side_split ?? 0))} · Kiosk {fmtMoney(Number(e.kiosk_added_split ?? 0))}
                          </div>
                        ) : null}
                        {e.notes && <div>{e.notes}</div>}
                      </div>
                    )}
                    {e.entry_type !== "gaming_machine" && (e.reason || e.notes || "—")}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {canTxn && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditingEntry(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm("Delete this entry?")) delEntry.mutate(e.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {period.notes && (
          <div className="mt-4 rounded border bg-muted/30 p-3 text-sm">
            <p className="mb-1 font-medium">Notes</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{period.notes}</p>
          </div>
        )}

        {editingPeriod && (
          <EditPeriodDialog
            period={period}
            onClose={() => setEditingPeriod(false)}
            onSaved={() => {
              setEditingPeriod(false);
              qc.invalidateQueries({ queryKey: ["admin", "gaming-periods"] });
            }}
          />
        )}

        {(addingEntry || editingEntry) && (
          <EntryDialog
            periodId={period.id}
            entry={editingEntry}
            onClose={() => { setAddingEntry(false); setEditingEntry(null); }}
            onSaved={() => {
              setAddingEntry(false);
              setEditingEntry(null);
              qc.invalidateQueries({ queryKey: ["gaming-entries", period.id] });
              qc.invalidateQueries({ queryKey: ["admin", "gaming-entries-all"] });
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Edit Period (dates + kiosk amounts + notes) ---------------- */
function EditPeriodDialog({
  period, onClose, onSaved,
}: { period: Period; onClose: () => void; onSaved: () => void }) {
  const [startAt, setStartAt] = useState(toLocalInput(period.period_start));
  const [endAt, setEndAt] = useState(period.period_end ? toLocalInput(period.period_end) : "");
  const [startingKiosk, setStartingKiosk] = useState(String(period.starting_kiosk_amount ?? ""));
  const [endingKiosk, setEndingKiosk] = useState(period.ending_kiosk_amount != null ? String(period.ending_kiosk_amount) : "");
  const [notes, setNotes] = useState(period.notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const startAmt = parseFloat(startingKiosk);
      if (!isFinite(startAmt) || startAmt < 0) throw new Error("Invalid starting kiosk amount");
      const payload: Record<string, unknown> = {
        period_start: fromLocalInput(startAt),
        starting_kiosk_amount: startAmt,
        notes: notes.trim() || null,
      };
      if (period.status === "closed") {
        if (!endAt) throw new Error("End date required");
        const endAmt = parseFloat(endingKiosk);
        if (!isFinite(endAmt) || endAmt < 0) throw new Error("Invalid ending kiosk amount");
        payload.period_end = fromLocalInput(endAt);
        payload.ending_kiosk_amount = endAmt;
      } else if (endAt) {
        payload.period_end = fromLocalInput(endAt);
      }
      const { error } = await supabase.from("gaming_periods").update(payload as never).eq("id", period.id);
      if (error) throw error;
      toast({ title: "Period updated" });
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
          <DialogTitle>Edit period</DialogTitle>
          <DialogDescription>Adjust the dates, kiosk amounts and notes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <Label>Starting kiosk amount</Label>
              <Input type="number" step="0.01" min="0" value={startingKiosk} onChange={(e) => setStartingKiosk(e.target.value)} />
            </div>
            {period.status === "closed" && (
              <>
                <div>
                  <Label>End date</Label>
                  <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                </div>
                <div>
                  <Label>Ending kiosk amount</Label>
                  <Input type="number" step="0.01" min="0" value={endingKiosk} onChange={(e) => setEndingKiosk(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Add / Edit Entry ---------------- */
function EntryDialog({
  periodId, entry, onClose, onSaved,
}: { periodId: string; entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!entry;
  const [type, setType] = useState<EntryType>(entry?.entry_type ?? "gaming_machine");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(entry?.occurred_at ?? new Date().toISOString()));
  const [kioskCurrent, setKioskCurrent] = useState(entry?.kiosk_current != null ? String(entry.kiosk_current) : "");
  const [bankSplit, setBankSplit] = useState(entry?.bank_deposit_split != null ? String(entry.bank_deposit_split) : "");
  const [sideSplit, setSideSplit] = useState(entry?.cash_on_side_split != null ? String(entry.cash_on_side_split) : "");
  const [kioskSplit, setKioskSplit] = useState(entry?.kiosk_added_split != null ? String(entry.kiosk_added_split) : "");
  const [reason, setReason] = useState(entry?.reason ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const numOrNull = (s: string) => {
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  };

  const save = async () => {
    setBusy(true);
    try {
      const amt = parseFloat(amount);
      if (!isFinite(amt) || amt < 0) throw new Error("Amount must be a valid number");

      const payload: Record<string, unknown> = {
        period_id: periodId,
        entry_type: type,
        amount: amt,
        occurred_at: fromLocalInput(occurredAt),
        notes: notes.trim() || null,
        reason: reason.trim() || null,
        kiosk_current: null,
        bank_deposit_split: null,
        cash_on_side_split: null,
        kiosk_added_split: null,
      };

      if (type === "gaming_machine") {
        const k = numOrNull(kioskCurrent);
        if (k == null || k < 0) throw new Error("Kiosk current amount is required");
        payload.kiosk_current = k;
        payload.bank_deposit_split = numOrNull(bankSplit) ?? 0;
        payload.cash_on_side_split = numOrNull(sideSplit) ?? 0;
        payload.kiosk_added_split = numOrNull(kioskSplit) ?? 0;
      }

      if (isEdit && entry) {
        const { error } = await supabase.from("gaming_entries").update(payload as never).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("gaming_entries").insert({ ...payload, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
      toast({ title: isEdit ? "Entry updated" : "Entry added" });
      onSaved();
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit entry" : "Add entry"}</DialogTitle>
          <DialogDescription>Record activity against this gaming period.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTRY_LABELS) as EntryType[]).map((k) => (
                    <SelectItem key={k} value={k}>{ENTRY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>When</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>{type === "gaming_machine" ? "Total money from gaming machines" : "Amount"}</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          {type === "gaming_machine" && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div>
                <Label>Money currently in the kiosk *</Label>
                <Input type="number" step="0.01" min="0" value={kioskCurrent} onChange={(e) => setKioskCurrent(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Optionally split how this money is being handled:</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">To bank</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={bankSplit} onChange={(e) => setBankSplit(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Cash on side</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={sideSplit} onChange={(e) => setSideSplit(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Back into kiosk</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={kioskSplit} onChange={(e) => setKioskSplit(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {(type === "bank_deposit" || type === "manual_payout" || type === "cash_on_side") && (
            <div>
              <Label>Reason / reference</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save" : "Add entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Summary card ---------------- */
function SummaryCard({
  label, value, highlight, tone,
}: { label: string; value: string; highlight?: boolean; tone?: "danger" }) {
  const border = tone === "danger"
    ? "border-destructive/50 bg-destructive/5"
    : highlight ? "bg-primary/5 border-primary/40" : "bg-card";
  const valClass = tone === "danger" ? "text-destructive" : "";
  return (
    <div className={`rounded-lg border p-3 ${border}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${valClass}`}>{value}</p>
    </div>
  );
}
