@echo off
REM Double-click to stop the Iboro app (and stop it auto-starting
REM on login). Run "Start Iboro (Windows).bat" any time to bring
REM it back - nothing gets uninstalled or deleted.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "deploy\windows\uninstall-services.ps1"
echo.
echo Stopped. Double-click "Start Iboro (Windows).bat" any time to bring it back.
pause
