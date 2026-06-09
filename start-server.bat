@echo off
cd /d "%~dp0"

echo Starting LEGO Star Wars Battles dev server...
echo.

npm.cmd run dev -- --port 5173

echo.
echo Server stopped.
pause
