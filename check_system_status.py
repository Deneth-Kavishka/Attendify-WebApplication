#!/usr/bin/env python3
"""
Quick RFID System Status Checker
"""

import serial
import serial.tools.list_ports
import psycopg2
import sys

def check_serial_ports():
    """Check available serial ports"""
    print("=== SERIAL PORTS ===")
    ports = serial.tools.list_ports.comports()
    
    if not ports:
        print("❌ No COM ports found")
        return False
    
    for port in ports:
        print(f"✓ {port.device}: {port.description}")
        if 'COM7' in port.device:
            print("  → This is your Arduino port!")
    
    return True

def test_arduino_connection():
    """Test connection to Arduino"""
    print("\n=== ARDUINO CONNECTION ===")
    try:
        ser = serial.Serial('COM7', 115200, timeout=2)
        print("✓ Successfully connected to COM7")
        
        # Send a test command
        ser.write(b'STATUS\n')
        
        # Wait for response
        import time
        time.sleep(1)
        
        if ser.in_waiting > 0:
            response = ser.readline().decode('utf-8').strip()
            print(f"✓ Arduino responded: {response}")
        else:
            print("⚠ Arduino not responding (may need RFID serial code)")
        
        ser.close()
        return True
        
    except serial.SerialException as e:
        print(f"❌ Cannot connect to COM7: {e}")
        print("  → Make sure Arduino is connected and Arduino IDE is closed")
        return False

def test_database_connection():
    """Test PostgreSQL connection"""
    print("\n=== DATABASE CONNECTION ===")
    try:
        conn = psycopg2.connect(
            host='localhost',
            database='attendify',
            user='postgres',
            password='admin123'
        )
        print("✓ PostgreSQL connection successful")
        
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✓ Database version: {version[:50]}...")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Database connection failed: {e}")
        print("  → Check if PostgreSQL is running")
        print("  → Verify database credentials")
        return False

def main():
    print("🔍 SmartTrack RFID System Status Check")
    print("=" * 50)
    
    # Check each component
    serial_ok = check_serial_ports()
    arduino_ok = test_arduino_connection()
    database_ok = test_database_connection()
    
    print("\n=== SUMMARY ===")
    
    if serial_ok and arduino_ok and database_ok:
        print("🎉 ALL SYSTEMS READY!")
        print("\nNext steps:")
        print("1. Upload SmartTrack_RFID_Serial.ino to Arduino")
        print("2. Run: python test_serial_basic.py")
        print("3. Scan your RFID card (BF74B21F)")
    else:
        print("⚠ SOME ISSUES FOUND:")
        if not serial_ok:
            print("  - Serial ports need checking")
        if not arduino_ok:
            print("  - Arduino connection needs fixing")
        if not database_ok:
            print("  - Database connection needs fixing")

if __name__ == "__main__":
    main()
    input("\nPress Enter to exit...")
