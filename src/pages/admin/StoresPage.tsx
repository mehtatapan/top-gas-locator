import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Store as StoreIcon, Pencil, Power } from "lucide-react";

interface Store {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type Draft = {
  id?: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  active: boolean;
};

const EMPTY: Draft = { slug: "", name: "", city: "", state: "", address: "", phone: "", active: true };

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function StoresPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can("stores.manage");

  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);

  const storesQ = useQuery({
    queryKey: ["admin", "stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, slug, name, city, state, address, phone, active, created_at, updated_at")
        .order("name");
      if (error) throw error;
      return data as Store[];
    },
  });

  const filtered = useMemo(() => {
    const list = storesQ.data ?? [];
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q) ||
      (s.state ?? "").toLowerCase().includes(q),
    );
  }, [storesQ.data, filter]);

  const toggleActive = useMutation({
    mutationFn: async (s: Store) => {
      const { error } = await supabase.from("stores").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Store updated" });
      qc.invalidateQueries({ queryKey: ["admin", "stores"] });
      qc.invalidateQueries({ queryKey: ["stores-lite"] });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stores</h1>
          <p className="text-sm text-muted-foreground">Manage store locations. These scope users, tickets, inventory, and reports.</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="mr-2 h-4 w-4" /> New store
          </Button>
        )}
      </div>

      <Input
        placeholder="Search by name, slug, city or state…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {storesQ.isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {storesQ.error && (
              <TableRow><TableCell colSpan={6} className="text-center text-destructive">{(storesQ.error as Error).message}</TableCell></TableRow>
            )}
            {!storesQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <StoreIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No stores yet.</p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                <TableCell>
                  {s.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {canManage && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing({
                        id: s.id, slug: s.slug, name: s.name,
                        city: s.city ?? "", state: s.state ?? "",
                        address: s.address ?? "", phone: s.phone ?? "",
                        active: s.active,
                      })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`${s.active ? "Deactivate" : "Activate"} ${s.name}?`)) toggleActive.mutate(s);
                      }}>
                        <Power className="h-3.5 w-3.5" />
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
        <StoreDialog
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin", "stores"] });
            qc.invalidateQueries({ queryKey: ["stores-lite"] });
          }}
        />
      )}
    </div>
  );
}

function StoreDialog({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!draft.id;
  const [form, setForm] = useState<Draft>(draft);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(draft); setSlugTouched(!!draft.id); }, [draft]);

  const update = (patch: Partial<Draft>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      if (!form.name.trim()) throw new Error("Name is required");
      const slug = (form.slug || slugify(form.name)).trim();
      if (!slug) throw new Error("Slug is required");

      const payload = {
        slug,
        name: form.name.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        active: form.active,
      };

      if (isEdit && form.id) {
        const { error } = await supabase.from("stores").update(payload).eq("id", form.id);
        if (error) throw error;
        toast({ title: "Store updated" });
      } else {
        const { error } = await supabase.from("stores").insert(payload);
        if (error) throw error;
        toast({ title: "Store created" });
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
          <DialogTitle>{isEdit ? "Edit store" : "New store"}</DialogTitle>
          <DialogDescription>
            Stores are used to scope users, tickets, inventory, and reports across the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => {
                const name = e.target.value;
                update({ name, ...(slugTouched ? {} : { slug: slugify(name) }) });
              }} placeholder="e.g. VT Gas — Killeen" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={form.slug} onChange={(e) => { setSlugTouched(true); update({ slug: slugify(e.target.value) }); }} placeholder="vt-killeen" />
              <p className="mt-1 text-xs text-muted-foreground">Used in URLs & internal references. Lowercase, dashes only.</p>
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => update({ address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => update({ city: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={(e) => update({ state: e.target.value })} maxLength={2} placeholder="TX" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label htmlFor="active" className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive stores are hidden from operational dropdowns.</p>
            </div>
            <Switch id="active" checked={form.active} onCheckedChange={(v) => update({ active: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Create store"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
