#!/usr/bin/env powershell

# SmartTrack Enhanced RFID System Startup Script
# This script starts all necessary services for the RFID attendance system
# 
# Services included:
# - PostgreSQL Database
# - Node.js Backend with Enhanced RFID Service
# - Python Face Recognition Service (backup)
# - React Frontend Development Server
# 
# Version: 2.0.0

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SmartTrack Enhanced RFID System Startup" -ForegroundColor Cyan
Write-Host "  Version 2.0.0" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Function to start a service in a new window
function Start-Service {
    param(
        [string]$Title,
        [string]$Command,
        [string]$WorkingDirectory = $PWD,
        [int]$Port = 0
    )
    
    if ($Port -gt 0 -and (Test-Port $Port)) {
        Write-Host "⚠️  Port $Port is already in use for $Title" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🚀 Starting $Title..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WorkingDirectory'; $Command" -WindowStyle Normal
    Start-Sleep -Seconds 2
}

# Check Node.js installation
Write-Host "🔧 Checking system requirements..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check npm packages
Write-Host "📦 Checking npm packages..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing npm packages..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install npm packages" -ForegroundColor Red
        exit 1
    }
}

# Check PostgreSQL connection
Write-Host "🐘 Checking PostgreSQL connection..." -ForegroundColor Yellow
try {
    # Test database connection
    $dbTest = npm run test:db 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL connection successful" -ForegroundColor Green
    } else {
        Write-Host "⚠️  PostgreSQL connection failed - some features may not work" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not test PostgreSQL connection" -ForegroundColor Yellow
}

# Check Python installation (for face recognition backup)
Write-Host "🐍 Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python version: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Python not found - face recognition backup will not be available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Starting all services..." -ForegroundColor Cyan
Write-Host ""

# Start Backend Server (Enhanced RFID Service included)
Start-Service -Title "Backend Server (Enhanced RFID)" -Command "npm run dev" -Port 5000

# Start WebSocket Server for real-time communication
Write-Host "🔌 WebSocket server will start automatically with the backend (Port 8080)" -ForegroundColor Green

# Start Frontend Development Server
Start-Service -Title "Frontend Development Server" -Command "npm run dev:client" -Port 5173

# Start Python Face Recognition Service (if available)
if (Test-Path "python_backend/requirements.txt") {
    Start-Service -Title "Python Face Recognition Service" -Command "cd python_backend; python simple_face_service.py" -WorkingDirectory "$PWD/python_backend" -Port 8000
} else {
    Write-Host "⚠️  Python backend not found - skipping face recognition service" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All Services Started Successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Service URLs:" -ForegroundColor White
Write-Host "   • Frontend:           http://localhost:5173" -ForegroundColor Gray
Write-Host "   • Backend API:        http://localhost:5000" -ForegroundColor Gray
Write-Host "   • WebSocket:          ws://localhost:8080" -ForegroundColor Gray
Write-Host "   • RFID Service:       ws://localhost:8080/rfid" -ForegroundColor Gray
if (Test-Path "python_backend") {
    Write-Host "   • Face Recognition:   http://localhost:8000" -ForegroundColor Gray
}
Write-Host ""
Write-Host "🔧 RFID Device Configuration:" -ForegroundColor White
Write-Host "   • Server Host:        192.168.8.110 (update in Arduino code)" -ForegroundColor Gray
Write-Host "   • Server Port:        5000" -ForegroundColor Gray
Write-Host "   • WebSocket Path:     /" -ForegroundColor Gray
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor White
Write-Host "   1. Update WiFi credentials in Arduino code" -ForegroundColor Gray
Write-Host "   2. Update server IP address in Arduino code" -ForegroundColor Gray
Write-Host "   3. Upload Enhanced_NodeMCU_RFID_Final.ino to your NodeMCU" -ForegroundColor Gray
Write-Host "   4. Open frontend and navigate to RFID Scanner page" -ForegroundColor Gray
Write-Host "   5. Test RFID scanning with registered student cards" -ForegroundColor Gray
Write-Host ""
Write-Host "🐛 Troubleshooting:" -ForegroundColor White
Write-Host "   • Check Serial Monitor in Arduino IDE for NodeMCU logs" -ForegroundColor Gray
Write-Host "   • Verify WiFi connection on NodeMCU" -ForegroundColor Gray
Write-Host "   • Check WebSocket connection in browser developer tools" -ForegroundColor Gray
Write-Host "   • Ensure RFID cards are registered in the system" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Keep the script running
try {
    while ($true) {
        Start-Sleep -Seconds 30
        
        # Check if services are still running
        $backendRunning = Test-Port 5000
        $frontendRunning = Test-Port 5173
        $websocketRunning = Test-Port 8080
        
        $status = "Backend: " + $(if ($backendRunning) { "✅" } else { "❌" })
        $status += " | Frontend: " + $(if ($frontendRunning) { "✅" } else { "❌" })
        $status += " | WebSocket: " + $(if ($websocketRunning) { "✅" } else { "❌" })
        
        Write-Host "📊 Service Status: $status" -ForegroundColor Cyan
    }
} catch {
    Write-Host ""
    Write-Host "🛑 Shutting down services..." -ForegroundColor Yellow
    Write-Host "All service windows should be closed manually." -ForegroundColor Gray
}
