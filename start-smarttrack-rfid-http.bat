@echo off
REM SmartTrack RFID HTTP Server Startup Script
REM ==========================================
REM Easy startup for Windows systems

echo.
echo ============================================
echo   🎯 SmartTrack RFID HTTP Server Setup
echo ============================================
echo.

REM Change to python_backend directory
cd /d "%~dp0python_backend"

echo 📦 Installing Python dependencies...
pip install -r requirements_http.txt

echo.
echo 🚀 Starting SmartTrack RFID HTTP Server...
echo.
echo 📡 Server will be available at:
echo    - Arduino Endpoint: http://localhost:8080/rfid-scan
echo    - Web Dashboard:     http://localhost:8080
echo    - React API:         http://localhost:8080/api/*
echo.
echo 💡 Ready for RFID scans! Connect your NodeMCU.
echo.
echo 🛑 Press Ctrl+C to stop the server
echo.

REM Start the HTTP server
python smarttrack_rfid_http_server.py

echo.
echo 🛑 Server stopped.
pause
