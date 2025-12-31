Write-Host "===================================" -ForegroundColor Cyan
Write-Host " OBD Dev Reset (Next.js + Prisma) " -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "WARNING: If the dev server is running, press Ctrl+C in that terminal first." -ForegroundColor Yellow
Write-Host ""

# Dev-only guard: Prevents multiple Next.js dev servers from running simultaneously
# This check detects if a dev server is already running and aborts to avoid conflicts.
# Only applies to development mode - production builds are not affected.
Write-Host "Step 0: Checking for existing Next.js dev server..." -ForegroundColor Cyan
$existingDevServer = $false
$portsToCheck = @(3000, 3001)

foreach ($port in $portsToCheck) {
    try {
        $healthUrl = "http://localhost:$port/api/health"
        $response = Invoke-WebRequest -Uri $healthUrl -Method GET -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $existingDevServer = $true
            Write-Host "  WARNING: Next.js dev server is already running on port $port" -ForegroundColor Red
            Write-Host "  Aborting startup to prevent multiple dev servers." -ForegroundColor Red
            Write-Host "  Please stop the existing dev server first, then run this script again." -ForegroundColor Yellow
            exit 1
        }
    } catch {
        # Port not responding, continue checking
    }
}

# Also check for Next.js dev processes by command line
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and ($cmdLine -like "*next dev*" -or $cmdLine -like "*npm run dev*" -or $cmdLine -like "*pnpm dev*")) {
                $existingDevServer = $true
                Write-Host "  WARNING: Next.js dev server process detected (PID: $($proc.Id))" -ForegroundColor Red
                Write-Host "  Aborting startup to prevent multiple dev servers." -ForegroundColor Red
                Write-Host "  Please stop the existing dev server first, then run this script again." -ForegroundColor Yellow
                exit 1
            }
        } catch {
            # Could not check command line, continue
        }
    }
}

if (-not $existingDevServer) {
    Write-Host "  No existing dev server detected - proceeding with startup" -ForegroundColor Gray
}

Write-Host "Step 1: Checking for existing dev server processes..." -ForegroundColor Cyan
$portInUse = $false
try {
    $listener = netstat -ano | Select-String ":3000.*LISTENING"
    if ($listener) {
        $portInUse = $true
        Write-Host "  Port 3000 is in use - dev server may already be running" -ForegroundColor Yellow
    }
} catch {
    # Ignore netstat errors
}

$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
$devServerProcesses = @()

if ($nodeProcesses) {
    foreach ($proc in $nodeProcesses) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and ($cmdLine -like "*next dev*" -or $cmdLine -like "*npm run dev*" -or $cmdLine -like "*pnpm dev*" -or $cmdLine -like "*next-server*")) {
                $devServerProcesses += $proc
            }
        } catch {
            # If we can't check command line, check if port is in use as fallback
            if ($portInUse) {
                $devServerProcesses += $proc
            }
        }
    }
}

if ($devServerProcesses.Count -gt 0) {
    Write-Host "  Found $($devServerProcesses.Count) Node process(es) that may be running dev server" -ForegroundColor Yellow
    Write-Host "  Attempting to stop them (best-effort)..." -ForegroundColor Yellow
    foreach ($proc in $devServerProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "    Stopped process $($proc.Id)" -ForegroundColor Gray
        } catch {
            Write-Host "    Could not stop process $($proc.Id) - may need manual intervention" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 3
    Write-Host "  Waiting for processes to fully terminate..." -ForegroundColor Gray
}

# Also kill ALL Node processes if port is in use (more aggressive cleanup for corruption issues)
if ($portInUse -and $devServerProcesses.Count -eq 0) {
    Write-Host "  Port 3000 is in use but no matching Node process found" -ForegroundColor Yellow
    Write-Host "  Killing ALL Node processes to clear potential corruption..." -ForegroundColor Yellow
    $allNodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($allNodeProcesses) {
        foreach ($proc in $allNodeProcesses) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Write-Host "    Stopped Node process $($proc.Id)" -ForegroundColor Gray
            } catch {
                # Ignore errors
            }
        }
        Start-Sleep -Seconds 3
    }
    Write-Host "  If issues persist, manually stop the dev server and try again" -ForegroundColor Yellow
} elseif (-not $portInUse -and $devServerProcesses.Count -eq 0) {
    Write-Host "  No existing dev server processes detected" -ForegroundColor Gray
}

Write-Host "Step 2: Removing Next.js cache and lock files..." -ForegroundColor Cyan
if (Test-Path ".next\dev\lock") {
    Write-Host "  Removing stale lock file (.next\dev\lock)..." -ForegroundColor Gray
    Remove-Item -Path ".next\dev\lock" -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".next\cache") {
    Write-Host "  Removing .next\cache directory (Turbopack cache)..." -ForegroundColor Gray
    Remove-Item -Recurse -Force .next\cache -ErrorAction SilentlyContinue
}
if (Test-Path ".next\turbopack") {
    Write-Host "  Removing .next\turbopack directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force .next\turbopack -ErrorAction SilentlyContinue
}
if (Test-Path ".next") {
    Write-Host "  Removing .next directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
}

Write-Host "Step 2b: Removing Turbopack Windows AppData cache..." -ForegroundColor Cyan
# Clear Next.js/Turbopack cache from Windows AppData
$appDataCachePaths = @(
    "$env:LOCALAPPDATA\next",
    "$env:LOCALAPPDATA\turbopack",
    "$env:TEMP\next",
    "$env:TEMP\turbopack"
)

foreach ($cachePath in $appDataCachePaths) {
    if (Test-Path $cachePath) {
        Write-Host "  Removing $cachePath..." -ForegroundColor Gray
        try {
            Remove-Item -Recurse -Force $cachePath -ErrorAction Stop
            Write-Host "    Successfully removed" -ForegroundColor Gray
        } catch {
            Write-Host "    Warning: Could not fully remove $cachePath (may be locked)" -ForegroundColor Yellow
            Write-Host "    You may need to manually delete this directory after closing all Node processes" -ForegroundColor Yellow
        }
    }
}

Write-Host "Step 3: Removing Prisma runtime cache..." -ForegroundColor Cyan
if (Test-Path "node_modules\.prisma") {
    Write-Host "  Removing node_modules\.prisma directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
}

Write-Host "Step 4: Regenerating Prisma client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Prisma generate failed. Aborting." -ForegroundColor Red
    exit 1
}

# Verify Prisma generate actually succeeded by checking for generated files
$prismaClientPath = "node_modules\.prisma\client\index.js"
if (-not (Test-Path $prismaClientPath)) {
    Write-Host "ERROR: Prisma client was not generated. Expected file not found: $prismaClientPath" -ForegroundColor Red
    exit 1
}
Write-Host "  Prisma client generated successfully" -ForegroundColor Gray

# Dev-only: Verify required Prisma models are available
# This assertion ensures prisma.user, prisma.crmContact, and prisma.crmTag exist
# If models are missing, it indicates migrations need to be applied or schema is out of sync
Write-Host "  Verifying required Prisma models are available..." -ForegroundColor Gray
npx tsx scripts/verify-prisma-models.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Required Prisma models are missing. See error above." -ForegroundColor Red
    Write-Host "  Run: npx prisma migrate deploy" -ForegroundColor Yellow
    exit 1
}
Write-Host "  All required Prisma models verified" -ForegroundColor Gray

Write-Host "Step 5: Cleaning up dev server locks and port conflicts..." -ForegroundColor Cyan

# Delete stale lock file
if (Test-Path ".next\dev\lock") {
    Write-Host "  Removing stale lock file (.next\dev\lock)..." -ForegroundColor Gray
    Remove-Item -Force .next\dev\lock -ErrorAction SilentlyContinue
    Write-Host "    Lock file removed" -ForegroundColor Gray
} else {
    Write-Host "  No lock file found" -ForegroundColor Gray
}

# Kill processes using port 3000
$killedPids3000 = @()
try {
    $lines = netstat -ano | Select-String ":3000.*LISTENING"
    foreach ($line in $lines) {
        # Extract PID from end of line (netstat format: ... LISTENING        PID)
        if ($line -match '\s+(\d+)$') {
            $pid = $matches[1]
            try {
                $result = taskkill /PID $pid /F 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $killedPids3000 += $pid
                    Write-Host "    Killed process $pid using port 3000" -ForegroundColor Gray
                }
            } catch {
                # Process may have already terminated, ignore
            }
        }
    }
} catch {
    # Ignore netstat errors
}

# Kill processes using port 3001
$killedPids3001 = @()
try {
    $lines = netstat -ano | Select-String ":3001.*LISTENING"
    foreach ($line in $lines) {
        # Extract PID from end of line (netstat format: ... LISTENING        PID)
        if ($line -match '\s+(\d+)$') {
            $pid = $matches[1]
            try {
                $result = taskkill /PID $pid /F 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $killedPids3001 += $pid
                    Write-Host "    Killed process $pid using port 3001" -ForegroundColor Gray
                }
            } catch {
                # Process may have already terminated, ignore
            }
        }
    }
} catch {
    # Ignore netstat errors
}

# Print summary of killed PIDs
$totalKilled = $killedPids3000.Count + $killedPids3001.Count
if ($totalKilled -gt 0) {
    Write-Host "  Summary: Killed $totalKilled process(es)" -ForegroundColor Gray
    if ($killedPids3000.Count -gt 0) {
        Write-Host "    Port 3000: PIDs $($killedPids3000 -join ', ')" -ForegroundColor Gray
    }
    if ($killedPids3001.Count -gt 0) {
        Write-Host "    Port 3001: PIDs $($killedPids3001 -join ', ')" -ForegroundColor Gray
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "  No processes found using ports 3000 or 3001" -ForegroundColor Gray
}

Write-Host "Step 6: Starting dev server..." -ForegroundColor Cyan
Write-Host "  Waiting 2 seconds before starting..." -ForegroundColor Gray
Start-Sleep -Seconds 2

$devProcess = Start-Process -FilePath "npm" -ArgumentList "run","dev" -NoNewWindow -PassThru
if (-not $devProcess) {
    Write-Host "ERROR: Failed to start dev server process." -ForegroundColor Red
    exit 1
}

Write-Host "Step 7: Waiting for server to become ready..." -ForegroundColor Cyan
$maxAttempts = 45
$attempt = 0
$ready = $false
$detectedPort = $null

# Try port 3000 first, then 3001 as fallback
$portsToTry = @(3000, 3001)

while ($attempt -lt $maxAttempts -and -not $ready) {
    Start-Sleep -Seconds 2
    $attempt++
    
    # Check both ports to detect which one is actually in use
    foreach ($port in $portsToTry) {
        if ($ready) {
            break
        }
        
        try {
            $healthUrl = "http://localhost:$port/api/health"
            $response = Invoke-WebRequest -Uri $healthUrl -Method GET -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $detectedPort = $port
                $ready = $true
                break
            }
        } catch {
            # Try fallback endpoint on this port
            try {
                $fallbackUrl = "http://localhost:$port/api/debug/db-info"
                $response = Invoke-WebRequest -Uri $fallbackUrl -Method GET -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    $detectedPort = $port
                    $ready = $true
                    break
                }
            } catch {
                # Port not ready yet, continue to next port
            }
        }
    }
    
    if (-not $ready -and ($attempt % 5 -eq 0)) {
        Write-Host "  Still waiting... ($attempt/$maxAttempts attempts)" -ForegroundColor Gray
    }
}

if ($ready -and $detectedPort) {
    Write-Host "READY: server responding on port $detectedPort" -ForegroundColor Green
} else {
    Write-Host "ERROR: server did not become ready within timeout" -ForegroundColor Red
    exit 1
}
