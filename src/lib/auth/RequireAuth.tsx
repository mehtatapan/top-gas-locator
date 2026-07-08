import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

interface Props {
  children: ReactNode;
  permission?: string;
}

export function RequireAuth({ children, permission }: Props) {
  const { session, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  if (permission && !can(permission)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-xl font-bold">Access denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
