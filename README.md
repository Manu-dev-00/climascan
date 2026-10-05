# CliMaScan 🌦
### Numérisation automatique des fiches climatologiques → CLIDATA
**Station DGMN Lomé · Togo · WMO**

---

## Architecture

```
climascan/
├── backend/          # FastAPI + Python
│   ├── app/
│   │   ├── main.py           # Point d'entrée API
│   │   ├── core/
│   │   │   ├── config.py     # Configuration (.env)
│   │   │   └── store.py      # Store en mémoire (→ Oracle en prod)
│   │   ├── models/
│   │   │   └── schemas.py    # Modèles Pydantic
│   │   ├── services/
│   │   │   ├── ocr_service.py        # OCR Tesseract + OpenCV
│   │   │   ├── claude_service.py     # Extraction IA (Claude API)
│   │   │   ├── validator_service.py  # Validation climatologique
│   │   │   └── export_service.py     # CSV / Excel / SQL CLIDATA
│   │   └── api/
│   │       ├── upload.py     # Upload single + batch
│   │       ├── validation.py # Révision et validation
│   │       ├── export.py     # Export multi-format
│   │       └── stats.py      # Statistiques
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/         # React + Vite
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   └── CliDataGrid.jsx   # Grille CLIDATA exacte
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Upload.jsx
    │   │   ├── Review.jsx        # Révision avec grille CLIDATA
    │   │   └── Export.jsx
    │   └── styles/global.css
    └── package.json
```

---

## Installation

### 1. Prérequis
- Python 3.11+
- Node.js 18+
- Tesseract OCR installé système
- Clé API Anthropic (Claude)

### 2. Installer Tesseract
```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng

# Windows : télécharger sur https://github.com/UB-Mannheim/tesseract/wiki
```

### 3. Backend
```bash
cd backend

# Copier la config
cp .env.example .env
# Renseigner ANTHROPIC_API_KEY dans .env

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Utilisation

### Flux complet

1. **Numériser** : Scanner la fiche papier (JPG/PNG/PDF) ou photographier avec le mobile
2. **Upload** : Glisser-déposer dans l'interface · mode batch pour un mois complet
3. **Extraction IA** : OCR (Tesseract) + vision intelligente (Claude) → données structurées
4. **Révision** : Grille CLIDATA exacte avec codes couleur :
   - 🔴 Rouge = confiance < 75% → vérifier
   - 🟡 Jaune = corrigé manuellement
   - 🟢 Vert = confiance ≥ 85%
5. **Validation** : Vérification des règles climatologiques (Tx≥Tn, plages physiques, normales 1991-2020)
6. **Export** → CSV CLIDATA · Excel multi-feuilles · SQL Oracle (INSERT direct)

### Types de formulaires supportés
| Formulaire | Colonnes CLIDATA |
|---|---|
| Température sous abris | TEMP 00:00 → TEMP 21:00 |
| Thermomètre mouillé | TWET 00:00 → TWET 21:00 |
| Précipitations & Évaporation | RR 06:00, EVA 06:00 |
| Tension vapeur / HR / Pression | TV 00:00–21:00, HR Max |
| Tableau climatologique mensuel | TN, TX, TMOY, RR, PICHE, Insolation |

### Stations Togo (IDs CLIDATA)
| ID | Nom |
|---|---|
| TG1M001S | Lomé Aéro |
| TG1M002S | Tabligbo |
| TG1P003S | Atakpamé |
| TG1P004S | Kouma Konda |
| TG1P010S | Notsé |
| TG1S008S | Mango |
| TG1S009S | Dapaong |
| TG1S012S | Mandouri |

---

## API Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/api/upload/single` | Upload + traitement IA d'une fiche |
| POST | `/api/upload/batch` | Batch mensuel (max 10 fichiers) |
| GET | `/api/upload/list` | Liste avec filtres |
| GET | `/api/upload/{id}/status` | Statut du traitement |
| GET | `/api/validation/{id}` | Détail complet pour révision |
| PATCH | `/api/validation/{id}/field` | Correction manuelle (auditée) |
| POST | `/api/validation/{id}/validate` | Validation finale |
| GET | `/api/validation/{id}/audit` | Historique corrections |
| POST | `/api/export/csv` | Export CSV CLIDATA |
| POST | `/api/export/excel` | Export Excel .xlsx |
| POST | `/api/export/sql` | Export SQL Oracle |
| GET | `/api/stats/` | Statistiques globales |

---

## Production : connexion Oracle CLIDATA

Renseigner dans `.env` :
```
ORACLE_DSN=clidatadb1
ORACLE_USER=clidata
ORACLE_PASSWORD=xxxx
```

Puis dans `store.py`, remplacer le store mémoire par une connexion `cx_Oracle` :
```python
import cx_Oracle
conn = cx_Oracle.connect(user, password, dsn)
```

---

## Validations climatologiques automatiques

- ✓ Tx ≥ Tn chaque jour
- ✓ Plages physiques : Tn [15–35°C], Tx [22–42°C], HR [0–100%], P [990–1030 hPa]
- ✓ Précipitations ≥ 0
- ✓ Comparaison normales 1991–2020 Lomé (alertes si écart > 150%)
- ✓ Score de confiance OCR par champ (seuil configurable, défaut 75%)

---

*Développé par ALEZA M. Amos pour la DGMN — Météorologie Nationale du Togo · Format WMO CLIDATA*
