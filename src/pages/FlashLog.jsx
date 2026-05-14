import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const OLD_VERSIONS = ["86.00", "86.01", "91.01", "91.02"];
const NEW_VERSIONS = ["86.02", "91.03"];

function getIST() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export default function FlashLog() {
  const [vehicles, setVehicles] = useState([]);
  const [flashedIds, setFlashedIds] = useState(new Set());
  const [flashLogs, setFlashLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [oldVersion, setOldVersion] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [techName, setTechName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("flash_logs_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "flash_logs" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchAll() {
    const { data: vData } = await supabase.from("vehicles").select("*").order("vehicle_number");
    const { data: lData } = await supabase.from("flash_logs").select("*").order("flashed_at", { ascending: false });
    if (vData) setVehicles(vData);
    if (lData) {
      setFlashLogs(lData);
      setFlashedIds(new Set(lData.map((l) => l.vehicle_id)));
    }
  }

  const availableVehicles = vehicles.filter((v) => !flashedIds.has(v.id));
  const filteredVehicles = availableVehicles.filter((v) =>
    v.vehicle_number.toLowerCase().includes(search.toLowerCase())
  );

  function selectVehicle(v) {
    setSelectedVehicle(v);
    setSearch(v.vehicle_number);
    setShowDropdown(false);
  }

  async function handleSubmit() {
    if (!selectedVehicle) return setErrorMsg("Please select a vehicle.");
    if (!oldVersion) return setErrorMsg("Please select old software version.");
    if (!newVersion) return setErrorMsg("Please select new software version.");
    if (!techName.trim()) return setErrorMsg("Please enter technician name.");
    setErrorMsg("");
    setSubmitting(true);
    const istNow = new Date().toLocaleString("en-CA", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).replace(",", "");
    const { error } = await supabase.from("flash_logs").insert([{
      vehicle_id: selectedVehicle.id,
      vehicle_number: selectedVehicle.vehicle_number,
      zone: selectedVehicle.zone,
      customer_name: selectedVehicle.customer_name,
      old_version: oldVersion,
      new_version: newVersion,
      technician_name: techName.trim(),
      flashed_at: istNow,
    }]);
    setSubmitting(false);
    if (error) {
      setErrorMsg("Submission failed: " + error.message);
    } else {
      setSuccessMsg("Vehicle " + selectedVehicle.vehicle_number + " logged successfully!");
      setSelectedVehicle(null);
      setSearch("");
      setOldVersion("");
      setNewVersion("");
      setTechName("");
      setTimeout(() => setSuccessMsg(""), 4000);
    }
  }

  const zoneSummary = flashLogs.reduce((acc, log) => {
    acc[log.zone] = (acc[log.zone] || 0) + 1;
    return acc;
  }, {});

  function exportExcel() {
    const rows = flashLogs.map((l) => ({
      "Vehicle Number": l.vehicle_number,
      "Zone": l.zone,
      "Customer Name": l.customer_name,
      "Old Version": l.old_version,
      "New Version": l.new_version,
      "Technician": l.technician_name,
      "Flashed At (IST)": l.flashed_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flash Logs");
    XLSX.writeFile(wb, "IndofastFlashLog_" + new Date().toISOString().slice(0, 10) + ".xlsx");
  }

  const last10 = flashLogs.slice(0, 10);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ color: "#e0f0ff", fontSize: "1.5rem", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>
          Vehicle Software Flash Log
        </h1>
        <p style={{ color: "#3a5a7a", fontSize: "0.8rem", margin: "4px 0 0" }}>
          {getIST()} IST | {flashLogs.length} vehicles flashed | {availableVehicles.length} remaining
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        <Card title="New Flash Entry">
          <Label>Vehicle Number</Label>
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setSelectedVehicle(null); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search vehicle number..."
              style={inputStyle}
            />
            {showDropdown && search && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: "#0d1220", border: "1px solid #1e3a5a",
                borderRadius: 8, maxHeight: 200, overflowY: "auto", marginTop: 4,
              }}>
                {filteredVehicles.length === 0
                  ? (
                    <div style={{ padding: "10px 14px", color: "#3a5a7a", fontSize: "0.8rem" }}>
                      No available vehicles found
                    </div>
                  )
                  : filteredVehicles.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => selectVehicle(v)}
                      style={{ padding: "10px 14px", cursor: "pointer", color: "#b0d0f0", fontSize: "0.85rem", borderBottom: "1px solid #1e2d4a" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#1a2a3a"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ color: "#00d4ff", fontWeight: 600 }}>{v.vehicle_number}</span>
                      <span style={{ color: "#3a5a7a", marginLeft: 8 }}>{v.zone} | {v.customer_name}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
            <div>
              <Label>Zone</Label>
              <ReadonlyField value={selectedVehicle ? selectedVehicle.zone : ""} placeholder="Auto-filled" />
            </div>
            <div>
              <Label>Customer Name</Label>
              <ReadonlyField value={selectedVehicle ? selectedVehicle.customer_name : ""} placeholder="Auto-filled" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
            <div>
              <Label>Old Software Version</Label>
              <select value={oldVersion} onChange={(e) => setOldVersion(e.target.value)} style={selectStyle}>
                <option value="">Select...</option>
                {OLD_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>New Software Version</Label>
              <select value={newVersion} onChange={(e) => setNewVersion(e.target.value)} style={selectStyle}>
                <option value="">Select...</option>
                {NEW_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <Label>Technician Name</Label>
            <input
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              placeholder="Enter technician name..."
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: "0.75rem", padding: "8px 12px", background: "#0a1a2a", borderRadius: 6, border: "1px solid #1e2d4a", color: "#3a6a8a", fontSize: "0.75rem" }}>
            Flash timestamp will be auto-captured in IST at submission
          </div>

          {errorMsg && (
            <div style={{ marginTop: "0.75rem", color: "#ff6b6b", fontSize: "0.8rem", padding: "8px 12px", background: "#2a0a0a", borderRadius: 6, border: "1px solid #5a1a1a" }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ marginTop: "0.75rem", color: "#00d4aa", fontSize: "0.8rem", padding: "8px 12px", background: "#0a2a1a", borderRadius: 6, border: "1px solid #1a5a3a" }}>
              {successMsg}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              marginTop: "1rem", width: "100%",
              background: submitting ? "#1a2a3a" : "linear-gradient(135deg, #00d4ff, #0066ff)",
              border: "none", borderRadius: 8, padding: "12px",
              color: submitting ? "#3a5a7a" : "#fff",
              fontFamily: "inherit", fontWeight: 700, fontSize: "0.9rem",
              letterSpacing: "0.05em", cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "SUBMITTING..." : "SUBMIT FLASH LOG"}
          </button>
        </Card>

        <Card title="Flashed Vehicles by Zone">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
            <button
              onClick={exportExcel}
              style={{ background: "#0a2a1a", border: "1px solid #1a5a3a", color: "#00d4aa", borderRadius: 6, padding: "6px 14px", fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
            >
              Export Excel
            </button>
          </div>
          {Object.keys(zoneSummary).length === 0
            ? <div style={{ color: "#3a5a7a", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No data yet</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Object.entries(zoneSummary).sort().map(([zone, count]) => (
                  <div key={zone} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a1525", borderRadius: 6, border: "1px solid #1e2d4a" }}>
                    <span style={{ color: "#b0d0f0", fontSize: "0.85rem" }}>{zone}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ height: 4, borderRadius: 2, width: Math.max(30, (count / flashLogs.length) * 120) + "px", background: "linear-gradient(90deg, #00d4ff, #0066ff)" }} />
                      <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: "0.9rem", minWidth: 24, textAlign: "right" }}>{count}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", borderTop: "1px solid #1e2d4a", marginTop: "0.25rem" }}>
                  <span style={{ color: "#3a6a8a", fontSize: "0.8rem" }}>TOTAL</span>
                  <span style={{ color: "#e0f0ff", fontWeight: 700 }}>{flashLogs.length}</span>
                </div>
              </div>
            )
          }
        </Card>

        <Card title="Last 10 Vehicles Flashed">
          {last10.length === 0
            ? <div style={{ color: "#3a5a7a", fontSize: "0.8rem", textAlign: "center", padding: "1rem" }}>No flashes yet</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {last10.map((log) => (
                  <div key={log.id} style={{ padding: "8px 12px", background: "#0a1525", borderRadius: 6, border: "1px solid #1e2d4a", fontSize: "0.78rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#00d4ff", fontWeight: 700 }}>{log.vehicle_number}</span>
                      <span style={{ color: "#3a5a7a" }}>{log.flashed_at ? log.flashed_at.slice(0, 16) : ""}</span>
                    </div>
                    <div style={{ color: "#5a7a9a", marginTop: 2 }}>
                      {log.zone} | {log.customer_name} | <span style={{ color: "#7a9aba" }}>{log.old_version} to {log.new_version}</span> | {log.technician_name}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Card>

      </div>
    </div>
  </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "#0d1220", border: "1px solid #1e2d4a", borderRadius: 12, padding: "1.25rem" }}>
      <h2 style={{ color: "#7ab0d0", fontSize: "0.82rem", fontWeight: 700, margin: "0 0 1rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ color: "#3a6a8a", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function ReadonlyField({ value, placeholder }) {
  return (
    <div style={{ width: "100%", background: "#080f1a", border: "1px solid #1e3a5a", borderRadius: 8, padding: "10px 12px", color: value ? "#7ab0d0" : "#2a3a4a", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem", boxSizing: "border-box", minHeight: 42 }}>
      {value || placeholder}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "#080f1a", border: "1px solid #1e3a5a",
  borderRadius: 8, padding: "10px 12px", color: "#b0d0f0",
  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem",
  outline: "none", boxSizing: "border-box",
};

const selectStyle = {
  width: "100%", background: "#080f1a", border: "1px solid #1e3a5a",
  borderRadius: 8, padding: "10px 12px", color: "#b0d0f0",
  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.85rem",
  outline: "none", boxSizing: "border-box", cursor: "pointer", appearance: "none",
};
