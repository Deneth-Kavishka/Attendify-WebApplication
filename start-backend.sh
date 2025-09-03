#!/bin/bash

# Node.js Backend Startup Script for ESP32-CAM Face Recognition System
# ====================================================================

echo "🚀 Starting ESP32-CAM Face Recognition System Backend..."
echo "======================================================="

# Check if required dependencies are installed
echo "📦 Checking dependencies..."

# Kill any existing processes on ports 5000 and 8080
echo "🔄 Cleaning up existing processes..."

# For Windows (PowerShell)
if command -v powershell &> /dev/null; then
    powershell -Command "Get-Process | Where-Object {$_.ProcessName -eq 'node'} | ForEach-Object {if ((Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in @(5000, 8080)}).Count -gt 0) {Stop-Process -Id $_.Id -Force}}"
fi

# Wait a moment for cleanup
sleep 2

echo "🌐 Starting Node.js Backend Server..."

# Start the backend server
NODE_ENV=development npm run dev

echo "✅ Backend startup complete!"
echo ""
echo "🔗 Your services should be running on:"
echo "   - Node.js Backend: http://localhost:5000"
echo "   - WebSocket Server: ws://localhost:8080"
echo ""
echo "📋 Next steps:"
echo "   1. Start the Python face recognition service"
echo "   2. Start the frontend development server"
echo "   3. Upload ESP32-CAM firmware"
