@echo off
setlocal
cd /d "%~dp0"
python tests\run_all.py
if errorlevel 1 exit /b %errorlevel%
