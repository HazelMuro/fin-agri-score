@echo off
title Fin-Agri Score System Starter
echo ===================================================
echo   Fin-Agri Score: Defense Edition 
echo ===================================================
echo.
echo [1/3] Starting Inference Engine (AI Model)...
start "Fin-Agri: Inference (AI)" cmd /k "cd inference && python main.py"

echo [2/3] Starting Backend API...
start "Fin-Agri: Backend (API)" cmd /k "cd backend && npm run dev"

echo [3/3] Starting Frontend Dashboard...
start "Fin-Agri: Frontend (UI)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   SYSTEM IS STARTING UP...
echo   Wait 5 seconds for servers to ready...
echo ===================================================
timeout /t 5 >nul

echo Opening browser tabs for multi-role demo...
echo [Tab 1] Loan Officer
start http://localhost:5173
echo [Tab 2] Credit Manager
start http://localhost:5173
echo [Tab 3] System Admin
start http://localhost:5173

echo.
echo ===================================================
echo   SYSTEM IS READY!
echo   Three independent tabs have been opened.
echo   Log in with different roles in each tab.
echo ===================================================
pause
