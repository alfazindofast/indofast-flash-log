import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const OLD_VERSIONS = ["86.00", "86.01", "91.01", "91.02"];
const NEW_VERSIONS = ["86.02", "91.03"];

const COLORS = {
  bg: "#0f172a",
  card: "#111827",
  cardBorder: "#334155",

  text: "#f8fafc",
  textSoft: "#cbd5e1",
  textMuted: "#94a3b8",

  inputBg: "#1e293b",
  inputBorder: "#475569",

  primary: "#38bdf8",
  primaryDark: "#0284c7",

  success: "#22c55e",
  successBg: "#052e16",

  error: "#ef4444",
  errorBg: "#450a0a",

  rowBg: "#172033",
  rowHover: "#22304a",
};

function getIST() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flash_logs",
        },
        () => {
          fetchAll();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchAll() {
    const { data: vData } = await supabase
      .from("vehicles")
      .select("*")
      .order("vehicle_number");

    const { data: lData } = await supabase
      .from("flash_logs")
      .select("*")
      .order("flashed_at", { ascending: false });

    if (vData) setVehicles(vData);

    if (lData) {
      setFlashLogs(lData);
      setFlashedIds(new Set(lData.map((l) => l.vehicle_id)));
    }
  }

  const availableVehicles = vehicles.filter(
    (v) => !flashedIds.has(v.id)
  );

  const filteredVehicles = availableVehicles.filter((v) =>
    v.vehicle_number.toLowerCase().includes(search.toLowerCase())
  );

  function selectVehicle(v) {
    setSelectedVehicle(v);
    setSearch(v.vehicle_number);
    setShowDropdown(false);
  }

  async function handleSubmit() {
    if (!selectedVehicle)
      return setErrorMsg("Please select a vehicle.");

    if (!oldVersion)
      return setErrorMsg("Please select old software version.");

    if (!newVersion)
      return setErrorMsg("Please select new software version.");

    if (!techName.trim())
      return setErrorMsg("Please enter technician name.");

    setErrorMsg("");
    setSubmitting(true);

    const istNow = new Date()
      .toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(",", "");

    const { error } = await supabase
      .from("flash_logs")
      .insert([
        {
          vehicle_id: selectedVehicle.id,
          vehicle_number: selectedVehicle.vehicle_number,
          zone: selectedVehicle.zone,
          customer_name: selectedVehicle.customer_name,
          old_version: oldVersion,
          new_version: newVersion,
          technician_name: techName.trim(),
          flashed_at: istNow,
        },
      ]);

    setSubmitting(false);

    if (error) {
      setErrorMsg("Submission failed: " + error.message);
    } else {
      setSuccessMsg(
        `✓ Vehicle ${selectedVehicle.vehicle_number} logged successfully!`
      );

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
    const data = flashLogs.map((l) => ({
      "Vehicle Number": l.vehicle_number,
      Zone: l.zone,
      "Customer Name": l.customer_name,
      "Old Version": l.old_version,
      "New Version": l.new_version,
      Technician: l.technician_name,
      "Flashed At (IST)": l.flashed_at,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Flash Logs");

    XLSX.writeFile(
      wb,
      `IndofastFlashLog_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  }

  const last10 = flashLogs.slice(0, 10);

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        background: COLORS.bg,
        minHeight: "100vh",
        color: COLORS.text,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            color: COLORS.text,
            fontSize: "1.7rem",
            fontWeight: 700,
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          Vehicle Software Flash Log
        </h1>

        <p
          style={{
            color: COLORS.textMuted,
            fontSize: "0.9rem",
            margin: "6px 0 0",
          }}
        >
          {getIST()} IST · {flashLogs.length} vehicles flashed ·{" "}
          {availableVehicles.length} remaining
        </p>
      </div>

      {/* SINGLE COLUMN */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Flash Form */}
        <Card title="📋 New Flash Entry">
          {/* Vehicle Search */}
          <Label>Vehicle Number</Label>

          <div style={{ position: "relative" }} ref={dropdownRef}>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
                setSelectedVehicle(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search vehicle number..."
              style={inputStyle}
            />

            {showDropdown && search && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: COLORS.card,
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 8,
                  maxHeight: 200,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                {filteredVehicles.length === 0 ? (
                  <div
                    style={{
                      padding: "10px 14px",
                      color: COLORS.textMuted,
                      fontSize: "0.8rem",
                    }}
                  >
                    No available vehicles found
                  </div>
                ) : (
                  filteredVehicles.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => selectVehicle(v)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        color: COLORS.text,
                        fontSize: "0.85rem",
                        borderBottom: `1px solid ${COLORS.cardBorder}`,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          COLORS.rowHover)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          "transparent")
                      }
                    >
                      <span
                        style={{
                          color: COLORS.primary,
                          fontWeight: 700,
                        }}
                      >
                        {v.vehicle_number}
                      </span>

                      <span
                        style={{
                          color: COLORS.textMuted,
                          marginLeft: 8,
                        }}
                      >
                        {v.zone} · {v.customer_name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Auto-filled fields */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginTop: "0.75rem",
            }}
          >
            <div>
              <Label>Zone</Label>
              <ReadonlyField value={selectedVehicle?.zone || "—"} />
            </div>

            <div>
              <Label>Customer Name</Label>
              <ReadonlyField
                value={selectedVehicle?.customer_name || "—"}
              />
            </div>
          </div>

          {/* Versions */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginTop: "0.75rem",
            }}
          >
            <div>
              <Label>Old Software Version</Label>

              <select
                value={oldVersion}
                onChange={(e) => setOldVersion(e.target.value)}
                style={selectStyle}
              >
                <option value="">Select...</option>

                {OLD_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>New Software Version</Label>

              <select
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                style={selectStyle}
              >
                <option value="">Select...</option>

                {NEW_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Technician */}
          <div style={{ marginTop: "0.75rem" }}>
            <Label>Technician Name</Label>

            <input
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              placeholder="Enter technician name..."
              style={inputStyle}
            />
          </div>

          {/* Timestamp */}
          <div
            style={{
              marginTop: "0.75rem",
              padding: "10px 12px",
              background: "#111827",
              borderRadius: 8,
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textMuted,
              fontSize: "0.8rem",
            }}
          >
            ⏱ Flash timestamp will be auto-captured in IST at
            submission
          </div>

          {/* Messages */}
          {errorMsg && (
            <div
              style={{
                marginTop: "0.75rem",
                color: "#fca5a5",
                fontSize: "0.82rem",
                padding: "10px 12px",
                background: COLORS.errorBg,
                borderRadius: 8,
                border: `1px solid ${COLORS.error}`,
              }}
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginTop: "0.75rem",
                color: "#86efac",
                fontSize: "0.82rem",
                padding: "10px 12px",
                background: COLORS.successBg,
                borderRadius: 8,
                border: `1px solid ${COLORS.success}`,
              }}
            >
              {successMsg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              marginTop: "1rem",
              width: "100%",
              background: submitting
                ? "#334155"
                : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
              border: "none",
              borderRadius: 10,
              padding: "13px",
              color: "#fff",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: "0.92rem",
              letterSpacing: "0.05em",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {submitting
              ? "SUBMITTING..."
              : "⚡ SUBMIT FLASH LOG"}
          </button>
        </Card>

        {/* Summary */}
        <Card title="📊 Flashed Vehicles by Zone">
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "0.75rem",
            }}
          >
            <button
              onClick={exportExcel}
              style={{
                background: "#052e16",
                border: `1px solid ${COLORS.success}`,
                color: "#86efac",
                borderRadius: 8,
                padding: "8px 14px",
                fontFamily: "inherit",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ↓ Export Excel
            </button>
          </div>

          {Object.keys(zoneSummary).length === 0 ? (
            <div
              style={{
                color: COLORS.textMuted,
                fontSize: "0.85rem",
                textAlign: "center",
                padding: "1rem",
              }}
            >
              No data yet
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {Object.entries(zoneSummary)
                .sort()
                .map(([zone, count]) => (
                  <div
                    key={zone}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: COLORS.rowBg,
                      borderRadius: 8,
                      border: `1px solid ${COLORS.cardBorder}`,
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.text,
                        fontSize: "0.9rem",
                      }}
                    >
                      {zone}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          height: 5,
                          borderRadius: 2,
                          width: `${Math.max(
                            30,
                            (count / flashLogs.length) * 120
                          )}px`,
                          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
                        }}
                      />

                      <span
                        style={{
                          color: COLORS.primary,
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          minWidth: 24,
                          textAlign: "right",
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderTop: `1px solid ${COLORS.cardBorder}`,
                  marginTop: "0.25rem",
                }}
              >
                <span
                  style={{
                    color: COLORS.textMuted,
                    fontSize: "0.85rem",
                  }}
                >
                  TOTAL
                </span>

                <span
                  style={{
                    color: COLORS.text,
                    fontWeight: 700,
                  }}
                >
                  {flashLogs.length}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Last 10 */}
        <Card title="🕐 Last 10 Vehicles Flashed">
          {last10.length === 0 ? (
            <div
              style={{
                color: COLORS.textMuted,
                fontSize: "0.85rem",
                textAlign: "center",
                padding: "1rem",
              }}
            >
              No flashes yet
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {last10.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: "10px 12px",
                    background: COLORS.rowBg,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.cardBorder}`,
                    fontSize: "0.82rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.primary,
                        fontWeight: 700,
                      }}
                    >
                      {log.vehicle_number}
                    </span>

                    <span
                      style={{
                        color: COLORS.textMuted,
                      }}
                    >
                      {log.flashed_at?.slice(0, 16)}
                    </span>
                  </div>

                  <div
                    style={{
                      color: COLORS.textSoft,
                      marginTop: 4,
                    }}
                  >
                    {log.zone} · {log.customer_name} ·{" "}
                    <span
                      style={{
                        color: COLORS.primary,
                      }}
                    >
                      {log.old_version} → {log.new_version}
                    </span>{" "}
                    · {log.technician_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 14,
        padding: "1.25rem",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      }}
    >
      <h2
        style={{
          color: COLORS.primary,
          fontSize: "0.82rem",
          fontWeight: 700,
          margin: "0 0 1rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>

      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        color: COLORS.textSoft,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function ReadonlyField({ value }) {
  return (
    <div
      style={{
        ...inputStyle,
        color:
          value === "—"
            ? COLORS.textMuted
            : COLORS.primary,
        background: "#0b1220",
        cursor: "default",
        display: "flex",
        alignItems: "center",
        fontWeight: 600,
      }}
    >
      {value}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: COLORS.inputBg,
  border: `1px solid ${COLORS.inputBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  color: COLORS.text,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "0.9rem",
  outline: "none",
  boxSizing: "border-box",
  transition: "all 0.2s",
};

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23cbd5e1'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
};
