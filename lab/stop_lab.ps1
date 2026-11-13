# Stop and clean up lab containers
Set-Location $PSScriptRoot
Write-Host "Stopping KGEC DPI Lab containers..." -ForegroundColor Yellow
docker compose down
Write-Host "✓ Lab stopped." -ForegroundColor Green
