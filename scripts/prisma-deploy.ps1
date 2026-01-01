Write-Host "Running prisma generate..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: prisma generate failed" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Running prisma migrate deploy..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: prisma migrate deploy failed" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Done." -ForegroundColor Green
