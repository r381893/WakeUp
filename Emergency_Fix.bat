@echo off
echo =======================================
echo      EMERGENCY SSL FIX
echo =======================================
cd backend
call venv\Scripts\activate

echo [Step 1] Uninstalling problematic certifi...
pip uninstall -y certifi

echo [Step 2] Reinstalling clean certifi...
pip install certifi==2024.2.2

echo [Step 3] Verifying path...
python -c "import certifi; print('New Cert Path:', certifi.where())"

echo.
echo FIX APPLIED. Please run WakeUp.bat again.
pause
