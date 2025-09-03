@echo off
echo ========================================
echo Starting ESP32-CAM Face Recognition System
echo ========================================
echo.

echo 🚀 Starting services in the following order:
echo 1. Python Face Recognition Service (Port 8000)
echo 2. Node.js Backend Server (Port 5000)
echo 3. React Frontend (Port 3000)
echo.

echo 🐍 Starting Python Face Recognition Service...
echo ----------------------------------------
start "Python Face Recognition" cmd /k "cd python_backend && python complete_face_service.py"
timeout /t 3 /nobreak >nul

echo.
echo 🟢 Starting Node.js Backend Server...
echo ----------------------------------------
start "Node.js Backend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ⚛️ Starting React Frontend...
echo ----------------------------------------
start "React Frontend" cmd /k "cd client && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ✅ All services started!
echo ========================================
echo.
echo 🌐 Access Points:
echo • Frontend: http://localhost:3000
echo • Node.js API: http://localhost:5000
echo • Python Service: http://localhost:8000
echo • ESP32 Scanner: esp32-scanner.html
echo.
echo 📱 ESP32-CAM Setup:
echo 1. Upload ESP32_CAM_Final_FaceRecognition.ino to ESP32-CAM
echo 2. Update WiFi credentials in Arduino code:
echo    - ssid = "Dialog 4G 588"
echo    - password = "83EF36AA" 
echo    - serverURL = "http://192.168.8.110:5000"
echo    - pythonURL = "http://192.168.8.110:8000"
echo 3. Open Serial Monitor to verify ESP32 connection
echo 4. Check esp32-scanner.html to find ESP32 IP address
echo.
echo 🎯 Usage:
echo 1. Enroll student faces using the Face Enrollment form
echo 2. Start camera monitoring in Live Camera Monitor
echo 3. View real-time attendance in Attendance Feed
echo.
echo Press any key to open ESP32 Scanner...
pause >nul
start esp32-scanner.html
