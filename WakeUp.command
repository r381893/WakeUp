#!/bin/bash

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================="
echo "     WEALTH-OS: SYSTEM RESTART & LAUNCH (MAC)"
echo "================================================="

echo "[1/3] Cleaning up old processes..."
# Kill any existing uvicorn processes running main:app
pkill -f "uvicorn main:app" > /dev/null 2>&1
echo "(Old processes cleaned if any existed)"

echo "[2/3] Launching The Brain (Backend)..."
# Open a new Terminal window for the backend
osascript -e "tell application \"Terminal\" to do script \"cd \\\"$DIR/backend\\\" && source venv_mac/bin/activate && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload\""

echo "Waiting for backend to warm up..."
sleep 5

echo "[3/3] Launching The Interface (Frontend)..."
# Open a new Terminal window for the frontend
osascript -e "tell application \"Terminal\" to do script \"cd \\\"$DIR/frontend\\\" && npm run dev\""

echo ""
echo "================================================="
echo "SYSTEM STARTUP INITIATED."
echo "Opening browser at: http://localhost:5173"
echo "================================================="

# Wait a moment for frontend server to likely be up
sleep 10
open "http://localhost:5173"
