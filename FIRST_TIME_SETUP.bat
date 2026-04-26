@echo off
setlocal

REM One-time setup for Windows double-click workflow.
REM Installs dependencies, creates inference venv, and prepares Prisma.

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "INFERENCE=%ROOT%inference"
set "FRONTEND=%ROOT%frontend"

echo ============================================
echo Fin-Agri Score - First Time Setup
echo ============================================
echo.

echo [1/3] Backend dependencies + Prisma client...
cd /d "%BACKEND%"

REM Prisma on Windows often fails with EPERM if something is using the engine DLL
REM (Node dev server, another terminal, OneDrive locking files under Desktop, etc.).
echo.
echo Tip: If Prisma errors with EPERM, run STOP_OBJECTIVE3.bat first, close all "npm run dev"
echo      windows, and avoid OneDrive-synced Desktop folders if possible.
echo.

echo Stopping any process listening on port 4000 (backend dev server)...
for /f "tokens=5" %%A in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
  taskkill /PID %%A /F >nul 2>&1
)

call npm install
if errorlevel 1 goto :fail

call npx prisma generate
if errorlevel 1 (
  echo.
  echo [RETRY] Prisma generate failed — waiting 3s, removing stale .prisma output, trying once more...
  timeout /t 3 >nul
  if exist "node_modules\.prisma" rmdir /s /q "node_modules\.prisma" 2>nul
  call npx prisma generate
)
if errorlevel 1 goto :fail

call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo [2/3] Inference Python environment...
cd /d "%INFERENCE%"
if not exist ".venv\Scripts\python.exe" (
  py -3.12 -m venv .venv
  if errorlevel 1 goto :fail
)
call .\.venv\Scripts\python -m pip install --upgrade pip
if errorlevel 1 goto :fail
call .\.venv\Scripts\python -m pip install -r requirements.txt
if errorlevel 1 goto :fail

echo.
echo [3/3] Frontend dependencies...
cd /d "%FRONTEND%"
call npm install
if errorlevel 1 goto :fail

echo.
echo ============================================
echo Setup complete.
echo Next: double-click RUN_OBJECTIVE3.bat
echo ============================================
pause
exit /b 0

:fail
echo.
echo [ERROR] Setup failed. Check the messages above.
echo.
echo If the error mentions EPERM and query_engine-windows.dll.node:
echo   - Run STOP_OBJECTIVE3.bat, close every cmd window running npm/node, then run this setup again.
echo   - Repos under OneDrive\Desktop often hit file locks — move the project to e.g. C:\dev\hazel or
echo     pause OneDrive syncing for this folder, then retry.
pause
exit /b 1

