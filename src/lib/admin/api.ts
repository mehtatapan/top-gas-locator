import { supabase } from "@/integrations/supabase/client";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------- Users ----------------
export interface UserAssignment {
  assignment_id: string;
  role_id: string;
  role_key: string | null;
  role_name: string | null;
  store_id: string | null;
  store_name: string | null;
}
export interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  assignments: UserAssignment[];
}

export const adminApi = {
  listUsers: () => req<{ users: AdminUser[] }>("/api/admin/users"),
  inviteUser: (body: { email: string; full_name?: string; assignments: { role_id: string; store_id: string | null }[] }) =>
    req<{ id: string; email: string }>("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (userId: string, body: { full_name?: string; active?: boolean; assignments?: { role_id: string; store_id: string | null }[] }) =>
    req<{ ok: true }>(`/api/admin/users?user_id=${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  deactivateUser: (userId: string) =>
    req<{ ok: true }>(`/api/admin/users?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),

  // Roles
  listRoles: () => req<{
    roles: { id: string; key: string; name: string; description: string | null; is_system: boolean; permission_ids: string[] }[];
    permissions: { id: string; key: string; module: string; description: string | null }[];
  }>("/api/admin/roles"),
  createRole: (body: { key: string; name: string; description?: string; permission_ids?: string[] }) =>
    req<{ id: string }>("/api/admin/roles", { method: "POST", body: JSON.stringify(body) }),
  updateRole: (roleId: string, body: { name?: string; description?: string; permission_ids?: string[] }) =>
    req<{ ok: true }>(`/api/admin/roles?role_id=${encodeURIComponent(roleId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRole: (roleId: string) =>
    req<{ ok: true }>(`/api/admin/roles?role_id=${encodeURIComponent(roleId)}`, { method: "DELETE" }),
};
