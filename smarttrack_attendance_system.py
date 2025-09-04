#!/usr/bin/env python3
"""
SmartTrack RFID Attendance Management System
Complete attendance marking and student management via serial communication
"""

import serial
import json
import time
import sys
import psycopg2
from datetime import datetime, date
import os

class SmartTrackAttendanceSystem:
    def __init__(self):
        self.serial_conn = None
        self.db_conn = None
        self.students_db = {}
        
        # Configuration
        self.SERIAL_PORT = 'COM7'
        self.BAUD_RATE = 115200
        
        # Load database configuration from .env file
        self.load_env_config()
        
        # Initialize database connection
        self.initialize_database()
        
        # Statistics
        self.total_scans = 0
        self.successful_scans = 0
        self.failed_scans = 0
        self.session_start = datetime.now()
        
        # Attendance tracking
        self.daily_attendance = {}
        
        print("=" * 60)
        print("🎓 SmartTrack RFID Attendance Management System")
        print("=" * 60)
        print("📅 Session started:", self.session_start.strftime("%Y-%m-%d %H:%M:%S"))
        print("🗄️ Database: PostgreSQL (attendify)")
        print("📡 Serial Port: COM7")
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
                # Remove postgresql:// prefix
                url_part = database_url[13:]
                # Split user:pass@host:port/database
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
                    # Fallback
                    user, password, host, port, database = 'postgres', 'Alpha', 'localhost', 5432, 'Attendify'
            else:
                # Fallback to your .env values
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
            # Fallback to your .env values
            self.DB_CONFIG = {
                'host': 'localhost',
                'database': 'Attendify',
                'user': 'postgres',
                'password': 'Alpha',
                'port': 5432
            }

    def initialize_database(self):
        """Initialize PostgreSQL database and create tables"""
        try:
            print("🔌 Connecting to PostgreSQL database...")
            self.db_conn = psycopg2.connect(**self.DB_CONFIG)
            self.create_tables()
            self.load_students()
            print("✅ Database connected and ready")
            return True
        except psycopg2.Error as e:
            print(f"❌ Database connection failed: {e}")
            return False

    def create_tables(self):
        """Create necessary database tables"""
        cursor = self.db_conn.cursor()
        
        # Enhanced students table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rfid_students (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE NOT NULL,
                rfid_card VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                department VARCHAR(100),
                year_of_study INTEGER,
                phone VARCHAR(20),
                emergency_contact VARCHAR(20),
                photo_url VARCHAR(255),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Enhanced attendance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rfid_attendance (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) NOT NULL,
                rfid_card VARCHAR(20) NOT NULL,
                device_id VARCHAR(50),
                location VARCHAR(100),
                scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                scan_date DATE DEFAULT CURRENT_DATE,
                device_uptime INTEGER,
                scan_type VARCHAR(20) DEFAULT 'check_in',
                method VARCHAR(20) DEFAULT 'RFID',
                status VARCHAR(20) DEFAULT 'present',
                notes TEXT,
                FOREIGN KEY (student_id) REFERENCES rfid_students(student_id)
            )
        ''')
        
        # Daily attendance summary
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_attendance_summary (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) NOT NULL,
                attendance_date DATE NOT NULL,
                first_scan_time TIMESTAMP,
                last_scan_time TIMESTAMP,
                total_scans INTEGER DEFAULT 1,
                status VARCHAR(20) DEFAULT 'present',
                location VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, attendance_date),
                FOREIGN KEY (student_id) REFERENCES rfid_students(student_id)
            )
        ''')
        
        # Devices table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rfid_devices (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(50) UNIQUE NOT NULL,
                device_name VARCHAR(100),
                location VARCHAR(100),
                device_type VARCHAR(50) DEFAULT 'RFID_READER',
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'online',
                total_scans INTEGER DEFAULT 0,
                version VARCHAR(20),
                notes TEXT
            )
        ''')
        
        self.db_conn.commit()
        cursor.close()
        self.insert_sample_data()

    def insert_sample_data(self):
        """Insert sample students and device data"""
        cursor = self.db_conn.cursor()
        
        # Sample students
        students = [
            ('ST001', 'ABC123456', 'John Doe', 'john.doe@university.edu', 'Computer Science', 3, '+1234567890', '+1234567899', 'active'),
            ('ST002', 'DEF789012', 'Jane Smith', 'jane.smith@university.edu', 'Engineering', 2, '+1234567891', '+1234567898', 'active'),
            ('ST003', 'GHI345678', 'Mike Johnson', 'mike.johnson@university.edu', 'Physics', 4, '+1234567892', '+1234567897', 'active'),
            ('ST005', 'BF74B21F', 'Deneth Kavishka', 'deneth.kavishka@university.edu', 'IoT Development', 4, '+94771234567', '+94771234568', 'active'),
            ('TEST001', 'TEST123456', 'Test Student', 'test@university.edu', 'Testing Department', 1, '+1234567893', '+1234567896', 'active')
        ]
        
        for student in students:
            try:
                cursor.execute('''
                    INSERT INTO rfid_students (student_id, rfid_card, name, email, department, year_of_study, phone, emergency_contact, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (student_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        department = EXCLUDED.department,
                        year_of_study = EXCLUDED.year_of_study,
                        phone = EXCLUDED.phone,
                        emergency_contact = EXCLUDED.emergency_contact,
                        updated_at = CURRENT_TIMESTAMP
                ''', student)
            except psycopg2.Error:
                pass  # Student already exists
        
        # Register device
        try:
            cursor.execute('''
                INSERT INTO rfid_devices (device_id, device_name, location, device_type, version)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (device_id) DO UPDATE SET
                    last_seen = CURRENT_TIMESTAMP,
                    status = 'online'
            ''', ('RFID_SCANNER_001', 'Main Entrance Scanner', 'Main Entrance', 'RFID_READER', 'SERIAL_v1.0'))
        except psycopg2.Error:
            pass
        
        self.db_conn.commit()
        cursor.close()

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
        """Process attendance marking with comprehensive student management"""
        try:
            if rfid_card not in self.students_db:
                self.mark_unknown_card(rfid_card, device_data)
                return False
            
            student = self.students_db[rfid_card]
            current_time = datetime.now()
            current_date = current_time.date()
            
            # Display student information
            self.display_student_info(student, rfid_card)
            
            # Check if already marked today
            attendance_status = self.check_daily_attendance(student['studentId'], current_date)
            
            # Mark attendance
            attendance_id = self.mark_attendance(student, rfid_card, device_data, current_time, attendance_status)
            
            # Update daily summary
            self.update_daily_summary(student, current_date, current_time, device_data.get('location', 'Unknown'))
            
            # Send response to Arduino
            self.send_arduino_response("SUCCESS", f"Welcome {student['name']}")
            
            self.successful_scans += 1
            self.total_scans += 1
            
            # Update statistics
            self.update_session_stats(student['studentId'])
            
            return True
            
        except Exception as e:
            print(f"❌ Error processing attendance: {e}")
            self.send_arduino_response("ERROR", "Processing failed")
            self.failed_scans += 1
            self.total_scans += 1
            return False

    def display_student_info(self, student, rfid_card):
        """Display comprehensive student information"""
        print("\n" + "🎓" + "=" * 58 + "🎓")
        print("║" + " " * 20 + "STUDENT ATTENDANCE" + " " * 20 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 👤 Name: {student['name']:<45} ║")
        print(f"║ 🆔 Student ID: {student['studentId']:<41} ║")
        print(f"║ 🏫 Department: {student['department']:<41} ║")
        print(f"║ 📧 Email: {student['email']:<45} ║")
        print(f"║ 📱 Phone: {student['phone']:<45} ║")
        print(f"║ 📚 Year: {student['year']:<46} ║")
        print(f"║ 💳 RFID Card: {rfid_card:<41} ║")
        print(f"║ 🕐 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<37} ║")
        print("╚" + "=" * 58 + "╝")

    def check_daily_attendance(self, student_id, check_date):
        """Check if student already marked attendance today"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT id, first_scan_time, total_scans, status 
            FROM daily_attendance_summary 
            WHERE student_id = %s AND attendance_date = %s
        ''', (student_id, check_date))
        
        result = cursor.fetchone()
        cursor.close()
        
        if result:
            print(f"📋 Previous attendance today: {result[3]} (Scan #{result[2] + 1})")
            return 'additional_scan'
        else:
            print("📋 First attendance today")
            return 'first_scan'

    def mark_attendance(self, student, rfid_card, device_data, scan_time, attendance_status):
        """Mark attendance in the database"""
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
        
        print(f"✅ Attendance marked successfully (ID: {attendance_id})")
        return attendance_id

    def update_daily_summary(self, student, attendance_date, scan_time, location):
        """Update or create daily attendance summary"""
        cursor = self.db_conn.cursor()
        
        cursor.execute('''
            INSERT INTO daily_attendance_summary (
                student_id, attendance_date, first_scan_time, last_scan_time, 
                total_scans, status, location
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (student_id, attendance_date) DO UPDATE SET
                last_scan_time = EXCLUDED.last_scan_time,
                total_scans = daily_attendance_summary.total_scans + 1,
                location = EXCLUDED.location
        ''', (
            student['studentId'],
            attendance_date,
            scan_time,
            scan_time,
            1,
            'present',
            location
        ))
        
        self.db_conn.commit()
        cursor.close()

    def mark_unknown_card(self, rfid_card, device_data):
        """Handle unknown RFID cards"""
        print("\n" + "❌" + "=" * 58 + "❌")
        print("║" + " " * 20 + "UNKNOWN RFID CARD" + " " * 21 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 💳 Card ID: {rfid_card:<44} ║")
        print(f"║ 🕐 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<37} ║")
        print(f"║ 📍 Location: {device_data.get('location', 'Unknown'):<42} ║")
        print("║" + " " * 58 + "║")
        print("║ Please contact administrator to register this card    ║")
        print("╚" + "=" * 58 + "╝")
        
        # Log unknown card attempt
        cursor = self.db_conn.cursor()
        cursor.execute('''
            INSERT INTO rfid_attendance (
                student_id, rfid_card, device_id, location, scan_time, 
                status
            ) VALUES (%s, %s, %s, %s, %s, %s)
        ''', (
            'UNKNOWN',
            rfid_card,
            device_data.get('deviceId', 'RFID_SCANNER_001'),
            device_data.get('location', 'Unknown'),
            datetime.now(),
            'unknown_card'
        ))
        self.db_conn.commit()
        cursor.close()
        
        self.send_arduino_response("ERROR", "Unknown RFID card")

    def update_session_stats(self, student_id):
        """Update session statistics"""
        if student_id not in self.daily_attendance:
            self.daily_attendance[student_id] = 0
        self.daily_attendance[student_id] += 1

    def send_arduino_response(self, status, message):
        """Send response back to Arduino"""
        if self.serial_conn:
            try:
                response = f"RESPONSE:{status}:{message}\n"
                self.serial_conn.write(response.encode())
                print(f"📤 Arduino Response: {status} - {message}")
            except Exception as e:
                print(f"❌ Failed to send Arduino response: {e}")

    def display_session_summary(self):
        """Display current session statistics"""
        print("\n" + "📊" + "=" * 58 + "📊")
        print("║" + " " * 18 + "SESSION SUMMARY" + " " * 25 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 🕐 Session Duration: {str(datetime.now() - self.session_start)[:7]:<37} ║")
        print(f"║ 📱 Total Scans: {self.total_scans:<41} ║")
        print(f"║ ✅ Successful: {self.successful_scans:<42} ║")
        print(f"║ ❌ Failed: {self.failed_scans:<46} ║")
        print(f"║ 👥 Unique Students Today: {len(self.daily_attendance):<32} ║")
        print("╚" + "=" * 58 + "╝")

    def get_attendance_report(self):
        """Generate today's attendance report"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT s.name, s.student_id, s.department, 
                   das.first_scan_time, das.total_scans, das.location
            FROM daily_attendance_summary das
            JOIN rfid_students s ON das.student_id = s.student_id
            WHERE das.attendance_date = CURRENT_DATE
            ORDER BY das.first_scan_time
        ''')
        
        print(f"\n📋 TODAY'S ATTENDANCE REPORT ({date.today()})")
        print("=" * 80)
        print(f"{'Name':<20} {'ID':<10} {'Department':<15} {'First Scan':<12} {'Scans':<6} {'Location'}")
        print("-" * 80)
        
        for row in cursor.fetchall():
            print(f"{row[0]:<20} {row[1]:<10} {row[2]:<15} {row[3].strftime('%H:%M:%S'):<12} {row[4]:<6} {row[5]}")
        
        cursor.close()

    def start_system(self):
        """Start the complete attendance system"""
        if not self.initialize_database():
            return False
        
        if not self.initialize_serial():
            return False
        
        print("\n✅ SmartTrack Attendance System Ready!")
        print("📋 Scan RFID cards to mark attendance")
        print("🔧 Press Ctrl+C to stop and view report")
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
            print("\n🛑 Stopping attendance system...")
            self.display_session_summary()
            self.get_attendance_report()
        
        finally:
            if self.serial_conn:
                self.serial_conn.close()
            if hasattr(self, 'db_conn'):
                self.db_conn.close()
            print("✅ System stopped safely")

def main():
    system = SmartTrackAttendanceSystem()
    system.start_system()

if __name__ == "__main__":
    main()
