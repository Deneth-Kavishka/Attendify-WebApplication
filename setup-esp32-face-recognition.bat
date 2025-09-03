@echo off
echo ========================================
echo ESP32-CAM Face Recognition Setup
echo ========================================
echo.

echo 📦 Installing Python Dependencies...
echo ----------------------------------------
cd python_backend
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python dependency installation failed!
    echo Please check your Python installation and try again.
    pause
    exit /b 1
)

echo.
echo ✅ Python dependencies installed successfully!
echo.

echo 📦 Installing Node.js Dependencies...
echo ----------------------------------------
cd ..
npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js dependency installation failed!
    echo Please check your Node.js installation and try again.
    pause
    exit /b 1
)

echo.
echo ✅ Node.js dependencies installed successfully!
echo.

echo 📦 Installing Frontend Dependencies...
echo ----------------------------------------
cd client
npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Frontend dependency installation failed!
    echo Please check your Node.js installation and try again.
    pause
    exit /b 1
)

echo.
echo ✅ Frontend dependencies installed successfully!
echo.

echo 🎉 Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Upload ESP32_CAM_Final_FaceRecognition.ino to your ESP32-CAM
echo 2. Update WiFi credentials in the Arduino code
echo 3. Run start-services.bat to start all services
echo.
echo Files to check:
echo • arduino_code/ESP32_CAM_Final_FaceRecognition.ino
echo • python_backend/complete_face_service.py
echo • client/src/components/ui/live-camera-monitor.jsx
echo.
pause
