import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Ticket, Megaphone, Gamepad2, DollarSign, Users, ShieldAlert, LogOut, Store, Shield } from "lucide-react";

const nav = [
  { to: "/admin",            label: "Dashboard",  icon: LayoutDashboard, perm: null },
  { to: "/admin/tickets",    label: "Tickets",    icon: Ticket,          perm: "tickets.view" },
  { to: "/admin/promotions", label: "Promotions", icon: Megaphone,       perm: "promotions.view" },
  { to: "/admin/gaming",     label: "Gaming",     icon: Gamepad2,        perm: "gaming.view" },
  { to: "/admin/pnl",        label: "P&L",        icon: DollarSign,      perm: "pnl.view" },
  { to: "/admin/stores",     label: "Stores",     icon: Store,           perm: "stores.view" },
  { to: "/admin/users",      label: "Users",      icon: Users,           perm: "users.view" },
  { to: "/admin/roles",      label: "Roles",      icon: Shield,          perm: "roles.view" },
  { to: "/admin/audit",      label: "Audit Log",  icon: ShieldAlert,     perm: "admin.audit" },
];

export default function AdminLayout() {
  const { user, can, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src="/android-chrome-192x192.png" className="h-8 w-8 rounded-full" alt="VT" />
          <div>
            <p className="text-sm font-bold leading-none">VT Gas & Market</p>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav
            .filter((n) => !n.perm || can(n.perm))
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/admin"}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="border-t p-3">
          <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate("/admin/login", { replace: true });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3 md:hidden">
          <Link to="/admin" className="flex items-center gap-2">
            <img src="/android-chrome-192x192.png" className="h-7 w-7 rounded-full" alt="VT" />
            <span className="font-bold">Admin</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/admin/login"); }}>
            Sign out
          </Button>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
