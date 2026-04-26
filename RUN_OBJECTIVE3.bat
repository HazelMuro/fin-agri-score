@echo off
setlocal

REM Double-click launcher for Objective 3 demo stack:
REM - Backend API (Node/Express)
REM - Inference service (Python/FastAPI)
REM - Frontend dashboard (React/Vite)

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "INFERENCE=%ROOT%inference"
set "FRONTEND=%ROOT%frontend"

echo Starting Fin-Agri Score services...
echo.

if not exist "%BACKEND%\node_modules" (
  echo [WARN] Backend dependencies are missing. Run FIRST_TIME_SETUP.bat first.
)
if not exist "%FRONTEND%\node_modules" (
  echo [WARN] Frontend dependencies are missing. Run FIRST_TIME_SETUP.bat first.
)
if not exist "%INFERENCE%\.venv\Scripts\python.exe" (
  echo [WARN] Inference venv missing. Run FIRST_TIME_SETUP.bat first.
)

start "Fin-Agri Backend (4000)" cmd /k "cd /d "%BACKEND%" && npm run dev"
start "Fin-Agri Inference (8000)" cmd /k "cd /d "%INFERENCE%" && .\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "Fin-Agri Frontend (5173)" cmd /k "cd /d "%FRONTEND%" && npm run dev"

timeout /t 4 >nul
start "" "http://localhost:5173"

echo.
echo Objective 3 launch triggered.
echo Browser opened at: http://localhost:5173
echo.
echo To stop everything quickly, double-click STOP_OBJECTIVE3.bat
echo.
pause

