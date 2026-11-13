# ═══════════════════════════════════════════════════════════════════════════════
# KGEC DPI Lab — Quick Start Script (Windows PowerShell)
# Run from the project root: .\lab\start_lab.ps1
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$LabDir = $PSScriptRoot

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  KGEC DPI Lab Environment — Start" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Check Docker ──────────────────────────────────────────────────────────────
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Docker not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Docker Desktop for Windows:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host ""
    Write-Host "After installing, re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Docker found: $(docker --version)" -ForegroundColor Green

# ── Create ftp-data directory ─────────────────────────────────────────────────
$FtpDataDir = Join-Path $LabDir "ftp-data"
if (-not (Test-Path $FtpDataDir)) {
    New-Item -ItemType Directory -Path $FtpDataDir | Out-Null
    # Plant a dummy file for FTP listing
    "KGEC DPI Lab dummy file" | Out-File -FilePath (Join-Path $FtpDataDir "readme.txt")
    Write-Host "✓ Created ftp-data directory" -ForegroundColor Green
}

# ── Pull & start containers ───────────────────────────────────────────────────
Write-Host ""
Write-Host "Starting lab containers..." -ForegroundColor Yellow
Set-Location $LabDir
docker compose up -d

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Lab services running:" -ForegroundColor Green
Write-Host ""
Write-Host "  FTP Target  → ftp://127.0.0.1:2121" -ForegroundColor White
Write-Host "                User: labuser / Pass: password123" -ForegroundColor Gray
Write-Host ""
Write-Host "  SSH Target  → ssh://127.0.0.1:2222" -ForegroundColor White
Write-Host "                User: labuser / Pass: weakpass" -ForegroundColor Gray
Write-Host ""
Write-Host "  DVWA (Web)  → http://localhost:8080" -ForegroundColor White
Write-Host "                User: admin / Pass: password" -ForegroundColor Gray
Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000 → Capture tab" -ForegroundColor White
Write-Host "  2. Set interface to 'Ethernet' or 'Loopback'" -ForegroundColor White
Write-Host "  3. Set BPF filter: tcp port 2121 or tcp port 2222" -ForegroundColor White
Write-Host "  4. Set duration (e.g. 60s) and click Start" -ForegroundColor White
Write-Host "  5. Run traffic generator:" -ForegroundColor White
Write-Host "     python lab/traffic_generator.py --mode mixed --duration 60" -ForegroundColor Yellow
Write-Host ""
