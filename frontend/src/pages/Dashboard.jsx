import { useEffect, useState } from "react"

const API = "http://localhost:8000"

function ConfBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 85 ? "#059669" : pct >= 65 ? "#d97706" : "#dc2626"
  return (
    <div className="conf-bar">
      <div className="conf-track">
        <div className="conf-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="conf-pct">{pct}%</span>
    </div>
  )
}

export default function Dashboard({ stats, onNavigate }) {
  const [recent, setRecent] = useState([])
  const [alertSummary, setAlertSummary] = useState(null)
  const [byMonth, setByMonth] = useState(null)

  useEffect(() => {
    fetchRecent()
    fetchAlertSummary()
    fetchByMonth()
  }, [])

  async function fetchRecent() {
    try {
      const res = await fetch(`${API}/api/upload/list`)
      if (res.ok) {
        const d = await res.json()
        setRecent(d.records.slice(0, 8))
      }
    } catch {}
  }

  async function fetchAlertSummary() {
    try {
      const res = await fetch(`${API}/api/stats/alerts/summary`)
      if (res.ok) setAlertSummary(await res.json())
    } catch {}
  }

  async function fetchByMonth() {
    try {
      const res = await fetch(`${API}/api/stats/by-month`)
      if (res.ok) setByMonth(await res.json())
    } catch {}
  }

  const statusBadge = (r) => {
    if (r.validated) return <span className="badge badge-success">Validée</span>
    if (r.status === "processing") return <span className="badge badge-info">En cours…</span>
    if (r.status === "error") return <span className="badge badge-danger">Erreur</span>
    if (r.flagged_fields > 0) return <span className="badge badge-warn">À réviser</span>
    return <span className="badge badge-gray">Prête</span>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Station DGMN Lomé · Latitude 06°10'N · Longitude 01°15'E</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("upload")}>
          ⊕ Numériser une fiche
        </button>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="label">Total fiches</div>
          <div className="value">{stats?.total ?? "—"}</div>
          <div className="sub">enregistrements</div>
        </div>
        <div className="stat-card success">
          <div className="label">Validées</div>
          <div className="value">{stats?.validated ?? "—"}</div>
          <div className="sub">prêtes pour CLIDATA</div>
        </div>
        <div className="stat-card warn">
          <div className="label">En attente</div>
          <div className="value">{stats?.pending ?? "—"}</div>
          <div className="sub">révision requise</div>
        </div>
        <div className="stat-card">
          <div className="label">Confiance moy.</div>
          <div className="value">
            {stats?.avg_confidence ? `${Math.round(stats.avg_confidence * 100)}%` : "—"}
          </div>
          <div className="sub">score global OCR + IA</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px" }}>
        {/* Fiches récentes */}
        <div className="card">
          <div className="card-title">Fiches récentes</div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <p>Aucune fiche numérisée pour l'instant.<br/>Commencez par uploader une fiche.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Station</th>
                    <th>Mois / Année</th>
                    <th>Type</th>
                    <th>Confiance</th>
                    <th>Alertes</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.station}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.mois} {r.annee}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 10 }}>
                          {r.form_type?.replace("_", " ").slice(0, 15)}
                        </span>
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <ConfBar value={r.global_confidence} />
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {r.alerts_count > 0 ? (
                          <span className="badge badge-warn">{r.alerts_count}</span>
                        ) : (
                          <span className="badge badge-success">0</span>
                        )}
                      </td>
                      <td>{statusBadge(r)}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate("review")}
                        >
                          Réviser
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertes résumé */}
        <div className="card">
          <div className="card-title">Alertes détectées</div>
          {alertSummary ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {[
                  { key: "error", label: "Erreurs critiques", cls: "danger" },
                  { key: "warning", label: "Avertissements", cls: "warn" },
                  { key: "info", label: "Informatifs", cls: "info" },
                ].map(({ key, label, cls }) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13 }}>{label}</span>
                    <span className={`badge badge-${cls}`}>
                      {alertSummary.by_type?.[key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
              <div className="card-title" style={{ marginBottom: 10 }}>Champs les plus signalés</div>
              {Object.entries(alertSummary.top_flagged_fields || {}).slice(0, 5).map(([field, count]) => (
                <div key={field} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontFamily: "var(--mono)", color: "rgba(13,17,23,0.6)" }}>{field}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 500 }}>{count}</span>
                </div>
              ))}
              {Object.keys(alertSummary.top_flagged_fields || {}).length === 0 && (
                <p style={{ fontSize: 12, color: "rgba(13,17,23,0.4)", textAlign: "center", padding: "16px 0" }}>Aucune alerte</p>
              )}
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <div className="spinner" />
            </div>
          )}
        </div>
      </div>

      {/* Actions rapides */}
      <div className="card">
        <div className="card-title">Actions rapides</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => onNavigate("upload")}>
            ⊕ Nouvelle fiche
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate("review")}>
            ◎ Réviser les fiches signalées
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate("export")}>
            ⊞ Exporter vers CLIDATA
          </button>
        </div>
      </div>
    </>
  )
}
