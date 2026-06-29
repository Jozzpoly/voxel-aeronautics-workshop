@echo off
setlocal
cd /d "%~dp0"
echo Starting VAW Blockbench Import Studio...
echo Studio: http://127.0.0.1:8765/tools/blockbench_import_studio/
echo Install endpoint: http://127.0.0.1:8765/__vaw/install_visual_block
echo.
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found in PATH.
  echo Install Node.js or run: python tools\serve.py --studio
  pause
  exit /b 1
)
call npm.cmd run studio:serve
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Studio server stopped with exit code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
