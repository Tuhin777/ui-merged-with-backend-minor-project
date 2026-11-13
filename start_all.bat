@echo off
setlocal enabledelayedexpansion
title KGEC DPI Intelligence Studio - Launcher
color 0A

echo ======================================================================
echo   KGEC DPI Intelligence Studio ^| Launcher ^& Cyber Lab Workbench
echo ======================================================================
echo.

:: 1. Locate project root directory whether launched from root or subfolder
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

if exist "%SCRIPT_DIR%\dpi\server.py" (
    set "PROJECT_ROOT=%SCRIPT_DIR%"
) else if exist "%SCRIPT_DIR%\Minor_Project-KGEC_25-27\dpi\server.py" (
    set "PROJECT_ROOT=%SCRIPT_DIR%\Minor_Project-KGEC_25-27"
) else (
    echo [ERROR] Could not find 'dpi\server.py'.
    echo Please make sure this script is placed in the project directory.
    pause
    exit /b 1
)

set "WEB_DIR=%PROJECT_ROOT%\apps\web"

:: 2. Check for Python
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python was not found in PATH!
    echo Please install Python 3.10+ and add it to your system PATH.
    pause
    exit /b 1
)

:: 3. Check for Package Manager (pnpm or npm)
set "PKG_RUNNER=npm run dev"
where pnpm >nul 2>&1
if !errorlevel! equ 0 (
    set "PKG_RUNNER=pnpm dev"
)

:: 4. Start Python Backend API (Port 8000)
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [*] Backend API is already active on http://localhost:8000
) else (
    echo [*] Starting Python Backend API on http://localhost:8000 ...
    start "KGEC DPI - Backend API (:8000)" /D "%PROJECT_ROOT%" cmd /k "title DPI Backend (:8000) && color 0A && python dpi/server.py"
    timeout /t 3 /nobreak >nul
)

:: 5. Start Web Studio (Port 3000)
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [*] Web Studio is already active on http://localhost:3000
) else (
    echo [*] Starting Next.js Web Studio with !PKG_RUNNER! on http://localhost:3000 ...
    start "KGEC DPI - Web Studio (:3000)" /D "%WEB_DIR%" cmd /k "title DPI Web Studio (:3000) && color 0B && !PKG_RUNNER!"
    timeout /t 4 /nobreak >nul
)

echo.
echo ======================================================================
echo   [OK] DPI Intelligence Studio is running!
echo.
echo   - Web Studio:   http://localhost:3000
echo   - Backend API:  http://localhost:8000
echo   - API Docs:     http://localhost:8000/docs
echo   - Cyber Lab:    http://localhost:3000 (Click 'Cyber Lab' in Sidebar)
echo.
echo   Launching http://localhost:3000 in your browser...
echo ======================================================================
echo.

start http://localhost:3000

echo You can close this launcher window anytime.
echo To shut down all services, run stop_all.bat or STOP_STUDIO.bat.
echo.
pause
