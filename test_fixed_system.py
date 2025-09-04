#!/usr/bin/env python3
"""
Test the fixed attendance system
"""

from smarttrack_attendance_system import SmartTrackAttendanceSystem
import traceback

try:
    print("🧪 Testing SmartTrack System...")
    system = SmartTrackAttendanceSystem()
    
    print("✅ System initialization successful!")
    print(f"📋 Students loaded: {len(system.students_db)}")
    
    # Check if your cards are loaded
    if 'BF74B21F' in system.students_db:
        student = system.students_db['BF74B21F']
        print(f"✅ Your card BF74B21F found: {student['name']} ({student['studentId']})")
    else:
        print("❌ Your card BF74B21F not found")
        
    if 'F6C9D600' in system.students_db:
        student = system.students_db['F6C9D600']
        print(f"✅ Test card F6C9D600 found: {student['name']} ({student['studentId']})")
    else:
        print("❌ Test card F6C9D600 not found")
    
    print("🎯 System ready for RFID scanning!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    traceback.print_exc()
