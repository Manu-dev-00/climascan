import { useState, useEffect, useCallback } from "react"
import CliDataGrid, { CLIDATA_FORMS, STATIONS_TOGO } from "../components/CliDataGrid"

const API = "http://localhost:8000"
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

function normalizeToGrid(rawData, formType) {
  const grid = {}
  const daily = rawData?.daily || []
  const form = CLIDATA_FORMS[formType]
  if (!form) return grid
  daily.forEach(dayObj => {
    const day = String(dayObj.date).padStart(2, "0")
    grid[day] = {}
    const vals = dayObj.values || {}
    form.columns.forEach(col => {
      const aliases = [col.key, col.key.toLowerCase(), col.key.toUpperCase()]
      let found = null
      for (const a of aliases) { if (vals[a]) { found = vals[a]; break } }
      grid[day][col.key] = {
        value: found?.value ?? null,
        confidence: found?.confidence ?? 1.0,
        flagged: found?.flagged ?? false,
        corrected: found?.corrected ?? false,
      }
    })
  })
  return grid
}

function ConfBadge({ value }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 85 ? "#059669" : pct >= 65 ? "#d97706" : "#dc2626"
  const bg = pct >= 85 ? "#d1fae5" : pct >= 65 ? "#fef3c7" : "#fee2e2"
  return (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
      {pct}% confiance
    </span>
  )
}

export default function Review({ onNotify }) {
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [gridData, setGridData] = useState({})
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [filter, setFilter] = useState("all")
  const [tab, setTab] = useState("grid")
  const [operator, setOperator] = useState("météorologue@dgmn.tg")
  const [gridFormType, setGridFormType] = useState("temperature_air")

  useEffect(() => { fetchList() }, [filter])
  useEffect(() => { if (selected) fetchDetail(selected) }, [selected])
  useEffect(() => {
    if (!records.some(r => r.status === "processing")) return
    const t = setInterval(fetchList, 3000)
    return () => clearInterval(t)
  }, [records])

  async function fetchList() {
    try {
      const res = await fetch(`${API}/api/upload/list`)
      if (res.ok) {
        const d = await res.json()
        let recs = d.records
        if (filter === "flagged") recs = recs.filter(r => r.flagged_fields > 0)
        else if (filter === "validated") recs = recs.filter(r => r.validated)
        else if (filter === "pending") recs = recs.filter(r => !r.validated && r.status === "ready")
        setRecords(recs)
      }
    } catch {}
  }

  async function fetchDetail(id) {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/validation/${id}`)
      if (res.ok) {
        const d = await res.json()
        setDetail(d)
        const ft = d.form_type || "temperature_air"
        setGridFormType(ft)
        setGridData(normalizeToGrid(d.data, ft))
      }
    } catch {}
    setLoading(false)
  }

  const handleCellChange = useCallback(async (day, colKey, newVal) => {
    setGridData(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [colKey]: { ...(prev[day]?.[colKey] || {}), value: newVal, corrected: true, flagged: false } }
    }))
    try {
      await fetch(`${API}/api/validation/${selected}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_path: `data.daily.${day}.values.${colKey}.value`, new_value: newVal, operator })
      })
    } catch {}
  }, [selected, operator])

  async function handleValidate() {
    if (!selected || !detail) return
    const errors = (detail.alerts || []).filter(a => a.type === "error")
    if (errors.length > 0) { onNotify(`${errors.length} erreur(s) à corriger`, "error"); setTab("alerts"); return }
    setValidating(true)
    try {
      const res = await fetch(`${API}/api/validation/${selected}/validate?operator=${encodeURIComponent(operator)}`, { method: "POST" })
      if (res.ok) { onNotify("✓ Fiche validée — prête pour CLIDATA", "success"); fetchList(); fetchDetail(selected) }
      else { const err = await res.json(); onNotify(err.detail || "Erreur", "error") }
    } catch { onNotify("Erreur réseau", "error") }
    setValidating(false)
  }

  async function sendToCLIDATA() {
    if (!selected) return
    try {
      const res = await fetch(`${API}/api/export/csv`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_ids: [selected], format: "csv" })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url
        a.download = `clidata_${detail?.station}_${detail?.mois}_${detail?.annee}.csv`; a.click()
        URL.revokeObjectURL(url)
        onNotify("Fichier CLIDATA exporté", "success")
      }
    } catch { onNotify("Erreur export", "error") }
  }

  const statusBadge = r => {
    if (r.validated) return <span className="badge badge-success">✓</span>
    if (r.status === "processing") return <span className="badge badge-info">IA…</span>
    if (r.status === "error") return <span className="badge badge-danger">Err</span>
    if (r.flagged_fields > 0) return <span className="badge badge-warn">{r.flagged_fields}⚑</span>
    return <span className="badge badge-gray">OK</span>
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 14, height: "calc(100vh - 64px)", overflow: "hidden" }}>

      {/* ── LISTE ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h1 className="page-title" style={{ fontSize: 18 }}>Révision</h1>
          <button className="btn btn-secondary btn-sm" onClick={fetchList}>↻</button>
        </div>
        <div className="tabs">
          {[["all","Tout"],["pending","Attente"],["flagged","Signalées"],["validated","Validées"]].map(([k,l]) => (
            <button key={k} className={`tab ${filter===k?"active":""}`} onClick={() => setFilter(k)} style={{ fontSize: 10, padding: "5px 5px" }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {records.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}><div className="empty-icon">◈</div><p style={{ fontSize: 12 }}>Aucune fiche</p></div>
          ) : records.map(r => (
            <div key={r.id} onClick={() => setSelected(r.id)} style={{
              padding: "9px 11px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${selected===r.id ? "var(--accent)" : "var(--border)"}`,
              background: selected===r.id ? "#dbeafe" : "#fff", transition: "all 0.12s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(13,17,23,0.5)" }}>{r.mois} {r.annee}</span>
                {statusBadge(r)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{r.station}</div>
              <div style={{ fontSize: 10, color: "rgba(13,17,23,0.4)", fontFamily: "monospace", marginTop: 2 }}>
                {r.form_type?.replace(/_/g," ").slice(0,28)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DÉTAIL ── */}
      <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }}>
        {!selected ? (
          <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="empty-state">
              <div className="empty-icon" style={{ fontSize: 44 }}>◎</div>
              <p>Sélectionnez une fiche pour la réviser dans la grille CLIDATA</p>
            </div>
          </div>
        ) : loading ? (
          <div className="card" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 12px" }} />
              <p style={{ color: "rgba(13,17,23,0.45)", fontSize: 13 }}>Traitement IA en cours…</p>
            </div>
          </div>
        ) : detail ? (
          <>
            {/* Header */}
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: 16, fontWeight: 700 }}>
                  {detail.station} — {detail.mois} {detail.annee}
                </div>
                <div style={{ fontSize: 11, color: "rgba(13,17,23,0.45)", fontFamily: "monospace", marginTop: 2, display: "flex", gap: 10 }}>
                  <ConfBadge value={detail.global_confidence} />
                  <span>· {detail.flagged_fields} signalé(s)</span>
                  {detail.alerts?.filter(a=>a.type==="error").length > 0 &&
                    <span style={{ color: "#dc2626" }}>· {detail.alerts.filter(a=>a.type==="error").length} erreur(s)</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <input className="form-control" style={{ width: 180, fontSize: 11 }} value={operator} onChange={e => setOperator(e.target.value)} placeholder="Identifiant opérateur" />
                <button className="btn btn-secondary btn-sm" onClick={sendToCLIDATA}>⊞ CSV</button>
                {detail.validated ? (
                  <span className="badge badge-success" style={{ padding: "8px 12px", fontSize: 12 }}>✓ {detail.validated_by}</span>
                ) : (
                  <button className="btn btn-success btn-sm" onClick={handleValidate} disabled={validating}>
                    {validating ? <div className="spinner" style={{ width: 13, height: 13 }} /> : "✓ Valider → CLIDATA"}
                  </button>
                )}
              </div>
            </div>

            {/* Tabs + sélecteur formulaire */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="tabs" style={{ maxWidth: 400 }}>
                {[["grid","Grille CLIDATA"],["alerts",`Alertes(${detail.alerts?.length||0})`],["audit","Historique"]].map(([k,l]) => (
                  <button key={k} className={`tab ${tab===k?"active":""}`} onClick={() => setTab(k)} style={{ fontSize: 11 }}>{l}</button>
                ))}
              </div>
              {tab === "grid" && (
                <select className="form-control" style={{ fontSize: 11, padding: "5px 8px", width: "auto" }}
                  value={gridFormType} onChange={e => { setGridFormType(e.target.value); setGridData(normalizeToGrid(detail.data, e.target.value)) }}>
                  {Object.entries(CLIDATA_FORMS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
              {/* ── GRILLE CLIDATA EXACTE ── */}
              {tab === "grid" && (
                <CliDataGrid
                  data={gridData}
                  formType={gridFormType}
                  station={STATIONS_TOGO.find(s => s.name.toLowerCase().includes((detail.station||"").toLowerCase().split(" ")[0]))?.id || detail.station}
                  year={detail.annee}
                  month={MONTH_NAMES.indexOf(detail.mois) + 1 || 1}
                  onCellChange={handleCellChange}
                  readOnly={detail.validated}
                />
              )}

              {/* ── ALERTES ── */}
              {tab === "alerts" && (
                <div className="card">
                  <div className="card-title">Alertes climatologiques</div>
                  {!detail.alerts?.length ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "var(--success)" }}>✓ Aucune alerte</div>
                  ) : (
                    <div className="alert-list">
                      {detail.alerts.map((a,i) => (
                        <div key={i} className={`alert-item ${a.type}`}>
                          <span className="alert-icon">{a.type==="error"?"✕":a.type==="warning"?"△":"ℹ"}</span>
                          <div>
                            <div className="alert-msg">{a.message}</div>
                            <div className="alert-field">
                              {a.field}{a.date && ` · Jour ${String(a.date).padStart(2,"0")}`}
                              {a.expected_range && ` · Attendu: ${a.expected_range}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── AUDIT ── */}
              {tab === "audit" && (
                <div className="card">
                  <div className="card-title">Historique des corrections</div>
                  {!detail.audit_log?.length ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(13,17,23,0.4)", fontSize: 13 }}>Aucune correction enregistrée</div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Horodatage</th><th>Champ</th><th>Avant</th><th>Après</th><th>Opérateur</th></tr></thead>
                        <tbody>
                          {detail.audit_log.map((e,i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: "monospace", fontSize: 11 }}>{new Date(e.timestamp).toLocaleString("fr-TG")}</td>
                              <td style={{ fontFamily: "monospace", fontSize: 11 }}>{e.field}</td>
                              <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--danger)" }}>{String(e.old_value??'—')}</td>
                              <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--success)" }}>{String(e.new_value)}</td>
                              <td style={{ fontSize: 12 }}>{e.operator}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
