import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Users } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";

const NAV_ITEMS = [
  { path: "/",        label: "Dashboard", icon: LayoutDashboard, exact: true  },
  { path: "/tickets", label: "Tickets",   icon: Inbox,           exact: false },
];

const ADMIN_ITEMS = [
  { path: "/users", label: "Users", icon: Users, exact: false },
];

export default function Sidebar() {
  const location = useLocation();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role: UserRole } | undefined)?.role === ROLES.ADMIN;

  const isActive = (path: string, exact: boolean) =>
    exact
      ? location.pathname === path
      : location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const allItems = [...NAV_ITEMS, ...(isAdmin ? ADMIN_ITEMS : [])];

  return (
    <aside
      style={{
        width:          "220px",
        flexShrink:     0,
        background:     "var(--rt-surface)",
        borderRight:    "1px solid var(--rt-border)",
        position:       "sticky",
        top:            "56px",
        height:         "calc(100vh - 56px)",
        overflowY:      "auto",
        padding:        "12px 10px",
        display:        "flex",
        flexDirection:  "column",
        gap:            "2px",
      }}
    >
      {allItems.map(({ path, label, icon: Icon, exact }) => {
        const active = isActive(path, exact);
        return (
          <Link
            key={path}
            to={path}
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
  );
}
