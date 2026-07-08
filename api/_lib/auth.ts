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

  const { data: perms } = await sb.rpc("my_permissions");
  const permissionKeys = ((perms ?? []) as { permission_key: string }[]).map((r) => r.permission_key);

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
