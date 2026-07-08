import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Lock, Plus, Shield, Trash2 } from "lucide-react";

interface RoleRow {
  id: string; key: string; name: string; description: string | null;
  is_system: boolean; permission_ids: string[];
}
interface Perm { id: string; key: string; module: string; description: string | null; }

export default function RolesPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManage = can("roles.manage");
  const rolesQ = useQuery({ queryKey: ["admin", "roles"], queryFn: adminApi.listRoles });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = rolesQ.data?.roles.find((r) => r.id === selectedId) ?? rolesQ.data?.roles[0];

  const deleteRole = useMutation({
    mutationFn: (id: string) => adminApi.deleteRole(id),
    onSuccess: () => { toast({ title: "Role deleted" }); setSelectedId(null); qc.invalidateQueries({ queryKey: ["admin", "roles"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Bundles of permissions assigned to users.</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New role
          </Button>
        )}
      </div>

      {rolesQ.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {rolesQ.error && <p className="text-destructive">{(rolesQ.error as Error).message}</p>}

      {rolesQ.data && (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          {/* Role list */}
          <div className="space-y-1 rounded-lg border bg-card p-2">
            {rolesQ.data.roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                  (selected?.id === r.id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{r.name}</span>
                </div>
                {r.is_system && <Lock className="h-3 w-3 opacity-60" />}
              </button>
            ))}
          </div>

          {/* Detail */}
          {selected && (
            <RoleEditor
              key={selected.id}
              role={selected}
              permissions={rolesQ.data.permissions}
              canManage={canManage}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "roles"] })}
              onDelete={() => { if (confirm(`Delete role "${selected.name}"?`)) deleteRole.mutate(selected.id); }}
            />
          )}
        </div>
      )}

      {creating && (
        <CreateRoleDialog
          permissions={rolesQ.data?.permissions ?? []}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); qc.invalidateQueries({ queryKey: ["admin", "roles"] }); setSelectedId(id); }}
        />
      )}
    </div>
  );
}

function RoleEditor({
  role, permissions, canManage, onSaved, onDelete,
}: {
  role: RoleRow; permissions: Perm[]; canManage: boolean; onSaved: () => void; onDelete: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permission_ids));
  const [busy, setBusy] = useState(false);

  const permsLocked = role.key === "super_admin" || role.key === "owner";
  const grouped = useMemo(() => {
    const map = new Map<string, Perm[]>();
    for (const p of permissions) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const dirty = name !== role.name
    || description !== (role.description ?? "")
    || selected.size !== role.permission_ids.length
    || role.permission_ids.some((id) => !selected.has(id));

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.updateRole(role.id, {
        name,
        description,
        permission_ids: permsLocked ? undefined : Array.from(selected),
      });
      toast({ title: "Role saved" });
      onSaved();
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleModule = (mod: string, on: boolean) => {
    const ids = permissions.filter((p) => p.module === mod).map((p) => p.id);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{role.name}</h2>
            {role.is_system && <Badge variant="outline" className="text-xs"><Lock className="mr-1 h-3 w-3" /> System</Badge>}
            <Badge variant="secondary" className="text-xs">{role.key}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{selected.size} of {permissions.length} permissions granted</p>
        </div>
        {canManage && !role.is_system && (
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} rows={1} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Permissions</Label>
          {permsLocked && <span className="text-xs text-muted-foreground">Admin roles always have every permission.</span>}
        </div>
        <div className={`grid gap-4 md:grid-cols-2 ${permsLocked ? "opacity-50 pointer-events-none" : ""}`}>
          {grouped.map(([mod, perms]) => {
            const all = perms.every((p) => selected.has(p.id));
            const some = !all && perms.some((p) => selected.has(p.id));
            return (
              <div key={mod} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize">{mod}</p>
                  <Checkbox
                    checked={all ? true : some ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleModule(mod, !!v)}
                    disabled={!canManage}
                    aria-label={`Toggle all ${mod}`}
                  />
                </div>
                <ul className="space-y-1">
                  {perms.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        id={p.id}
                        checked={selected.has(p.id)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            v ? next.add(p.id) : next.delete(p.id);
                            return next;
                          });
                        }}
                        disabled={!canManage}
                      />
                      <label htmlFor={p.id} className="cursor-pointer">
                        <span className="font-mono text-xs">{p.key}</span>
                        {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      )}
    </div>
  );
}

function CreateRoleDialog({ permissions, onClose, onCreated }: {
  permissions: Perm[]; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!key.match(/^[a-z][a-z0-9_]*$/)) return toast({ title: "Invalid key", description: "Lowercase letters, digits, underscores only.", variant: "destructive" });
    if (!name.trim()) return toast({ title: "Name required", variant: "destructive" });
    setBusy(true);
    try {
      const { id } = await adminApi.createRole({ key, name, description });
      toast({ title: "Role created", description: "Add permissions on the next screen." });
      onCreated(id);
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
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>Create a custom role, then assign permissions to it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="cashier_lead" />
            <p className="mt-1 text-xs text-muted-foreground">Used internally. Lowercase, no spaces.</p>
          </div>
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cashier Lead" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
