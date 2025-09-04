import requests
import base64
import time
import json
from datetime import datetime

# Test image - simple base64 encoded placeholder
test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

def test_face_recognition():
    """Test face recognition endpoint"""
    print("🔍 Testing face recognition...")
    
    url = "http://localhost:8000/api/face/recognize"
    
    payload = {
        "deviceId": "ESP32_CAM_001",
        "image": test_image,
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Face recognition test successful!")
        else:
            print("❌ Face recognition test failed!")
            
    except Exception as e:
        print(f"❌ Error testing face recognition: {e}")

def test_face_enrollment():
    """Test face enrollment endpoint"""
    print("\n👤 Testing face enrollment...")
    
    url = "http://localhost:8000/api/face/enroll"
    
    payload = {
        "student_id": "ST005",
        "student_name": "Test Student",
        "image": test_image
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Face enrollment test successful!")
        else:
            print("❌ Face enrollment test failed!")
            
    except Exception as e:
        print(f"❌ Error testing face enrollment: {e}")

def test_health_check():
    """Test health check endpoint"""
    print("\n🏥 Testing health check...")
    
    url = "http://localhost:8000/health"
    
    try:
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Health check test successful!")
        else:
            print("❌ Health check test failed!")
            
    except Exception as e:
        print(f"❌ Error testing health check: {e}")

def test_students_endpoint():
    """Test students endpoint"""
    print("\n👥 Testing students endpoint...")
    
    url = "http://localhost:8000/api/students"
    
    try:
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Students endpoint test successful!")
        else:
            print("❌ Students endpoint test failed!")
            
    except Exception as e:
        print(f"❌ Error testing students endpoint: {e}")

if __name__ == "__main__":
    print("🧪 ESP32-CAM Python Backend Test Suite")
    print("=" * 50)
    
    # Run all tests
    test_health_check()
    test_students_endpoint()
    test_face_enrollment()
    test_face_recognition()
    
    print("\n🎉 Test suite completed!")
    print("📋 You can now:")
    print("   1. Upload the ESP32-CAM Arduino code")
    print("   2. Open the frontend at http://localhost:5173")
    print("   3. Test live camera output and recognition")
