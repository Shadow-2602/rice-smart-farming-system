@echo off
REM One-time setup: create venv, install deps, create MySQL database, run migrations.
REM Prerequisites: Python 3.11+ and MySQL must already be installed and in PATH.

cd /d "%~dp0"

echo [1/4] Creating Python virtual environment...
python -m venv .venv
if errorlevel 1 goto :error

echo [2/4] Installing dependencies...
call .venv\Scripts\activate.bat
pip install -r backend\requirements.txt
pip install requests
if errorlevel 1 goto :error

echo [3/4] Creating MySQL database 'ricesystem' (assumes root with no password)...
mysql -u root -e "CREATE DATABASE IF NOT EXISTS ricesystem CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 (
    echo.
    echo [!] Could not create the database. Run this manually:
    echo     mysql -u root -p
    echo     CREATE DATABASE ricesystem CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    echo.
)

echo [4/4] Running database migrations...
cd backend
alembic upgrade head
cd ..

echo.
echo ============================================
echo  Setup complete. Run start.bat to launch.
echo ============================================
goto :eof

:error
echo.
echo [!] Setup failed. See error above.
exit /b 1
