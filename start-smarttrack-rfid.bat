@echo off
REM SmartTrack RFID Attendance System - Windows Startup Script
REM This script automatically starts the complete RFID attendance system

title SmartTrack RFID Attendance System

echo.
echo ===============================================================
echo    🎯 SmartTrack RFID Attendance System Launcher
echo ===============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo 💡 Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Navigate to the python_backend directory
cd /d "%~dp0python_backend"

REM Check if the launcher script exists
if not exist "start_smarttrack_rfid.py" (
    echo ❌ SmartTrack launcher script not found
    echo 💡 Make sure you're running this from the SmartTrack root directory
    pause
    exit /b 1
)

echo 🚀 Starting SmartTrack RFID System...
echo.
echo 📋 What this will do:
echo    • Setup Python virtual environment
echo    • Install required packages
echo    • Start RFID WebSocket server
echo    • Launch web dashboard
echo    • Monitor system health
echo.
echo 🌐 After startup, open: http://localhost:5001
echo 📡 Device WebSocket: ws://localhost:3001/rfid-ws
echo.

pause

REM Start the Python launcher
python start_smarttrack_rfid.py

echo.
echo 🛑 SmartTrack RFID System has stopped
pause
