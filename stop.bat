@echo off
setlocal
cd /d "%~dp0"
set "PY=%~dp0.runtime\python\python.exe"
if not exist "%PY%" (
  echo Auto Offer is not running.
  exit /b 0
)
"%PY%" "%~dp0scripts\launcher\launcher.py" stop
exit /b %ERRORLEVEL%
