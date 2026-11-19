@echo off
rem Windows: double-click this file (or run it) to get everything ready: Node.js and Git if they are missing,
rem the game engine, the game in the browser and its public link. Mac and Linux: sh scripts/bootstrap.sh
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" %*
echo.
pause
