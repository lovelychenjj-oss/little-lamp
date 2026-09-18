@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or later, then try again.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 (
  pause
  exit /b 1
)
call npm start
pause
