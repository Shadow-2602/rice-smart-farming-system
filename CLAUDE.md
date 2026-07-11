# Rice Smart Farming Dashboard — Project Context

A Final-Year Project: an end-to-end AI dashboard for Malaysian paddy fields.
IoT sensors drop rice-leaf images into a folder, a watcher daemon ingests
them, YOLO11s detects diseases, XGBoost predicts yield, and a React dashboard
plus an Ollama-backed advisory chat surface the results.

## Environment (Windows machine)

| Tool | Location / Version | Notes |
|---|---|---|
| Project root | `D:\FYP2\Rice_System` | absolute path; everything is here |
| Python | 3.14 (system) | venv at `.venv\` |
| Node | v25.9.0 | installed to `D:\` — `node.exe` and `npm.cmd` live at the drive root |
| `npm` | `D:\npm.cmd` | **always invoke `D:\npm.cmd`** — PowerShell blocks `npm.ps1` execution policy |
| MySQL | XAMPP at `D:\xampp` | data files in `D:\xampp\mysql\data`; start via `D:\xampp\mysql_start.bat` |
| MySQL creds | `root` with **empty password**, port 3306 | XAMPP defaults |
| Database | `ricesystem` | created via `backend/create_db.py` |
| Ollama | installed on `C:` (program) + `D:\FYP2\Ollama\models` (models) | env var `OLLAMA_MODELS=D:\FYP2\Ollama\models` |
| LLM model | `llama3:latest` (8B, ~4.7 GB, Q4_0) | cold-start ~30s on CPU |
| Test images | `D:\FYP2\test_images\` | two datasets: `Rice_Leaf_AUG/` and `Rice_Diseases/` |
| Trained models | `D:\FYP2\Rice_System\models\yolo11ver2.pt` + `rice_yield_xgboost_model.json` | from user's separate training projects |

## Running the system

**Fast path** — double-click `start_all.bat` from the project root. It:
1. Starts MySQL via XAMPP if port 3306 is free
2. Opens a backend window: `uvicorn app.main:app --port 8000`
3. Opens a frontend window: `D:\npm.cmd run dev` (Vite on :5173)
4. Auto-opens the browser to `http://localhost:5173`

`stop_all.bat` cleanly shuts them down via window-title taskkill + port-targeted PID kill (won't touch unrelated Python/Node processes).

**Manual** (if launcher fails):
```cmd
:: backend
cd D:\FYP2\Rice_System\backend
D:\FYP2\Rice_System\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

:: frontend
cd D:\FYP2\Rice_System\frontend
D:\npm.cmd run dev
```

## Architecture

```
D:\FYP2\test_images\<dataset>\<class>\*.jpg
        │
        │ watcher polls every 30s (services/watcher.py)
        │ - dedupe by sensor_images.original_path
        │ - random sensor assignment (folder ≠ sensor mapping)
        │ - BACKDATES captured_at randomly within last 30 days
        ▼
storage/raw/<sensor_id>/<uuid>.jpg + sensor_images row (is_processed=false)
        │
        │ pipeline.run_once() picks up unprocessed rows in batches of 50
        ▼
┌── YOLO11s ──────┐   ┌── XGBoost ──────┐
│ disease label   │   │ yield kg/ha     │
│ confidence      │   │ from 14 weather │
│ bounding boxes  │   │ features only   │
│ annotated PNG   │   │                 │
└─────────────────┘   └─────────────────┘
        │                       │
        ▼                       ▼
disease_detections      yield_predictions
predicted_at=image.captured_at (NOT now())
        │
        ▼
alerts (warning if conf>0.6, critical if >0.85)
        │
   FastAPI REST endpoints (/api/v1/*)
        │
        ▼
React + Vite + Tailwind + Chart.js + Leaflet dashboard (localhost:5173)
        │
        ▼
Advisory chat → Ollama localhost:11434 (system prompt rebuilt from MySQL each turn)
```

## Field topology (configured, not data-driven)

`.env`:
```
FIELD_LAYOUT=Zone A:4,Zone B:3,Zone C:3
```
→ **10 sensors** named `Sensor 1` … `Sensor 10`, three zones, geographically clustered around Kedah (6.13°N, 100.37°E ± 0.05).

Reconciled idempotently at startup in `app/services/topology.py` — existing sensors get renamed in place (data preserved); extras are deactivated, not deleted.

## Key constraints / non-obvious behaviors

### Time-stamping (important for live demo)
- **`sensor_images.captured_at`** is randomly **backdated to a date in the last 30 days** so the time-series charts have a spread of data. New images do NOT cluster at "now".
- **`sensor_images.created_at`** is the true ingestion moment (`func.now()`). This is what the dashboard uses for live KPIs.
- **`disease_detections.predicted_at` / `yield_predictions.predicted_at`** inherit `image.captured_at` (so charts bucket correctly).
- Dashboard fetches recent detections with `?sort=recent` → orders by `sensor_images.created_at desc` via JOIN, so freshly-arrived items appear at the top regardless of their backdated capture date.
- `summary.images_today` and `summary.detections_today` use `created_at`, not `captured_at`.
- A one-time spread script (`backend/spread_demo_timestamps.py`) reshuffles existing rows' timestamps if needed. Idempotent.

### Watcher
- Polls `WATCH_DIR` (default `D:/FYP2/test_images`) every 30s, recursive.
- Sensor assignment is **random**, not folder-based — folders are just demo data sources.
- Sensors are lazy-created only if a leaf folder has new files (avoids ghost duplicates).
- Dedupe key: `sensor_images.original_path`.

### Pipeline batch size
`BATCH_SIZE = 50` in `worker/pipeline.py`. Each `run_once(db)` processes up to 50 pending rows.

### YOLO classes (must match exactly)
`bacterial_leaf_blight`, `leaf_blast`, `tungro`, `healthy`, `sheath_blight`, `brownspot`

Display + Malay mapping is in `worker/yolo_runner.py` (`DISEASE_DISPLAY`).

When the top detection is `healthy`, severity is forced to `"none"` and no alert is generated.

### XGBoost features (must match exactly)
14 weather features in this order — see `worker/xgboost_runner.py` `FEATURE_ORDER`:
```
temperature, pressure, dew_point, humidity, wind_speed, gust, wind_chill,
uv_index, feels_like_temperature, visibility, solar_radiation,
pollutant_value, precipitation_rate, precipitation_total
```
The watcher fills these with realistic sampled Malaysian climate values per image.

### Ollama advisory
- System prompt is **rebuilt from MySQL on every chat turn** — see `app/services/advisory.py::build_context`.
- Streaming via FastAPI `StreamingResponse` (NDJSON from Ollama → plain text chunks).
- Frontend uses `fetch` + `ReadableStream` reader in `api/api.js::streamAdvisoryChat`.
- Health probe at `/api/v1/advisory/health` checks Ollama reachability and whether the model is pulled.

### Frontend design system
- Imported from a **Claude Design** (Anthropic Labs) HTML bundle, adapted to React.
- All custom CSS lives in `src/index.css` alongside Tailwind base.
- Color tokens: `--bg #eeece8` (cream), `--lime #c8e63c`, `--green #4a9a60`, `--text #1a1a1a`.
- Fonts: Inter (display + body) and JetBrains Mono (numerics).
- Layout: top nav (not sidebar), bento grid (`.bento` 12-col system).
- Bilingual: `src/i18n.js` exposes `getStrings(lang)` returning the design's nested t-object. Disease names map English ↔ Malay via `DISEASE_NAMES`.

### Advisory page background
Uses `/advisory-bg.jpg` from `frontend/public/` (a paddy field painting). Chat card is glassmorphic with `backdrop-filter: blur(14px)`. Only the Advisory page has this background — other pages keep the cream/sage gradient.

## Database schema (overview)

5 tables created via Alembic 001-004:
- **`sensors`** — id (CHAR(36)), name, location_name, lat/lng, field_zone, is_active, created_at
- **`sensor_images`** — id, sensor_id, file_path, original_path (dedup), captured_at, created_at, is_processed, + 14 weather columns
- **`disease_detections`** — id, sensor_image_id, sensor_id, disease_label (+ _ms), confidence_score, bounding_box_json, num_detections, severity_level, annotated_file_path, predicted_at
- **`yield_predictions`** — id, sensor_id, sensor_image_id, predicted_yield_kg_per_hectare, confidence_interval_low/high, input_features_json, predicted_at
- **`alerts`** — id, sensor_id, disease_detection_id, alert_type, title (+ _ms), message (+ _ms), severity, is_read, is_dismissed, created_at

All FKs CASCADE on image deletion, SET NULL on sensor deletion (preserving historical data).

## Known sharp edges

1. **MySQL must be running before backend starts** — backend crashes at startup because `ensure_field_layout()` queries on connect. Cause #1 of every "backend failed exit 255" log entry.
2. **`server_default=func.now()` overrides** — when creating predictions in `pipeline.py`, you must explicitly set `predicted_at=image.captured_at`; otherwise the server fills `now()` and breaks chart spread.
3. **Sort by ISO date BEFORE formatting to "10 May"** — string sort puts "10 May" before "3 May". The dashboard's `yieldData` and history's charts all sort on ISO keys first, then format for display.
4. **Cold-start Ollama is ~30s on CPU** — first chat after Ollama starts takes ~30s. Subsequent warm requests are ~3-15s. The model unloads after ~5min idle.
5. **`if (...)` blocks in batch scripts can't contain labels** — `start_all.bat` and `stop_all.bat` use flat goto-style flow because nested labels broke the parser ("`)` was unexpected").
6. **`createdAt` for chat history is in-frontend only** — chat is stateless on the backend; frontend tracks message history in React state and passes the whole list on each turn.

## File layout

```
D:\FYP2\Rice_System\
├── .env                          # MySQL URL, WATCH_DIR, OLLAMA_*, FIELD_LAYOUT
├── start_all.bat / stop_all.bat  # one-click launcher / shutdown
├── setup.bat                     # one-time: create venv, install deps, init DB, run migrations
├── models/                       # yolo11ver2.pt + rice_yield_xgboost_model.json
├── storage/                      # raw/ + annotated/ — managed by the app
├── backend/
│   ├── alembic/versions/         # 001-004 migrations
│   ├── create_db.py              # one-time: creates `ricesystem` DB
│   ├── spread_demo_timestamps.py # idempotent timestamp spreader
│   └── app/
│       ├── main.py               # FastAPI + lifespan (init storage, topology, watcher)
│       ├── config.py             # pydantic Settings reading .env
│       ├── database.py           # sync SQLAlchemy + MySQL via PyMySQL
│       ├── models/               # SQLAlchemy ORM models
│       ├── schemas/              # Pydantic request/response shapes
│       ├── routers/              # sensors, predictions, alerts, images, pipeline,
│       │                         #   watcher, advisory
│       └── services/
│           ├── storage.py        # raw/annotated path helpers
│           ├── topology.py       # FIELD_LAYOUT reconciler
│           ├── watcher.py        # background scan + ingest thread
│           └── advisory.py       # Ollama client + context builder
│       worker/
│       ├── pipeline.py           # run_once() — orchestrates YOLO + XGBoost
│       ├── yolo_runner.py        # YOLO11s inference + annotation
│       └── xgboost_runner.py     # XGBoost yield inference
└── frontend/
    ├── package.json
    ├── vite.config.js            # proxies /api → :8000
    └── src/
        ├── main.jsx / App.jsx
        ├── index.css             # Claude Design CSS + Tailwind base
        ├── i18n.js               # bilingual strings + disease name map
        ├── store.js              # Zustand: lang
        ├── api/api.js            # Axios + streamAdvisoryChat (fetch + ReadableStream)
        ├── components/
        │   ├── Layout.jsx        # top-nav with EN/MS toggle
        │   ├── SeverityBadge.jsx
        │   ├── Skeleton.jsx
        │   └── Charts.jsx        # YieldChart + DiseaseChart + ConfBar + ZoneBadge
        └── pages/
            ├── DashboardPage.jsx
            ├── SensorsPage.jsx
            ├── SensorDetailPage.jsx
            ├── AlertsPage.jsx
            ├── HistoryPage.jsx
            └── AdvisoryPage.jsx
```

## Useful commands

```cmd
:: Run one-off pipeline tick (e.g. drain backlog without waiting)
curl -X POST http://localhost:8000/api/v1/watcher/scan

:: Bulk mark all alerts read
curl -X PATCH http://localhost:8000/api/v1/alerts/read-all

:: Re-spread timestamps (idempotent)
.venv\Scripts\python.exe backend\spread_demo_timestamps.py

:: Check Ollama is reachable
curl http://localhost:8000/api/v1/advisory/health

:: Health probe
curl http://localhost:8000/health
```

## Demo flow (presentation-ready)

1. `start_all.bat` → wait for the three windows to come up
2. Open browser at `http://localhost:5173`
3. Drop fresh rice-leaf images into `D:\FYP2\test_images\Rice_Leaf_AUG\<class>\`
4. Within 30s the watcher ingests; within another 10s the dashboard polls and shows:
   - Green pill in the page header: `+5 ingested · 5 processed`
   - **Images Today** + **Diseases Today** KPI counters tick up
   - New rows appear at the top of **Recent Detections** (sorted by arrival, not capture)
5. Click into a sensor → annotated images visible with YOLO bounding boxes
6. Go to **Advisory** → ask *"What disease did Sensor 3 just detect, and what should I do?"* — Llama 3 cites live MySQL data
7. Click **"View context"** to show the prompt being injected (proves the chatbot is grounded in real system state)

## What still might break

- **Backend crash → MySQL not running.** Always check XAMPP first.
- **Vite died silently** after Claude Code restart. Just rerun the start script.
- **Ollama returns 500** if `llama3` was never pulled or `OLLAMA_MODELS` env var didn't propagate. Restart Ollama from system tray and re-pull.
- **Date strings out of order** (e.g. "10 May" before "3 May") — sort on ISO keys before formatting.
