#!/usr/bin/env python3
"""
Check database schema
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
    
    print('✅ Connected to Attendify database')
    
    # Check tables
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    tables = cursor.fetchall()
    print(f'📋 Found {len(tables)} tables:')
    for table in tables:
        print(f'  - {table[0]}')
    
    # Check specific tables
    if tables:
        for table in tables:
            table_name = table[0]
            if 'student' in table_name.lower():
                cursor.execute(f"""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = '{table_name}'
                """)
                columns = cursor.fetchall()
                print(f'\n📝 Columns in {table_name}:')
                for col in columns:
                    print(f'  - {col[0]} ({col[1]})')
    
    conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
