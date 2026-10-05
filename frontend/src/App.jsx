import { useState, useEffect } from "react"
import Dashboard from "./pages/Dashboard"
import Upload from "./pages/Upload"
import Review from "./pages/Review"
import Export from "./pages/Export"
import "./styles/global.css"

const PAGES = ["dashboard", "upload", "review", "export"]

export default function App() {
  const [page, setPage] = useState("dashboard")
  const [stats, setStats] = useState(null)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  async function fetchStats() {
    try {
      const res = await fetch("http://localhost:8000/api/stats/")
      if (res.ok) setStats(await res.json())
    } catch {}
  }

  function notify(msg, type = "success") {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">CS</div>
          <div className="logo-text">
            <span className="logo-main">CliMaScan</span>
            <span className="logo-sub">DGMN Lomé</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {[
            { id: "dashboard", icon: "◈", label: "Tableau de bord" },
            { id: "upload", icon: "⊕", label: "Numériser" },
            { id: "review", icon: "◎", label: "Révision" },
            { id: "export", icon: "⊞", label: "Export CLIDATA" },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
              {id === "review" && stats?.pending > 0 && (
                <span className="nav-badge">{stats.pending}</span>
              )}
            </button>
          ))}
        </nav>

        {stats && (
          <div className="sidebar-stats">
            <div className="stat-pill">
              <span className="stat-num">{stats.total}</span>
              <span className="stat-lbl">fiches</span>
            </div>
            <div className="stat-pill success">
              <span className="stat-num">{stats.validated}</span>
              <span className="stat-lbl">validées</span>
            </div>
            <div className="stat-pill warn">
              <span className="stat-num">{stats.flagged}</span>
              <span className="stat-lbl">signalées</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="conn-status">
            <span className="conn-dot"></span>
            <span>CLIDATA Oracle</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {notification && (
          <div className={`notification ${notification.type}`}>
            {notification.msg}
          </div>
        )}
        {page === "dashboard" && <Dashboard stats={stats} onNavigate={setPage} />}
        {page === "upload" && <Upload onNotify={notify} onNavigate={setPage} />}
        {page === "review" && <Review onNotify={notify} />}
        {page === "export" && <Export onNotify={notify} />}
      </main>
    </div>
  )
}
