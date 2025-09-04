@echo off
title SmartTrack RFID Attendance System
color 0A

echo.
echo ===============================================
echo    SmartTrack RFID Attendance System
echo ===============================================
echo.
echo Select an option:
echo.
echo 1. Start Attendance System (Serial)
echo 2. Student Management System
echo 3. System Status Check
echo 4. Basic Serial Test
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto attendance
if "%choice%"=="2" goto management
if "%choice%"=="3" goto status
if "%choice%"=="4" goto test
if "%choice%"=="5" goto exit

echo Invalid choice. Please try again.
pause
goto start

:attendance
echo.
echo Starting SmartTrack Attendance System...
echo Make sure your Arduino is connected and running!
echo.
python smarttrack_attendance_system.py
pause
goto start

:management
echo.
echo Starting Student Management System...
echo.
python student_management_system.py
pause
goto start

:status
echo.
echo Checking System Status...
echo.
python check_system_status.py
pause
goto start

:test
echo.
echo Starting Basic Serial Test...
echo.
python test_serial_basic.py
pause
goto start

:exit
echo.
echo Goodbye!
timeout /t 2 > nul
