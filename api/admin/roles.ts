import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, requirePermission } from "../_lib/auth.js";
import { getServiceSupabase } from "../_lib/supabase-admin.js";

/**
 * Admin roles endpoint.
 *  GET   /api/admin/roles                 -> list roles, permissions, and mapping
 *  POST  /api/admin/roles                 -> create a custom role
 *  PATCH /api/admin/roles?role_id=...     -> update name/description & replace permissions
 *  DELETE /api/admin/roles?role_id=...    -> delete a non-system role
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const caller = await requireUser(req);
    if (req.method === "GET")    { requirePermission(caller, "roles.view");   return await list(res); }
    if (req.method === "POST")   { requirePermission(caller, "roles.manage"); return await create(req, res); }
    if (req.method === "PATCH")  { requirePermission(caller, "roles.manage"); return await update(req, res); }
    if (req.method === "DELETE") { requirePermission(caller, "roles.manage"); return await remove(req, res); }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    return res.status(e?.status ?? 500).json({ error: e?.message ?? "Server error" });
  }
}

const SYSTEM_ROLE_KEYS = new Set(["super_admin", "owner", "regional_manager", "store_manager", "employee"]);

async function list(res: VercelResponse) {
  const sb = getServiceSupabase();
  const [{ data: roles, error: rErr }, { data: perms, error: pErr }, { data: mapping, error: mErr }] = await Promise.all([
    sb.from("roles").select("id, key, name, description").order("name"),
    sb.from("permissions").select("id, key, module, description").order("module").order("key"),
    sb.from("role_permissions").select("role_id, permission_id"),
  ]);
  if (rErr) throw rErr;
  if (pErr) throw pErr;
  if (mErr) throw mErr;

  const permsByRole = new Map<string, string[]>();
  for (const m of mapping ?? []) {
    const arr = permsByRole.get(m.role_id) ?? [];
    arr.push(m.permission_id);
    permsByRole.set(m.role_id, arr);
  }

  const rolesOut = (roles ?? []).map((r) => ({
    ...r,
    is_system: SYSTEM_ROLE_KEYS.has(r.key),
    permission_ids: permsByRole.get(r.id) ?? [],
  }));

  return res.status(200).json({ roles: rolesOut, permissions: perms ?? [] });
}

async function create(req: VercelRequest, res: VercelResponse) {
  const { key, name, description, permission_ids } = req.body as {
    key: string; name: string; description?: string; permission_ids?: string[];
  };
  if (!key || !name) return res.status(400).json({ error: "key and name required" });
  if (SYSTEM_ROLE_KEYS.has(key)) return res.status(400).json({ error: "reserved key" });

  const sb = getServiceSupabase();
  const { data, error } = await sb.from("roles").insert({ key, name, description }).select("id").single();
  if (error) return res.status(400).json({ error: error.message });

  if (permission_ids?.length) {
    const rows = permission_ids.map((pid) => ({ role_id: data.id, permission_id: pid }));
    const { error: mErr } = await sb.from("role_permissions").insert(rows);
    if (mErr) return res.status(400).json({ error: mErr.message });
  }
  return res.status(201).json({ id: data.id });
}

async function update(req: VercelRequest, res: VercelResponse) {
  const roleId = String(req.query.role_id ?? "");
  if (!roleId) return res.status(400).json({ error: "role_id required" });
  const { name, description, permission_ids } = req.body as {
    name?: string; description?: string; permission_ids?: string[];
  };
  const sb = getServiceSupabase();

  const { data: role, error: fErr } = await sb.from("roles").select("id, key").eq("id", roleId).single();
  if (fErr || !role) return res.status(404).json({ error: "role not found" });

  if (name !== undefined || description !== undefined) {
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    const { error } = await sb.from("roles").update(patch).eq("id", roleId);
    if (error) return res.status(400).json({ error: error.message });
  }

  if (permission_ids) {
    // super_admin & owner keep full permissions - refuse to shrink them
    if (role.key === "super_admin" || role.key === "owner") {
      return res.status(400).json({ error: `Permissions for ${role.key} cannot be edited` });
    }
    const { error: dErr } = await sb.from("role_permissions").delete().eq("role_id", roleId);
    if (dErr) return res.status(400).json({ error: dErr.message });
    if (permission_ids.length) {
      const rows = permission_ids.map((pid) => ({ role_id: roleId, permission_id: pid }));
      const { error: iErr } = await sb.from("role_permissions").insert(rows);
      if (iErr) return res.status(400).json({ error: iErr.message });
    }
  }
  return res.status(200).json({ ok: true });
}

async function remove(req: VercelRequest, res: VercelResponse) {
  const roleId = String(req.query.role_id ?? "");
  if (!roleId) return res.status(400).json({ error: "role_id required" });
  const sb = getServiceSupabase();
  const { data: role } = await sb.from("roles").select("key").eq("id", roleId).single();
  if (role && SYSTEM_ROLE_KEYS.has(role.key)) return res.status(400).json({ error: "System role cannot be deleted" });
  const { error } = await sb.from("roles").delete().eq("id", roleId);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
