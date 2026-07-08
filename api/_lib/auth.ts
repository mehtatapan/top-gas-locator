import type { VercelRequest } from "@vercel/node";
import { getServiceSupabase } from "./supabase-admin.js";

export interface AuthedUser {
  id: string;
  email: string | null;
  accessToken: string;
  permissions: string[];
}

/**
 * Verifies the caller's Supabase JWT and returns the user plus their permission keys.
 * Throws if the request is unauthenticated.
 */
export async function requireUser(req: VercelRequest): Promise<AuthedUser> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw Object.assign(new Error("Missing bearer token"), { status: 401 });

  const sb = getServiceSupabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Invalid token"), { status: 401 });

  const { data: perms, error: pErr } = await sb
    .from("user_roles")
    .select("role_permissions:role_id!inner(permissions:permission_id!inner(key))")
    // fall back to RPC below if the join fails
    .eq("user_id", data.user.id)
    .limit(1000);

  let permissionKeys: string[] = [];
  if (!pErr && perms) {
    // Flatten the nested joins into a unique list.
    const set = new Set<string>();
    for (const row of perms as any[]) {
      const rp = row?.role_permissions;
      const list = Array.isArray(rp) ? rp : [rp];
      for (const x of list) {
        const p = x?.permissions;
        if (p?.key) set.add(p.key);
      }
    }
    permissionKeys = Array.from(set);
  }
  // Fallback via RPC (cleaner) if the nested join is empty.
  if (permissionKeys.length === 0) {
    const { data: rpc } = await sb.rpc("my_permissions").select().returns<{ permission_key: string }[]>();
    if (rpc) permissionKeys = rpc.map((r) => r.permission_key);
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    accessToken: token,
    permissions: permissionKeys,
  };
}

export function requirePermission(user: AuthedUser, key: string) {
  if (!user.permissions.includes(key)) {
    throw Object.assign(new Error(`Missing permission: ${key}`), { status: 403 });
  }
}
