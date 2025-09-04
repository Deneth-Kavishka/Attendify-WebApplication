# 🚀 HOW TO START YOUR NODE.JS BACKEND

## ✅ Your Node.js Backend is Currently Running!

**Status:** Your Node.js backend is successfully running on **http://localhost:5000**

## 🌐 Current System Status:

1. **✅ Node.js Backend:** Running on port 5000

   - Express server with API endpoints
   - WebSocket support for real-time updates
   - PostgreSQL database connection
   - Hardware device monitoring

2. **✅ Frontend Interface:** Available at http://localhost:5000
   - React-based web interface
   - Real-time attendance feed
   - Face enrollment forms
   - Camera monitoring dashboard

## 📱 Access Your Application:

- **Main Application:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/hardware
- **Admin Dashboard:** http://localhost:5000 (login required)

## 🔧 Backend Services Include:

- **Express.js Server** - Main web server
- **WebSocket Server** - Real-time communication
- **PostgreSQL Database** - Data storage
- **Device Status Monitor** - ESP32-CAM monitoring
- **RFID Service** - Attendance tracking
- **API Endpoints** - RESTful services

## 📋 If You Need to Restart the Backend:

### Option 1: Using npm (Recommended)

```powershell
# From project root directory
npm run dev
```

### Option 2: Manual Start

```powershell
# Set environment and start
$env:NODE_ENV="development"
npm run dev
```

### Option 3: Production Mode

```powershell
# Build and start production
npm run build
npm start
```

## 🛠️ Troubleshooting:

### If Port 5000 is Busy:

```powershell
# Find and stop the process
Get-Process -Name node | Stop-Process -Force
# Then restart
npm run dev
```

### If Port 8080 Conflicts:

The WebSocket server uses port 8080. If there's a conflict, the system will automatically handle it.

## 🎯 Next Steps:

1. **✅ Node.js Backend** - Currently Running
2. **🔄 Python Backend** - Start face recognition service: `cd python_backend; python simple_face_service.py`
3. **📱 ESP32-CAM** - Upload Arduino firmware
4. **🧪 Test System** - Access http://localhost:5000

## 📊 System Architecture:

```
ESP32-CAM → WiFi → Node.js Backend (Port 5000) → Database
    ↓                      ↓                        ↓
Camera Feed         React Frontend           Attendance Data
    ↓                      ↓                        ↓
Python Service     Real-time Updates      WebSocket (Port 8080)
```

## 🎉 Your Node.js backend is ready and operational!
