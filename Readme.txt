================================================================================
 RICE SMART FARMING AI DASHBOARD - README
 Final Year Project (FYP2)
 Prepared by: Cheong Hong Meng
================================================================================

1. PROJECT OVERVIEW
--------------------------------------------------------------------------------
An end-to-end AI dashboard for Malaysian paddy fields. IoT sensors drop
rice-leaf images into a watch folder; a watcher daemon ingests them, YOLO11s
detects diseases, XGBoost predicts yield, and a React dashboard with an
Ollama-backed (LLaMA 3) advisory chat surfaces the results.

Architecture:
  Watch folder (images) --> Watcher daemon --> Storage + MySQL
        --> Pipeline worker --> YOLO11s (disease detection)
                             --> XGBoost (yield prediction)
        --> FastAPI backend --> React + Vite dashboard
        --> Ollama (LLaMA 3) --> Advisory chat


2. LATEST SOURCE CODE
--------------------------------------------------------------------------------
GitHub (public repository):
  https://github.com/Shadow-2602/rice-smart-farming-system


3. TOOLS & LIBRARIES REQUIRED (with versions and download links)
--------------------------------------------------------------------------------
Core tools to install first:

  - Python 3.11 or later
    https://www.python.org/downloads/

  - Node.js v20 LTS or later (npm is bundled with Node.js)
    https://nodejs.org/

  - MySQL via XAMPP (includes MySQL + phpMyAdmin)
    https://www.apachefriends.org/download.html

  - Ollama (to run LLaMA 3 locally for the advisory chat)
    https://ollama.com/download
    After installing, pull the model with:
        ollama pull llama3

  - Git
    https://git-scm.com/downloads

Backend Python libraries (installed automatically via requirements.txt):
  fastapi==0.115.6
  uvicorn[standard]==0.32.1
  sqlalchemy==2.0.49
  pymysql==1.1.1
  cryptography==44.0.0
  alembic==1.14.0
  pydantic-settings==2.7.0
  python-multipart==0.0.19
  ultralytics>=8.3.0      (YOLO11s)
  xgboost>=2.1.0
  numpy>=1.26.0
  Pillow>=10.0.0

Frontend JavaScript libraries (installed automatically via package.json):
  react ^18.3.1, react-dom ^18.3.1, react-router-dom ^6.28.0
  axios ^1.7.9, chart.js ^4.5.1, recharts ^2.15.0
  leaflet ^1.9.4, react-leaflet ^4.2.1, zustand ^5.0.2
  vite ^5.4.11, tailwindcss ^3.4.17


4. SETUP INSTRUCTIONS
--------------------------------------------------------------------------------
Step 1 - Clone the repository
    git clone https://github.com/Shadow-2602/rice-smart-farming-system.git
    cd rice-smart-farming-system

    NOTE (Windows): if you clone to a different drive than the one Command
    Prompt opened in (e.g. cloning into D:\ while your prompt is on C:\),
    a plain "cd" will NOT switch drives and will silently stay on the old
    drive. Use "cd /d" instead, e.g.:
        cd /d D:\rice-smart-farming-system
    or switch drives first with "D:" then "cd \rice-smart-farming-system".

Step 2 - Create Python virtual environment and install backend dependencies
    python -m venv .venv
    .venv\Scripts\activate.bat        (Windows)
    pip install -r backend\requirements.txt

Step 3 - Start MySQL (via XAMPP Control Panel or mysql_start.bat) and create
the database:
    cd backend
    python create_db.py
    (This creates a database named "ricesystem".)

Step 4 - Configure environment variables
    Copy ".env.example" (in the project root) to ".env" and adjust the
    MySQL credentials if needed. Defaults assume XAMPP's "root" user with
    no password on port 3306.

    IMPORTANT: also add a WATCH_DIR line to your .env file, e.g.:
        WATCH_DIR=C:/test_images
    This tells the watcher daemon which folder to monitor for new rice-leaf
    images. Without this line, the app falls back to a hardcoded path
    (D:/FYP2/test_images) used on the original development machine, which
    will not exist on yours — the watcher will simply find no images and
    stay idle, with no error shown. See Section 7 for full details on
    setting up a test folder.

Step 5 - Run database migrations
    (still inside backend/)
    alembic upgrade head

Step 6 - Install frontend dependencies
    cd ..\frontend
    npm install

NOTE: Steps 2-6 are automated by running "setup.bat" from the project root
(double-click it, or run it in Command Prompt). It assumes Python and MySQL
are already installed and available in PATH.


5. RUNNING THE SYSTEM
--------------------------------------------------------------------------------
Option A - One-click launch (Windows):
    Double-click "start_all.bat" from the project root. This starts MySQL,
    the FastAPI backend (port 8000), and the Vite frontend (port 5173), then
    opens http://localhost:5173 in your browser automatically.

    NOTE: start_all.bat/stop_all.bat contain machine-specific paths
    (e.g. D:\xampp, D:\npm.cmd). Open these two files in a text editor and
    update the XAMPP_DIR and NPM paths to match your own installation before
    running them.

Option B - Manual start:
    Backend:
        cd backend
        ..\.venv\Scripts\activate.bat
        uvicorn app.main:app --host 0.0.0.0 --port 8000

    Frontend (in a separate terminal):
        cd frontend
        npm run dev

    Then open http://localhost:5173 in your browser.

Ollama must be running in the background for the advisory chat feature to
work (it starts automatically as a service after installation on most
systems; otherwise run "ollama serve").

To stop everything: double-click "stop_all.bat" (Windows only), or close the
terminal windows / press Ctrl+C in each.


6. GITHUB REPOSITORY SETUP (already done for this submission)
--------------------------------------------------------------------------------
The source code has already been pushed to the public repository above:
    https://github.com/Shadow-2602/rice-smart-farming-system

For reference, this is how it was set up, in case the repo ever needs to be
recreated (e.g. on a new machine):

    git init
    git add .
    git add -f models/yolo11ver2.pt models/rice_yield_xgboost_model.json
    git config --global user.email "your_email@example.com"
    git config --global user.name "Your Name"
    git commit -m "Initial commit - Rice Smart Farming AI Dashboard"
    git branch -M main
    git remote add origin https://github.com/Shadow-2602/rice-smart-farming-system.git
    git push -u origin main

NOTE: The project's .gitignore excludes trained model files (models/*.pt and
models/*.json) by default, to avoid committing large binaries by accident.
The "git add -f" step above force-adds the two trained models
(yolo11ver2.pt and rice_yield_xgboost_model.json) so they are included in
the repository despite that rule. Both files are well under GitHub's 100MB
per-file limit (~19MB and ~220KB), so no Git LFS is required. Anyone
cloning the repo can verify both files are present under the models/
folder on GitHub.


7. TEST DATASET (for demoing the disease-detection pipeline)
--------------------------------------------------------------------------------
This system is data-source agnostic: it works by watching a local folder
for new rice-leaf images and does not require any bundled dataset to run.
To test the full pipeline (image ingestion -> YOLO11s detection -> XGBoost
yield prediction -> dashboard), download sample rice-leaf images from any
of the following public Kaggle datasets:

  - https://www.kaggle.com/datasets/anshulm257/rice-disease-dataset
  - https://www.kaggle.com/datasets/thegoanpanda/rice-crop-diseases
  - https://www.kaggle.com/datasets/vbookshelf/rice-leaf-diseases
  - https://www.kaggle.com/datasets/nizorogbezuode/rice-leaf-images

Steps:
  1. Download and unzip any of the above datasets (a free Kaggle account
     may be required).
  2. Create a folder anywhere on disk, e.g. C:\test_images
  3. Copy some of the downloaded rice-leaf images (.jpg) into that folder
     (subfolders are fine - the watcher scans recursively and folder
     structure/class labels are ignored).
  4. Open backend\.env (created in Section 4, Step 4) and set:
        WATCH_DIR=C:/test_images
     (Use forward slashes or double backslashes.)
  5. Restart the backend. The watcher polls this folder every 30 seconds,
     ingests any new images, randomly assigns them to a sensor/zone, and
     runs them through the YOLO11s + XGBoost pipeline automatically.
     Results appear on the dashboard within about a minute.


8. PROJECT STRUCTURE
--------------------------------------------------------------------------------
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


9. CONTACT
--------------------------------------------------------------------------------
Cheong Hong Meng
Bachelor of IT (Hons) Security Technology
Faculty of Information Science & Technology (FIST), Multimedia University (MMU) Melaka
================================================================================
