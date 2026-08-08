@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-with-web-and-sync.ps1"
exit /b %ERRORLEVEL%
