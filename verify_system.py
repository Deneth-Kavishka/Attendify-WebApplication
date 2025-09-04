#!/usr/bin/env python3
"""
SmartTrack RFID System Verification Script
Tests all components of the RFID attendance system
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
SERVER_URL = "http://localhost:5080"
TEST_TIMEOUT = 5

def print_header(title):
    print(f"\n{'='*60}")
    print(f"🔍 {title}")
    print(f"{'='*60}")

def print_status(test_name, success, message=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if message:
        print(f"    📝 {message}")

def test_server_status():
    """Test if the server is running and responsive"""
    print_header("SERVER STATUS TEST")
    
    try:
        response = requests.get(f"{SERVER_URL}/status", timeout=TEST_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            print_status("Server Online", True, f"Version: {data.get('version', 'Unknown')}")
            print_status("Students Loaded", True, f"Count: {data.get('students_loaded', 0)}")
            print_status("Connected Devices", True, f"Count: {data.get('connected_devices', 0)}")
            return True
        else:
            print_status("Server Status", False, f"HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_status("Server Connection", False, str(e))
        return False

def test_rfid_scan():
    """Test RFID scan endpoint"""
    print_header("RFID SCAN TEST")
    
    test_payload = {
        "rfidCard": "TEST123456",
        "deviceId": "VERIFICATION_DEVICE",
        "location": "Test Location",
        "timestamp": int(time.time() * 1000),
        "deviceUptime": 3600,
        "signalStrength": -45
    }
    
    try:
        response = requests.post(
            f"{SERVER_URL}/rfid-scan",
            json=test_payload,
            timeout=TEST_TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            print_status("RFID Scan Endpoint", True, "Scan processed successfully")
            if data.get('success'):
                print_status("Scan Processing", True, data.get('message', ''))
            else:
                print_status("Scan Processing", False, data.get('message', ''))
            return True
        else:
            print_status("RFID Scan Endpoint", False, f"HTTP {response.status_code}")
            print(f"    Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print_status("RFID Scan Request", False, str(e))
        return False

def test_api_endpoints():
    """Test API endpoints for React frontend"""
    print_header("API ENDPOINTS TEST")
    
    endpoints = [
        "/api/recent-scans",
        "/api/stats", 
        "/api/devices",
        "/api/students",
        "/api/daily-summary"
    ]
    
    success_count = 0
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{SERVER_URL}{endpoint}", timeout=TEST_TIMEOUT)
            if response.status_code == 200:
                print_status(f"GET {endpoint}", True, "Endpoint responsive")
                success_count += 1
            else:
                print_status(f"GET {endpoint}", False, f"HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            print_status(f"GET {endpoint}", False, str(e))
    
    return success_count == len(endpoints)

def test_device_heartbeat():
    """Test device heartbeat endpoint"""
    print_header("DEVICE HEARTBEAT TEST")
    
    heartbeat_payload = {
        "deviceId": "VERIFICATION_DEVICE",
        "deviceType": "RFID_READER",
        "location": "Test Location",
        "version": "1.0.0",
        "timestamp": int(time.time() * 1000),
        "uptime": 3600,
        "totalScans": 10,
        "successfulScans": 8,
        "failedScans": 2,
        "wifiSignal": -55,
        "freeHeap": 45000,
        "status": "online"
    }
    
    try:
        response = requests.post(
            f"{SERVER_URL}/device-heartbeat",
            json=heartbeat_payload,
            timeout=TEST_TIMEOUT
        )
        
        if response.status_code == 200:
            print_status("Device Heartbeat", True, "Device registered successfully")
            return True
        else:
            print_status("Device Heartbeat", False, f"HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_status("Device Heartbeat", False, str(e))
        return False

def main():
    """Run all verification tests"""
    print_header("SMARTTRACK RFID SYSTEM VERIFICATION")
    print(f"🕐 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Testing server: {SERVER_URL}")
    
    # Run all tests
    tests = [
        ("Server Status", test_server_status),
        ("RFID Scan Processing", test_rfid_scan),
        ("API Endpoints", test_api_endpoints),
        ("Device Heartbeat", test_device_heartbeat)
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for test_name, test_func in tests:
        if test_func():
            passed_tests += 1
    
    # Final report
    print_header("VERIFICATION RESULTS")
    print(f"📊 Tests Passed: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED - System is ready for deployment!")
        print("\n📋 Next Steps:")
        print("   1. Update Arduino code with your WiFi credentials")
        print("   2. Upload Arduino code to NodeMCU ESP8266")
        print("   3. Integrate React components into your frontend")
        print("   4. Test with actual RFID cards")
        sys.exit(0)
    else:
        print("⚠️  SOME TESTS FAILED - Please check server configuration")
        print("\n🔧 Troubleshooting:")
        print("   1. Ensure Python server is running on port 5080")
        print("   2. Check PostgreSQL database connection")
        print("   3. Verify Firebase configuration")
        print("   4. Review server logs for errors")
        sys.exit(1)

if __name__ == "__main__":
    main()
