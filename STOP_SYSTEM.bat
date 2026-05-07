@echo off
echo Stopping all Fin-Agri services...
taskkill /F /IM node.exe /T
taskkill /F /IM python.exe /T
echo Done.
pause
