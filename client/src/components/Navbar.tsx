import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { ROLES, type UserRole } from "@tms/core";
import { LogOut, UserRound, Menu } from "lucide-react";

function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const isAdmin = (session?.user as { role: UserRole } | undefined)?.role === ROLES.ADMIN;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header
      style={{
        background:   "linear-gradient(135deg, #0a0000 0%, #660000 35%, #990000 70%, #cc0000 100%)",
        borderBottom: "none",
        position:     "sticky",
        top:          0,
        zIndex:       50,
        flexShrink:   0,
      }}
    >
      <div className="flex items-center px-4" style={{ height: "64px" }}>

        {/* Hamburger — mobile only */}
        <button
          className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg mr-1 flex-shrink-0"
          onClick={onMenuClick}
          aria-label="Toggle menu"
          style={{ background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#ffffff" }}
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Logo — flex-1 pushes right side to far edge */}
        <Link
          to="/"
          className="flex items-center gap-2.5 flex-1 flex-shrink-0"
          style={{ textDecoration: "none" }}
        >
          <div className="flex items-center justify-center rounded-lg px-5 py-1.5" style={{ background: "#ffffff" }}>
            <img
              src="/wisright-logo.png"
              alt="Right Tracker"
              style={{ height: "38px", width: "auto", objectFit: "contain" }}
            />
          </div>
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.3)" }} />
          <span className="text-sm font-bold" style={{ color: "#ffffff", whiteSpace: "nowrap" }}>
            Right Tracker
            <span className="hidden sm:inline font-normal text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>— WisRight Support Tool</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Divider */}
          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.25)" }} />

          {/* User avatar + name */}
          {session?.user?.name && (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,0,0,0.18)", border: "1.5px solid rgba(255,255,255,0.3)" }}
              >
                <UserRound className="h-4 w-4" style={{ color: "#ffffff" }} />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-tight max-w-[110px] truncate" style={{ color: "#ffffff" }}>
                  {session.user.name}
                </p>
                <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {isAdmin ? "Administrator" : "Agent"}
                </p>
              </div>
            </div>
          )}

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
  );
}

export default Navbar;
