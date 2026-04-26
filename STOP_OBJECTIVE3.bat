@echo off
setlocal

echo Stopping Fin-Agri services on ports 4000, 5173, 8000...

for %%P in (4000 5173 8000) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /PID %%A /F >nul 2>&1
  )
)

echo Done.
pause

