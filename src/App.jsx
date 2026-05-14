import { useState } from "react";
import FlashLog from "./pages/FlashLog";
import Admin from "./pages/Admin";

export default function App() {
  const [page, setPage] = useState("main");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", fontFamily: "'IBM Plex Mono', monospace" }}>
      <nav style={{
        background: "#0d1220",
        borderBottom: "1px solid #1e2d4a",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "56px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: "linear-gradient(135deg, #00d4ff, #0066ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>⚡</div>
          <span style={{ color: "#e0f0ff", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.05em" }}>
            INDOFAST <span style={{ color: "#00d4ff" }}>FLASH</span> LOG
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <NavBtn active={page === "main"} onClick={() => setPage("main")}>Dashboard</NavBtn>
          <NavBtn active={page === "admin"} onClick={() => setPage("admin")}>Admin</NavBtn>
        </div>
      </nav>

      {page === "main" ? <FlashLog /> : <Admin />}
    </div>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#00d4ff22" : "transparent",
      border: active ? "1px solid #00d4ff55" : "1px solid transparent",
      color: active ? "#00d4ff" : "#5a7a9a",
      padding: "6px 16px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: "0.78rem",
      fontFamily: "inherit",
      fontWeight: 600,
      letterSpacing: "0.05em",
      transition: "all 0.2s",
    }}>{children}</button>
  );
}
