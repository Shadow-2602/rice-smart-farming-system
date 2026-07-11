@echo off
REM ============================================================
REM  Rice Smart Farming - one-click stop
REM  Targets the three windows opened by start_all.bat. Kills
REM  by window title first, falls back to port-based PID lookup
REM  so it never touches unrelated Python/Node processes.
REM ============================================================
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   Rice Smart Farming - Shutdown
echo ============================================
echo.

REM ========== 1. Frontend (Vite, port 5173) ==========
echo [1/3] Stopping frontend (Vite, :5173)...
taskkill /F /FI "WINDOWTITLE eq Rice Frontend - Vite 5173" /T >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":5173 .*LISTENING"') do (
    taskkill /F /PID %%P /T >nul 2>&1
)
echo       Done.

REM ========== 2. Backend (FastAPI, port 8000) ==========
echo [2/3] Stopping backend (FastAPI, :8000)...
taskkill /F /FI "WINDOWTITLE eq Rice Backend - FastAPI 8000" /T >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
    taskkill /F /PID %%P /T >nul 2>&1
)
echo       Done.

REM ========== 3. MySQL ==========
echo [3/3] Stopping MySQL...
"D:\xampp\mysql\bin\mysqladmin.exe" -u root shutdown >nul 2>&1
if !ERRORLEVEL! EQU 0 goto mysql_done

REM mysqladmin failed - port-targeted force kill
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3306 .*LISTENING"') do (
    taskkill /F /PID %%P /T >nul 2>&1
)
:mysql_done
echo       Done.

echo.
echo ============================================
echo   All services stopped.
echo ============================================
timeout /t 2 /nobreak >nul

endlocal
