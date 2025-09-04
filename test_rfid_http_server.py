#!/usr/bin/env python3
"""
SmartTrack RFID HTTP Server Test Suite
====================================
Quick tests to verify all endpoints are working correctly
"""

import requests
import json
import time

# Configuration
SERVER_URL = "http://localhost:5080"
TEST_RFID_CARDS = ["1234567890", "0987654321", "UNKNOWN_CARD"]

def test_server_status():
    """Test server status endpoint"""
    print("🔍 Testing server status...")
    try:
        response = requests.get(f"{SERVER_URL}/status")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Server Status: {data['status']}")
            print(f"📚 Students Loaded: {data['students_loaded']}")
            print(f"📱 Connected Devices: {data['connected_devices']}")
            return True
        else:
            print(f"❌ Status check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Status check error: {e}")
        return False

def test_rfid_scan(rfid_card, device_id="TEST_DEVICE"):
    """Test RFID scan endpoint"""
    print(f"🔍 Testing RFID scan: {rfid_card}")
    try:
        payload = {
            "rfidCard": rfid_card,
            "deviceId": device_id,
            "location": "Test Location",
            "timestamp": int(time.time() * 1000),
            "deviceUptime": 12345,
            "signalStrength": -45
        }
        
        response = requests.post(
            f"{SERVER_URL}/rfid-scan",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data['success']:
                print(f"✅ RFID Scan Success: {data['student']['fullName']} ({data['student']['studentId']})")
                return True
            else:
                print(f"❌ RFID Scan Failed: {data['message']}")
                return False
        elif response.status_code == 404:
            data = response.json()
            print(f"⚠️ RFID Card Not Found: {data['message']}")
            return True  # This is expected for unknown cards
        else:
            print(f"❌ RFID Scan Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ RFID Scan Exception: {e}")
        return False

def test_api_endpoints():
    """Test React API endpoints"""
    print("🔍 Testing React API endpoints...")
    
    endpoints = [
        "/api/students",
        "/api/devices", 
        "/api/live-feed",
        "/api/attendance/recent"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{SERVER_URL}{endpoint}")
            if response.status_code == 200:
                data = response.json()
                if data.get('success', True):
                    print(f"✅ {endpoint}: OK")
                else:
                    print(f"❌ {endpoint}: {data.get('message', 'Failed')}")
            else:
                print(f"❌ {endpoint}: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: {e}")

def test_device_heartbeat():
    """Test device heartbeat endpoint"""
    print("🔍 Testing device heartbeat...")
    try:
        payload = {
            "deviceId": "TEST_DEVICE_001",
            "deviceType": "RFID_READER",
            "location": "Test Location",
            "version": "1.0.0",
            "uptime": 123456,
            "totalScans": 50,
            "successfulScans": 48,
            "failedScans": 2,
            "wifiSignal": -42,
            "freeHeap": 45000
        }
        
        response = requests.post(
            f"{SERVER_URL}/device-heartbeat",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data['success']:
                print(f"✅ Device Heartbeat Success")
                return True
            else:
                print(f"❌ Device Heartbeat Failed: {data['message']}")
                return False
        else:
            print(f"❌ Device Heartbeat Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Device Heartbeat Exception: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 SmartTrack RFID HTTP Server Test Suite")
    print("=" * 50)
    
    # Test server status
    if not test_server_status():
        print("❌ Server not responding. Please start the server first.")
        return
    
    print()
    
    # Test RFID scans
    print("📡 Testing RFID Scans:")
    for card in TEST_RFID_CARDS:
        test_rfid_scan(card)
        time.sleep(0.5)
    
    print()
    
    # Test API endpoints
    test_api_endpoints()
    
    print()
    
    # Test device heartbeat
    test_device_heartbeat()
    
    print()
    print("🎯 Test Summary:")
    print("✅ If all tests passed, your RFID system is ready!")
    print("📱 Upload the Arduino code to your NodeMCU")
    print("🌐 Open http://localhost:5080 to see the dashboard")
    print("⚡ Add the React component to your SmartTrack app")

if __name__ == "__main__":
    main()
