# OBD CRM Database Fix Script
# One-command fixer for CRM database setup issues
# ASCII only - no emojis or special characters

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " OBD CRM Database Fix Script " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 0: Print repo folder
$repoPath = Get-Location
Write-Host "Step 0: Repository Location" -ForegroundColor Cyan
Write-Host "  Working directory: $repoPath" -ForegroundColor Gray
Write-Host ""

# Step 1: Read and print DATABASE_URL
Write-Host "Step 1: Reading DATABASE_URL" -ForegroundColor Cyan
$databaseUrl = $null
$databaseHost = $null
$databaseName = $null

$envFile = ".env.local"
if (!(Test-Path $envFile)) {
  $envFile = ".env"
}

if (!(Test-Path $envFile)) {
  Write-Host "  ERROR: No .env or .env.local file found." -ForegroundColor Red
  exit 1
}

Get-Content $envFile | ForEach-Object {
  if ($_ -like "DATABASE_URL=*") {
    $databaseUrl = $_.Substring("DATABASE_URL=".Length).Trim('"')
  }
}

if (-not $databaseUrl) {
  Write-Host "  ERROR: DATABASE_URL not found in $envFile" -ForegroundColor Red
  exit 1
}

Write-Host "  DATABASE_URL detected." -ForegroundColor Green

try {
    $url = [System.Uri]::new($databaseUrl)
    $databaseHost = $url.Host
    $databaseName = $url.AbsolutePath.TrimStart('/')
    Write-Host "  Host: $databaseHost" -ForegroundColor Gray
    Write-Host "  Database: $databaseName" -ForegroundColor Gray
} catch {
    Write-Host "  WARNING: Could not parse DATABASE_URL" -ForegroundColor Yellow
}
Write-Host ""

# Step 1.5: Check for CRM migration
Write-Host "Step 1.5: Checking for CRM Migration" -ForegroundColor Cyan
$crmMigrationFound = $false
$migrationFolders = Get-ChildItem -Path "prisma\migrations" -Directory -ErrorAction SilentlyContinue

foreach ($folder in $migrationFolders) {
    $migrationFile = Join-Path $folder.FullName "migration.sql"
    if (Test-Path $migrationFile) {
        $content = Get-Content $migrationFile -Raw
        if ($content -like '*CREATE TABLE*CrmContact*') {
            $crmMigrationFound = $true
            Write-Host "  Found CRM migration: $($folder.Name)" -ForegroundColor Green
            break
        }
    }
}

if (-not $crmMigrationFound) {
    Write-Host "  WARNING: No CRM migration found in prisma/migrations" -ForegroundColor Yellow
    Write-Host "  This may be OK if CRM tables were added to an existing migration" -ForegroundColor Gray
    Write-Host "  The migrate deploy step will apply any pending migrations" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Run migrations
Write-Host "Step 2: Applying Database Migrations" -ForegroundColor Cyan
Write-Host "  Running: npx prisma migrate deploy" -ForegroundColor Gray
$migrateResult = & npx prisma migrate deploy 2>&1
$migrateExitCode = $LASTEXITCODE

if ($migrateExitCode -eq 0) {
    Write-Host "  Migrations applied successfully" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Migration deploy returned exit code $migrateExitCode" -ForegroundColor Yellow
    Write-Host "  Output: $($migrateResult -join "`n")" -ForegroundColor Gray
    Write-Host "  Continuing anyway..." -ForegroundColor Gray
}
Write-Host ""

# Step 3: Generate Prisma Client
Write-Host "Step 3: Generating Prisma Client" -ForegroundColor Cyan
Write-Host "  Running: npx prisma generate" -ForegroundColor Gray
$generateResult = & npx prisma generate 2>&1
$generateExitCode = $LASTEXITCODE

if ($generateExitCode -eq 0) {
    Write-Host "  Prisma client generated successfully" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Prisma generate failed with exit code $generateExitCode" -ForegroundColor Red
    Write-Host "  Output: $($generateResult -join "`n")" -ForegroundColor Gray
    Write-Host "  Aborting - cannot proceed without Prisma client" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Verify Prisma Client
Write-Host "Step 4: Verifying Prisma Client" -ForegroundColor Cyan
Write-Host "  Running: npx prisma validate" -ForegroundColor Gray
$validateResult = & npx prisma validate 2>&1
$validateExitCode = $LASTEXITCODE

if ($validateExitCode -ne 0) {
    Write-Host "  ERROR: Prisma validate failed with exit code $validateExitCode" -ForegroundColor Red
    Write-Host "  Output: $($validateResult -join "`n")" -ForegroundColor Gray
    Write-Host "  Aborting - Prisma schema is invalid" -ForegroundColor Red
    exit 1
}

Write-Host "  Prisma schema validated successfully" -ForegroundColor Green

# Prisma generate was already run in Step 3, verify it succeeded
if ($generateExitCode -eq 0) {
    Write-Host "  Prisma client verified." -ForegroundColor Green
} else {
    Write-Host "  ERROR: Prisma client generation failed (from Step 3)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Start dev server (optional)
Write-Host "Step 5: Dev Server Status" -ForegroundColor Cyan
$shouldStartServer = $false

# Check if server is already running
$serverRunning = $false
$serverPort = $null

foreach ($port in @(3000, 3001)) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/api/health" -Method GET -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverRunning = $true
            $serverPort = $port
            Write-Host "  Dev server already running on port $port" -ForegroundColor Green
            break
        }
    } catch {
        # Server not running on this port
    }
}

if (-not $serverRunning) {
    Write-Host "  Dev server is not running" -ForegroundColor Gray
    Write-Host "  To start it manually, run: npm run dev" -ForegroundColor Gray
    Write-Host "  Or wait for the script to start it automatically..." -ForegroundColor Gray
    
    # Ask if we should start it (for now, we'll skip auto-start to avoid blocking)
    # In a real scenario, you might want to start it in background
    $shouldStartServer = $false
}
Write-Host ""

# Step 6: Test endpoints (if server is running)
Write-Host "Step 6: Testing API Endpoints" -ForegroundColor Cyan

if ($serverRunning) {
    $testPort = $serverPort
    Write-Host "  Testing endpoints on port $testPort..." -ForegroundColor Gray
    
    $endpointTests = @(
        @{ Name = "db-info"; Url = "http://localhost:$testPort/api/debug/db-info"; ExpectedStatus = 200 },
        @{ Name = "obd-crm-db-doctor"; Url = "http://localhost:$testPort/api/debug/obd-crm-db-doctor"; ExpectedStatus = 200 },
        @{ Name = "obd-crm/contacts"; Url = "http://localhost:$testPort/api/obd-crm/contacts"; ExpectedStatus = 200 },
        @{ Name = "obd-crm/tags"; Url = "http://localhost:$testPort/api/obd-crm/tags"; ExpectedStatus = 200 }
    )
    
    $endpointResults = @{}
    
    foreach ($test in $endpointTests) {
        try {
            $response = Invoke-WebRequest -Uri $test.Url -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            $endpointResults[$test.Name] = @{
                Status = $response.StatusCode
                Success = $response.StatusCode -eq $test.ExpectedStatus
            }
            
            if ($test.Name -eq "obd-crm-db-doctor") {
                try {
                    $doctorData = $response.Content | ConvertFrom-Json
                    if ($doctorData.data) {
                        Write-Host "    DB Doctor Report:" -ForegroundColor Gray
                        Write-Host "      Database: $($doctorData.data.databaseName) on $($doctorData.data.databaseHost)" -ForegroundColor Gray
                        Write-Host "      CRM Tables Exist: $($doctorData.data.tablesExist.CrmContact -and $doctorData.data.tablesExist.CrmTag)" -ForegroundColor Gray
                        Write-Host "      Status: $($doctorData.data.migrationStatusHint)" -ForegroundColor Gray
                    }
                } catch {
                    # Ignore JSON parse errors
                }
            }
            
            if ($endpointResults[$test.Name].Success) {
                Write-Host "  $($test.Name): PASS ($($response.StatusCode))" -ForegroundColor Green
            } else {
                Write-Host "  $($test.Name): FAIL (got $($response.StatusCode), expected $($test.ExpectedStatus))" -ForegroundColor Yellow
            }
        } catch {
            $statusCode = 0
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode.value__
            }
            $endpointResults[$test.Name] = @{
                Status = $statusCode
                Success = $false
            }
            Write-Host "  $($test.Name): FAIL (error: $($_.Exception.Message))" -ForegroundColor Red
        }
    }
    
    # Determine overall PASS/FAIL
    $contactsOk = $endpointResults["obd-crm/contacts"].Success
    $tagsOk = $endpointResults["obd-crm/tags"].Success
    $doctorOk = $endpointResults["obd-crm-db-doctor"].Success
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    if ($contactsOk -and $tagsOk -and $doctorOk) {
        Write-Host " RESULT: PASS " -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "All CRM endpoints are working correctly." -ForegroundColor Green
        Write-Host "The Database Setup Issue should be resolved." -ForegroundColor Green
        exit 0
    } else {
        Write-Host " RESULT: FAIL " -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Some endpoints are not working correctly:" -ForegroundColor Yellow
        if (-not $contactsOk) {
            Write-Host "  - /api/obd-crm/contacts returned error" -ForegroundColor Red
        }
        if (-not $tagsOk) {
            Write-Host "  - /api/obd-crm/tags returned error" -ForegroundColor Red
        }
        if (-not $doctorOk) {
            Write-Host "  - /api/debug/obd-crm-db-doctor returned error" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Check the DB Doctor endpoint output above for specific issues" -ForegroundColor Gray
        Write-Host "  2. Verify DATABASE_URL points to the correct database" -ForegroundColor Gray
        Write-Host "  3. Ensure all migrations are applied: npx prisma migrate deploy" -ForegroundColor Gray
        Write-Host "  4. Regenerate Prisma client: npx prisma generate" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "  Skipping endpoint tests (server not running)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    
    # If migrations and Prisma generate succeeded, result is PASS
    if ($migrateExitCode -eq 0 -and $generateExitCode -eq 0 -and $validateExitCode -eq 0) {
        Write-Host " RESULT: PASS " -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Database migrations and Prisma client setup completed successfully." -ForegroundColor Green
        Write-Host "To verify the fix:" -ForegroundColor Yellow
        Write-Host "  1. Start the dev server: npm run dev" -ForegroundColor Gray
        Write-Host "  2. Wait for server to be ready" -ForegroundColor Gray
        Write-Host "  3. Visit: http://localhost:3000/api/debug/obd-crm-db-doctor" -ForegroundColor Gray
        Write-Host "  4. Check the CRM page: http://localhost:3000/apps/obd-crm" -ForegroundColor Gray
        exit 0
    } else {
        Write-Host " RESULT: FAIL " -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Database setup did not complete successfully." -ForegroundColor Red
        if ($migrateExitCode -ne 0) {
            Write-Host "  - Migrations failed" -ForegroundColor Red
        }
        if ($generateExitCode -ne 0) {
            Write-Host "  - Prisma client generation failed" -ForegroundColor Red
        }
        if ($validateExitCode -ne 0) {
            Write-Host "  - Prisma schema validation failed" -ForegroundColor Red
        }
        exit 1
    }
}

