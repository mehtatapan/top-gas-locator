import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditRow {
  id: string;
  actor_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: { id: string; full_name: string | null } | null;
}

const MODULES = ["all", "tickets", "promotions", "gaming", "pnl", "stores", "users", "roles", "admin"];
const ACTIONS = ["all", "INSERT", "UPDATE", "DELETE"];
const PAGE_SIZE = 50;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });

function actionVariant(a: string): "default" | "outline" | "destructive" | "secondary" {
  if (a === "INSERT") return "default";
  if (a === "DELETE") return "destructive";
  if (a === "UPDATE") return "secondary";
  return "outline";
}

export default function AuditPage() {
  const [module, setModule] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const q = useQuery({
    queryKey: ["admin", "audit", module, action, page],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select(`id, actor_id, module, action, entity_type, entity_id, before, after, ip, user_agent, created_at,
                 profiles:actor_id ( id, full_name )`, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (module !== "all") query = query.eq("module", module);
      if (action !== "all") query = query.eq("action", action);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.count ?? 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      (r.entity_type ?? "").toLowerCase().includes(s) ||
      (r.entity_id ?? "").toLowerCase().includes(s) ||
      (r.profiles?.full_name ?? "").toLowerCase().includes(s),
    );
  }, [rows, search]);

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Immutable record of privileged changes across the platform. Read-only.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs">Module</Label>
          <Select value={module} onValueChange={(v) => { setModule(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Action</Label>
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Search (entity type / id / actor)</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="tickets, uuid, name…" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="w-24 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {q.error && (
              <TableRow><TableCell colSpan={6} className="text-center text-destructive">{(q.error as Error).message}</TableCell></TableRow>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No audit entries.</p>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(r)}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmt(r.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.profiles?.full_name ?? <span className="italic">System</span>}
                </TableCell>
                <TableCell><Badge variant="outline">{r.module}</Badge></TableCell>
                <TableCell><Badge variant={actionVariant(r.action)}>{r.action}</Badge></TableCell>
                <TableCell className="font-mono text-xs">
                  <div>{r.entity_type ?? "—"}</div>
                  {r.entity_id && <div className="text-muted-foreground">{r.entity_id.slice(0, 8)}…</div>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost">View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} total · page {page + 1} of {maxPage + 1}</span>
        <div className="space-x-1">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={page >= maxPage} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selected && <AuditDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AuditDrawer({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  const diff = useMemo(() => computeDiff(row.before, row.after), [row.before, row.after]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <Badge variant={actionVariant(row.action)} className="mr-2">{row.action}</Badge>
            {row.module} · {row.entity_type ?? "—"}
          </SheetTitle>
          <SheetDescription>
            {fmt(row.created_at)} · by {row.profiles?.full_name ?? "System"}
            {row.ip && <> · {row.ip}</>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {row.entity_id && (
            <div>
              <p className="text-xs text-muted-foreground">Entity ID</p>
              <p className="font-mono text-sm break-all">{row.entity_id}</p>
            </div>
          )}

          {diff.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Changed fields</p>
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.map((d) => (
                      <TableRow key={d.field}>
                        <TableCell className="font-mono text-xs">{d.field}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{d.before}</TableCell>
                        <TableCell className="font-mono text-xs">{d.after}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Raw payload</summary>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <JsonBlock title="Before" value={row.before} />
              <JsonBlock title="After" value={row.after} />
            </div>
          </details>

          {row.user_agent && (
            <div>
              <p className="text-xs text-muted-foreground">User agent</p>
              <p className="text-xs break-all">{row.user_agent}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded border bg-muted/30 p-2">
      <p className="mb-1 text-xs font-semibold">{title}</p>
      <pre className="max-h-72 overflow-auto text-[10px] leading-tight">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function computeDiff(before: unknown, after: unknown): { field: string; before: string; after: string }[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  if (typeof b !== "object" || typeof a !== "object") return [];
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const skip = new Set(["updated_at", "created_at"]);
  const out: { field: string; before: string; after: string }[] = [];
  for (const k of keys) {
    if (skip.has(k)) continue;
    const bv = JSON.stringify(b[k]);
    const av = JSON.stringify(a[k]);
    if (bv !== av) out.push({ field: k, before: bv ?? "—", after: av ?? "—" });
  }
  return out;
}
