import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

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
  priority: number | null;
  created_at: string;
  updated_at: string;
  promotion_stores?: { store_id: string; stores?: { id: string; name: string } | null }[];
}

interface StoreLite { id: string; name: string }

type Draft = {
  id?: string;
  store_ids: string[]; // empty = chain-wide (all stores)
  title: string;
  description: string;
  image_url: string;
  starts_at: string;
  ends_at: string;
  status: Status;
  priority: string;
};

const EMPTY: Draft = {
  store_ids: [], title: "", description: "", image_url: "", starts_at: "", ends_at: "", status: "draft", priority: "",
};

const STATUSES: Status[] = ["draft", "scheduled", "active", "archived"];

const statusVariant = (s: Status): "default" | "secondary" | "outline" =>
  s === "active" ? "default" : s === "archived" ? "outline" : "secondary";

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
        .select("id, store_id, title, description, image_url, starts_at, ends_at, status, priority, created_at, updated_at, promotion_stores(store_id, stores(id, name))")
        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Promotion[];
    },
  });

  const filtered = useMemo(() => {
    const list = promosQ.data ?? [];
    return list.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      const linkedIds = (p.promotion_stores ?? []).map((l) => l.store_id);
      const isChainWide = linkedIds.length === 0;
      if (storeFilter !== "all") {
        if (storeFilter === "__all__") {
          if (!isChainWide) return false;
        } else {
          if (!linkedIds.includes(storeFilter)) return false;
        }
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

  const storeNameById = useMemo(() => {
    const m = new Map<string, string>();
    (storesQ.data ?? []).forEach((s) => m.set(s.id, s.name));
    return m;
  }, [storesQ.data]);

  function renderStoresCell(p: Promotion) {
    const links = p.promotion_stores ?? [];
    if (links.length === 0) return <span className="italic text-muted-foreground">All stores</span>;
    const names = links.map((l) => l.stores?.name ?? storeNameById.get(l.store_id) ?? "—");
    if (names.length <= 2) return <span className="text-muted-foreground">{names.join(", ")}</span>;
    return (
      <span className="text-muted-foreground" title={names.join(", ")}>
        {names.slice(0, 2).join(", ")} <Badge variant="outline" className="ml-1">+{names.length - 2}</Badge>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Create and schedule in-store promotions. Assign to one, several, or all stores.
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
              <TableHead>Stores</TableHead>
              <TableHead>Starts</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promosQ.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {promosQ.error && (
              <TableRow><TableCell colSpan={7} className="text-center text-destructive">{(promosQ.error as Error).message}</TableCell></TableRow>
            )}
            {!promosQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
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
                <TableCell>{renderStoresCell(p)}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.starts_at)}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.ends_at)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.priority == null ? <span className="italic">—</span> : p.priority}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {canManage && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing({
                        id: p.id,
                        store_ids: (p.promotion_stores ?? []).map((l) => l.store_id),
                        title: p.title,
                        description: p.description ?? "",
                        image_url: p.image_url ?? "",
                        starts_at: toLocalInput(p.starts_at),
                        ends_at: toLocalInput(p.ends_at),
                        status: p.status,
                        priority: p.priority == null ? "" : String(p.priority),
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

function StoreMultiSelect({
  stores, selected, onChange,
}: {
  stores: StoreLite[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const allSelected = selected.length === 0; // chain-wide
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };
  const label = allSelected
    ? "All stores (chain-wide)"
    : selected.length === 1
      ? stores.find((s) => s.id === selected[0])?.name ?? "1 store"
      : `${selected.length} stores selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            <Checkbox checked={allSelected} className="pointer-events-none" />
            <span className="font-medium">All stores (chain-wide)</span>
          </button>
          <div className="my-1 h-px bg-border" />
          {stores.map((s) => {
            const checked = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="truncate">{s.name}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
      let priorityNum: number | null = null;
      if (form.priority.trim() !== "") {
        const n = Number(form.priority);
        if (!Number.isInteger(n) || n < 1) throw new Error("Priority must be a positive whole number (1 = top).");
        priorityNum = n;
      }

      // Keep legacy store_id in sync: single store = that id, otherwise null.
      const legacyStoreId = form.store_ids.length === 1 ? form.store_ids[0] : null;

      const payload = {
        store_id: legacyStoreId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        status: form.status,
        priority: priorityNum,
      };

      let promoId = form.id;
      if (isEdit && form.id) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("promotions")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        promoId = data.id;
      }

      // Replace store links to match selection.
      if (promoId) {
        const { error: delErr } = await supabase
          .from("promotion_stores")
          .delete()
          .eq("promotion_id", promoId);
        if (delErr) throw delErr;
        if (form.store_ids.length > 0) {
          const { error: insErr } = await supabase
            .from("promotion_stores")
            .insert(form.store_ids.map((sid) => ({ promotion_id: promoId!, store_id: sid })));
          if (insErr) throw insErr;
        }
      }

      toast({ title: isEdit ? "Promotion updated" : "Promotion created" });
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
            Pick one or more stores, or leave empty to run chain-wide across every location.
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

          <div>
            <Label>Promotion image</Label>
            <ImageUpload
              value={form.image_url}
              onChange={(url) => update({ image_url: url })}
              module="promotions"
              subPath={form.store_ids.length === 1 ? form.store_ids[0] : "chain-wide"}
            />
          </div>

          <div>
            <Label>Stores</Label>
            <StoreMultiSelect
              stores={stores}
              selected={form.store_ids}
              onChange={(ids) => update({ store_ids: ids })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Select any combination of stores. Leave empty to show at every location.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="starts_at">Starts</Label>
              <Input id="starts_at" type="datetime-local" value={form.starts_at} onChange={(e) => update({ starts_at: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ends_at">Ends</Label>
              <Input id="ends_at" type="datetime-local" value={form.ends_at} onChange={(e) => update({ ends_at: e.target.value })} />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update({ status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority (1 = top)</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                placeholder="Leave blank for none"
                value={form.priority}
                onChange={(e) => update({ priority: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Lower numbers appear first. Pin up to ~4 as your top featured promos per store.
              </p>
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
