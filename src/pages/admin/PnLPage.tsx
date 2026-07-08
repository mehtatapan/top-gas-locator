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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Pencil, Plus, Trash2 } from "lucide-react";

type Kind = "revenue" | "expense";
interface StoreLite { id: string; name: string }
interface Category { id: string; key: string; name: string }
interface Entry {
  id: string;
  store_id: string | null;
  period_month: string; // YYYY-MM-DD
  kind: Kind;
  expense_category_id: string | null;
  revenue_category_id: string | null;
  amount: number;
  memo: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
  stores?: { id: string; name: string } | null;
  expense_categories?: { id: string; name: string } | null;
  revenue_categories?: { id: string; name: string } | null;
}

type Draft = {
  id?: string;
  store_id: string | null;
  period_month: string;   // YYYY-MM
  kind: Kind;
  category_id: string;    // expense or revenue category id
  amount: string;
  entry_date: string;     // YYYY-MM-DD
  memo: string;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);

// current YYYY-MM
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthToDate(m: string) { return `${m}-01`; }              // YYYY-MM -> YYYY-MM-01
function dateToMonth(d: string) { return d.slice(0, 7); }           // YYYY-MM-DD -> YYYY-MM
function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

const EMPTY: Draft = {
  store_id: null,
  period_month: currentMonth(),
  kind: "expense",
  category_id: "",
  amount: "",
  entry_date: new Date().toISOString().slice(0, 10),
  memo: "",
};

export default function PnLPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canEdit = can("pnl.edit");

  const [month, setMonth] = useState<string>(currentMonth());
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Draft | null>(null);

  const storesQ = useQuery({
    queryKey: ["stores-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as StoreLite[];
    },
  });

  const catsQ = useQuery({
    queryKey: ["pnl-categories"],
    queryFn: async () => {
      const [exp, rev] = await Promise.all([
        supabase.from("expense_categories").select("id, key, name").order("name"),
        supabase.from("revenue_categories").select("id, key, name").order("name"),
      ]);
      if (exp.error) throw exp.error;
      if (rev.error) throw rev.error;
      return { expense: exp.data as Category[], revenue: rev.data as Category[] };
    },
  });

  const entriesQ = useQuery({
    queryKey: ["admin", "pnl", month, storeFilter],
    queryFn: async () => {
      let q = supabase
        .from("pnl_entries")
        .select(`
          id, store_id, period_month, kind, expense_category_id, revenue_category_id,
          amount, memo, entry_date, created_at, updated_at,
          stores(id, name),
          expense_categories(id, name),
          revenue_categories(id, name)
        `)
        .eq("period_month", monthToDate(month))
        .order("entry_date", { ascending: false });
      if (storeFilter === "__chain__") q = q.is("store_id", null);
      else if (storeFilter !== "all") q = q.eq("store_id", storeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Entry[];
    },
  });

  const entries = entriesQ.data ?? [];

  const totals = useMemo(() => {
    const revenue = entries.filter((e) => e.kind === "revenue").reduce((s, e) => s + Number(e.amount), 0);
    const expense = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
    return { revenue, expense, net: revenue - expense };
  }, [entries]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; kind: Kind; total: number }>();
    for (const e of entries) {
      const cat = e.kind === "expense" ? e.expense_categories : e.revenue_categories;
      const key = `${e.kind}:${cat?.id ?? "none"}`;
      const name = cat?.name ?? "(uncategorized)";
      const prev = map.get(key) ?? { name, kind: e.kind, total: 0 };
      prev.total += Number(e.amount);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [entries]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pnl_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entry deleted" });
      qc.invalidateQueries({ queryKey: ["admin", "pnl"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground">
            Monthly revenue and expense entries per store. Roll-ups by category and net.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY, period_month: month })}>
            <Plus className="mr-2 h-4 w-4" /> New entry
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} className="w-44" />
        </div>
        <div>
          <Label className="text-xs">Store</Label>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              <SelectItem value="__chain__">Chain-wide only</SelectItem>
              {(storesQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={`Revenue — ${monthLabel(month)}`} value={fmtMoney(totals.revenue)} tone="positive" />
        <SummaryCard label="Expenses" value={fmtMoney(totals.expense)} tone="negative" />
        <SummaryCard label="Net" value={fmtMoney(totals.net)} highlight tone={totals.net >= 0 ? "positive" : "negative"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Category rollup */}
        <div className="lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold">By category</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCategory.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">No data</TableCell></TableRow>
                )}
                {byCategory.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant={c.kind === "revenue" ? "default" : "outline"} className="mr-2">
                        {c.kind}
                      </Badge>
                      {c.name}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Entries */}
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">Entries</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesQ.isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {entriesQ.error && (
                  <TableRow><TableCell colSpan={6} className="text-center text-destructive">{(entriesQ.error as Error).message}</TableCell></TableRow>
                )}
                {!entriesQ.isLoading && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <DollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No entries for this month.</p>
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((e) => {
                  const cat = e.kind === "expense" ? e.expense_categories : e.revenue_categories;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">{e.entry_date}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.stores?.name ?? <span className="italic">Chain-wide</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.kind === "revenue" ? "default" : "outline"} className="mr-2">{e.kind}</Badge>
                        {cat?.name ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{e.memo ?? ""}</TableCell>
                      <TableCell className="text-right font-mono">
                        {e.kind === "expense" ? "−" : ""}{fmtMoney(Number(e.amount))}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {canEdit && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditing({
                              id: e.id,
                              store_id: e.store_id,
                              period_month: dateToMonth(e.period_month),
                              kind: e.kind,
                              category_id: (e.kind === "expense" ? e.expense_category_id : e.revenue_category_id) ?? "",
                              amount: String(e.amount),
                              entry_date: e.entry_date,
                              memo: e.memo ?? "",
                            })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (confirm("Delete this entry?")) del.mutate(e.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {editing && (
        <EntryDialog
          draft={editing}
          stores={storesQ.data ?? []}
          categories={catsQ.data ?? { expense: [], revenue: [] }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "pnl"] });
          }}
        />
      )}
    </div>
  );
}

function EntryDialog({
  draft, stores, categories, onClose, onSaved,
}: {
  draft: Draft;
  stores: StoreLite[];
  categories: { expense: Category[]; revenue: Category[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!draft.id;
  const [form, setForm] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const update = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));
  const catList = form.kind === "expense" ? categories.expense : categories.revenue;

  const save = async () => {
    setBusy(true);
    try {
      const amt = parseFloat(form.amount);
      if (!isFinite(amt) || amt <= 0) throw new Error("Amount must be positive");
      if (!form.category_id) throw new Error("Category is required");
      if (!form.period_month) throw new Error("Month is required");

      const payload = {
        store_id: form.store_id,
        period_month: monthToDate(form.period_month),
        kind: form.kind,
        expense_category_id: form.kind === "expense" ? form.category_id : null,
        revenue_category_id: form.kind === "revenue" ? form.category_id : null,
        amount: amt,
        memo: form.memo.trim() || null,
        entry_date: form.entry_date || new Date().toISOString().slice(0, 10),
      };

      if (isEdit && form.id) {
        const { error } = await supabase.from("pnl_entries").update(payload).eq("id", form.id);
        if (error) throw error;
        toast({ title: "Entry updated" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("pnl_entries").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
        toast({ title: "Entry created" });
      }
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
          <DialogTitle>{isEdit ? "Edit entry" : "New P&L entry"}</DialogTitle>
          <DialogDescription>
            Entries are grouped by month and store. Leave store empty for chain-wide items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={form.kind} onValueChange={(v) => update({ kind: v as Kind, category_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => update({ category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {catList.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Store</Label>
              <Select value={form.store_id ?? "__all__"} onValueChange={(v) => update({ store_id: v === "__all__" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Chain-wide</SelectItem>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month</Label>
              <Input type="month" value={form.period_month} onChange={(e) => update({ period_month: e.target.value })} />
            </div>

            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => update({ amount: e.target.value })} />
            </div>
            <div>
              <Label>Entry date</Label>
              <Input type="date" value={form.entry_date} onChange={(e) => update({ entry_date: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label>Memo</Label>
              <Textarea rows={2} value={form.memo} onChange={(e) => update({ memo: e.target.value })} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save" : "Create entry"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label, value, highlight, tone,
}: { label: string; value: string; highlight?: boolean; tone?: "positive" | "negative" }) {
  const toneClass = tone === "positive" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "negative" ? "text-destructive" : "";
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "bg-primary/5 border-primary/40" : "bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
