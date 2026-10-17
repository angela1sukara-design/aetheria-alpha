@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "%~dp0启动游戏-双击直接运行.html" (
  echo 尚未构建游戏。请先执行 npm ci 和 npm run build。
  pause
  exit /b 1
)
start "" "%~dp0启动游戏-双击直接运行.html"
endlocal
