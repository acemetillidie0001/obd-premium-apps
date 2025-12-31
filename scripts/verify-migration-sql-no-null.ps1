# Verify Migration SQL Files for Null Bytes
# Checks that migration.sql files do not contain embedded null bytes (0x00)
# which can cause "string contains embedded null" errors in Prisma migrate deploy

param(
    [string]$FilePath = ""
)

function Test-FileForNullBytes {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        Write-Host "FAIL: File not found: $Path" -ForegroundColor Red
        return $false
    }
    
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        $nullPositions = @()
        
        for ($i = 0; $i -lt $bytes.Length; $i++) {
            if ($bytes[$i] -eq 0) {
                $nullPositions += $i
            }
        }
        
        if ($nullPositions.Count -gt 0) {
            Write-Host "FAIL: Found $($nullPositions.Count) null byte(s) in: $Path" -ForegroundColor Red
            Write-Host "      Null bytes at positions: $($nullPositions -join ', ')" -ForegroundColor Yellow
            return $false
        } else {
            Write-Host "PASS: No null bytes found in: $Path" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "FAIL: Error reading file $Path : $_" -ForegroundColor Red
        return $false
    }
}

# Main execution
if ($FilePath) {
    # Test single file
    $result = Test-FileForNullBytes -Path $FilePath
    exit $(if ($result) { 0 } else { 1 })
} else {
    # Test all migration.sql files in prisma/migrations
    $migrationDir = "prisma/migrations"
    
    if (-not (Test-Path $migrationDir)) {
        Write-Host "FAIL: Migration directory not found: $migrationDir" -ForegroundColor Red
        exit 1
    }
    
    $allPassed = $true
    $migrationFiles = Get-ChildItem -Path $migrationDir -Filter "migration.sql" -Recurse
    
    if ($migrationFiles.Count -eq 0) {
        Write-Host "No migration.sql files found in $migrationDir" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Checking $($migrationFiles.Count) migration.sql file(s)..." -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($file in $migrationFiles) {
        $result = Test-FileForNullBytes -Path $file.FullName
        if (-not $result) {
            $allPassed = $false
        }
    }
    
    Write-Host ""
    if ($allPassed) {
        Write-Host "All migration files passed verification." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "One or more migration files contain null bytes." -ForegroundColor Red
        exit 1
    }
}

