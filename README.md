# Rice Smart Farming AI Dashboard

**Final Year Project (FYP2)**
Prepared by: Cheong Hong Meng
Bachelor of IT (Hons) Security Technology — Faculty of Information Science & Technology (FIST), Multimedia University (MMU) Melaka

---

## 1. Project Overview

An end-to-end AI dashboard for Malaysian paddy fields. IoT sensors drop rice-leaf images into a watch folder; a watcher daemon ingests them, YOLO11s detects diseases, XGBoost predicts yield, and a React dashboard with an Ollama-backed (LLaMA 3) advisory chat surfaces the results.

**Architecture:**

```
Watch folder (images) --> Watcher daemon --> Storage + MySQL
      --> Pipeline worker --> YOLO11s (disease detection)
                           --> XGBoost (yield prediction)
      --> FastAPI backend --> React + Vite dashboard
      --> Ollama (LLaMA 3) --> Advisory chat
```

---

## 2. Latest Source Code

GitHub (public repository): **https://github.com/Shadow-2602/rice-smart-farming-system**

---

## 3. Tools & Libraries Required

**Core tools to install first:**

| Tool | Version | Download |
|---|---|---|
| Python | 3.11+ | https://www.python.org/downloads/ |
| Node.js | v20 LTS+ (npm bundled) | https://nodejs.org/ |
| MySQL (via XAMPP) | includes phpMyAdmin | https://www.apachefriends.org/download.html |
| Ollama | for local LLaMA 3 | https://ollama.com/download |
| Git | latest | https://git-scm.com/downloads |

After installing Ollama, pull the model:
```bash
ollama pull llama3
```

**Backend Python libraries** (installed automatically via `requirements.txt`):
```
fastapi==0.115.6
uvicorn[standard]==0.32.1
sqlalchemy==2.0.49
pymysql==1.1.1
cryptography==44.0.0
alembic==1.14.0
pydantic-settings==2.7.0
python-multipart==0.0.19
ultralytics>=8.3.0      # YOLO11s
xgboost>=2.1.0
numpy>=1.26.0
Pillow>=10.0.0
```

**Frontend JavaScript libraries** (installed automatically via `package.json`):
```
react ^18.3.1, react-dom ^18.3.1, react-router-dom ^6.28.0
axios ^1.7.9, chart.js ^4.5.1, recharts ^2.15.0
leaflet ^1.9.4, react-leaflet ^4.2.1, zustand ^5.0.2
vite ^5.4.11, tailwindcss ^3.4.17
```

---

## 4. Setup Instructions

**Step 1 — Clone the repository**
```bash
git clone https://github.com/Shadow-2602/rice-smart-farming-system.git
cd rice-smart-farming-system
```
> **Windows note:** if you clone to a different drive than the one Command Prompt opened in (e.g. cloning into `D:\` while your prompt is on `C:\`), a plain `cd` will **not** switch drives. Use `cd /d D:\rice-smart-farming-system`, or switch drives first with `D:` then `cd \rice-smart-farming-system`.

**Step 2 — Create Python virtual environment and install backend dependencies**
```bash
python -m venv .venv
.venv\Scripts\activate.bat        :: Windows
pip install -r backend\requirements.txt
```

**Step 3 — Start MySQL (via XAMPP Control Panel) and create the database**
```bash
cd backend
python create_db.py
```
This creates a database named `ricesystem`.

**Step 4 — Configure environment variables**
Copy `.env.example` (project root) to `.env` and adjust MySQL credentials if needed. Defaults assume XAMPP's `root` user with no password on port 3306.

> **Important:** also add a `WATCH_DIR` line to your `.env`, e.g. `WATCH_DIR=C:/test_images`. This tells the watcher daemon which folder to monitor for new rice-leaf images. Without it, the app falls back to a hardcoded path (`D:/FYP2/test_images`) from the original dev machine, which won't exist on yours — the watcher will simply stay idle with no error shown. See [Section 7](#7-test-dataset-for-demoing-the-disease-detection-pipeline) for full details.

**Step 5 — Run database migrations**
```bash
alembic upgrade head
```

**Step 6 — Install frontend dependencies**
```bash
cd ..\frontend
npm install
```

> Steps 2–6 are automated by running `setup.bat` from the project root (assumes Python and MySQL are already installed and available in PATH).

---

## 5. Running the System

**Option A — One-click launch (Windows)**
Double-click `start_all.bat` from the project root. This starts MySQL, the FastAPI backend (port 8000), and the Vite frontend (port 5173), then opens `http://localhost:5173` automatically.

> `start_all.bat` / `stop_all.bat` contain machine-specific paths (e.g. `D:\xampp`, `D:\npm.cmd`). Edit these two files to match your own installation before running them.

**Option B — Manual start**
```bash
# Backend
cd backend
..\.venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```
Then open `http://localhost:5173`.

Ollama must be running in the background for the advisory chat (usually auto-starts as a service; otherwise run `ollama serve`).

To stop everything: double-click `stop_all.bat`, or close the terminals / Ctrl+C.

---

## 6. GitHub Repository Setup (already done for this submission)

The source code has already been pushed to the repository above. For reference, this is how it was set up:

```bash
git init
git add .
git add -f models/yolo11ver2.pt models/rice_yield_xgboost_model.json
git config --global user.email "your_email@example.com"
git config --global user.name "Your Name"
git commit -m "Initial commit - Rice Smart Farming AI Dashboard"
git branch -M main
git remote add origin https://github.com/Shadow-2602/rice-smart-farming-system.git
git push -u origin main
```

> The project's `.gitignore` excludes trained model files (`models/*.pt`, `models/*.json`) by default. The `git add -f` step force-adds the two trained models so they're included despite that rule. Both files (~19MB and ~220KB) are well under GitHub's 100MB limit, so no Git LFS is required.

---

## 7. Test Dataset (for demoing the disease-detection pipeline)

This system is data-source agnostic — it watches a local folder for new rice-leaf images and doesn't require any bundled dataset to run. To test the full pipeline (image ingestion → YOLO11s detection → XGBoost yield prediction → dashboard), download sample rice-leaf images from any of these public Kaggle datasets:

- https://www.kaggle.com/datasets/anshulm257/rice-disease-dataset
- https://www.kaggle.com/datasets/thegoanpanda/rice-crop-diseases
- https://www.kaggle.com/datasets/vbookshelf/rice-leaf-diseases
- https://www.kaggle.com/datasets/nizorogbezuode/rice-leaf-images

**Steps:**
1. Download and unzip any of the above datasets (a free Kaggle account may be required).
2. Create a folder anywhere on disk, e.g. `C:\test_images`.
3. Copy some downloaded rice-leaf images (`.jpg`) into that folder (subfolders are fine — the watcher scans recursively and ignores folder/class structure).
4. Open `backend\.env` and set:
   ```
   WATCH_DIR=C:/test_images
   ```
5. Restart the backend. The watcher polls this folder every 30 seconds, ingests new images, randomly assigns them to a sensor/zone, and runs them through the YOLO11s + XGBoost pipeline automatically. Results appear on the dashboard within about a minute.

---

## 8. Project Structure

```
Rice_System/
├── backend/            FastAPI app (routers, models, schemas, services)
│   ├── app/
│   ├── worker/          YOLO11s + XGBoost inference runners
│   ├── alembic/         database migrations
│   └── requirements.txt
├── frontend/            React + Vite dashboard
│   ├── src/
│   └── package.json
├── models/              trained YOLO11s (.pt) and XGBoost (.json) models
├── .env.example         template for local environment configuration
├── setup.bat            one-time environment setup (Windows)
├── start_all.bat        one-click launcher (Windows)
└── stop_all.bat         one-click shutdown (Windows)
```

---

## 9. Contact

**Cheong Hong Meng**
Bachelor of IT (Hons) Security Technology
Faculty of Information Science & Technology (FIST), Multimedia University (MMU) Melaka
