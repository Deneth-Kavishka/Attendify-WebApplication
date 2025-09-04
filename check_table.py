import psycopg2

conn = psycopg2.connect(host='localhost', port='5432', database='Attendify', user='postgres', password='Alpha')
cursor = conn.cursor()

# Get column information
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'rfid_students' 
    ORDER BY ordinal_position
""")

columns = cursor.fetchall()
print("rfid_students table columns:")
for col_name, col_type in columns:
    print(f"  {col_name}: {col_type}")

# Get sample data
cursor.execute("SELECT * FROM rfid_students LIMIT 1")
sample = cursor.fetchone()
if sample:
    print(f"\nSample data: {sample}")

cursor.close()
conn.close()
