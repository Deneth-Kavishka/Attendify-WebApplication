#!/usr/bin/env python3
"""
Check rfid_attendance table columns
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
    
    cursor.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'rfid_attendance'
        ORDER BY ordinal_position
    """)
    columns = cursor.fetchall()
    
    print('📋 Columns in rfid_attendance table:')
    for col in columns:
        print(f'  - {col[0]} ({col[1]})')
    
    conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
