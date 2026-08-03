@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Auto Offer Server - close this window to stop
cd /d "%~dp0\..\.."
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
".runtime\python\python.exe" "scripts\launcher\launcher.py" serve --state-file "%CD%\.runtime\server.json" --build-fingerprint "%~1" --project-root-id "%~2"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Auto Offer server stopped with an error. See .runtime\logs\launcher.log
  pause
)
exit /b %RC%
