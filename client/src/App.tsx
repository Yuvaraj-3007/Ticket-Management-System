import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Tickets from "@/pages/Tickets";
import TicketDetailPage from "@/pages/TicketDetailPage";
import Users from "@/pages/Users";
import AgentDetail from "@/pages/AgentDetail";
import Clients from "@/pages/Clients";
import AppLayout from "@/components/AppLayout";
import Analytics from "@/pages/Analytics";
import Portal404 from "@/pages/portal/Portal404";
import PortalLayout from "@/pages/portal/PortalLayout";
import PortalSubmit from "@/pages/portal/PortalSubmit";
import PortalLogin from "@/pages/portal/PortalLogin";
import PortalTickets from "@/pages/portal/PortalTickets";
import PortalTicketDetail from "@/pages/portal/PortalTicketDetail";
import PortalDashboard from "@/pages/portal/PortalDashboard";
import PortalForgotPassword from "@/pages/portal/PortalForgotPassword";
import PortalResetPassword from "@/pages/portal/PortalResetPassword";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // CUSTOMER accounts belong in the portal, not the internal app
  const role = (session.user as unknown as { role?: string }).role;
  if (role === "CUSTOMER") {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if ((session.user as unknown as { role: UserRole }).role !== ROLES.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const role = (session?.user as unknown as { role?: string })?.role;

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (session) {
    // Customer session on admin login page — go to portal instead
    if (role === "CUSTOMER") {
      return <Navigate to="/portal/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function CustomerRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    const slug = localStorage.getItem("portal-slug") ?? "";
    return <Navigate to={`/portal/${slug}/login`} replace />;
  }

  const role = (session.user as unknown as { role?: string }).role;
  if (role !== "CUSTOMER") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<GuestRoute><Login /></GuestRoute>}
        />

        {/* Portal — no AppLayout, no sidebar */}
        <Route path="/portal/404" element={<Portal404 />} />
        <Route path="/portal/auth/signup" element={<Navigate to="/" replace />} />
        <Route path="/portal/forgot-password" element={<PortalForgotPassword />} />
        <Route path="/portal/reset-password" element={<PortalResetPassword />} />
        <Route path="/portal/:slug/login" element={<PortalLogin />} />
        <Route path="/portal/:slug/submit" element={<PortalSubmit />} />
        <Route path="/portal/:slug" element={<Navigate to="login" replace />} />
        <Route element={<CustomerRoute />}>
          <Route element={<PortalLayout />}>
            <Route path="/portal/dashboard" element={<PortalDashboard />} />
            <Route path="/portal/tickets" element={<PortalTickets />} />
            <Route path="/portal/tickets/:id" element={<PortalTicketDetail />} />
          </Route>
        </Route>

        {/* All authenticated pages share AppLayout (header + sidebar) */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/"            element={<Dashboard />} />
          <Route path="/tickets"     element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/users"       element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="/users/:id"   element={<AdminRoute><AgentDetail /></AdminRoute>} />
          <Route path="/clients"     element={<AdminRoute><Clients /></AdminRoute>} />
          <Route path="/analytics"   element={<AdminRoute><Analytics /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
