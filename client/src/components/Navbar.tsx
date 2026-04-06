import { useNavigate, useLocation, Link } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";
import { LogOut, Sun, Moon, UserRound } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();

  const isAdmin = (session?.user as { role: UserRole } | undefined)?.role === ROLES.ADMIN;
  const isDark = theme === "dark";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isActive = (path: string, exact: boolean) =>
    exact
      ? location.pathname === path
      : location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const navLinks = [
    { path: "/",        label: "Dashboard", exact: true  },
    { path: "/tickets", label: "Tickets",   exact: false },
    ...(isAdmin ? [{ path: "/users", label: "Users", exact: false }] : []),
  ];

  return (
    <header
      style={{
        background: "var(--rt-surface)",
        borderBottom: "1px solid var(--rt-border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center" style={{ height: "56px" }}>

        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 mr-8 flex-shrink-0"
          style={{ textDecoration: "none" }}
        >
          <img
            src="/wisright-logo.png"
            alt="Right Tracker"
            style={{
              height: "26px",
              width: "auto",
              objectFit: "contain",
              filter: "none",
            }}
          />
          <div style={{ width: "1px", height: "18px", background: "var(--rt-border-2)" }} />
          <span className="text-sm font-bold tracking-tight" style={{ color: "var(--rt-text-1)" }}>
            Right <span style={{ color: "var(--rt-accent)" }}>Tracker</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map(({ path, label, exact }) => {
            const active = isActive(path, exact);
            return (
              <Link
                key={path}
                to={path}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
                style={{
                  color:      active ? "var(--rt-accent)"    : "var(--rt-text-3)",
                  background: active ? "var(--rt-accent-bg)" : "transparent",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color      = "var(--rt-text-2)";
                    (e.currentTarget as HTMLElement).style.background = "var(--rt-surface-2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color      = "var(--rt-text-3)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "var(--rt-surface-2)",
              border:     "1px solid var(--rt-border)",
              color:      "var(--rt-text-2)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-accent)";
              (e.currentTarget as HTMLElement).style.color       = "var(--rt-accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-border)";
              (e.currentTarget as HTMLElement).style.color       = "var(--rt-text-2)";
            }}
          >
            {isDark
              ? <Sun  className="h-3.5 w-3.5" />
              : <Moon className="h-3.5 w-3.5" />
            }
          </button>

          {/* Divider */}
          <div style={{ width: "1px", height: "20px", background: "var(--rt-border)" }} />

          {/* User avatar + name */}
          {session?.user?.name && (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: "var(--rt-accent-bg)",
                  border: "1.5px solid var(--rt-accent)",
                }}
              >
                <UserRound className="h-4 w-4" style={{ color: "var(--rt-accent)" }} />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-tight max-w-[110px] truncate" style={{ color: "var(--rt-text-1)" }}>
                  {session.user.name}
                </p>
                <p className="text-[10px] leading-tight" style={{ color: "var(--rt-text-3)" }}>
                  {isAdmin ? "Administrator" : "Agent"}
                </p>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ml-1"
            style={{
              color:      "var(--rt-text-3)",
              border:     "1px solid var(--rt-border)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color       = "#EF4444";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)";
              (e.currentTarget as HTMLElement).style.background  = "rgba(239,68,68,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color       = "var(--rt-text-3)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--rt-border)";
              (e.currentTarget as HTMLElement).style.background  = "transparent";
            }}
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
