import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { LogOut, Inbox, UserRound, Menu, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { path: "/portal/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { path: "/portal/tickets",   label: "My Tickets", icon: Inbox            },
];

export default function PortalLayout() {
  const { data: session } = useSession();
  const location  = useLocation();
  const navigate  = useNavigate();

  const userName =
    (session?.user as unknown as { name?: string } | undefined)?.name ?? "Customer";

  const handleSignOut = async () => {
    await signOut();
    const slug = localStorage.getItem("portal-slug") ?? "";
    navigate(slug ? `/portal/${slug}/login` : "/");
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* ── Top navbar ── */}
      <header
        style={{
          background:   "var(--rt-accent)",
          borderBottom: "none",
          position:     "sticky",
          top:          0,
          zIndex:       50,
          flexShrink:   0,
        }}
      >
        <div className="flex items-center px-4" style={{ height: "56px" }}>
          {/* Hamburger — mobile only */}
          <button
            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg mr-1 flex-shrink-0"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
            style={{ background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#ffffff" }}
          >
            <Menu className="h-3.5 w-3.5" />
          </button>
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-1 flex-shrink-0">
            <img
              src="/wisright-logo.png"
              alt="Right Tracker"
              style={{ height: "26px", width: "auto", objectFit: "contain" }}
            />
            <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.3)" }} />
            <span className="text-sm font-bold tracking-tight" style={{ color: "#ffffff" }}>
              Right <span style={{ color: "rgba(255,255,255,0.75)" }}>Tracker</span>
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium ml-1"
              style={{ background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.85)" }}
            >
              Customer Portal
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Divider */}
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.25)" }} />

            {/* User avatar + name */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,0,0,0.18)", border: "1.5px solid rgba(255,255,255,0.3)" }}
              >
                <UserRound className="h-4 w-4" style={{ color: "#ffffff" }} />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-tight max-w-[110px] truncate" style={{ color: "#ffffff" }}>
                  {userName}
                </p>
                <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Customer
                </p>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ml-1"
              style={{ color: "#ffffff", border: "1px solid rgba(255,255,255,0.25)", background: "transparent" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.18)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar */}
        <aside
          className={[
            "fixed md:sticky top-[56px] left-0 z-40 md:z-auto",
            "h-[calc(100vh-56px)] overflow-y-auto",
            "transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
          style={{
            width:         "220px",
            flexShrink:    0,
            background:    "var(--rt-surface)",
            borderRight:   "1px solid var(--rt-border)",
            padding:       "12px 10px",
            display:       "flex",
            flexDirection: "column",
            gap:           "2px",
          }}
        >
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "10px",
                  padding:        "9px 12px",
                  borderRadius:   "8px",
                  textDecoration: "none",
                  fontWeight:     active ? 600 : 500,
                  fontSize:       "14px",
                  color:          active ? "#ffffff" : "var(--rt-text-2)",
                  background:     active ? "var(--rt-accent)" : "transparent",
                  transition:     "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "var(--rt-accent-bg)";
                    (e.currentTarget as HTMLElement).style.color      = "var(--rt-accent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color      = "var(--rt-text-2)";
                  }
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {label}
              </Link>
            );
          })}
        </aside>

        {/* Main content */}
        <main
          style={{
            flex:      1,
            background: "var(--rt-bg)",
            overflowY: "auto",
            minWidth:  0,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
