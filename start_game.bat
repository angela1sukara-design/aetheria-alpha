@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  start "" "%~dp0启动游戏-双击直接运行.html"
  exit /b 0
)
start "Aetheria Alpha 0.2" cmd /k node scripts\serve.mjs --open
endlocal
