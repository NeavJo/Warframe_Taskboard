@echo off
title WF Taskboard - GitHub Pages Test (No Proxy)
echo ========================================
echo   Warframe Taskboard - GitHub Pages Test
echo   No proxy - simulates remote deployment
echo ========================================
echo.
echo   Use download-market-resources.bat to
echo   fetch items data and images first.
echo.
echo   http://localhost:8081/?noproxy
echo   ?noproxy = simulate GitHub Pages (no proxy)
echo   no param = normal (but no proxy available)
echo.
echo ========================================
echo.

python -m http.server 8081
pause
