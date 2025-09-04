#!/usr/bin/env python3
"""
Test the standalone attendance system
"""

from student_management_standalone import StudentManagementStandalone

def test_system():
    print("=" * 60)
    print("🎓 Testing SmartTrack Standalone System")
    print("=" * 60)
    
    sm = StudentManagementStandalone()
    
    print("\n🔍 Looking for your RFID card BF74B21F...")
    students = sm.load_students()
    
    for student in students:
        if student['rfid_card'] == 'BF74B21F':
            print(f"\n✅ Found your profile:")
            print(f"👤 Name: {student['name']}")
            print(f"🆔 Student ID: {student['student_id']}")
            print(f"🏫 Department: {student['department']}")
            print(f"📧 Email: {student['email']}")
            print(f"📱 Phone: {student['phone']}")
            print(f"📚 Year: {student['year']}")
            print(f"💳 RFID Card: {student['rfid_card']}")
            print(f"📊 Status: {student['status']}")
            break
    else:
        print("❌ RFID card BF74B21F not found in database")
    
    print(f"\n📚 Total students in database: {len(students)}")
    
    print("\n🎯 System ready for RFID attendance scanning!")
    print("📋 To start attendance system: python smarttrack_attendance_standalone.py")
    print("👥 To manage students: python student_management_standalone.py")
    print("🚀 Quick launcher: start_smarttrack_standalone.bat")

if __name__ == "__main__":
    test_system()
