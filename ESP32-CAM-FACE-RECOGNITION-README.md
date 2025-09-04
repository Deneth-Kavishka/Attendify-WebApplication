# ESP32-CAM Face Recognition System

Complete face recognition attendance system using ESP32-CAM, Python backend, and React frontend.

## 🎯 System Overview

### Hardware Requirements

- **ESP32-CAM Module** (AI-Thinker)
  - Pins: 3V3, IO16, IO0, GND, VCC, UOR, UOT, GND/R, IO4, IO2, IO14, IO15, IO13, IO12, GND, 5V
  - Camera: OV2640
  - Power: 5V external supply recommended

### Software Stack

- **Arduino Code**: ESP32-CAM firmware with face recognition
- **Python Backend**: Flask service with face recognition (OpenCV + face_recognition)
- **Node.js Backend**: Express.js API server
- **React Frontend**: Live camera monitoring and enrollment interface

## 🚀 Quick Start

### 1. Setup Dependencies

```bash
# Run the setup script
setup-esp32-face-recognition.bat
```

### 2. Configure ESP32-CAM

1. Open `arduino_code/ESP32_CAM_Final_FaceRecognition.ino` in Arduino IDE
2. Update WiFi credentials:
   ```cpp
   const char* ssid = "Dialog 4G 588";           // Your WiFi name
   const char* password = "83EF36AA";            // Your WiFi password
   const char* serverURL = "http://192.168.8.110:5000";     // Node.js server
   const char* pythonURL = "http://192.168.8.110:8000";     // Python backend
   ```
3. Upload to ESP32-CAM
4. Open Serial Monitor to verify connection

### 3. Start All Services

```bash
# Start all services automatically
start-esp32-face-recognition.bat
```

## 📱 System Components

### ESP32-CAM Firmware

**File**: `arduino_code/ESP32_CAM_Final_FaceRecognition.ino`

**Features**:

- 📷 MJPEG camera streaming
- 🔍 Motion detection for proximity sensing
- 📡 WiFi connectivity with status monitoring
- 🔗 WebSocket communication for real-time updates
- 💓 Heartbeat monitoring
- 🚨 LED status indicators
- 🌐 Built-in web interface

**Pin Usage**:

```
IO4  - Flash LED (built-in)
IO2  - Status LED
IO13 - Motion sensor (optional)
IO14 - Manual capture button
IO15 - Proximity sensor (optional)
IO12 - External status LED
IO16 - Serial TX (UOT)
```

**LED Status Codes**:

- 1 blink: Camera initialized
- 2 blinks: WiFi connecting
- 3 blinks: All systems ready
- Solid ON: Normal operation
- Fast blinking: Face recognition in progress

### Python Face Recognition Service

**File**: `python_backend/complete_face_service.py`

**Features**:

- 🎯 Real-time face recognition
- 👥 Student enrollment with multiple images
- 📊 Recognition statistics and analytics
- 🔗 WebSocket real-time updates
- 💾 Persistent face encodings storage
- 📝 Attendance logging

**API Endpoints**:

```
GET  /health                    - Service health check
POST /api/face/enroll          - Enroll new student face
POST /api/face/recognize       - Recognize face from ESP32
GET  /api/students             - List all students
POST /api/students             - Add new student
GET  /api/attendance           - Get attendance records
GET  /api/statistics           - Get recognition statistics
```

**Dependencies**:

- Flask + Flask-SocketIO
- OpenCV (`cv2`)
- `face_recognition` library
- NumPy, Pillow

### React Frontend

**Files**:

- `client/src/components/ui/live-camera-monitor.jsx`
- `client/src/components/ui/attendance-feed.jsx`
- `client/src/components/ui/face-enrollment-form.jsx`

**Features**:

- 📹 Live camera stream monitoring
- 🔍 ESP32 device auto-discovery
- 👥 Face enrollment interface
- 📊 Real-time attendance feed
- 🐍 Python service health monitoring
- 🔗 WebSocket real-time updates

## 🌐 Access Points

Once all services are running:

| Service        | URL                   | Purpose                    |
| -------------- | --------------------- | -------------------------- |
| Frontend App   | http://localhost:3000 | Main application interface |
| Node.js API    | http://localhost:5000 | Backend API server         |
| Python Service | http://localhost:8000 | Face recognition service   |
| ESP32-CAM      | http://192.168.8.XXX  | Direct ESP32 access        |
| ESP32 Scanner  | esp32-scanner.html    | Find ESP32 devices         |

## 📋 Usage Instructions

### 1. Enroll Student Faces

1. Navigate to the Face Enrollment section
2. Fill in Student ID and Name
3. Click "Start Camera" and position face in circle
4. Click "Capture" when face is properly positioned
5. Click "Enroll Face" to save to database

### 2. Start Face Recognition

1. Upload ESP32 firmware and verify connection
2. Open Live Camera Monitor in frontend
3. Select ESP32 device from dropdown
4. Toggle monitoring ON
5. ESP32 will automatically recognize faces when motion is detected

### 3. View Real-time Attendance

1. Attendance Feed shows live recognition results
2. Displays student name, confidence score, and timestamp
3. Automatically updates via WebSocket connections

## 🔧 Configuration

### WiFi Settings

Update in ESP32 firmware:

```cpp
const char* ssid = "Your_WiFi_Name";
const char* password = "Your_WiFi_Password";
```

### Server URLs

Update your computer's IP address:

```cpp
const char* serverURL = "http://YOUR_IP:5000";
const char* pythonURL = "http://YOUR_IP:8000";
```

### Camera Settings

Adjust in ESP32 firmware:

```cpp
config.frame_size = FRAMESIZE_VGA;  // 640x480
config.jpeg_quality = 12;           // 1-63 (lower = better quality)
config.fb_count = 2;                // Frame buffers
```

## 🛠️ Troubleshooting

### ESP32-CAM Issues

1. **Camera not initializing**:

   - Check camera module connection
   - Verify power supply (5V recommended)
   - Try different frame size/quality settings

2. **WiFi connection failed**:

   - Verify SSID and password
   - Check WiFi signal strength
   - Restart ESP32-CAM

3. **No camera stream**:
   - Check IP address in Serial Monitor
   - Test direct ESP32 access: http://ESP32_IP/
   - Verify CORS headers in browser

### Python Service Issues

1. **Face recognition library installation**:

   ```bash
   pip install cmake
   pip install dlib
   pip install face-recognition
   ```

2. **OpenCV installation**:

   ```bash
   pip install opencv-python
   ```

3. **Service not responding**:
   - Check port 8000 is available
   - Verify Python dependencies installed
   - Check firewall settings

### Frontend Issues

1. **ESP32 not detected**:

   - Run esp32-scanner.html to find devices
   - Check network connectivity
   - Verify ESP32 IP range

2. **WebSocket connection failed**:
   - Check all services are running
   - Verify ports 3000, 5000, 8000 are available
   - Check browser console for errors

## 📊 Monitoring & Debugging

### ESP32 Serial Monitor

Monitor ESP32 status and debug information:

```
🎥 ESP32-CAM FACE RECOGNITION SYSTEM
📱 Device ID: ESP32_CAM_001
📍 Location: Room A101
✅ Camera: Initialized successfully
✅ WiFi Connected: 192.168.8.105
🌐 Web Interface: http://192.168.8.105/
💓 Heartbeat sent: HTTP 200
🔍 Starting face recognition...
✅ Face recognition completed successfully
```

### Python Service Logs

Check `python_backend/face_recognition.log` for detailed recognition logs.

### Frontend Debug Info

Open browser developer console to see:

- WebSocket connection status
- ESP32 device discovery
- Python service health checks
- Real-time attendance updates

## 🎯 Performance Optimization

### ESP32-CAM

- Use VGA resolution for balance of quality/speed
- Adjust JPEG quality (12-15 recommended)
- Enable motion detection to reduce processing
- Use external antenna for better WiFi signal

### Python Service

- Increase face recognition tolerance for better matching
- Optimize image preprocessing
- Use multiple face encodings per student
- Implement caching for known faces

### Network

- Use 5GHz WiFi for better bandwidth
- Place ESP32-CAM close to router
- Consider dedicated network for IoT devices

## 📝 Development Notes

### File Structure

```
arduino_code/
├── ESP32_CAM_Final_FaceRecognition.ino    # Main ESP32 firmware
├── ESP32_CAM_Simple_Debug.ino             # Debug version
└── camera_pins.h                          # Pin definitions

python_backend/
├── complete_face_service.py               # Main Python service
├── face_recognition_service.py            # Face recognition logic
├── requirements.txt                       # Python dependencies
└── *.pkl, *.json                         # Data storage files

client/src/components/ui/
├── live-camera-monitor.jsx               # Camera monitoring interface
├── attendance-feed.jsx                   # Real-time attendance display
└── face-enrollment-form.jsx              # Student enrollment form
```

### Adding New Features

1. **New ESP32 sensors**: Add to pin definitions and setup()
2. **Face recognition improvements**: Modify Python service algorithms
3. **Frontend enhancements**: Add new React components
4. **Database integration**: Extend Node.js backend APIs

## 🤝 Support

For issues and questions:

1. Check Serial Monitor output from ESP32
2. Review Python service logs
3. Check browser console for frontend errors
4. Verify all services are running on correct ports
5. Test network connectivity between components

## 📄 License

This project is for educational and development purposes. Please ensure compliance with privacy laws when using face recognition technology.
