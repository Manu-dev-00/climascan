import { useState, useEffect } from "react"

const API = "http://localhost:8000"

export default function Export({ onNotify }) {
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState([])
  const [exporting, setExporting] = useState(false)
  const [format, setFormat] = useState("csv")

  useEffect(() => { fetchValidated() }, [])

  async function fetchValidated() {
    try {
      const res = await fetch(`${API}/api/upload/list`)
      if (res.ok) {
        const d = await res.json()
        setRecords(d.records.filter(r => r.validated))
      }
    } catch {}
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selectAll() {
    setSelected(records.map(r => r.id))
  }

  async function doExport() {
    if (selected.length === 0) { onNotify("Sélectionnez au moins une fiche", "error"); return }
    setExporting(true)
    try {
      const res = await fetch(`${API}/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_ids: selected, format, include_metadata: true })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `clidata_export.${format === "excel" ? "xlsx" : format === "sql" ? "sql" : "csv"}`
        a.click()
        URL.revokeObjectURL(url)
        onNotify(`Export ${format.toUpperCase()} généré avec succès`, "success")
      }
    } catch { onNotify("Erreur lors de l'export", "error") }
    setExporting(false)
  }

  async function exportAllValidated() {
    setExporting(true)
    try {
      const res = await fetch(`${API}/api/export/validated/all?format=${format}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `clidata_valides.${format === "excel" ? "xlsx" : format}`
        a.click()
        URL.revokeObjectURL(url)
        onNotify("Export complet généré", "success")
      }
    } catch { onNotify("Erreur export", "error") }
    setExporting(false)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Export CLIDATA</h1>
          <p className="page-subtitle">Génération CSV · Excel · SQL Oracle — format CLIDATA WMO</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Format d'export</div>
        <div className="tabs" style={{ maxWidth: 360 }}>
          {[["csv","CSV CLIDATA"],["excel","Excel (.xlsx)"],["sql","SQL Oracle"]].map(([k,l]) => (
            <button key={k} className={`tab ${format === k ? "active" : ""}`} onClick={() => setFormat(k)}>{l}</button>
          ))}
        </div>
        <p style={{ marginTop: 10, fontSize: 12, color: "rgba(13,17,23,0.45)", fontFamily: "var(--mono)" }}>
          {format === "csv" && "Séparateur ; · Encodage UTF-8 · Colonnes normalisées CLIDATA"}
          {format === "excel" && "Multi-feuilles par type de formulaire · Formatage professionnel"}
          {format === "sql" && "Script INSERT Oracle compatible CLIDATA · Exécutable via SQL*Plus"}
        </p>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            Fiches validées ({records.length})
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={selectAll}>
              Tout sélectionner
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected([])}>
              Désélectionner
            </button>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⊞</div>
            <p>Aucune fiche validée pour l'instant.<br/>Validez des fiches dans l'onglet Révision.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Station</th>
                  <th>Mois / Année</th>
                  <th>Type de formulaire</th>
                  <th>Validé par</th>
                  <th>Date validation</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} onClick={() => toggleSelect(r.id)} style={{ cursor: "pointer" }}>
                    <td>
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.station}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.mois} {r.annee}</td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 10 }}>
                        {r.form_type?.replace(/_/g," ")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{r.validated_by || "—"}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                      {r.validated_at ? new Date(r.validated_at).toLocaleDateString("fr-TG") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={exportAllValidated} disabled={exporting || records.length === 0}>
          Exporter tout ({records.length} fiches)
        </button>
        <button className="btn btn-primary" onClick={doExport} disabled={exporting || selected.length === 0}>
          {exporting
            ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Export…</>
            : `⊞ Exporter la sélection (${selected.length})`
          }
        </button>
      </div>
    </>
  )
}
