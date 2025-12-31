# Predev script: Removes stale Next.js dev lock file before starting dev server
# This script runs automatically via npm lifecycle hook "predev"

if (Test-Path ".next\dev\lock") {
    Remove-Item -Force .next\dev\lock -ErrorAction SilentlyContinue
    Write-Host "Removed stale dev lock" -ForegroundColor Gray
}

