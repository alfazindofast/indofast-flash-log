import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const ADMIN_PASSWORD = "Admin@Indofast";

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  // Upload state
  const [vehicles, setVehicles] = useState([]);
  const [manualVehicle, setManualVehicle] = useState({ vehicle_number: "", zone: "", customer_name: "" });
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("manual"); // "manual" | "csv"

  // Flash logs for admin view
  const [flashLogs, setFlashLogs] = useState([]);

  function handleLogin() {
    if (pwInput === ADMIN_PASSWORD) {
      setAuthed(true);
      fetchData();
    } else {
      setPwError("Incorrect password.");
    }
  }

  async function fetchData() {
    const { data: vData } = await supabase.from("vehicles").select("*").order("vehicle_number");
    const { data: lData } = await supabase.from("flash_logs").select("*").order("flashed_at", { ascending: false });
    if (vData) setVehicles(vData);
    if (lData) setFlashLogs(lData);
  }

  async function addManualVehicle() {
    const { vehicle_number, zone, customer_name } = manualVehicle;
    if (!vehicle_number.trim() || !zone.trim() || !customer_name.trim()) {
      return setUploadError("All fields are required.");
    }
    setLoading(true);
    setUploadError("");
    const { error } = await supabase.from("vehicles").insert([{
      vehicle_number: vehicle_number.trim().toUpperCase(),
      zone: zone.trim(),
      customer_name: customer_name.trim(),
    }]);
    setLoading(false);
    if (error) {
      setUploadError("Error: " + (error.message.includes("duplicate") ? "Vehicle number already exists." : error.message));
    } else {
      setUploadMsg(`✓ Vehicle ${vehicle_number.toUpperCase()} added.`);
      setManualVehicle({ vehicle_number: "", zone: "", customer_name: "" });
      fetchData();
      setTimeout(() => setUploadMsg(""), 3000);
    }
  }

  async function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setUploadError("");
    setUploadMsg("");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Expect header: Vehicle Number, Zone, Customer Name
        const dataRows = rows.slice(1).filter((r) => r[0] && r[1] && r[2]);
        const toInsert = dataRows.map((r) => ({
          vehicle_number: String(r[0]).trim().toUpperCase(),
          zone: String(r[1]).trim(),
          customer_name: String(r[2]).trim(),
        }));

        if (toInsert.length === 0) {
          setUploadError("No valid rows found. Ensure columns: Vehicle Number, Zone, Customer Name");
          setLoading(false);
          return;
        }

        const { error } = await supabase.from("vehicles").upsert(toInsert, { onConflict: "vehicle_number" });
        setLoading(false);
        if (error) {
          setUploadError("Upload error: " + error.message);
        } else {
          setUploadMsg(`✓ ${toInsert.length} vehicles uploaded successfully.`);
          fetchData();
          setTimeout(() => setUploadMsg(""), 4000);
        }
      } catch (err) {
        setUploadError("Failed to parse file: " + err.message);
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function deleteVehicle(id, vehicleNumber) {
    if (!window.confirm(`Delete vehicle ${vehicleNumber}? This cannot be undone.`)) return;
    await supabase.from("vehicles").delete().eq("id", id);
    fetchData();
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Vehicle Number", "Zone", "Customer Name"],
      ["MH01AB1234", "North Zone", "Customer Name Example"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
    XLSX.writeFile(wb, "VehicleUploadTemplate.xlsx");
  }

  if (!authed) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <div style={{
          background: "#0d1220", border: "1px solid #1e2d4a", borderRadius: 16,
          padding: "2.5rem", width: "100%", maxWidth: 360, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: "1rem" }}>🔐</div>
          <h2 style={{ color: "#e0f0ff", fontSize: "1.1rem", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>Admin Access</h2>
          <p style={{ color: "#3a5a7a", fontSize: "0.78rem", margin: "0 0 1.5rem" }}>Enter admin password to continue</p>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Password"
            style={{
              width: "100%", background: "#080f1a", border: "1px solid #1e3a5a",
              borderRadius: 8, padding: "10px 12px", color: "#b0d0f0",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.9rem",
              outline: "none", boxSizing: "border-box", marginBottom: "0.75rem",
            }}
          />
          {pwError && <div style={{ color: "#ff6b6b", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{pwError}</div>}
          <button onClick={handleLogin} style={{
            width: "100%", background: "linear-gradient(135deg, #00d4ff, #0066ff)",
            border: "none", borderRadius: 8, padding: "10px",
            color: "#fff", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
            fontSize: "0.85rem", letterSpacing: "0.05em", cursor: "pointer",
          }}>
            UNLOCK
          </button>
        </div>
      </div>
    );
  }

  const flashedIds = new Set(flashLogs.map((l) => l.vehicle_id));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ color: "#e0f0ff", fontSize: "1.5rem", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>
          Admin Panel
        </h1>
        <p style={{ color: "#3a5a7a", fontSize: "0.8rem", margin: "4px 0 0" }}>
          {vehicles.length} vehicles registered · {flashedIds.size} flashed · {vehicles.length - flashedIds.size} pending
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

        {/* Upload Section */}
        <div>
          <AdminCard title="🚗 Add Vehicles">

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              {["manual", "csv"].map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, background: tab === t ? "#00d4ff22" : "transparent",
                  border: tab === t ? "1px solid #00d4ff55" : "1px solid #1e3a5a",
                  color: tab === t ? "#00d4ff" : "#3a5a7a",
                  padding: "8px", borderRadius: 6, cursor: "pointer",
                  fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600,
                  letterSpacing: "0.05em",
                }}>
                  {t === "manual" ? "✏️ Manual Entry" : "📁 CSV / Excel Upload"}
                </button>
              ))}
            </div>

            {tab === "manual" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <ALabel>Vehicle Number</ALabel>
                  <input value={manualVehicle.vehicle_number}
                    onChange={(e) => setManualVehicle({ ...manualVehicle, vehicle_number: e.target.value })}
                    placeholder="e.g. MH01AB1234" style={aInputStyle} />
                </div>
                <div>
                  <ALabel>Zone</ALabel>
                  <input value={manualVehicle.zone}
                    onChange={(e) => setManualVehicle({ ...manualVehicle, zone: e.target.value })}
                    placeholder="e.g. North Zone" style={aInputStyle} />
                </div>
                <div>
                  <ALabel>Customer Name</ALabel>
                  <input value={manualVehicle.customer_name}
                    onChange={(e) => setManualVehicle({ ...manualVehicle, customer_name: e.target.value })}
                    placeholder="Customer name" style={aInputStyle} />
                </div>
                <button onClick={addManualVehicle} disabled={loading} style={{
                  background: "linear-gradient(135deg, #00d4ff, #0066ff)",
                  border: "none", borderRadius: 8, padding: "10px",
                  color: "#fff", fontFamily: "inherit", fontWeight: 700,
                  fontSize: "0.85rem", cursor: loading ? "not-allowed" : "pointer",
                  letterSpacing: "0.05em",
                }}>
                  {loading ? "ADDING..." : "ADD VEHICLE"}
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: "#5a7a9a", fontSize: "0.8rem", marginTop: 0 }}>
                  Upload a CSV or Excel file with columns: <strong style={{ color: "#7ab0d0" }}>Vehicle Number, Zone, Customer Name</strong>. Existing vehicles will be updated.
                </p>
                <button onClick={downloadTemplate} style={{
                  width: "100%", background: "#0a1525", border: "1px dashed #1e3a5a",
                  borderRadius: 8, padding: "10px", color: "#3a6a8a",
                  fontFamily: "inherit", fontSize: "0.8rem", cursor: "pointer",
                  marginBottom: "0.75rem",
                }}>
                  ↓ Download Template
                </button>
                <label style={{
                  display: "block", width: "100%", background: "linear-gradient(135deg, #00d4ff22, #0066ff22)",
                  border: "1px dashed #00d4ff55", borderRadius: 8, padding: "20px",
                  color: "#00d4ff", fontFamily: "inherit", fontSize: "0.82rem", cursor: "pointer",
                  textAlign: "center", boxSizing: "border-box",
                }}>
                  {loading ? "Uploading..." : "📁 Click to select CSV or Excel file"}
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleCSVUpload} style={{ display: "none" }} />
                </label>
              </div>
            )}

            {uploadError && <div style={{ marginTop: "0.75rem", color: "#ff6b6b", fontSize: "0.8rem", padding: "8px 12px", background: "#2a0a0a", borderRadius: 6 }}>{uploadError}</div>}
            {uploadMsg && <div style={{ marginTop: "0.75rem", color: "#00d4aa", fontSize: "0.8rem", padding: "8px 12px", background: "#0a2a1a", borderRadius: 6 }}>{uploadMsg}</div>}
          </AdminCard>
        </div>

        {/* Vehicle List */}
        <div>
          <AdminCard title={`📋 Vehicle Registry (${vehicles.length})`}>
            <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {vehicles.length === 0 ? (
                <div style={{ color: "#3a5a7a", fontSize: "0.8rem", textAlign: "center", padding: "2rem" }}>No vehicles registered yet</div>
              ) : vehicles.map((v) => {
                const isFlashed = flashedIds.has(v.id);
                return (
                  <div key={v.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px", background: "#0a1525", borderRadius: 6,
                    border: `1px solid ${isFlashed ? "#1a3a1a" : "#1e2d4a"}`,
                  }}>
                    <div>
                      <span style={{ color: isFlashed ? "#3a8a5a" : "#00d4ff", fontWeight: 700, fontSize: "0.82rem" }}>
                        {v.vehicle_number}
                      </span>
                      {isFlashed && <span style={{ color: "#2a6a4a", fontSize: "0.7rem", marginLeft: 6 }}>✓ FLASHED</span>}
                      <div style={{ color: "#3a5a7a", fontSize: "0.72rem" }}>{v.zone} · {v.customer_name}</div>
                    </div>
                    {!isFlashed && (
                      <button onClick={() => deleteVehicle(v.id, v.vehicle_number)} style={{
                        background: "transparent", border: "1px solid #3a1a1a",
                        color: "#5a2a2a", borderRadius: 4, padding: "4px 8px",
                        cursor: "pointer", fontSize: "0.7rem", fontFamily: "inherit",
                      }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </AdminCard>
        </div>

        {/* All Flash Logs */}
        <div style={{ gridColumn: "1 / -1" }}>
          <AdminCard title={`⚡ All Flash Logs (${flashLogs.length})`}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    {["Vehicle", "Zone", "Customer", "Old Ver", "New Ver", "Technician", "Flashed At (IST)"].map((h) => (
                      <th key={h} style={{ color: "#3a6a8a", padding: "6px 10px", textAlign: "left", borderBottom: "1px solid #1e2d4a", fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flashLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #1e2d4a" }}>
                      <td style={{ padding: "7px 10px", color: "#00d4ff", fontWeight: 700 }}>{log.vehicle_number}</td>
                      <td style={{ padding: "7px 10px", color: "#7ab0d0" }}>{log.zone}</td>
                      <td style={{ padding: "7px 10px", color: "#7ab0d0" }}>{log.customer_name}</td>
                      <td style={{ padding: "7px 10px", color: "#ff9a4a" }}>{log.old_version}</td>
                      <td style={{ padding: "7px 10px", color: "#00d4aa" }}>{log.new_version}</td>
                      <td style={{ padding: "7px 10px", color: "#b0d0f0" }}>{log.technician_name}</td>
                      <td style={{ padding: "7px 10px", color: "#5a7a9a", whiteSpace: "nowrap" }}>{log.flashed_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {flashLogs.length === 0 && (
                <div style={{ color: "#3a5a7a", textAlign: "center", padding: "2rem", fontSize: "0.8rem" }}>No flash logs yet</div>
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

function AdminCard({ title, children }) {
  return (
    <div style={{ background: "#0d1220", border: "1px solid #1e2d4a", borderRadius: 12, padding: "1.25rem" }}>
      <h2 style={{ color: "#7ab0d0", fontSize: "0.82rem", fontWeight: 700, margin: "0 0 1rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</h2>
      {children}
    </div>
  );
}

function ALabel({ children }) {
  return <div style={{ color: "#3a6a8a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>{children}</div>;
}

const aInputStyle = {
  width: "100%", background: "#080f1a", border: "1px solid #1e3a5a",
  borderRadius: 8, padding: "10px 12px", color: "#b0d0f0",
  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem",
  outline: "none", boxSizing: "border-box",
};
