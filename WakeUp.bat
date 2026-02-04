@echo off
echo =================================================
echo      WEALTH-OS: SYSTEM RESTART & LAUNCH
echo =================================================

echo [1/3] Cleaning up old processes...
taskkill /F /IM uvicorn.exe >nul 2>&1
echo (If you have other Python scripts running, please ignore any errors below)
REM We wont kill python.exe globally to be safe, but we hope closing windows did it.

echo [2/3] Launching The Brain (Backend)...
start "Wealth-OS Brain" cmd /k "cd backend && call venv\Scripts\activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 4 >nul

echo [3/3] Launching The Interface (Frontend)...
start "Wealth-OS Interface" cmd /k "cd frontend && npm run dev"

echo.
echo =================================================
echo SYSTEM STARTUP INITIATED.
echo Browser launching automatically...
echo =================================================
pause
