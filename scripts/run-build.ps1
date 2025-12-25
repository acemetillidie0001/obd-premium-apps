# Force build to run from repo root
# This script ensures the working directory is correct before running npm build
# 
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\run-build.ps1
# 
# Useful for CI/CD environments or when build commands are executed from
# unexpected working directories (e.g., Cursor auto-run).

$scriptPath = $PSScriptRoot
$repoRoot = Split-Path $scriptPath -Parent

Set-Location $repoRoot

if (!(Test-Path "package.json")) {
    Write-Error "package.json not found in repo root: $repoRoot"
    exit 1
}

Write-Host "Building from: $(Get-Location)"
npm run build

