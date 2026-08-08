@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-resource-pack-tunnel.ps1"
if errorlevel 1 (
  echo RPGMaker resource-pack tunnel failed.
  pause
  exit /b 1
)
"%~dp0runtime\jdk-25.0.4+7-jre\bin\java.exe" -Xms2G -Xmx6G -Dfile.encoding=UTF-8 -jar paper.jar --nogui
