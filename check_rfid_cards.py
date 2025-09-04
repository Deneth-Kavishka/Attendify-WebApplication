#!/usr/bin/env python3
"""
Check RFID cards in database
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
    
    print('🔍 Checking RFID cards in database...')
    
    # Check all students
    cursor.execute("SELECT rfid_card, student_id, full_name, status FROM rfid_students")
    students = cursor.fetchall()
    
    print(f'📋 Found {len(students)} students:')
    for student in students:
        print(f'  Card: {student[0]} | ID: {student[1]} | Name: {student[2]} | Status: {student[3]}')
    
    print()
    print('🎯 Checking your specific cards:')
    
    # Check BF74B21F
    cursor.execute("SELECT * FROM rfid_students WHERE rfid_card = 'BF74B21F'")
    result = cursor.fetchone()
    if result:
        print(f'✅ Found BF74B21F: {result}')
    else:
        print('❌ BF74B21F not found')
    
    # Check F6C9D600  
    cursor.execute("SELECT * FROM rfid_students WHERE rfid_card = 'F6C9D600'")
    result = cursor.fetchone()
    if result:
        print(f'✅ Found F6C9D600: {result}')
    else:
        print('❌ F6C9D600 not found')
    
    conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
