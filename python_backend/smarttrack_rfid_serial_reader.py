#!/usr/bin/env python3
"""
SmartTrack RFID Serial Reader
Reads RFID data directly from Arduino via USB Serial port
Processes data to PostgreSQL and Firebase databases
"""

import serial
import json
import time
import psycopg2
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import threading
import logging
import sys
import re
import os

# Configure console encoding for Windows
if os.name == 'nt':
    os.system('chcp 65001 > nul')

# Configure logging with UTF-8 encoding
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rfid_serial_service.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SmartTrackRFIDSerialReader:
    def __init__(self):
        self.serial_connection = None
        self.db_connection = None
        self.firebase_db = None
        self.running = False
        
        # Configuration
        self.SERIAL_PORT = 'COM7'  # Your Arduino's COM port (found by port scanner)
        self.BAUD_RATE = 115200
        self.TIMEOUT = 1
        
        # Database configuration
        self.DB_CONFIG = {
            'host': 'localhost',
            'database': 'attendify',
            'user': 'postgres',
            'password': 'admin123'  # Update with your password
        }
        
        # Firebase configuration file path
        self.FIREBASE_KEY_PATH = 'firebase-service-account.json'  # Update path
        
        # Student database (same as before)
        self.students_db = {
            'ABC123456': {
                'studentId': 'ST001',
                'fullName': 'John Doe',
                'department': 'Computer Science',
                'attendanceStats': {'attendancePercentage': 95.5}
            },
            'DEF789012': {
                'studentId': 'ST002', 
                'fullName': 'Jane Smith',
                'department': 'Engineering',
                'attendanceStats': {'attendancePercentage': 89.2}
            },
            'GHI345678': {
                'studentId': 'ST003',
                'fullName': 'Mike Johnson', 
                'department': 'Physics',
                'attendanceStats': {'attendancePercentage': 92.8}
            },
            'BF74B21F': {  # Your actual card
                'studentId': 'ST005',
                'fullName': 'Deneth Kavishka',
                'department': 'IoT Development',
                'attendanceStats': {'attendancePercentage': 98.5}
            },
            'TEST123456': {  # Test card
                'studentId': 'TEST001',
                'fullName': 'Test Student',
                'department': 'Testing',
                'attendanceStats': {'attendancePercentage': 100.0}
            }
        }
        
        # Statistics
        self.total_scans = 0
        self.successful_scans = 0
        self.failed_scans = 0
        self.connected_devices = set()

    def initialize_serial(self):
        """Initialize serial connection to Arduino"""
        try:
            logger.info(f"🔌 Connecting to Arduino on {self.SERIAL_PORT}...")
            self.serial_connection = serial.Serial(
                port=self.SERIAL_PORT,
                baudrate=self.BAUD_RATE,
                timeout=self.TIMEOUT
            )
            time.sleep(2)  # Wait for Arduino to reset
            logger.info("✅ Serial connection established")
            return True
        except serial.SerialException as e:
            logger.error(f"❌ Serial connection failed: {e}")
            logger.info("💡 Available COM ports:")
            import serial.tools.list_ports
            ports = serial.tools.list_ports.comports()
            for port in ports:
                logger.info(f"   - {port.device}: {port.description}")
            return False

    def initialize_database(self):
        """Initialize PostgreSQL database connection"""
        try:
            logger.info("🗄️ Connecting to PostgreSQL database...")
            self.db_connection = psycopg2.connect(**self.DB_CONFIG)
            self.create_tables()
            logger.info("✅ PostgreSQL database connected")
            return True
        except psycopg2.Error as e:
            logger.error(f"❌ Database connection failed: {e}")
            logger.info("💡 Make sure PostgreSQL is running and credentials are correct")
            return False

    def initialize_firebase(self):
        """Initialize Firebase connection"""
        try:
            logger.info("🔥 Connecting to Firebase...")
            if not firebase_admin._apps:
                cred = credentials.Certificate(self.FIREBASE_KEY_PATH)
                firebase_admin.initialize_app(cred)
            self.firebase_db = firestore.client()
            logger.info("✅ Firebase connected")
            return True
        except Exception as e:
            logger.error(f"❌ Firebase connection failed: {e}")
            logger.info("💡 Check Firebase service account key file")
            return False

    def create_tables(self):
        """Create database tables if they don't exist"""
        cursor = self.db_connection.cursor()
        
        # Students table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rfid_students (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE,
                rfid_card VARCHAR(20) UNIQUE,
                name VARCHAR(100),
                department VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Attendance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rfid_attendance (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50),
                rfid_card VARCHAR(20),
                device_id VARCHAR(50),
                location VARCHAR(100),
                scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                device_uptime INTEGER,
                method VARCHAR(20) DEFAULT 'RFID',
                status VARCHAR(20) DEFAULT 'present'
            )
        ''')
        
        # Devices table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rfid_devices (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(50) UNIQUE,
                device_type VARCHAR(50),
                location VARCHAR(100),
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'online',
                total_scans INTEGER DEFAULT 0,
                version VARCHAR(20)
            )
        ''')
        
        self.db_connection.commit()
        cursor.close()
        
        # Insert sample students
        self.insert_sample_students()

    def insert_sample_students(self):
        """Insert sample students into database"""
        cursor = self.db_connection.cursor()
        
        for rfid_card, student in self.students_db.items():
            try:
                cursor.execute('''
                    INSERT INTO rfid_students (student_id, rfid_card, name, department)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (rfid_card) DO NOTHING
                ''', (
                    student['studentId'],
                    rfid_card,
                    student['fullName'],
                    student['department']
                ))
            except psycopg2.Error:
                pass  # Student already exists
        
        self.db_connection.commit()
        cursor.close()

    def process_rfid_scan(self, data):
        """Process RFID scan data"""
        try:
            rfid_card = data['rfidCard']
            device_id = data['deviceId']
            location = data['location']
            timestamp = data['timestamp']
            device_uptime = data.get('deviceUptime', 0)
            
            logger.info(f"📱 Processing RFID scan: {rfid_card} from {device_id}")
            
            # Check if student exists
            if rfid_card in self.students_db:
                student = self.students_db[rfid_card]
                
                # Save to PostgreSQL
                self.save_to_postgresql(rfid_card, student, device_id, location, device_uptime)
                
                # Save to Firebase
                self.save_to_firebase(rfid_card, student, device_id, location)
                
                # Send success response to Arduino
                self.send_to_arduino("SUCCESS", f"Welcome {student['fullName']}")
                self.successful_scans += 1
                
                logger.info(f"✅ Attendance recorded for {student['fullName']} ({rfid_card})")
                
            else:
                # Unknown card
                self.send_to_arduino("ERROR", "Unknown RFID card")
                self.failed_scans += 1
                logger.warning(f"❌ Unknown RFID card: {rfid_card}")
            
            self.total_scans += 1
            
        except Exception as e:
            logger.error(f"❌ Error processing RFID scan: {e}")
            self.send_to_arduino("ERROR", "Processing failed")
            self.failed_scans += 1

    def save_to_postgresql(self, rfid_card, student, device_id, location, device_uptime):
        """Save attendance record to PostgreSQL"""
        try:
            cursor = self.db_connection.cursor()
            cursor.execute('''
                INSERT INTO rfid_attendance (
                    student_id, rfid_card, device_id, location, 
                    device_uptime, method, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                student['studentId'],
                rfid_card,
                device_id,
                location,
                device_uptime,
                'RFID',
                'present'
            ))
            self.db_connection.commit()
            cursor.close()
            logger.info("💾 Saved to PostgreSQL")
        except psycopg2.Error as e:
            logger.error(f"❌ PostgreSQL save failed: {e}")

    def save_to_firebase(self, rfid_card, student, device_id, location):
        """Save attendance record to Firebase"""
        try:
            if self.firebase_db:
                # Attendance collection
                attendance_doc = {
                    'studentId': student['studentId'],
                    'rfidCard': rfid_card,
                    'deviceId': device_id,
                    'location': location,
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'studentName': student['fullName'],
                    'department': student['department'],
                    'status': 'present'
                }
                
                self.firebase_db.collection('attendance').add(attendance_doc)
                
                # Device status update
                device_doc = {
                    'deviceId': device_id,
                    'location': location,
                    'lastScan': firestore.SERVER_TIMESTAMP,
                    'totalScans': self.total_scans,
                    'status': 'online'
                }
                
                self.firebase_db.collection('devices').document(device_id).set(device_doc, merge=True)
                
                logger.info("🔥 Saved to Firebase")
        except Exception as e:
            logger.error(f"❌ Firebase save failed: {e}")

    def process_heartbeat(self, data):
        """Process device heartbeat"""
        try:
            device_id = data['deviceId']
            location = data['location']
            total_scans = data.get('totalScans', 0)
            uptime = data.get('uptime', 0)
            
            self.connected_devices.add(device_id)
            
            # Update device status in PostgreSQL
            cursor = self.db_connection.cursor()
            cursor.execute('''
                INSERT INTO rfid_devices (device_id, device_type, location, total_scans, version)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (device_id) DO UPDATE SET
                    last_seen = CURRENT_TIMESTAMP,
                    total_scans = EXCLUDED.total_scans,
                    status = 'online'
            ''', (
                device_id,
                data.get('deviceType', 'RFID_READER'),
                location,
                total_scans,
                data.get('version', '1.0')
            ))
            self.db_connection.commit()
            cursor.close()
            
            logger.info(f"💓 Heartbeat from {device_id} - Uptime: {uptime}s")
            
        except Exception as e:
            logger.error(f"❌ Error processing heartbeat: {e}")

    def send_to_arduino(self, status, message):
        """Send response back to Arduino"""
        if self.serial_connection:
            try:
                response = f"RESPONSE:{status}:{message}\n"
                self.serial_connection.write(response.encode())
                logger.info(f"📤 Sent to Arduino: {status} - {message}")
            except Exception as e:
                logger.error(f"❌ Failed to send to Arduino: {e}")

    def read_serial_data(self):
        """Read and process data from serial port"""
        buffer = ""
        
        while self.running:
            try:
                if self.serial_connection and self.serial_connection.in_waiting > 0:
                    data = self.serial_connection.readline().decode('utf-8').strip()
                    
                    if data:
                        # Check for data markers
                        if data == "SMARTTRACK_DATA_START":
                            # Next line should be JSON data
                            json_data = self.serial_connection.readline().decode('utf-8').strip()
                            end_marker = self.serial_connection.readline().decode('utf-8').strip()
                            
                            if end_marker == "SMARTTRACK_DATA_END":
                                try:
                                    parsed_data = json.loads(json_data)
                                    if parsed_data.get('type') == 'RFID_SCAN':
                                        self.process_rfid_scan(parsed_data)
                                except json.JSONDecodeError as e:
                                    logger.error(f"❌ JSON decode error: {e}")
                        
                        elif data == "SMARTTRACK_HEARTBEAT_START":
                            # Next line should be heartbeat JSON
                            json_data = self.serial_connection.readline().decode('utf-8').strip()
                            end_marker = self.serial_connection.readline().decode('utf-8').strip()
                            
                            if end_marker == "SMARTTRACK_HEARTBEAT_END":
                                try:
                                    parsed_data = json.loads(json_data)
                                    if parsed_data.get('type') == 'DEVICE_HEARTBEAT':
                                        self.process_heartbeat(parsed_data)
                                except json.JSONDecodeError as e:
                                    logger.error(f"❌ JSON decode error: {e}")
                        
                        else:
                            # Regular Arduino output (for debugging)
                            print(f"Arduino: {data}")
                
                time.sleep(0.1)  # Small delay to prevent CPU overload
                
            except Exception as e:
                logger.error(f"❌ Serial read error: {e}")
                time.sleep(1)

    def start(self):
        """Start the RFID serial reader service"""
        logger.info("🚀 Starting SmartTrack RFID Serial Reader...")
        
        # Initialize connections
        if not self.initialize_serial():
            return False
        
        if not self.initialize_database():
            return False
        
        # Firebase is optional
        self.initialize_firebase()
        
        # Start reading serial data
        self.running = True
        serial_thread = threading.Thread(target=self.read_serial_data)
        serial_thread.daemon = True
        serial_thread.start()
        
        logger.info("✅ SmartTrack RFID Serial Reader started successfully!")
        logger.info(f"📡 Listening on {self.SERIAL_PORT} at {self.BAUD_RATE} baud")
        logger.info("🎯 Ready to process RFID scans from Arduino...")
        
        return True

    def stop(self):
        """Stop the service"""
        logger.info("🛑 Stopping SmartTrack RFID Serial Reader...")
        self.running = False
        
        if self.serial_connection:
            self.serial_connection.close()
        
        if self.db_connection:
            self.db_connection.close()
        
        logger.info("✅ Service stopped")

    def get_statistics(self):
        """Get service statistics"""
        return {
            'total_scans': self.total_scans,
            'successful_scans': self.successful_scans,
            'failed_scans': self.failed_scans,
            'connected_devices': len(self.connected_devices),
            'students_loaded': len(self.students_db)
        }

def main():
    reader = SmartTrackRFIDSerialReader()
    
    try:
        if reader.start():
            print("\n" + "="*60)
            print("🎯 SmartTrack RFID Serial Reader Running")
            print("="*60)
            print("📱 Scan RFID cards on your Arduino device")
            print("💾 Data will be saved to PostgreSQL and Firebase")
            print("🔧 Press Ctrl+C to stop the service")
            print("="*60)
            
            # Keep the main thread alive
            while True:
                time.sleep(10)
                stats = reader.get_statistics()
                logger.info(f"📊 Stats - Scans: {stats['total_scans']}, Success: {stats['successful_scans']}, Failed: {stats['failed_scans']}")
                
    except KeyboardInterrupt:
        print("\n🛑 Shutdown requested by user")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
    finally:
        reader.stop()

if __name__ == "__main__":
    main()
