import { useState, useCallback } from "react"

// ─── Configuration des types de formulaires CLIDATA ─────────────────────────
export const CLIDATA_FORMS = {
  temperature_air: {
    label: "Température sous abris",
    unit: "×10 °C",
    columns: [
      { key: "T00", label: "TEMP 00:00" },
      { key: "T03", label: "TEMP 03:00" },
      { key: "T06", label: "TEMP 06:00" },
      { key: "T09", label: "TEMP 09:00" },
      { key: "T12", label: "TEMP 12:00" },
      { key: "T15", label: "TEMP 15:00" },
      { key: "T18", label: "TEMP 18:00" },
      { key: "T21", label: "TEMP 21:00" },
    ],
    computed: [
      { key: "TMIN", label: "MIN" },
      { key: "TMAX", label: "MAX" },
    ]
  },
  thermometre_mouille: {
    label: "Thermomètre mouillé",
    unit: "×10 °C",
    columns: [
      { key: "TW00", label: "TWET 00:00" },
      { key: "TW03", label: "TWET 03:00" },
      { key: "TW06", label: "TWET 06:00" },
      { key: "TW09", label: "TWET 09:00" },
      { key: "TW12", label: "TWET 12:00" },
      { key: "TW15", label: "TWET 15:00" },
      { key: "TW18", label: "TWET 18:00" },
      { key: "TW21", label: "TWET 21:00" },
    ],
    computed: []
  },
  precipitation_evaporation: {
    label: "Précipitations & Évaporation",
    unit: "×10 mm",
    columns: [
      { key: "RR06", label: "RR 06:00" },
      { key: "EVA06", label: "EVA 06:00" },
    ],
    computed: []
  },
  vapeur_pression_humidite: {
    label: "Tension vapeur / Humidité / Pression",
    unit: "×10 hPa / %",
    columns: [
      { key: "TV00", label: "TV 00:00" },
      { key: "TV03", label: "TV 03:00" },
      { key: "TV06", label: "TV 06:00" },
      { key: "TV09", label: "TV 09:00" },
      { key: "TV12", label: "TV 12:00" },
      { key: "TV18", label: "TV 18:00" },
      { key: "TV21", label: "TV 21:00" },
      { key: "HR",   label: "HR Max %" },
    ],
    computed: []
  },
  tableau_climatologique_mensuel: {
    label: "Données climatologiques mensuelles",
    unit: "×10 °C / mm",
    columns: [
      { key: "TN",   label: "TN (Min)" },
      { key: "TX",   label: "TX (Max)" },
      { key: "TMOY", label: "TMOY" },
      { key: "RR",   label: "RR (mm)" },
      { key: "PICHE",label: "PICHE" },
      { key: "INSOL",label: "Insolation" },
    ],
    computed: []
  }
}

// Stations Togo réelles depuis le screenshot CLIDATA
export const STATIONS_TOGO = [
  { id: "TG1M001S", name: "Lomé Aéro" },
  { id: "TG1M002S", name: "Tabligbo" },
  { id: "TG1M003S", name: "Station pilote" },
  { id: "TG1P003S", name: "Atakpamé" },
  { id: "TG1P004S", name: "Kouma Konda" },
  { id: "TG1P010S", name: "Notsé" },
  { id: "TG1S008S", name: "Mango" },
  { id: "TG1S009S", name: "Dapaong" },
  { id: "TG1S012S", name: "Mandouri" },
  { id: "DGMN_LOME", name: "DGMN Lomé (Surface)" },
]

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

// Couleurs CLIDATA — fidèle au screenshot (fond jaune/or, cellules blanches/gris)
const CLR = {
  headerBg: "#c8b97a",       // doré CLIDATA
  headerText: "#1a1a1a",
  rowOdd: "#ffffff",
  rowEven: "#f0f0f0",
  cellFlagged: "#ffcccc",
  cellEdited: "#fffacc",
  cellOk: "#ccffcc",
  border: "#888888",
  selectedRow: "#d0e4ff",
  totalRow: "#e8e0c0",
  inputFocus: "#fff3b0",
}

function computeStats(rowVals) {
  const nums = Object.values(rowVals).filter(v => v !== null && v !== "" && !isNaN(Number(v))).map(Number)
  if (nums.length === 0) return { min: null, max: null, mean: null }
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    mean: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
  }
}

// ─── Cellule éditable individuelle ───────────────────────────────────────────
function Cell({ value, flagged, corrected, readOnly, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")

  const bg = corrected ? CLR.cellEdited : flagged ? CLR.cellFlagged : "transparent"

  if (readOnly) {
    return (
      <td style={{
        padding: "2px 6px", textAlign: "right", fontFamily: "monospace",
        fontSize: 13, fontWeight: 600,
        background: bg, border: `1px solid ${CLR.border}`,
        minWidth: 68, color: flagged ? "#cc0000" : "#000"
      }}>
        {value ?? ""}
      </td>
    )
  }

  function commit(v) {
    const parsed = v === "" ? null : parseFloat(v)
    onSave(parsed)
    setEditing(false)
  }

  return (
    <td
      style={{
        padding: 0, border: `1px solid ${CLR.border}`,
        minWidth: 68, background: bg,
      }}
      onDoubleClick={() => !readOnly && setEditing(true)}
    >
      {editing ? (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Tab") commit(draft)
            if (e.key === "Escape") setEditing(false)
          }}
          style={{
            width: "100%", border: "none", outline: "2px solid #1a56db",
            padding: "2px 6px", fontFamily: "monospace", fontSize: 13,
            fontWeight: 600, textAlign: "right", background: CLR.inputFocus,
          }}
        />
      ) : (
        <div
          style={{
            padding: "3px 6px", textAlign: "right",
            fontFamily: "monospace", fontSize: 13, fontWeight: 600,
            color: flagged ? "#cc0000" : corrected ? "#0055cc" : "#000",
            cursor: "text", minHeight: 22,
          }}
          onClick={() => setEditing(true)}
        >
          {value !== null && value !== undefined && value !== "" ? value : ""}
        </div>
      )}
    </td>
  )
}

// ─── Composant principal : grille CLIDATA ─────────────────────────────────────
export default function CliDataGrid({
  data,           // { [day]: { [col]: { value, confidence, flagged, corrected } } }
  formType,
  station,
  year,
  month,
  onCellChange,
  readOnly = false,
}) {
  const [selectedRow, setSelectedRow] = useState(null)
  const form = CLIDATA_FORMS[formType] || CLIDATA_FORMS.temperature_air
  const cols = form.columns
  const computed = form.computed

  // Calcul des totaux/moyennes par colonne
  function colStats(colKey) {
    const vals = DAYS.map(d => {
      const cell = data?.[d]?.[colKey]
      return cell?.value !== null && cell?.value !== undefined ? Number(cell.value) : null
    }).filter(v => v !== null)
    if (vals.length === 0) return { total: "", mean: "" }
    const total = vals.reduce((a, b) => a + b, 0)
    return {
      total: total.toFixed(0),
      mean: (total / vals.length).toFixed(1)
    }
  }

  // Nb jours avec données
  const daysWithData = DAYS.filter(d =>
    cols.some(c => data?.[d]?.[c.key]?.value !== null && data?.[d]?.[c.key]?.value !== undefined)
  ).length

  const flaggedCells = DAYS.reduce((acc, d) =>
    acc + cols.filter(c => data?.[d]?.[c.key]?.flagged).length, 0)

  return (
    <div style={{ fontFamily: "monospace", fontSize: 13 }}>
      {/* ── Barre de titre style CLIDATA ── */}
      <div style={{
        background: CLR.headerBg, borderRadius: "4px 4px 0 0",
        padding: "6px 12px", border: `1px solid ${CLR.border}`,
        borderBottom: "none", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 16
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", letterSpacing: 0.3 }}>
            {form.label}
          </span>
          <span style={{
            background: "#1a1a1a", color: CLR.headerBg,
            padding: "2px 10px", borderRadius: 3, fontWeight: 700, fontSize: 13
          }}>
            STATION: {station || "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>
            YEAR: <span style={{ background: "#fff", padding: "1px 8px", border: "1px solid #999", borderRadius: 2 }}>{year}</span>
          </span>
          <span style={{ fontWeight: 600 }}>
            MONTH: <span style={{ background: "#fff", padding: "1px 8px", border: "1px solid #999", borderRadius: 2 }}>
              {String(month).padStart(2, "0")} — {MONTH_NAMES[(month - 1)] || ""}
            </span>
          </span>
          <span style={{ fontSize: 11, color: "#555" }}>{form.unit}</span>
        </div>
      </div>

      {/* ── Info bar ── */}
      <div style={{
        background: "#e8dfc0", border: `1px solid ${CLR.border}`, borderBottom: "none",
        padding: "3px 12px", display: "flex", gap: 24, fontSize: 11, color: "#555"
      }}>
        <span>Jours saisis : <b>{daysWithData}/31</b></span>
        <span>Champs signalés (confiance &lt;75%) : <b style={{ color: flaggedCells > 0 ? "#cc0000" : "#059669" }}>{flaggedCells}</b></span>
        {!readOnly && <span style={{ color: "#666" }}>Double-clic ou clic pour éditer une cellule</span>}
      </div>

      {/* ── Grille principale ── */}
      <div style={{ overflowX: "auto", border: `1px solid ${CLR.border}` }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: cols.length * 72 + 60 }}>
          <thead>
            <tr>
              {/* Colonne numéro de jour */}
              <th style={{
                background: CLR.headerBg, border: `1px solid ${CLR.border}`,
                padding: "4px 10px", textAlign: "center", width: 44,
                fontSize: 12, fontWeight: 700, color: CLR.headerText, position: "sticky", left: 0, zIndex: 2
              }}>
                Jour
              </th>
              {cols.map(col => (
                <th key={col.key} style={{
                  background: CLR.headerBg, border: `1px solid ${CLR.border}`,
                  padding: "4px 6px", textAlign: "center", whiteSpace: "nowrap",
                  fontSize: 12, fontWeight: 700, color: CLR.headerText, minWidth: 72
                }}>
                  {col.label}
                </th>
              ))}
              {computed.map(c => (
                <th key={c.key} style={{
                  background: "#b8a660", border: `1px solid ${CLR.border}`,
                  padding: "4px 6px", textAlign: "center",
                  fontSize: 12, fontWeight: 700, color: CLR.headerText, minWidth: 60
                }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, idx) => {
              const rowData = data?.[day] || {}
              const isEven = idx % 2 === 1
              const isSelected = selectedRow === day
              const rowBg = isSelected ? CLR.selectedRow : isEven ? CLR.rowEven : CLR.rowOdd

              // Calcul min/max pour la ligne
              const rowVals = {}
              cols.forEach(c => {
                const v = rowData[c.key]?.value
                if (v !== null && v !== undefined) rowVals[c.key] = v
              })
              const stats = computeStats(rowVals)

              return (
                <tr
                  key={day}
                  style={{ background: rowBg }}
                  onClick={() => setSelectedRow(selectedRow === day ? null : day)}
                >
                  {/* N° de jour — style CLIDATA : aligné à gauche, fond plus foncé */}
                  <td style={{
                    padding: "2px 8px", textAlign: "right",
                    background: isSelected ? "#a0c4ff" : isEven ? "#ddd" : "#eee",
                    border: `1px solid ${CLR.border}`, fontWeight: 700, fontSize: 13,
                    color: "#222", position: "sticky", left: 0, zIndex: 1
                  }}>
                    {day}
                  </td>

                  {cols.map(col => {
                    const cell = rowData[col.key] || {}
                    return (
                      <Cell
                        key={col.key}
                        value={cell.value}
                        flagged={cell.flagged}
                        corrected={cell.corrected}
                        readOnly={readOnly}
                        onSave={val => onCellChange?.(day, col.key, val)}
                      />
                    )
                  })}

                  {/* Colonnes calculées MIN/MAX */}
                  {computed.map(c => (
                    <td key={c.key} style={{
                      padding: "2px 6px", textAlign: "right",
                      background: "#f5f0d8", border: `1px solid ${CLR.border}`,
                      fontFamily: "monospace", fontSize: 12, fontWeight: 600,
                      color: "#444"
                    }}>
                      {c.key === "TMIN" && stats.min !== null ? stats.min : ""}
                      {c.key === "TMAX" && stats.max !== null ? stats.max : ""}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>

          {/* ── Ligne TOTAL / MOYENNE ── */}
          <tfoot>
            <tr>
              <td style={{
                background: CLR.totalRow, border: `1px solid ${CLR.border}`,
                padding: "3px 8px", fontWeight: 700, fontSize: 12, textAlign: "right",
                position: "sticky", left: 0
              }}>
                TOTAL
              </td>
              {cols.map(col => (
                <td key={col.key} style={{
                  background: CLR.totalRow, border: `1px solid ${CLR.border}`,
                  padding: "3px 6px", textAlign: "right",
                  fontFamily: "monospace", fontSize: 12, fontWeight: 700
                }}>
                  {colStats(col.key).total}
                </td>
              ))}
              {computed.map(c => <td key={c.key} style={{ background: CLR.totalRow, border: `1px solid ${CLR.border}` }} />)}
            </tr>
            <tr>
              <td style={{
                background: CLR.totalRow, border: `1px solid ${CLR.border}`,
                padding: "3px 8px", fontWeight: 700, fontSize: 12, textAlign: "right",
                position: "sticky", left: 0
              }}>
                MOY.
              </td>
              {cols.map(col => (
                <td key={col.key} style={{
                  background: CLR.totalRow, border: `1px solid ${CLR.border}`,
                  padding: "3px 6px", textAlign: "right",
                  fontFamily: "monospace", fontSize: 12, fontWeight: 700
                }}>
                  {colStats(col.key).mean}
                </td>
              ))}
              {computed.map(c => <td key={c.key} style={{ background: CLR.totalRow, border: `1px solid ${CLR.border}` }} />)}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Légende ── */}
      <div style={{
        background: "#f5f0e0", border: `1px solid ${CLR.border}`, borderTop: "none",
        borderRadius: "0 0 4px 4px", padding: "5px 12px",
        display: "flex", gap: 20, fontSize: 11, color: "#666"
      }}>
        <span>
          <span style={{ display: "inline-block", width: 12, height: 12, background: CLR.cellFlagged, border: "1px solid #ccc", marginRight: 4 }} />
          Confiance &lt;75% — à vérifier
        </span>
        <span>
          <span style={{ display: "inline-block", width: 12, height: 12, background: CLR.cellEdited, border: "1px solid #ccc", marginRight: 4 }} />
          Corrigé manuellement
        </span>
        <span>
          <span style={{ display: "inline-block", width: 12, height: 12, background: CLR.cellOk, border: "1px solid #ccc", marginRight: 4 }} />
          Confiance ≥85%
        </span>
      </div>
    </div>
  )
}
