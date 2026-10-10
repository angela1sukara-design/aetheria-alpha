@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)
start "Aetheria Alpha 0.1" cmd /k node scripts\serve.mjs --built
timeout /t 2 /nobreak >nul
start "" http://localhost:4173/
endlocal
