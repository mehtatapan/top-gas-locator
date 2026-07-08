import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminApi, type AdminUser } from "@/lib/admin/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, UserPlus, X } from "lucide-react";

interface Role { id: string; key: string; name: string; }
interface Store { id: string; name: string; }
type Draft = { role_id: string; store_id: string | null };

export default function UsersPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canInvite = can("users.invite");
  const canEdit = can("users.edit");
  const canDelete = can("users.delete");

  const usersQ = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.listUsers });
  const rolesQ = useQuery({
    queryKey: ["roles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("id, key, name").order("name");
      if (error) throw error;
      return data as Role[];
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

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const list = usersQ.data?.users ?? [];
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter((u) =>
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      u.assignments.some((a) => (a.role_name ?? "").toLowerCase().includes(q)),
    );
  }, [usersQ.data, filter]);

  const deactivate = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: () => { toast({ title: "User deactivated" }); qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">Invite team members and manage their roles.</p>
        </div>
        {canInvite && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite user
          </Button>
        )}
      </div>

      <Input placeholder="Search by name, email or role…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQ.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {usersQ.error && (
              <TableRow><TableCell colSpan={5} className="text-center text-destructive">{(usersQ.error as Error).message}</TableCell></TableRow>
            )}
            {!usersQ.isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.assignments.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    {u.assignments.map((a) => (
                      <Badge key={a.assignment_id} variant="secondary" className="text-xs">
                        {a.role_name}{a.store_name ? ` · ${a.store_name}` : " · All stores"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {u.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {canEdit && <Button size="sm" variant="outline" onClick={() => setEditing(u)}>Edit</Button>}
                  {canDelete && u.active && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm(`Deactivate ${u.email ?? u.full_name}?`)) deactivate.mutate(u.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {inviteOpen && (
        <UserDialog
          mode="invite"
          roles={rolesQ.data ?? []}
          stores={storesQ.data ?? []}
          onClose={() => setInviteOpen(false)}
          onSaved={() => { setInviteOpen(false); qc.invalidateQueries({ queryKey: ["admin", "users"] }); }}
        />
      )}
      {editing && (
        <UserDialog
          mode="edit"
          user={editing}
          roles={rolesQ.data ?? []}
          stores={storesQ.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin", "users"] }); }}
        />
      )}
    </div>
  );
}

// -------------------- Invite / Edit dialog --------------------
function UserDialog({
  mode, user, roles, stores, onClose, onSaved,
}: {
  mode: "invite" | "edit";
  user?: AdminUser;
  roles: Role[];
  stores: Store[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const [assignments, setAssignments] = useState<Draft[]>(
    user?.assignments.map((a) => ({ role_id: a.role_id, store_id: a.store_id })) ?? [],
  );

  useEffect(() => {
    // Reset when user changes
    if (user) {
      setEmail(user.email ?? "");
      setFullName(user.full_name ?? "");
      setActive(user.active);
      setAssignments(user.assignments.map((a) => ({ role_id: a.role_id, store_id: a.store_id })));
    }
  }, [user]);

  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (mode === "invite") {
        if (!email) throw new Error("Email is required");
        if (!assignments.length) throw new Error("Assign at least one role");
        for (const a of assignments) if (!a.role_id) throw new Error("Every assignment needs a role");
        await adminApi.inviteUser({ email, full_name: fullName || undefined, assignments });
        toast({ title: "Invite sent", description: `${email} will receive an email to set their password.` });
      } else if (user) {
        for (const a of assignments) if (!a.role_id) throw new Error("Every assignment needs a role");
        await adminApi.updateUser(user.id, { full_name: fullName || undefined, active, assignments });
        toast({ title: "User updated" });
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
          <DialogTitle>{mode === "invite" ? "Invite user" : "Edit user"}</DialogTitle>
          <DialogDescription>
            {mode === "invite"
              ? "They'll receive an email to set their password and gain access."
              : "Update their profile, active status, and role assignments."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={mode === "edit"} required />
          </div>
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Optional" />
          </div>
          {mode === "edit" && (
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <Label htmlFor="active" className="text-sm font-medium">Account active</Label>
                <p className="text-xs text-muted-foreground">Inactive users cannot sign in and have all permissions revoked.</p>
              </div>
              <Switch id="active" checked={active} onCheckedChange={setActive} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Role assignments</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setAssignments((a) => [...a, { role_id: "", store_id: null }])}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            {assignments.length === 0 && (
              <p className="rounded border border-dashed p-3 text-center text-sm text-muted-foreground">
                No roles assigned. Add at least one.
              </p>
            )}
            {assignments.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Select value={a.role_id} onValueChange={(v) => setAssignments((arr) => arr.map((x, j) => j === i ? { ...x, role_id: v } : x))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={a.store_id ?? "__all__"} onValueChange={(v) => setAssignments((arr) => arr.map((x, j) => j === i ? { ...x, store_id: v === "__all__" ? null : v } : x))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Scope" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All stores</SelectItem>
                    {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" onClick={() => setAssignments((arr) => arr.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : mode === "invite" ? "Send invite" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
