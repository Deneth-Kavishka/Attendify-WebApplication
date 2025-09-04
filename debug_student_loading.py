#!/usr/bin/env python3
"""
Debug student loading
"""

import psycopg2

try:
    conn = psycopg2.connect(
        host='localhost',
        database='Attendify',
        user='postgres',
        password='Alpha',
        port=5432
    )
    cursor = conn.cursor()
    
    print("🔍 Testing the exact query from load_students()...")
    
    # This is the exact query from the code
    cursor.execute('''
        SELECT rfid_card, student_id, full_name, email, department, phone, status
        FROM rfid_students 
        WHERE status = 'active'
    ''')
    
    students = cursor.fetchall()
    print(f"✅ Query successful! Found {len(students)} students")
    
    for i, student in enumerate(students):
        print(f"Student {i+1}:")
        print(f"  RFID: {student[0]}")
        print(f"  ID: {student[1]}")
        print(f"  Name: {student[2]}")
        print(f"  Email: {student[3]}")
        print(f"  Dept: {student[4]}")
        print(f"  Phone: {student[5]}")
        print(f"  Status: {student[6]}")
        print()
    
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
