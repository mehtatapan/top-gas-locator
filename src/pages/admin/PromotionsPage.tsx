import { useEffect, useMemo, useState } from "react";
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
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

type Status = "draft" | "scheduled" | "active" | "archived";

interface Promotion {
  id: string;
  store_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
  stores?: { id: string; name: string } | null;
}

interface StoreLite { id: string; name: string }

type Draft = {
  id?: string;
  store_id: string | null;
  title: string;
  description: string;
  image_url: string;
  starts_at: string; // datetime-local
  ends_at: string;
  status: Status;
};

const EMPTY: Draft = {
  store_id: null, title: "", description: "", image_url: "", starts_at: "", ends_at: "", status: "draft",
};

const STATUSES: Status[] = ["draft", "scheduled", "active", "archived"];

const statusVariant = (s: Status): "default" | "secondary" | "outline" =>
  s === "active" ? "default" : s === "archived" ? "outline" : "secondary";

// convert timestamptz -> value for <input type="datetime-local">
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}
function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function PromotionsPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can("promotions.manage");

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Draft | null>(null);

  const storesQ = useQuery({
    queryKey: ["stores-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as StoreLite[];
    },
  });

  const promosQ = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, store_id, title, description, image_url, starts_at, ends_at, status, created_at, updated_at, stores(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Promotion[];
    },
  });

  const filtered = useMemo(() => {
    const list = promosQ.data ?? [];
    return list.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (storeFilter !== "all") {
        if (storeFilter === "__all__" && p.store_id !== null) return false;
        if (storeFilter !== "__all__" && p.store_id !== storeFilter) return false;
      }
      if (filter.trim()) {
        const q = filter.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [promosQ.data, filter, statusFilter, storeFilter]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Promotion deleted" });
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Create and schedule in-store promotions. Scope to a single store or run chain-wide.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="mr-2 h-4 w-4" /> New promotion
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search title or description…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            <SelectItem value="__all__">Chain-wide only</SelectItem>
            {(storesQ.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promosQ.isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {promosQ.error && (
              <TableRow><TableCell colSpan={6} className="text-center text-destructive">{(promosQ.error as Error).message}</TableCell></TableRow>
            )}
            {!promosQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No promotions found.</p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-xs">
                  <div className="font-medium">{p.title}</div>
                  {p.description && (
                    <div className="truncate text-xs text-muted-foreground">{p.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.stores?.name ?? <span className="italic">All stores</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.starts_at)}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.ends_at)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {canManage && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing({
                        id: p.id,
                        store_id: p.store_id,
                        title: p.title,
                        description: p.description ?? "",
                        image_url: p.image_url ?? "",
                        starts_at: toLocalInput(p.starts_at),
                        ends_at: toLocalInput(p.ends_at),
                        status: p.status,
                      })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id);
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

      {editing && (
        <PromotionDialog
          draft={editing}
          stores={storesQ.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
          }}
        />
      )}
    </div>
  );
}

function PromotionDialog({
  draft, stores, onClose, onSaved,
}: {
  draft: Draft;
  stores: StoreLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!draft.id;
  const [form, setForm] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(draft); }, [draft]);
  const update = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      if (!form.title.trim()) throw new Error("Title is required");
      if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
        throw new Error("End time must be after start time");
      }

      const payload = {
        store_id: form.store_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        status: form.status,
      };

      if (isEdit && form.id) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", form.id);
        if (error) throw error;
        toast({ title: "Promotion updated" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("promotions").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
        toast({ title: "Promotion created" });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit promotion" : "New promotion"}</DialogTitle>
          <DialogDescription>
            Leave the store empty to run chain-wide. Schedule with start/end times or leave open-ended.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="2 for $3 Energy Drinks" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => update({ description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Store</Label>
              <Select
                value={form.store_id ?? "__all__"}
                onValueChange={(v) => update({ store_id: v === "__all__" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All stores (chain-wide)</SelectItem>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="starts_at">Starts</Label>
              <Input id="starts_at" type="datetime-local" value={form.starts_at} onChange={(e) => update({ starts_at: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ends_at">Ends</Label>
              <Input id="ends_at" type="datetime-local" value={form.ends_at} onChange={(e) => update({ ends_at: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update({ status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Create promotion"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
