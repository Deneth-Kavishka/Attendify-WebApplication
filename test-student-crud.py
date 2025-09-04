#!/usr/bin/env python3
"""
Test script for Student CRUD operations
Tests Create, Read, Update, Delete operations for the Admin portal
"""
import requests
import json
import time

BASE_URL = "http://localhost:5000"
HEADERS = {
    "Content-Type": "application/json"
}

def test_login():
    """Test login and get auth token"""
    print("🔐 Testing Login...")
    
    login_data = {
        "username": "admin",  # Assuming demo data has admin user
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/api/auth/login", 
                           headers=HEADERS, 
                           json=login_data)
    
    if response.status_code == 200:
        token = response.json().get("token")
        if token:
            print(f"✅ Login successful! Token: {token[:20]}...")
            return token
        else:
            print("❌ Login response missing token")
            return None
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_create_student(token):
    """Test creating a new student"""
    print("\\n📝 Testing Create Student...")
    
    student_data = {
        "fullName": "Test Student CRUD",
        "email": "test.crud@example.com",
        "studentId": "TEST001",
        "enrollmentYear": 2024,
        "department": "Computer Science",
        "active": True,
        # Personal Information
        "nic": "200012345678",
        "mobileNumber": "0771234567",
        "gender": "male",
        "dateOfBirth": "2000-01-15",
        "address": "123 Test Street, Colombo",
        "guardianName": "Test Guardian",
        "guardianContact": "0777777777",
        "emergencyContact": "0788888888",
        # Academic Information
        "batch": "2024A",
        "semester": "1",
        "gpa": 3.75,
        # RFID
        "rfidCard": "TEST12345",
        "faceRegistrationStatus": "pending"
    }
    
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    
    response = requests.post(f"{BASE_URL}/api/students", 
                           headers=headers, 
                           json=student_data)
    
    if response.status_code == 201:
        student = response.json()
        print(f"✅ Student created successfully! ID: {student.get('id')}")
        return student
    else:
        print(f"❌ Create failed: {response.status_code} - {response.text}")
        return None

def test_read_students(token):
    """Test reading all students"""
    print("\\n📖 Testing Read Students...")
    
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/students", headers=headers)
    
    if response.status_code == 200:
        students = response.json()
        print(f"✅ Retrieved {len(students)} students")
        
        # Show first student details
        if students:
            first_student = students[0]
            print(f"   First student: {first_student.get('fullName')} (ID: {first_student.get('id')})")
        
        return students
    else:
        print(f"❌ Read failed: {response.status_code} - {response.text}")
        return []

def test_read_single_student(token, student_id):
    """Test reading a single student"""
    print(f"\\n👤 Testing Read Single Student: {student_id}")
    
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/api/students/{student_id}", headers=headers)
    
    if response.status_code == 200:
        student = response.json()
        print(f"✅ Retrieved student: {student.get('fullName')}")
        print(f"   Email: {student.get('email')}")
        print(f"   Student ID: {student.get('studentId')}")
        print(f"   Department: {student.get('department')}")
        print(f"   RFID: {student.get('rfidCard')}")
        print(f"   Mobile: {student.get('mobileNumber')}")
        print(f"   NIC: {student.get('nic')}")
        return student
    else:
        print(f"❌ Read single failed: {response.status_code} - {response.text}")
        return None

def test_update_student(token, student_id):
    """Test updating a student"""
    print(f"\\n✏️ Testing Update Student: {student_id}")
    
    update_data = {
        "fullName": "Updated Test Student",
        "email": "updated.test@example.com",
        "studentId": "UPDATED001",
        "enrollmentYear": 2024,
        "department": "Information Technology",
        "active": True,
        # Personal Information
        "nic": "200012345678",
        "mobileNumber": "0779999999",  # Updated mobile
        "gender": "male",
        "dateOfBirth": "2000-01-15",
        "address": "456 Updated Street, Colombo",  # Updated address
        "guardianName": "Updated Guardian",  # Updated guardian
        "guardianContact": "0777777777",
        "emergencyContact": "0788888888",
        # Academic Information
        "batch": "2024B",  # Updated batch
        "semester": "2",   # Updated semester
        "gpa": 3.85,       # Updated GPA
        # RFID
        "rfidCard": "UPDATED123",  # Updated RFID
        "faceRegistrationStatus": "completed"  # Updated status
    }
    
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    
    response = requests.put(f"{BASE_URL}/api/students/{student_id}", 
                          headers=headers, 
                          json=update_data)
    
    if response.status_code == 200:
        updated_student = response.json()
        print(f"✅ Student updated successfully!")
        print(f"   New name: {updated_student.get('fullName')}")
        print(f"   New email: {updated_student.get('email')}")
        print(f"   New department: {updated_student.get('department')}")
        print(f"   New mobile: {updated_student.get('mobileNumber')}")
        print(f"   New batch: {updated_student.get('batch')}")
        print(f"   New RFID: {updated_student.get('rfidCard')}")
        return updated_student
    else:
        print(f"❌ Update failed: {response.status_code} - {response.text}")
        return None

def test_delete_student(token, student_id):
    """Test deleting a student"""
    print(f"\\n🗑️ Testing Delete Student: {student_id}")
    
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    
    response = requests.delete(f"{BASE_URL}/api/students/{student_id}", headers=headers)
    
    if response.status_code == 200:
        print("✅ Student deleted successfully!")
        return True
    else:
        print(f"❌ Delete failed: {response.status_code} - {response.text}")
        return False

def main():
    """Run all CRUD tests"""
    print("🧪 Starting Student CRUD Tests")
    print("=" * 50)
    
    # Step 1: Login
    token = test_login()
    if not token:
        print("❌ Cannot proceed without valid token")
        return
    
    time.sleep(1)
    
    # Step 2: Read existing students
    existing_students = test_read_students(token)
    time.sleep(1)
    
    # Step 3: Create new student
    new_student = test_create_student(token)
    if not new_student:
        print("❌ Cannot proceed without creating student")
        return
    
    student_id = new_student.get("id")
    time.sleep(1)
    
    # Step 4: Read single student
    test_read_single_student(token, student_id)
    time.sleep(1)
    
    # Step 5: Update student
    updated_student = test_update_student(token, student_id)
    time.sleep(1)
    
    # Step 6: Read updated student to verify changes
    print("\\n🔍 Verifying update...")
    test_read_single_student(token, student_id)
    time.sleep(1)
    
    # Step 7: Delete student
    test_delete_student(token, student_id)
    time.sleep(1)
    
    # Step 8: Verify deletion
    print("\\n🔍 Verifying deletion...")
    deleted_student = test_read_single_student(token, student_id)
    if deleted_student:
        print("❌ Student still exists after deletion!")
    else:
        print("✅ Student successfully deleted!")
    
    print("\\n" + "=" * 50)
    print("🏁 Student CRUD Tests Completed!")

if __name__ == "__main__":
    main()
