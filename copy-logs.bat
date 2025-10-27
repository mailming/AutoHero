@echo off
echo 🔄 Copying API monitor logs to project directory...
echo.

REM Run the PowerShell script
powershell.exe -ExecutionPolicy Bypass -File "%~dp0copy-api-logs.ps1"

echo.
echo ✅ Done! Check the api-logs folder in your project directory.
pause
