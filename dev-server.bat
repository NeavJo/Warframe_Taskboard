@echo off
title Warframe Taskboard Dev Server
cd /d "%~dp0"

set PORT=8082

echo ============================================
echo  Warframe Taskboard Dev Server
echo  http://localhost:%PORT%/
echo  Press Ctrl+C to stop.
echo ============================================
echo.

python dev-server-proxy.py
