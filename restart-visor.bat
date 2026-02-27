@echo off
REM Kill any existing VISOR processes
echo Cleaning up existing processes...
taskkill /F /IM node.exe 2>nul

REM Wait a moment for ports to free up
echo Waiting for ports to free up...
timeout /t 2 /nobreak >nul

REM Start VISOR fresh
echo Starting VISOR...
cd /d "%~dp0"
node server/index.js

