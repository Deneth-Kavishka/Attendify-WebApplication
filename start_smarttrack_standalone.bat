@echo off
title SmartTrack RFID Attendance System - Standalone Version
color 0A

echo.
echo ===================================================================
echo               SmartTrack RFID Attendance System
echo                      Standalone Version
echo ===================================================================
echo.
echo This version works without database dependencies
echo Data is stored in local CSV files
echo.
echo 1. Start Attendance System (RFID Scanning)
echo 2. Student Management System
echo 3. View Quick Reports
echo 4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Starting RFID Attendance System...
    echo Make sure your Arduino is connected to COM7
    echo Press Ctrl+C to stop the system
    echo.
    pause
    python smarttrack_attendance_standalone.py
) else if "%choice%"=="2" (
    echo.
    echo Starting Student Management System...
    echo.
    python student_management_standalone.py
) else if "%choice%"=="3" (
    echo.
    echo Quick Reports:
    echo.
    echo 1. Today's Attendance
    echo 2. All Students
    echo 3. Department Summary
    echo.
    set /p report="Choose report (1-3): "
    
    if "!report!"=="1" (
        python -c "
from student_management_standalone import StudentManagementStandalone
import sys
sm = StudentManagementStandalone()
sm.todays_attendance()
input('\nPress Enter to exit...')
"
    ) else if "!report!"=="2" (
        python -c "
from student_management_standalone import StudentManagementStandalone
import sys
sm = StudentManagementStandalone()
sm.view_all_students()
input('\nPress Enter to exit...')
"
    ) else if "!report!"=="3" (
        python -c "
from student_management_standalone import StudentManagementStandalone
import sys
sm = StudentManagementStandalone()
sm.department_summary()
input('\nPress Enter to exit...')
"
    ) else (
        echo Invalid choice
    )
) else if "%choice%"=="4" (
    echo.
    echo Goodbye!
    timeout /t 2 /nobreak > nul
    exit
) else (
    echo.
    echo Invalid choice. Please run the script again.
    pause
)

pause
