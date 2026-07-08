import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Ticket as TicketIcon, Send } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];

const STATUSES: TicketStatus[] = ["open", "in_progress", "waiting", "resolved", "closed", "cancelled"];
const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  waiting: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  urgent: "bg-destructive/15 text-destructive",
};

interface TicketRow {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category_id: string | null;
  store_id: string | null;
  assignee_id: string | null;
  created_by: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  stores: { id: string; name: string } | null;
  ticket_categories: { id: string; name: string } | null;
}
interface Category { id: string; key: string; name: string; }
interface Store { id: string; name: string; }
interface Profile { id: string; full_name: string | null; }

const humanize = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export default function TicketsPage() {
  const qc = useQueryClient();
  const { can, user } = useAuth();
  const canCreate = can("tickets.create");
  const canEdit = can("tickets.edit");
  const canAssign = can("tickets.assign");
  const canComment = can("tickets.comment");

  const [filters, setFilters] = useState({ q: "", status: "all", priority: "all", store: "all", assignee: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const ticketsQ = useQuery({
    queryKey: ["tickets", filters],
    queryFn: async () => {
      let q = supabase
        .from("tickets")
        .select("id, number, title, description, status, priority, category_id, store_id, assignee_id, created_by, due_at, created_at, updated_at, stores(id,name), ticket_categories(id,name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters.status !== "all") q = q.eq("status", filters.status as TicketStatus);
      if (filters.priority !== "all") q = q.eq("priority", filters.priority as TicketPriority);
      if (filters.store !== "all") q = q.eq("store_id", filters.store);
      if (filters.assignee === "me" && user) q = q.eq("assignee_id", user.id);
      else if (filters.assignee === "unassigned") q = q.is("assignee_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as TicketRow[];
    },
  });

  const catsQ = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_categories").select("id, key, name").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
  const storesQ = useQuery({
    queryKey: ["stores-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data as Store[];
    },
  });
  const profilesQ = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const filtered = useMemo(() => {
    const list = ticketsQ.data ?? [];
    if (!filters.q.trim()) return list;
    const q = filters.q.toLowerCase();
    return list.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      String(t.number).includes(q) ||
      (t.description ?? "").toLowerCase().includes(q),
    );
  }, [ticketsQ.data, filters.q]);

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profilesQ.data ?? []) if (p.full_name) m.set(p.id, p.full_name);
    return m;
  }, [profilesQ.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground">Track issues, tasks and requests across all stores.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New ticket
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search title, #, description…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} className="max-w-xs" />
        <FilterSelect value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} label="Status" options={[{ v: "all", l: "All statuses" }, ...STATUSES.map((s) => ({ v: s, l: humanize(s) }))]} />
        <FilterSelect value={filters.priority} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} label="Priority" options={[{ v: "all", l: "All priorities" }, ...PRIORITIES.map((p) => ({ v: p, l: humanize(p) }))]} />
        <FilterSelect value={filters.store} onChange={(v) => setFilters((f) => ({ ...f, store: v }))} label="Store" options={[{ v: "all", l: "All stores" }, ...(storesQ.data ?? []).map((s) => ({ v: s.id, l: s.name }))]} />
        <FilterSelect value={filters.assignee} onChange={(v) => setFilters((f) => ({ ...f, assignee: v }))} label="Assignee" options={[{ v: "all", l: "Anyone" }, { v: "me", l: "Assigned to me" }, { v: "unassigned", l: "Unassigned" }]} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ticketsQ.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {ticketsQ.error && (
              <TableRow><TableCell colSpan={8} className="text-center text-destructive">{(ticketsQ.error as Error).message}</TableCell></TableRow>
            )}
            {!ticketsQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <TicketIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No tickets match your filters.</p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelectedId(t.id)}>
                <TableCell className="font-mono text-xs text-muted-foreground">#{t.number}</TableCell>
                <TableCell className="max-w-md truncate font-medium">{t.title}</TableCell>
                <TableCell><span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[t.status]}`}>{humanize(t.status)}</span></TableCell>
                <TableCell><span className={`rounded px-2 py-0.5 text-xs ${PRIORITY_COLORS[t.priority]}`}>{humanize(t.priority)}</span></TableCell>
                <TableCell className="text-muted-foreground">{t.stores?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.assignee_id ? profileMap.get(t.assignee_id) ?? "—" : <Badge variant="outline">Unassigned</Badge>}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmtDate(t.due_at)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmtDate(t.updated_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {creating && (
        <TicketFormDialog
          categories={catsQ.data ?? []}
          stores={storesQ.data ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["tickets"] }); }}
        />
      )}

      <TicketDrawer
        ticketId={selectedId}
        onClose={() => setSelectedId(null)}
        categories={catsQ.data ?? []}
        stores={storesQ.data ?? []}
        profiles={profilesQ.data ?? []}
        profileMap={profileMap}
        canEdit={canEdit}
        canAssign={canAssign}
        canComment={canComment}
      />
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// -------------------- New Ticket Dialog --------------------
function TicketFormDialog({
  categories, stores, onClose, onSaved,
}: {
  categories: Category[]; stores: Store[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [storeId, setStoreId] = useState<string>("__none__");
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [dueAt, setDueAt] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (!title.trim()) throw new Error("Title is required");
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        store_id: storeId === "__none__" ? null : storeId,
        category_id: categoryId === "__none__" ? null : categoryId,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        created_by: user?.id ?? null,
      };
      const { error } = await supabase.from("tickets").insert(payload);
      if (error) throw error;
      toast({ title: "Ticket created" });
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
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>Log an issue, task or request.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{humanize(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-due">Due date</Label>
              <Input id="t-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Creating…" : "Create ticket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Detail Drawer --------------------
interface Comment { id: string; body: string; author_id: string; created_at: string; }
interface HistoryEntry { id: string; field: string; old_value: string | null; new_value: string | null; actor_id: string | null; created_at: string; }

function TicketDrawer({
  ticketId, onClose, categories, stores, profiles, profileMap, canEdit, canAssign, canComment,
}: {
  ticketId: string | null;
  onClose: () => void;
  categories: Category[];
  stores: Store[];
  profiles: Profile[];
  profileMap: Map<string, string>;
  canEdit: boolean;
  canAssign: boolean;
  canComment: boolean;
}) {
  const qc = useQueryClient();
  const open = !!ticketId;

  const ticketQ = useQuery({
    queryKey: ["ticket", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, number, title, description, status, priority, category_id, store_id, assignee_id, created_by, due_at, created_at, updated_at, stores(id,name), ticket_categories(id,name)")
        .eq("id", ticketId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TicketRow;
    },
  });

  const commentsQ = useQuery({
    queryKey: ["ticket-comments", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_comments")
        .select("id, body, author_id, created_at")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const historyQ = useQuery({
    queryKey: ["ticket-history", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_history")
        .select("id, field, old_value, new_value, actor_id, created_at")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as HistoryEntry[];
    },
  });

  const patch = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase.from("tickets").update(updates).eq("id", ticketId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["ticket-history", ticketId] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const [newComment, setNewComment] = useState("");
  const addComment = useMutation({
    mutationFn: async (body: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId!, author_id: user.id, body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    },
    onError: (e: Error) => toast({ title: "Comment failed", description: e.message, variant: "destructive" }),
  });

  const t = ticketQ.data;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {!t ? (
          <div className="py-16 text-center text-muted-foreground">{ticketQ.isLoading ? "Loading…" : "Ticket not found"}</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">#{t.number}</span>
                <span>{t.title}</span>
              </SheetTitle>
              <SheetDescription>
                Created {fmtDate(t.created_at)}{t.created_by ? ` by ${profileMap.get(t.created_by) ?? "someone"}` : ""}.
              </SheetDescription>
            </SheetHeader>

            {/* Field grid */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <FieldSelect label="Status" value={t.status} disabled={!canEdit} onChange={(v) => patch.mutate({ status: v as TicketStatus })}
                options={STATUSES.map((s) => ({ v: s, l: humanize(s) }))} />
              <FieldSelect label="Priority" value={t.priority} disabled={!canEdit} onChange={(v) => patch.mutate({ priority: v as TicketPriority })}
                options={PRIORITIES.map((p) => ({ v: p, l: humanize(p) }))} />
              <FieldSelect label="Store" value={t.store_id ?? "__none__"} disabled={!canEdit}
                onChange={(v) => patch.mutate({ store_id: v === "__none__" ? null : v })}
                options={[{ v: "__none__", l: "— None —" }, ...stores.map((s) => ({ v: s.id, l: s.name }))]} />
              <FieldSelect label="Category" value={t.category_id ?? "__none__"} disabled={!canEdit}
                onChange={(v) => patch.mutate({ category_id: v === "__none__" ? null : v })}
                options={[{ v: "__none__", l: "— None —" }, ...categories.map((c) => ({ v: c.id, l: c.name }))]} />
              <FieldSelect label="Assignee" value={t.assignee_id ?? "__none__"} disabled={!canAssign}
                onChange={(v) => patch.mutate({ assignee_id: v === "__none__" ? null : v })}
                options={[{ v: "__none__", l: "— Unassigned —" }, ...profiles.map((p) => ({ v: p.id, l: p.full_name ?? p.id.slice(0, 8) }))]} />
              <div>
                <Label className="text-xs text-muted-foreground">Due</Label>
                <Input
                  type="datetime-local"
                  disabled={!canEdit}
                  value={t.due_at ? new Date(t.due_at).toISOString().slice(0, 16) : ""}
                  onChange={(e) => patch.mutate({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>

            {t.description && (
              <div className="mt-6">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="mt-1 whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm">{t.description}</div>
              </div>
            )}

            <Tabs defaultValue="comments" className="mt-6">
              <TabsList>
                <TabsTrigger value="comments">Comments ({commentsQ.data?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="history">History ({historyQ.data?.length ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="space-y-3">
                <ScrollArea className="max-h-72 pr-2">
                  <div className="space-y-3">
                    {commentsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
                    {commentsQ.data?.map((c) => (
                      <div key={c.id} className="rounded border bg-card p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium">{profileMap.get(c.author_id) ?? "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {canComment && (
                  <div className="flex gap-2">
                    <Textarea placeholder="Add a comment…" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} />
                    <Button size="sm" disabled={!newComment.trim() || addComment.isPending} onClick={() => addComment.mutate(newComment.trim())}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history">
                <ScrollArea className="max-h-96 pr-2">
                  <div className="space-y-2">
                    {historyQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No changes yet.</p>}
                    {historyQ.data?.map((h) => (
                      <div key={h.id} className="rounded border bg-card p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{humanize(h.field)}</span>
                          <span className="text-muted-foreground">{fmtDate(h.created_at)}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {h.actor_id ? profileMap.get(h.actor_id) ?? "Someone" : "System"}:{" "}
                          <span className="line-through">{formatHistoryValue(h.field, h.old_value, profileMap)}</span>{" → "}
                          <span className="font-medium text-foreground">{formatHistoryValue(h.field, h.new_value, profileMap)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatHistoryValue(field: string, value: string | null, profileMap: Map<string, string>) {
  if (!value) return "—";
  if (field === "assignee") return profileMap.get(value) ?? value.slice(0, 8);
  if (field === "due_at") return new Date(value).toLocaleString();
  return humanize(value);
}

function FieldSelect({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
