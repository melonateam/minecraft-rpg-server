@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-with-web-and-sync.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Server launcher failed with exit code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
