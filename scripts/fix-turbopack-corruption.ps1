Write-Host "===================================" -ForegroundColor Cyan
Write-Host " Turbopack Corruption Fix " -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will aggressively clear all Turbopack/Next.js caches" -ForegroundColor Yellow
Write-Host "to fix corruption issues. Make sure your dev server is stopped!" -ForegroundColor Yellow
Write-Host ""

# Kill ALL Node processes
Write-Host "Step 1: Killing ALL Node processes..." -ForegroundColor Cyan
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Killed Node process $($proc.Id)" -ForegroundColor Gray
        } catch {
            Write-Host "  Could not kill process $($proc.Id)" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 3
} else {
    Write-Host "  No Node processes found" -ForegroundColor Gray
}

# Kill processes on ports 3000 and 3001
Write-Host "Step 2: Killing processes on ports 3000 and 3001..." -ForegroundColor Cyan
$ports = @(3000, 3001)
foreach ($port in $ports) {
    try {
        $lines = netstat -ano | Select-String ":$port.*LISTENING"
        foreach ($line in $lines) {
            if ($line -match '\s+(\d+)$') {
                $pid = $matches[1]
                try {
                    taskkill /PID $pid /F 2>&1 | Out-Null
                    Write-Host "  Killed process $pid on port $port" -ForegroundColor Gray
                } catch {
                    # Ignore
                }
            }
        }
    } catch {
        # Ignore
    }
}
Start-Sleep -Seconds 2

# Remove .next directory
Write-Host "Step 3: Removing .next directory..." -ForegroundColor Cyan
if (Test-Path ".next") {
    try {
        Remove-Item -Recurse -Force .next -ErrorAction Stop
        Write-Host "  Successfully removed .next directory" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: Could not remove .next directory" -ForegroundColor Red
        Write-Host "  You may need to manually delete it after closing all terminals" -ForegroundColor Yellow
        Write-Host "  Error: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  .next directory not found" -ForegroundColor Gray
}

# Remove Windows AppData caches
Write-Host "Step 4: Removing Windows AppData caches..." -ForegroundColor Cyan
$cachePaths = @(
    "$env:LOCALAPPDATA\next",
    "$env:LOCALAPPDATA\turbopack",
    "$env:TEMP\next",
    "$env:TEMP\turbopack",
    "$env:APPDATA\next",
    "$env:APPDATA\turbopack"
)

foreach ($cachePath in $cachePaths) {
    if (Test-Path $cachePath) {
        try {
            Remove-Item -Recurse -Force $cachePath -ErrorAction Stop
            Write-Host "  Removed: $cachePath" -ForegroundColor Green
        } catch {
            Write-Host "  Warning: Could not remove $cachePath" -ForegroundColor Yellow
            Write-Host "    You may need to manually delete it" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host " Cache cleanup complete!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Close all terminals and Cursor windows" -ForegroundColor White
Write-Host "2. Reopen Cursor" -ForegroundColor White
Write-Host "3. Run: npm run dev:reset" -ForegroundColor White
Write-Host ""

