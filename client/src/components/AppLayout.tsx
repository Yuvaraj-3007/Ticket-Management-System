import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar />
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
