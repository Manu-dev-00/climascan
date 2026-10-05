import { useState, useRef } from "react"

const API = "http://localhost:8000"
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

export default function Upload({ onNotify, onNavigate }) {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [station, setStation] = useState("DGMN LOME")
  const [mois, setMois] = useState("Janvier")
  const [annee, setAnnee] = useState(2026)
  const [mode, setMode] = useState("single")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState([])
  const inputRef = useRef()

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      ["image/jpeg","image/png","image/jpg","application/pdf"].includes(f.type)
    )
    setFiles(prev => [...prev, ...dropped])
  }

  function onFileInput(e) {
    setFiles(prev => [...prev, ...Array.from(e.target.files)])
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)
    setProgress([])

    try {
      if (mode === "single" || files.length === 1) {
        for (let i = 0; i < files.length; i++) {
          const fd = new FormData()
          fd.append("file", files[i])
          fd.append("station", station)
          fd.append("mois", mois)
          fd.append("annee", annee)
          setProgress(prev => [...prev, { name: files[i].name, status: "processing" }])
          const res = await fetch(`${API}/api/upload/single`, { method: "POST", body: fd })
          if (res.ok) {
            setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "done" } : p))
          } else {
            setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: "error" } : p))
          }
        }
      } else {
        const fd = new FormData()
        files.forEach(f => fd.append("files", f))
        fd.append("station", station)
        fd.append("mois", mois)
        fd.append("annee", annee)
        setProgress([{ name: `${files.length} fichiers`, status: "processing" }])
        const res = await fetch(`${API}/api/upload/batch`, { method: "POST", body: fd })
        if (res.ok) {
          setProgress([{ name: `${files.length} fichiers`, status: "done" }])
        } else {
          setProgress([{ name: `${files.length} fichiers`, status: "error" }])
        }
      }
      onNotify(`${files.length} fiche(s) envoyée(s) — traitement IA en cours`, "success")
      setFiles([])
      setTimeout(() => onNavigate("review"), 2000)
    } catch (e) {
      onNotify("Erreur de connexion au serveur", "error")
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Numériser une fiche</h1>
          <p className="page-subtitle">OCR + extraction IA — formats JPG, PNG, PDF acceptés</p>
        </div>
      </div>

      {/* Mode */}
      <div className="card">
        <div className="card-title">Mode d'import</div>
        <div className="tabs" style={{ maxWidth: 360 }}>
          <button className={`tab ${mode === "single" ? "active" : ""}`} onClick={() => setMode("single")}>
            Fiche unique
          </button>
          <button className={`tab ${mode === "batch" ? "active" : ""}`} onClick={() => setMode("batch")}>
            Batch mensuel
          </button>
        </div>
        <p style={{ fontSize: 12, color: "rgba(13,17,23,0.45)", marginTop: 10, fontFamily: "var(--mono)" }}>
          {mode === "batch"
            ? "Importez toutes les fiches d'un mois en une seule opération (max 10 fichiers)"
            : "Traitez une fiche à la fois avec contrôle précis"}
        </p>
      </div>

      {/* Métadonnées */}
      <div className="card">
        <div className="card-title">Informations de la station</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Station</label>
            <input className="form-control" value={station} onChange={e => setStation(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Mois</label>
            <select className="form-control" value={mois} onChange={e => setMois(e.target.value)}>
              {MOIS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Année</label>
            <input className="form-control" type="number" value={annee} onChange={e => setAnnee(+e.target.value)} min={1950} max={2100} />
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <div className="card">
        <div className="card-title">Fichiers à numériser</div>
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current.click()}
        >
          <div className="dropzone-icon">⊕</div>
          <div className="dropzone-title">
            {dragging ? "Relâchez pour ajouter" : "Déposez vos fiches ici"}
          </div>
          <div className="dropzone-sub">ou cliquez pour parcourir · JPG, PNG, PDF · max {20}MB</div>
          <input
            ref={inputRef} type="file" multiple hidden
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={onFileInput}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 20, opacity: 0.4 }}>
                  {f.type.includes("pdf") ? "⊟" : "◧"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(13,17,23,0.4)", fontFamily: "var(--mono)" }}>
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                {progress[i] && (
                  <span className={`badge ${progress[i].status === "done" ? "badge-success" : progress[i].status === "error" ? "badge-danger" : "badge-info"}`}>
                    {progress[i].status === "done" ? "Envoyé" : progress[i].status === "error" ? "Erreur" : "En cours…"}
                  </span>
                )}
                <button className="edit-btn" onClick={e => { e.stopPropagation(); removeFile(i) }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" onClick={() => setFiles([])}>Vider</button>
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
        >
          {uploading ? (
            <><div className="spinner" style={{ width: 16, height: 16 }} /> Traitement…</>
          ) : (
            `⊕ Lancer l'extraction IA (${files.length} fichier${files.length > 1 ? "s" : ""})`
          )}
        </button>
      </div>
    </>
  )
}
