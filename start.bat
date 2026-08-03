@echo off
setlocal
cd /d "%~dp0"
set "LOG=%~dp0.runtime\logs\launcher.log"
where powershell.exe >nul 2>nul || (
  echo Windows PowerShell is required. Log: "%LOG%"
  pause
  exit /b 10
)
if /I "%~1"=="--no-browser" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher\bootstrap.ps1" -NoBrowser
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher\bootstrap.ps1" %*
)
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Auto Offer could not start. Launcher log: "%LOG%"
  if not defined CI pause
)
exit /b %RC%
