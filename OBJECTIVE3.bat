@echo off
REM ========================================================================
REM  Objective 3 — Fin-Agri Score dashboard stack
REM  Starts backend (4000), inference (8000), frontend (5173) and opens the UI.
REM  Same behaviour as RUN_OBJECTIVE3.bat — use whichever name you prefer.
REM  First time? Run FIRST_TIME_SETUP.bat once. Stop services: STOP_OBJECTIVE3.bat
REM ========================================================================

cd /d "%~dp0"
call "%~dp0RUN_OBJECTIVE3.bat"
