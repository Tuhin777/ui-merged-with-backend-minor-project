@echo off
setlocal enabledelayedexpansion
title KGEC DPI Intelligence Studio - Shutdown
color 0C

echo ======================================================================
echo   KGEC DPI Intelligence Studio ^| Safe Shutdown
echo ======================================================================
echo.

echo [*] Scanning and terminating DPI Studio processes...

for %%p in (8000 3000 2121 2222 8080) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%%p " ^| findstr "LISTENING" 2^>nul') do (
        echo [*] Freeing Port %%p (PID: %%a)...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo ======================================================================
echo   [OK] All DPI Studio services ^& Lab targets have been stopped.
echo ======================================================================
echo.
pause
