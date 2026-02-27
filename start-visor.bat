@echo off
REM VISOR - One-Click Startup Script
REM This script builds the client and starts the server, then opens it in the browser

setlocal enabledelayedexpansion

REM Get the directory where this batch file is located
set "ScriptDir=%~dp0"

REM Navigate to project root
cd /d "%ScriptDir%"

echo.
echo =====================================
echo  ^^ VISOR - One-Click Startup
echo =====================================
echo.

REM Step 1: Build the client
echo [1/3] Building client...
cd client

if not exist "node_modules" (
    echo [*] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
)

echo [*] Running vite build...
call npm run build
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

cd ..
echo [OK] Client build complete
echo.

REM Step 2: Start the server
echo [2/3] Starting VISOR server...
echo     Server: http://localhost:6767
echo.

REM Wait a moment
timeout /t 1 /nobreak >nul

REM Step 3: Open browser
echo [3/3] Opening browser...
start http://localhost:6767

REM Wait for browser to start
timeout /t 2 /nobreak >nul

echo.
echo =====================================
echo [OK] VISOR is running!
echo     Open: http://localhost:6767
echo     Stop: Press Ctrl+C in terminal
echo =====================================
echo.

REM Start the server and keep it running
node server/index.js

REM If server exits, prompt user
echo.
echo Server stopped. Press any key to close...
pause >nul

