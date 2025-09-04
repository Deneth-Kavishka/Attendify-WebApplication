@echo off
echo ===============================================
echo    SmartTrack RFID Serial Reader Launcher
echo ===============================================
echo.
echo Starting RFID Serial communication service...
echo.

echo Checking Python environment...
python --version
echo.

echo Installing required packages...
pip install pyserial psycopg2 firebase-admin
echo.

echo Starting Basic RFID Serial Test...
echo Press Ctrl+C to stop the service
echo.
python test_serial_basic.py

pause
