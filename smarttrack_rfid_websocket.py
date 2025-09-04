#!/usr/bin/env python3
"""
SmartTrack RFID Attendance S        print(f"🌐 WebSocket Server: Port 5001")stem with WebSocket Integration
Real-time attendance marking with web dashboard integration
"""

import serial
import json
import time
import sys
import psycopg2
from datetime import datetime, date
import os
from urllib.parse import urlparse
import asyncio
import websockets
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit

class SmartTrackRFIDWebSocket:
    def __init__(self):
        self.serial_conn = None
        self.db_conn = None
        self.students_db = {}
        
        # Configuration
        self.SERIAL_PORT = 'COM7'
        self.BAUD_RATE = 115200
        
        # WebSocket and Flask setup
        self.app = Flask(__name__)
        CORS(self.app)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        
        # Load database configuration
        self.load_env_config()
        
        # Initialize database connection
        self.initialize_database()
        
        # Statistics
        self.total_scans = 0
        self.successful_scans = 0
        self.failed_scans = 0
        self.session_start = datetime.now()
        
        # Setup Flask routes
        self.setup_routes()
        
        print("=" * 60)
        print("🎓 SmartTrack RFID WebSocket Attendance System")
        print("=" * 60)
        print("📅 Session started:", self.session_start.strftime("%Y-%m-%d %H:%M:%S"))
        print("🗄️ Database: PostgreSQL (Attendify)")
        print("📡 Serial Port: COM7")
        print("🌐 WebSocket Server: Port 5000")
        print("=" * 60)

    def load_env_config(self):
        """Load database configuration from .env file"""
        try:
            # Read .env file
            env_path = os.path.join(os.path.dirname(__file__), '.env')
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        if line.strip() and not line.startswith('#') and '=' in line:
                            key, value = line.strip().split('=', 1)
                            os.environ[key] = value.strip('"')
            
            # Parse DATABASE_URL from .env
            database_url = os.getenv('DATABASE_URL', 'postgresql://postgres:Alpha@localhost:5432/Attendify')
            
            # Extract components from URL
            if database_url.startswith('postgresql://'):
                url_part = database_url[13:]
                if '@' in url_part:
                    auth_part, host_db_part = url_part.split('@', 1)
                    if ':' in auth_part:
                        user, password = auth_part.split(':', 1)
                    else:
                        user, password = auth_part, ''
                    
                    if '/' in host_db_part:
                        host_port, database = host_db_part.split('/', 1)
                    else:
                        host_port, database = host_db_part, 'Attendify'
                    
                    if ':' in host_port:
                        host, port = host_port.split(':', 1)
                        port = int(port)
                    else:
                        host, port = host_port, 5432
                else:
                    user, password, host, port, database = 'postgres', 'Alpha', 'localhost', 5432, 'Attendify'
            else:
                user, password, host, port, database = 'postgres', 'Alpha', 'localhost', 5432, 'Attendify'
            
            self.DB_CONFIG = {
                'host': host,
                'database': database,
                'user': user,
                'password': password,
                'port': port
            }
            
            print(f"📋 Database Config: {user}@{host}:{port}/{database}")
            
        except Exception as e:
            print(f"⚠️ Error loading .env config: {e}")
            self.DB_CONFIG = {
                'host': 'localhost',
                'database': 'Attendify',
                'user': 'postgres',
                'password': 'Alpha',
                'port': 5432
            }

    def initialize_database(self):
        """Initialize PostgreSQL database connection"""
        try:
            print("🔌 Connecting to PostgreSQL database...")
            self.db_conn = psycopg2.connect(**self.DB_CONFIG)
            self.load_students()
            print("✅ Database connected and ready")
            return True
        except psycopg2.Error as e:
            print(f"❌ Database connection failed: {e}")
            return False

    def load_students(self):
        """Load all students from database"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT rfid_card, student_id, full_name, email, department, phone, status
            FROM rfid_students 
            WHERE status = 'active'
        ''')
        
        self.students_db = {}
        student_count = 0
        
        for row in cursor.fetchall():
            self.students_db[row[0]] = {
                'studentId': row[1],
                'name': row[2],
                'email': row[3],
                'department': row[4],
                'phone': row[5],
                'status': row[6]
            }
            student_count += 1
        
        cursor.close()
        print(f"📚 Loaded {student_count} active students from database")

    def setup_routes(self):
        """Setup Flask API routes"""
        
        @self.app.route('/api/attendance/recent', methods=['GET'])
        def get_recent_attendance():
            """Get recent attendance records"""
            try:
                cursor = self.db_conn.cursor()
                cursor.execute('''
                    SELECT ra.student_id, rs.full_name, ra.device_id, ra.scan_time, 
                           ra.method, ra.status, rs.department
                    FROM rfid_attendance ra
                    JOIN rfid_students rs ON ra.student_id = rs.student_id
                    ORDER BY ra.scan_time DESC
                    LIMIT 20
                ''')
                
                records = []
                for row in cursor.fetchall():
                    records.append({
                        'studentId': row[0],
                        'studentName': row[1],
                        'deviceId': row[2],
                        'timestamp': row[3].isoformat() if row[3] else None,
                        'method': row[4] or 'rfid',
                        'status': row[5],
                        'department': row[6],
                        'id': f"rfid_{row[0]}_{int(time.time())}"
                    })
                
                cursor.close()
                return jsonify({'success': True, 'records': records})
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)})

        @self.app.route('/api/students', methods=['GET'])
        def get_students():
            """Get all active students"""
            return jsonify({
                'success': True, 
                'students': list(self.students_db.values()),
                'count': len(self.students_db)
            })

        @self.app.route('/api/stats', methods=['GET'])
        def get_stats():
            """Get attendance statistics"""
            return jsonify({
                'success': True,
                'stats': {
                    'totalScans': self.total_scans,
                    'successfulScans': self.successful_scans,
                    'failedScans': self.failed_scans,
                    'sessionStart': self.session_start.isoformat(),
                    'activeStudents': len(self.students_db)
                }
            })

    def initialize_serial(self):
        """Initialize serial connection"""
        try:
            print(f"📡 Connecting to Arduino on {self.SERIAL_PORT}...")
            self.serial_conn = serial.Serial(self.SERIAL_PORT, self.BAUD_RATE, timeout=1)
            time.sleep(2)  # Wait for Arduino reset
            print("✅ Serial connection established")
            return True
        except serial.SerialException as e:
            print(f"❌ Serial connection failed: {e}")
            return False

    def process_attendance(self, rfid_card, device_data):
        """Process attendance marking with WebSocket broadcast"""
        try:
            if rfid_card not in self.students_db:
                self.mark_unknown_card(rfid_card, device_data)
                return False
            
            student = self.students_db[rfid_card]
            current_time = datetime.now()
            
            # Display student information
            self.display_student_info(student, rfid_card)
            
            # Mark attendance in database
            attendance_id = self.mark_attendance(student, rfid_card, device_data, current_time)
            
            # Send response to Arduino
            self.send_arduino_response("SUCCESS", f"Welcome {student['name']}")
            
            # Create attendance record for WebSocket
            attendance_record = {
                'id': f"rfid_{student['studentId']}_{int(current_time.timestamp())}",
                'studentId': student['studentId'],
                'studentName': student['name'],
                'deviceId': device_data.get('deviceId', 'RFID_SCANNER_001'),
                'method': 'rfid',
                'timestamp': current_time.isoformat(),
                'status': 'present',
                'department': student['department'],
                'rfidCard': rfid_card,
                'location': device_data.get('location', 'Main Entrance')
            }
            
            # Broadcast to WebSocket clients
            self.socketio.emit('rfid_attendance', attendance_record)
            self.socketio.emit('attendance_update', attendance_record)
            
            print(f"📡 Broadcasted attendance update: {student['name']}")
            
            self.successful_scans += 1
            self.total_scans += 1
            
            return True
            
        except Exception as e:
            print(f"❌ Error processing attendance: {e}")
            self.send_arduino_response("ERROR", "Processing failed")
            self.failed_scans += 1
            self.total_scans += 1
            return False

    def display_student_info(self, student, rfid_card):
        """Display student information"""
        print("\n" + "🎓" + "=" * 58 + "🎓")
        print("║" + " " * 20 + "STUDENT ATTENDANCE" + " " * 20 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 👤 Name: {student['name']:<45} ║")
        print(f"║ 🆔 Student ID: {student['studentId']:<41} ║")
        print(f"║ 🏫 Department: {student['department']:<41} ║")
        print(f"║ 📧 Email: {student['email']:<45} ║")
        print(f"║ 📱 Phone: {student['phone']:<45} ║")
        print(f"║ 💳 RFID Card: {rfid_card:<41} ║")
        print(f"║ 🕐 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<37} ║")
        print("╚" + "=" * 58 + "╝")

    def mark_attendance(self, student, rfid_card, device_data, scan_time):
        """Mark attendance in database"""
        cursor = self.db_conn.cursor()
        
        # Insert attendance record
        cursor.execute('''
            INSERT INTO rfid_attendance (
                student_id, rfid_card, device_id, location, scan_time,
                device_uptime, method, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            student['studentId'],
            rfid_card,
            device_data.get('deviceId', 'RFID_SCANNER_001'),
            device_data.get('location', 'Main Entrance'),
            scan_time,
            device_data.get('deviceUptime', 0),
            'RFID',
            'present'
        ))
        
        attendance_id = cursor.fetchone()[0]
        self.db_conn.commit()
        cursor.close()
        
        print("✅ Attendance marked successfully")
        return attendance_id

    def mark_unknown_card(self, rfid_card, device_data):
        """Handle unknown RFID cards"""
        print("\n" + "❌" + "=" * 58 + "❌")
        print("║" + " " * 20 + "UNKNOWN RFID CARD" + " " * 21 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 💳 Card ID: {rfid_card:<44} ║")
        print(f"║ 🕐 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<37} ║")
        print(f"║ 📍 Location: {device_data.get('location', 'Unknown'):<42} ║")
        print("║" + " " * 58 + "║")
        print("║ Please contact administrator to register this card        ║")
        print("╚" + "=" * 58 + "╝")
        
        # Broadcast unknown card event
        unknown_record = {
            'id': f"unknown_{rfid_card}_{int(time.time())}",
            'rfidCard': rfid_card,
            'deviceId': device_data.get('deviceId', 'RFID_SCANNER_001'),
            'timestamp': datetime.now().isoformat(),
            'status': 'unknown_card',
            'location': device_data.get('location', 'Unknown')
        }
        
        self.socketio.emit('unknown_card', unknown_record)
        self.send_arduino_response("ERROR", "Unknown RFID card")

    def send_arduino_response(self, status, message):
        """Send response back to Arduino"""
        if self.serial_conn:
            try:
                response = f"RESPONSE:{status}:{message}\n"
                self.serial_conn.write(response.encode())
                print(f"📤 Arduino Response: {status} - {message}")
            except Exception as e:
                print(f"❌ Failed to send Arduino response: {e}")

    def run_rfid_scanner(self):
        """Main RFID scanning loop"""
        if not self.initialize_serial():
            print("❌ Cannot start without serial connection")
            return False
        
        print("\n✅ SmartTrack RFID WebSocket System Ready!")
        print("📋 Scan RFID cards to mark attendance")
        print("🌐 WebSocket broadcasting enabled")
        print("🔧 Press Ctrl+C to stop")
        print("=" * 60)
        
        try:
            while True:
                if self.serial_conn.in_waiting > 0:
                    data = self.serial_conn.readline().decode('utf-8').strip()
                    
                    if data == "SMARTTRACK_DATA_START":
                        json_data = self.serial_conn.readline().decode('utf-8').strip()
                        end_marker = self.serial_conn.readline().decode('utf-8').strip()
                        
                        if end_marker == "SMARTTRACK_DATA_END":
                            try:
                                scan_data = json.loads(json_data)
                                
                                if scan_data.get('type') == 'RFID_SCAN':
                                    rfid_card = scan_data.get('rfidCard', '')
                                    self.process_attendance(rfid_card, scan_data)
                                    
                            except json.JSONDecodeError as e:
                                print(f"❌ JSON Error: {e}")
                    
                    elif data.startswith("Arduino:"):
                        print(data)  # Show Arduino debug messages
                
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping RFID scanner...")
        
        finally:
            if self.serial_conn:
                self.serial_conn.close()
            print("✅ RFID scanner stopped")

    def start_web_server(self):
        """Start Flask-SocketIO web server"""
        print("🌐 Starting WebSocket server on port 5001...")
        self.socketio.run(self.app, host='0.0.0.0', port=5001, debug=False)

    def run(self):
        """Run both RFID scanner and web server"""
        # Start web server in a separate thread
        web_thread = threading.Thread(target=self.start_web_server, daemon=True)
        web_thread.start()
        
        # Give web server time to start
        time.sleep(2)
        
        # Run RFID scanner in main thread
        self.run_rfid_scanner()

def main():
    system = SmartTrackRFIDWebSocket()
    system.run()

if __name__ == "__main__":
    main()
