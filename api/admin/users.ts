import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, requirePermission } from "../_lib/auth.js";
import { getServiceSupabase } from "../_lib/supabase-admin.js";

/**
 * Admin users endpoint.
 *  GET    /api/admin/users              -> list all users with roles & stores
 *  POST   /api/admin/users              -> invite a new user (email + roles[])
 *  PATCH  /api/admin/users?user_id=...  -> replace roles for a user
 *  DELETE /api/admin/users?user_id=...  -> deactivate a user (profiles.active=false)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const caller = await requireUser(req);
    if (req.method === "GET")    { requirePermission(caller, "users.view");   return await listUsers(res); }
    if (req.method === "POST")   { requirePermission(caller, "users.invite"); return await inviteUser(req, res); }
    if (req.method === "PATCH")  { requirePermission(caller, "users.edit");   return await patchUser(req, res); }
    if (req.method === "DELETE") { requirePermission(caller, "users.delete"); return await deactivateUser(req, res); }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return res.status(status).json({ error: e?.message ?? "Server error" });
  }
}

async function listUsers(res: VercelResponse) {
  const sb = getServiceSupabase();

  const [{ data: profiles, error: pErr }, { data: assignments, error: aErr }] = await Promise.all([
    sb.from("profiles").select("id, full_name, phone, active, created_at").order("created_at", { ascending: false }),
    sb.from("user_roles").select("id, user_id, role_id, store_id, roles(id,key,name), stores(id,name,slug)"),
  ]);
  if (pErr) throw pErr;
  if (aErr) throw aErr;

  // Fetch emails from auth.users (paginated)
  const emailMap = new Map<string, string>();
  let page = 1;
  // Cap at 10 pages (1000 users) for safety
  while (page <= 10) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    for (const u of data.users) if (u.email) emailMap.set(u.id, u.email);
    if (data.users.length < 100) break;
    page++;
  }

  const rolesByUser = new Map<string, any[]>();
  for (const a of assignments ?? []) {
    const arr = rolesByUser.get(a.user_id) ?? [];
    arr.push({
      assignment_id: a.id,
      role_id: a.role_id,
      role_key: (a as any).roles?.key ?? null,
      role_name: (a as any).roles?.name ?? null,
      store_id: a.store_id,
      store_name: (a as any).stores?.name ?? null,
    });
    rolesByUser.set(a.user_id, arr);
  }

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? null,
    full_name: p.full_name,
    phone: p.phone,
    active: p.active,
    created_at: p.created_at,
    assignments: rolesByUser.get(p.id) ?? [],
  }));

  return res.status(200).json({ users });
}

interface InviteBody {
  email: string;
  full_name?: string;
  assignments: { role_id: string; store_id: string | null }[];
}

async function inviteUser(req: VercelRequest, res: VercelResponse) {
  const body = req.body as InviteBody;
  if (!body?.email) return res.status(400).json({ error: "email required" });
  const sb = getServiceSupabase();

  const redirectTo = `${getOrigin(req)}/admin/reset-password`;
  const { data, error } = await sb.auth.admin.inviteUserByEmail(body.email, {
    data: body.full_name ? { full_name: body.full_name } : undefined,
    redirectTo,
  });
  if (error) return res.status(400).json({ error: error.message });
  const userId = data.user?.id;
  if (!userId) return res.status(500).json({ error: "Invite created but no user id returned" });

  // Wait a tick for handle_new_user trigger to create the profile row.
  await sb.from("profiles").upsert({ id: userId, full_name: body.full_name ?? body.email });

  if (body.assignments?.length) {
    const rows = body.assignments.map((a) => ({ user_id: userId, role_id: a.role_id, store_id: a.store_id }));
    const { error: rErr } = await sb.from("user_roles").insert(rows);
    if (rErr) return res.status(400).json({ error: rErr.message });
  }
  return res.status(201).json({ id: userId, email: body.email });
}

async function patchUser(req: VercelRequest, res: VercelResponse) {
  const userId = String(req.query.user_id ?? "");
  if (!userId) return res.status(400).json({ error: "user_id required" });
  const body = req.body as { full_name?: string; active?: boolean; assignments?: { role_id: string; store_id: string | null }[] };
  const sb = getServiceSupabase();

  if (body.full_name !== undefined || body.active !== undefined) {
    const patch: Record<string, unknown> = {};
    if (body.full_name !== undefined) patch.full_name = body.full_name;
    if (body.active !== undefined) patch.active = body.active;
    const { error } = await sb.from("profiles").update(patch).eq("id", userId);
    if (error) return res.status(400).json({ error: error.message });
  }

  if (body.assignments) {
    // Atomic replace: delete all, insert new set.
    const { error: dErr } = await sb.from("user_roles").delete().eq("user_id", userId);
    if (dErr) return res.status(400).json({ error: dErr.message });
    if (body.assignments.length) {
      const rows = body.assignments.map((a) => ({ user_id: userId, role_id: a.role_id, store_id: a.store_id }));
      const { error: iErr } = await sb.from("user_roles").insert(rows);
      if (iErr) return res.status(400).json({ error: iErr.message });
    }
  }
  return res.status(200).json({ ok: true });
}

async function deactivateUser(req: VercelRequest, res: VercelResponse) {
  const userId = String(req.query.user_id ?? "");
  if (!userId) return res.status(400).json({ error: "user_id required" });
  const sb = getServiceSupabase();
  const { error } = await sb.from("profiles").update({ active: false }).eq("id", userId);
  if (error) return res.status(400).json({ error: error.message });
  // Also delete role assignments so an inactive user has no permissions
  await sb.from("user_roles").delete().eq("user_id", userId);
  return res.status(200).json({ ok: true });
}

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host  = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  return `${proto}://${host}`;
}
