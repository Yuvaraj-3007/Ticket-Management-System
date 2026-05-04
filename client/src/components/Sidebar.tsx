import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Inbox, Users, BarChart2, Building2, Ticket } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";

const NAV_ITEMS = [
  { path: "/",                 label: "Dashboard",  icon: LayoutDashboard, exact: true  },
  { path: "/tickets",          label: "Tickets",    icon: Inbox,           exact: false },
  { path: "/internal/tickets", label: "My Tickets", icon: Ticket,          exact: false },
];

const ADMIN_ITEMS = [
  { path: "/users",     label: "Users",     icon: Users,     exact: false },
  { path: "/clients",   label: "Clients",   icon: Building2, exact: false },
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
        width:          "240px",
        flexShrink:     0,
        background:     "#ffffff",
        borderRight:    "1px solid #ffd0d0",
        boxShadow:      "2px 0 16px rgba(204,0,0,0.08)",
        padding:        "16px 12px",
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
              paddingLeft:    "9px",
              borderRadius:   "8px",
              textDecoration: "none",
              fontWeight:     active ? 700 : 500,
              fontSize:       "14px",
              color:          active ? "#990000" : "#4a0a0a",
              background:     active ? "rgba(204,0,0,0.08)" : "transparent",
              borderLeft:     active ? "3px solid #ca8a04" : "3px solid transparent",
              transition:     "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = "rgba(204,0,0,0.05)";
                (e.currentTarget as HTMLElement).style.color      = "#990000";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color      = "#4a0a0a";
              }
            }}
          >
            <Icon size={18} style={{ flexShrink: 0, color: active ? "#ca8a04" : "#9ca3af" }} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
