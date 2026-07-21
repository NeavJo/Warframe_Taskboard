@echo off
chcp 65001 >nul
title Warframe Taskboard Dev Server
cd /d "%~dp0"

set PORT=8080

echo ============================================
echo  Warframe Taskboard - Dev Server Launcher
echo ============================================
echo.

REM Get local LAN IP
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4"') do (
    if not defined IP set "IP=%%a"
)
set IP=%IP: =%

if defined IP (
    echo Local URL : http://localhost:%PORT%/
    echo LAN URL   : http://%IP%:%PORT%/
) else (
    echo Local URL : http://localhost:%PORT%/
)
echo.
echo Press Ctrl+C to stop the server.
echo ============================================
echo.

REM Use Python's built-in HTTP server
where py >nul 2>nul
if %errorlevel%==0 (
    py -m http.server %PORT% --bind 0.0.0.0
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        python -m http.server %PORT% --bind 0.0.0.0
    ) else (
        echo [ERROR] Python is not installed or not in PATH.
        echo Please install Python 3 or use another static server.
        pause
        exit /b 1
    )
)
