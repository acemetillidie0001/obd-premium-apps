# PowerShell script to restart dev server with environment check
# This ensures DATABASE_URL is loaded before starting

Write-Host "Checking environment setup..." -ForegroundColor Cyan

# Check if DATABASE_URL exists in .env.local
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "DATABASE_URL=") {
        Write-Host "✅ DATABASE_URL found in .env.local" -ForegroundColor Green
    } else {
        Write-Host "❌ DATABASE_URL NOT found in .env.local" -ForegroundColor Red
        Write-Host "Please add DATABASE_URL to .env.local first" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "❌ .env.local file not found" -ForegroundColor Red
    Write-Host "Please create .env.local with DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nStopping any running dev servers..." -ForegroundColor Cyan
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { 
    $_.Path -like "*cursor-app-build*" -or $_.MainWindowTitle -like "*next*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "Starting dev server..." -ForegroundColor Cyan
Write-Host "The server will load DATABASE_URL from .env.local" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Gray

# Start dev server
pnpm dev

