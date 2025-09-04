#!/usr/bin/env python3
"""
Add your RFID cards to the database
"""

import psycopg2
import uuid
from datetime import datetime

try:
    conn = psycopg2.connect(
        host='localhost',
        database='Attendify',
        user='postgres', 
        password='Alpha',
        port=5432
    )
    cursor = conn.cursor()
    
    print('➕ Adding your RFID cards to database...')
    
    # Add your BF74B21F card
    cursor.execute("""
        INSERT INTO rfid_students (
            id, student_id, rfid_card, full_name, email, department, 
            phone, status, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (rfid_card) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            updated_at = EXCLUDED.updated_at
    """, (
        str(uuid.uuid4()),
        'ST005',
        'BF74B21F',
        'Deneth Kavishka',
        'deneth.kavishka@university.edu',
        'IoT Development',
        '+94771234567',
        'active',
        datetime.now(),
        datetime.now()
    ))
    
    # Add second card as backup
    cursor.execute("""
        INSERT INTO rfid_students (
            id, student_id, rfid_card, full_name, email, department,
            phone, status, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (rfid_card) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email, 
            updated_at = EXCLUDED.updated_at
    """, (
        str(uuid.uuid4()),
        'ST005',
        'F6C9D600',
        'Test Student',
        'test@university.edu',
        'Testing Department',
        '+94771234568',
        'active',
        datetime.now(),
        datetime.now()
    ))
    
    conn.commit()
    print('✅ Added BF74B21F for Deneth Kavishka')
    print('✅ Added F6C9D600 for Test Student')
    
    # Verify the cards were added
    cursor.execute("SELECT rfid_card, student_id, full_name FROM rfid_students WHERE rfid_card IN ('BF74B21F', 'F6C9D600')")
    results = cursor.fetchall()
    
    print('\n🎯 Verification:')
    for result in results:
        print(f'  ✅ {result[0]} -> {result[2]} ({result[1]})')
    
    conn.close()
    print('\n🎉 Your RFID cards are now registered!')
    
except Exception as e:
    print(f'❌ Error: {e}')
