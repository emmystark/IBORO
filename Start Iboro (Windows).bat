@echo off
REM Double-click this file to install (first run) or start (every run
REM after) the Iboro app. Safe to double-click any time - on a
REM machine that's already set up, this just makes sure everything is
REM running and opens the app in your browser.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "deploy\windows\setup.ps1"
pause
