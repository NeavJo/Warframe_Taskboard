@echo off
title WF Taskboard - Download Market Resources
echo ========================================
echo   Warframe Taskboard - Market Resources
echo   Download items data + arbitration + images
echo ========================================
echo.

echo [1/4] Downloading market items data file...
mkdir data 2>nul
curl.exe -sSL -H "Language: zh-hans" -H "Platform: pc" -o data\wf_market_items.json https://api.warframe.market/v2/items
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to download items data.
    echo The page will still work but autocomplete won't be available.
    echo.
) else (
    echo OK: Items data downloaded to data/wf_market_items.json
)

echo.
echo [2/4] Downloading arbitration data...
curl.exe -sSL -o data\arbys.schedule.v2.json https://arbi.wf.wiki/data/arbys.schedule.v2.json
curl.exe -sSL -o data\arbys.nodes.zh.json    https://arbi.wf.wiki/data/arbys.nodes.zh.json
curl.exe -sSL -o data\tierlist.default.json  https://arbi.wf.wiki/data/tierlist.default.json
echo OK: Arbitration data downloaded.

echo.
echo [3/4] Generating local data JS wrappers...
python .github\scripts\generate_local_data.py

echo.
if not exist "data\img" (
    echo [4/4] Downloading missing item images...
    python .github\scripts\download_market_images.py
) else (
    echo [4/4] Checking for missing images...
    python .github\scripts\download_market_images.py
)

echo.
echo ========================================
echo   Done! Resources are ready.
echo   You can now open index.html directly.
echo ========================================
echo.
pause
