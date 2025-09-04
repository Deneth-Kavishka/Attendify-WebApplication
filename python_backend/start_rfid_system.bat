@echo off
title SmartTrack RFID Attendance System
color 0A

echo ============================================
echo   SmartTrack RFID Attendance System
echo   Starting Python Backend...
echo ============================================
echo.

cd /d "%~dp0"

echo Installing required packages...
pip install -r requirements_rfid.txt

echo.
echo Starting RFID Attendance System...
echo Press Ctrl+C to stop the system
echo.

python rfid_attendance_system.py

pause
