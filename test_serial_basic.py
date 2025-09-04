#!/usr/bin/env python3
"""
SmartTrack RFID Serial Reader - Basic Test Version
Simple version for testing serial communication
"""

import serial
import json
import time
import sys

print("Starting SmartTrack RFID Serial Reader...")
print("Attempting to connect to COM7...")

try:
    # Try to connect to serial port
    ser = serial.Serial('COM7', 115200, timeout=1)
    print("SUCCESS: Connected to COM7")
    
    # Wait for Arduino to reset
    time.sleep(2)
    
    print("Listening for RFID data...")
    print("Scan an RFID card on your Arduino...")
    print("Press Ctrl+C to stop")
    print("-" * 50)
    
    # Sample student database
    students_db = {
        'BF74B21F': {
            'name': 'Deneth Kavishka',
            'studentId': 'ST005',
            'department': 'IoT Development'
        },
        'TEST123456': {
            'name': 'Test Student',
            'studentId': 'TEST001',
            'department': 'Testing'
        }
    }
    
    # Listen for data
    while True:
        if ser.in_waiting > 0:
            data = ser.readline().decode('utf-8').strip()
            
            if data:
                print(f"Arduino: {data}")
                
                # Check for RFID data markers
                if data == "SMARTTRACK_DATA_START":
                    json_data = ser.readline().decode('utf-8').strip()
                    end_marker = ser.readline().decode('utf-8').strip()
                    
                    if end_marker == "SMARTTRACK_DATA_END":
                        try:
                            scan_data = json.loads(json_data)
                            print(f"RECEIVED RFID SCAN: {scan_data}")
                            
                            if scan_data.get('type') == 'RFID_SCAN':
                                rfid_card = scan_data.get('rfidCard', '')
                                
                                if rfid_card in students_db:
                                    student = students_db[rfid_card]
                                    print(f"STUDENT FOUND: {student['name']} ({student['studentId']})")
                                    print(f"Department: {student['department']}")
                                    
                                    # Send success response back to Arduino
                                    response = f"RESPONSE:SUCCESS:Welcome {student['name']}\n"
                                    ser.write(response.encode())
                                    print(f"SENT TO ARDUINO: {response.strip()}")
                                else:
                                    print(f"UNKNOWN CARD: {rfid_card}")
                                    response = "RESPONSE:ERROR:Unknown RFID card\n"
                                    ser.write(response.encode())
                                    print(f"SENT TO ARDUINO: {response.strip()}")
                        
                        except json.JSONDecodeError as e:
                            print(f"JSON ERROR: {e}")
                
                elif data == "SMARTTRACK_HEARTBEAT_START":
                    json_data = ser.readline().decode('utf-8').strip()
                    end_marker = ser.readline().decode('utf-8').strip()
                    
                    if end_marker == "SMARTTRACK_HEARTBEAT_END":
                        try:
                            heartbeat_data = json.loads(json_data)
                            print(f"HEARTBEAT: Device {heartbeat_data.get('deviceId')} - Uptime: {heartbeat_data.get('uptime')}s")
                        except json.JSONDecodeError as e:
                            print(f"HEARTBEAT JSON ERROR: {e}")
        
        time.sleep(0.1)

except serial.SerialException as e:
    print(f"SERIAL ERROR: {e}")
    print("Make sure:")
    print("1. Arduino is connected to COM7")
    print("2. Arduino IDE Serial Monitor is closed")
    print("3. Arduino has the SmartTrack_RFID_Serial.ino code uploaded")
    
except KeyboardInterrupt:
    print("\nStopping...")
    
except Exception as e:
    print(f"UNEXPECTED ERROR: {e}")
    
finally:
    try:
        ser.close()
        print("Serial connection closed")
    except:
        pass

print("Test completed")
