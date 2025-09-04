#!/usr/bin/env python3
"""
SmartTrack RFID Attendance System - Standalone Version
Works without database dependency - stores data in local files
"""

import serial
import json
import time
import sys
import csv
import os
from datetime import datetime, date

class SmartTrackAttendanceStandalone:
    def __init__(self):
        self.serial_conn = None
        
        # Configuration
        self.SERIAL_PORT = 'COM7'
        self.BAUD_RATE = 115200
        
        # File paths
        self.STUDENTS_FILE = 'students_database.csv'
        self.ATTENDANCE_FILE = 'attendance_records.csv'
        self.DAILY_SUMMARY_FILE = 'daily_summary.csv'
        
        # Statistics
        self.total_scans = 0
        self.successful_scans = 0
        self.failed_scans = 0
        self.session_start = datetime.now()
        
        # Load data
        self.students_db = {}
        self.load_students_from_file()
        self.ensure_attendance_files()
        
        print("=" * 60)
        print("🎓 SmartTrack RFID Attendance System (Standalone)")
        print("=" * 60)
        print("📅 Session started:", self.session_start.strftime("%Y-%m-%d %H:%M:%S"))
        print("📁 Data stored in local CSV files")
        print("📡 Serial Port: COM7")
        print("=" * 60)

    def load_students_from_file(self):
        """Load students from CSV file"""
        if not os.path.exists(self.STUDENTS_FILE):
            self.create_sample_students()
        
        try:
            with open(self.STUDENTS_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    self.students_db[row['rfid_card']] = {
                        'studentId': row['student_id'],
                        'name': row['name'],
                        'email': row['email'],
                        'department': row['department'],
                        'year': int(row['year']),
                        'phone': row['phone'],
                        'status': row['status']
                    }
            print(f"📚 Loaded {len(self.students_db)} students from {self.STUDENTS_FILE}")
        except Exception as e:
            print(f"❌ Error loading students: {e}")
            self.create_sample_students()

    def create_sample_students(self):
        """Create sample students file"""
        students = [
            ['student_id', 'rfid_card', 'name', 'email', 'department', 'year', 'phone', 'status'],
            ['ST001', 'ABC123456', 'John Doe', 'john.doe@university.edu', 'Computer Science', '3', '+1234567890', 'active'],
            ['ST002', 'DEF789012', 'Jane Smith', 'jane.smith@university.edu', 'Engineering', '2', '+1234567891', 'active'],
            ['ST003', 'GHI345678', 'Mike Johnson', 'mike.johnson@university.edu', 'Physics', '4', '+1234567892', 'active'],
            ['ST005', 'BF74B21F', 'Deneth Kavishka', 'deneth.kavishka@university.edu', 'IoT Development', '4', '+94771234567', 'active'],
            ['TEST001', 'TEST123456', 'Test Student', 'test@university.edu', 'Testing Department', '1', '+1234567893', 'active']
        ]
        
        with open(self.STUDENTS_FILE, 'w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerows(students)
        
        print(f"✅ Created sample students file: {self.STUDENTS_FILE}")
        self.load_students_from_file()

    def ensure_attendance_files(self):
        """Create attendance files if they don't exist"""
        if not os.path.exists(self.ATTENDANCE_FILE):
            with open(self.ATTENDANCE_FILE, 'w', newline='', encoding='utf-8') as file:
                writer = csv.writer(file)
                writer.writerow(['timestamp', 'student_id', 'rfid_card', 'name', 'department', 'device_id', 'location', 'scan_type', 'status'])
        
        if not os.path.exists(self.DAILY_SUMMARY_FILE):
            with open(self.DAILY_SUMMARY_FILE, 'w', newline='', encoding='utf-8') as file:
                writer = csv.writer(file)
                writer.writerow(['date', 'student_id', 'name', 'department', 'first_scan', 'total_scans', 'location'])

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
        """Process attendance marking"""
        try:
            if rfid_card not in self.students_db:
                self.mark_unknown_card(rfid_card, device_data)
                return False
            
            student = self.students_db[rfid_card]
            current_time = datetime.now()
            
            # Display student information
            self.display_student_info(student, rfid_card)
            
            # Check if already marked today
            attendance_status = self.check_daily_attendance(student['studentId'])
            
            # Mark attendance
            self.mark_attendance(student, rfid_card, device_data, current_time, attendance_status)
            
            # Update daily summary
            self.update_daily_summary(student, current_time, device_data.get('location', 'Unknown'))
            
            # Send response to Arduino
            self.send_arduino_response("SUCCESS", f"Welcome {student['name']}")
            
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
        print(f"║ 📚 Year: {student['year']:<46} ║")
        print(f"║ 💳 RFID Card: {rfid_card:<41} ║")
        print(f"║ 🕐 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<37} ║")
        print("╚" + "=" * 58 + "╝")

    def check_daily_attendance(self, student_id):
        """Check if student already marked attendance today"""
        today = date.today().strftime('%Y-%m-%d')
        
        try:
            with open(self.DAILY_SUMMARY_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    if row['date'] == today and row['student_id'] == student_id:
                        scan_count = int(row['total_scans'])
                        print(f"📋 Previous attendance today (Scan #{scan_count + 1})")
                        return 'additional_scan'
        except FileNotFoundError:
            pass
        
        print("📋 First attendance today")
        return 'first_scan'

    def mark_attendance(self, student, rfid_card, device_data, scan_time, attendance_status):
        """Mark attendance in CSV file"""
        try:
            with open(self.ATTENDANCE_FILE, 'a', newline='', encoding='utf-8') as file:
                writer = csv.writer(file)
                writer.writerow([
                    scan_time.strftime('%Y-%m-%d %H:%M:%S'),
                    student['studentId'],
                    rfid_card,
                    student['name'],
                    student['department'],
                    device_data.get('deviceId', 'RFID_SCANNER_001'),
                    device_data.get('location', 'Main Entrance'),
                    attendance_status,
                    'present'
                ])
            print("✅ Attendance marked successfully")
        except Exception as e:
            print(f"❌ Error marking attendance: {e}")

    def update_daily_summary(self, student, scan_time, location):
        """Update daily summary"""
        today = date.today().strftime('%Y-%m-%d')
        
        # Read existing data
        summary_data = []
        student_found = False
        
        try:
            with open(self.DAILY_SUMMARY_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    if row['date'] == today and row['student_id'] == student['studentId']:
                        # Update existing entry
                        row['total_scans'] = str(int(row['total_scans']) + 1)
                        student_found = True
                    summary_data.append(row)
        except FileNotFoundError:
            pass
        
        # Add new entry if not found
        if not student_found:
            summary_data.append({
                'date': today,
                'student_id': student['studentId'],
                'name': student['name'],
                'department': student['department'],
                'first_scan': scan_time.strftime('%H:%M:%S'),
                'total_scans': '1',
                'location': location
            })
        
        # Write back to file
        with open(self.DAILY_SUMMARY_FILE, 'w', newline='', encoding='utf-8') as file:
            fieldnames = ['date', 'student_id', 'name', 'department', 'first_scan', 'total_scans', 'location']
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(summary_data)

    def mark_unknown_card(self, rfid_card, device_data):
        """Handle unknown RFID cards"""
        print("\n" + "❌" + "=" * 58 + "❌")
        print("║" + " " * 20 + "UNKNOWN RFID CARD" + " " * 21 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 💳 Card ID: {rfid_card:<44} ║")
        print(f"║ 🕐 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<37} ║")
        print(f"║ 📍 Location: {device_data.get('location', 'Unknown'):<42} ║")
        print("║" + " " * 58 + "║")
        print("║ Please add this card to students_database.csv        ║")
        print("╚" + "=" * 58 + "╝")
        
        # Log unknown card
        with open('unknown_cards.csv', 'a', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            if file.tell() == 0:  # File is empty, add header
                writer.writerow(['timestamp', 'rfid_card', 'device_id', 'location'])
            writer.writerow([
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                rfid_card,
                device_data.get('deviceId', 'RFID_SCANNER_001'),
                device_data.get('location', 'Unknown')
            ])
        
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

    def display_session_summary(self):
        """Display session statistics"""
        print("\n" + "📊" + "=" * 58 + "📊")
        print("║" + " " * 18 + "SESSION SUMMARY" + " " * 25 + "║")
        print("╠" + "=" * 58 + "╣")
        print(f"║ 🕐 Session Duration: {str(datetime.now() - self.session_start)[:7]:<37} ║")
        print(f"║ 📱 Total Scans: {self.total_scans:<41} ║")
        print(f"║ ✅ Successful: {self.successful_scans:<42} ║")
        print(f"║ ❌ Failed: {self.failed_scans:<46} ║")
        print("╚" + "=" * 58 + "╝")

    def get_todays_attendance(self):
        """Show today's attendance report"""
        today = date.today().strftime('%Y-%m-%d')
        
        print(f"\n📋 TODAY'S ATTENDANCE REPORT ({today})")
        print("=" * 90)
        print(f"{'Name':<25} {'ID':<10} {'Department':<20} {'First Scan':<12} {'Total Scans':<12} {'Location'}")
        print("-" * 90)
        
        total_students = 0
        try:
            with open(self.DAILY_SUMMARY_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    if row['date'] == today:
                        print(f"{row['name']:<25} {row['student_id']:<10} {row['department']:<20} {row['first_scan']:<12} {row['total_scans']:<12} {row['location']}")
                        total_students += 1
        except FileNotFoundError:
            print("No attendance records found")
        
        print(f"\nTotal Students Present: {total_students}")

    def start_system(self):
        """Start the attendance system"""
        if not self.initialize_serial():
            print("❌ Cannot start without serial connection")
            return False
        
        print("\n✅ SmartTrack Attendance System Ready!")
        print("📋 Scan RFID cards to mark attendance")
        print("📁 Data saved to CSV files:")
        print(f"   - Students: {self.STUDENTS_FILE}")
        print(f"   - Attendance: {self.ATTENDANCE_FILE}")
        print(f"   - Daily Summary: {self.DAILY_SUMMARY_FILE}")
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
            self.get_todays_attendance()
        
        finally:
            if self.serial_conn:
                self.serial_conn.close()
            print("✅ System stopped safely")

def main():
    system = SmartTrackAttendanceStandalone()
    system.start_system()

if __name__ == "__main__":
    main()
