@echo off
title WF Taskboard - GitHub Pages Test (No Proxy)
echo ========================================
echo   Warframe Taskboard - GitHub Pages Test
echo   No proxy - simulates remote deployment
echo ========================================
echo.

if not exist "data\wf_market_items.json" (
    echo [1/2] Downloading market items data file...
    mkdir data 2>nul
    curl.exe -sSL -H "Language: zh-hans" -H "Platform: pc" -o data\wf_market_items.json https://api.warframe.market/v2/items
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to download items data.
        echo The page will still work but autocomplete won't be available.
        echo.
    ) else (
        echo OK: Items data downloaded to data/wf_market_items.json
    )
) else (
    echo [1/2] Items data file already exists.
)

if not exist "data\img" (
    echo [2/3] Downloading missing item images...
    python .github/scripts/download_market_images.py
) else (
    echo [2/3] Checking for missing images...
    python .github/scripts/download_market_images.py
)

echo [3/3] Starting static file server on port 8081...
echo.
echo   http://localhost:8081/?noproxy
echo   ?noproxy = simulate GitHub Pages (no proxy)
echo   no param = normal (but no proxy available)
echo.
echo ========================================
echo.

python -m http.server 8081
pause
