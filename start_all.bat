@echo off
REM ============================================================
REM  Rice Smart Farming - one-click startup
REM  Opens MySQL, Backend, and Frontend in separate windows.
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "XAMPP_DIR=D:\xampp"
set "PROJECT_DIR=%~dp0"
set "VENV_ACTIVATE=%PROJECT_DIR%.venv\Scripts\activate.bat"
set "NPM=D:\npm.cmd"

echo.
echo ============================================
echo   Rice Smart Farming - Launcher
echo ============================================
echo.

REM ============= 1. MySQL =============
echo [1/3] Checking MySQL on port 3306...
netstat -an | findstr /R /C:":3306 .*LISTENING" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto mysql_ready

if not exist "%XAMPP_DIR%\mysql_start.bat" goto err_mysql_path
echo       Starting MySQL via XAMPP...
start "MySQL XAMPP" /MIN cmd /c "%XAMPP_DIR%\mysql_start.bat"

set /a tries=0
:wait_mysql
timeout /t 1 /nobreak >nul
netstat -an | findstr /R /C:":3306 .*LISTENING" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto mysql_ready
set /a tries+=1
if !tries! LEQ 25 goto wait_mysql
echo       [WARN] MySQL did not open port 3306 within 25s. Backend may fail.

:mysql_ready
echo       MySQL ready.

REM ============= 2. Backend =============
echo [2/3] Starting backend  - FastAPI on :8000
if not exist "%VENV_ACTIVATE%" goto err_venv
start "Rice Backend - FastAPI 8000" cmd /k "cd /d %PROJECT_DIR%backend && call %VENV_ACTIVATE% && uvicorn app.main:app --host 0.0.0.0 --port 8000"

REM ============= 3. Frontend =============
echo [3/3] Starting frontend - Vite on :5173
if not exist "%NPM%" goto err_npm
start "Rice Frontend - Vite 5173" cmd /k "cd /d %PROJECT_DIR%frontend && %NPM% run dev"

REM ============= Wait for Vite, open browser =============
echo.
echo Waiting for the frontend to be ready...
set /a tries=0
:wait_vite
timeout /t 1 /nobreak >nul
netstat -an | findstr /R /C:":5173 .*LISTENING" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto open_browser
set /a tries+=1
if !tries! LEQ 30 goto wait_vite
echo [WARN] Vite did not open within 30s. Opening browser anyway.

:open_browser
echo.
echo ============================================
echo   All three services launched.
echo   Opening http://localhost:5173 ...
echo ============================================
start "" "http://localhost:5173"
timeout /t 3 /nobreak >nul
goto end

:err_mysql_path
echo       [ERROR] Cannot find %XAMPP_DIR%\mysql_start.bat
echo       Edit XAMPP_DIR at the top of this script.
goto fail

:err_venv
echo       [ERROR] Cannot find %VENV_ACTIVATE%
echo       The Python venv is missing. Run:
echo           python -m venv .venv
echo           .venv\Scripts\activate
echo           pip install -r backend\requirements.txt
goto fail

:err_npm
echo       [ERROR] Cannot find %NPM%
echo       Edit NPM at the top of this script.
goto fail

:fail
echo.
echo Launch aborted. See message above.
echo.
pause
exit /b 1

:end
endlocal
