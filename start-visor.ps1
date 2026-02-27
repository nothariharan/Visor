#!/usr/bin/env pwsh
# VISOR - One-Click Startup Script
# This script builds the client and starts the server, then opens it in the browser

$ErrorActionPreference = "Stop"

Write-Host "🚀 VISOR - Starting up..." -ForegroundColor Green
Write-Host ""

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Navigate to project root
Push-Location $ScriptDir

try {
    # Step 1: Build the client (once)
    Write-Host "📦 Building client..." -ForegroundColor Yellow
    Set-Location "client"

    if (-not (Test-Path "node_modules")) {
        Write-Host "📥 Installing dependencies..." -ForegroundColor Cyan
        npm install
    }

    Write-Host "🔨 Running vite build..." -ForegroundColor Cyan
    npm run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build failed!"
    }

    Set-Location ".."

    Write-Host "✅ Client build complete" -ForegroundColor Green
    Write-Host ""

    # Step 2: Start the server
    Write-Host "🔥 Starting VISOR server..." -ForegroundColor Yellow
    Write-Host "   Server will run on http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""

    # Wait a moment for user to read the message
    Start-Sleep -Milliseconds 500

    # Step 3: Open browser (after a small delay to let server start)
    Write-Host "🌐 Opening browser in 2 seconds..." -ForegroundColor Cyan

    # Start server in background and capture the process
    $serverProcess = Start-Process node -ArgumentList "server/index.js" -PassThru -NoNewWindow

    # Wait for server to start
    Start-Sleep -Seconds 2

    # Open the browser
    Write-Host "🌐 Opening http://localhost:3000..." -ForegroundColor Green
    Start-Process "http://localhost:3000"

    Write-Host ""
    Write-Host "✅ VISOR is ready!" -ForegroundColor Green
    Write-Host "   Press Ctrl+C in this window to stop the server" -ForegroundColor Yellow
    Write-Host ""

    # Wait for the server process to complete
    Wait-Process -InputObject $serverProcess

} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

