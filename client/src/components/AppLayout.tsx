import { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar onMenuClick={() => setSidebarOpen((o) => !o)} />
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          style={{
            flex:       1,
            background: "var(--rt-bg)",
            overflowY:  "auto",
            minWidth:   0,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
