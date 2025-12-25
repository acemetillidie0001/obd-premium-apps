# Build Utility Script
# 
# Purpose: Ensures npm build runs from the repository root directory.
# 
# When to use:
# - Manual build execution when unsure of current working directory
# - Debugging build failures related to path issues
# - Local development when build commands fail due to directory context
# 
# IMPORTANT: This script does NOT run automatically in CI/CD.
# CI/CD systems should use standard npm scripts (npm run build) directly.
# 
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\run-build.ps1
# 
# This script changes to the repo root, verifies package.json exists,
# and then runs npm run build from the correct directory.

$scriptPath = $PSScriptRoot
$repoRoot = Split-Path $scriptPath -Parent

Set-Location $repoRoot

if (!(Test-Path "package.json")) {
    Write-Error "package.json not found in repo root: $repoRoot"
    exit 1
}

Write-Host "Building from: $(Get-Location)"
npm run build

