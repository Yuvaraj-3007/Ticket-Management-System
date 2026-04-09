import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Users, BarChart2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";

const NAV_ITEMS = [
  { path: "/",        label: "Dashboard", icon: LayoutDashboard, exact: true  },
  { path: "/tickets", label: "Tickets",   icon: Inbox,           exact: false },
];

const ADMIN_ITEMS = [
  { path: "/users",     label: "Users",     icon: Users,     exact: false },
  { path: "/analytics", label: "Analytics", icon: BarChart2, exact: false },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
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
      className={[
        "fixed md:sticky top-[56px] left-0 z-40 md:z-auto",
        "h-[calc(100vh-56px)] overflow-y-auto",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
      style={{
        width:          "220px",
        flexShrink:     0,
        background:     "var(--rt-surface)",
        borderRight:    "1px solid var(--rt-border)",
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
            onClick={onClose}
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
