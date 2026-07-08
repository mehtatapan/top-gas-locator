import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import LocationPage from "./pages/LocationPage";
import CareersPage from "./pages/CareersPage";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminLoginPage from "./pages/admin/LoginPage";
import ResetPasswordPage from "./pages/admin/ResetPasswordPage";
import ComingSoon from "./pages/admin/ComingSoon";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/location/:locationId" element={<LocationPage />} />
              <Route path="/careers" element={<CareersPage />} />

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <AdminLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="tickets" element={<RequireAuth permission="tickets.view"><ComingSoon title="Tickets" /></RequireAuth>} />
                <Route path="promotions" element={<RequireAuth permission="promotions.view"><ComingSoon title="Promotions" /></RequireAuth>} />
                <Route path="gaming" element={<RequireAuth permission="gaming.view"><ComingSoon title="Gaming" /></RequireAuth>} />
                <Route path="pnl" element={<RequireAuth permission="pnl.view"><ComingSoon title="Profit & Loss" /></RequireAuth>} />
                <Route path="stores" element={<RequireAuth permission="admin.stores"><ComingSoon title="Stores" /></RequireAuth>} />
                <Route path="users" element={<RequireAuth permission="admin.users"><ComingSoon title="Users & Roles" /></RequireAuth>} />
                <Route path="audit" element={<RequireAuth permission="admin.audit"><ComingSoon title="Audit Log" /></RequireAuth>} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
