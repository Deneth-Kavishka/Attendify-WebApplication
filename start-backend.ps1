# Node.js Backend Startup Script for ESP32-CAM Face Recognition System
# ====================================================================

Write-Host "🚀 Starting ESP32-CAM Face Recognition System Backend..." -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green

# Function to kill processes on specific ports
function Stop-ProcessOnPort {
    param([int]$Port)
    
    Write-Host "🔄 Checking port $Port..." -ForegroundColor Yellow
    
    $connections = netstat -ano | Select-String ":$Port\s"
    if ($connections) {
        foreach ($connection in $connections) {
            $parts = $connection.ToString().Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
            if ($parts.Count -ge 5) {
                $pid = $parts[-1]
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process -and $process.ProcessName -eq "node") {
                        Write-Host "🛑 Stopping Node.js process $pid on port $Port" -ForegroundColor Red
                        Stop-Process -Id $pid -Force
                    }
                } catch {
                    # Process might have already stopped
                }
            }
        }
    }
}

# Clean up ports
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 5000
Stop-ProcessOnPort -Port 8080

# Wait for cleanup
Start-Sleep -Seconds 3

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies if needed..." -ForegroundColor Yellow
npm install

Write-Host "🌐 Starting Node.js Backend Server..." -ForegroundColor Green

# Start the backend server
$env:NODE_ENV = "development"
npm run dev
