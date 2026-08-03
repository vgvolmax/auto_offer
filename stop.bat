@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
set "PYTHON=%~dp0.runtime\python\python.exe"
if not exist "%PYTHON%" (
  echo Auto Offer is not running: portable Python has not been prepared.
  exit /b 0
)
"%PYTHON%" "%~dp0scripts\launcher\launcher.py" stop
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" pause
exit /b %RC%
