#!/usr/bin/env python3
"""
SmartTrack RFID WebSocket Test Server
Runs WebSocket server without requiring hardware.
Provides real-time RFID attendance simulation via WebSocket with registration support.
"""

import os
import time
import threading
from datetime import datetime
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from flask import Flask, jsonify, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import psycopg2

# Load environment variables
load_dotenv()

class SmartTrackRFIDTestServer:
    def __init__(self):
        # Database configuration
        self.DB_HOST = os.getenv('DB_HOST', 'localhost')
        self.DB_PORT = os.getenv('DB_PORT', '5432')
        self.DB_NAME = os.getenv('DB_NAME', 'Attendify')
        self.DB_USER = os.getenv('DB_USER', 'postgres')
        self.DB_PASSWORD = os.getenv('DB_PASSWORD', 'Alpha')
        
        print(f"📋 Database Config: {self.DB_USER}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}")
        
        # Flask app setup
        self.app = Flask(__name__)
        self.app.config['SECRET_KEY'] = 'smarttrack_rfid_secret_2024'
        CORS(self.app)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        
        # Database connection
        self.db_conn = None
        
        # Registration mode state
        self.registration_mode = False
        self.registration_client = None
        
        # Auto-simulation state
        self.auto_simulation = False
        self.simulation_thread = None
        
        # Test data
        self.test_cards = ['BF74B21F', 'F6C9D600', 'A1B2C3D4', 'E5F6A7B8']
        self.current_card_index = 0
        
        # Setup routes and WebSocket events
        self.setup_routes()
        self.setup_socketio_events()

    def connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(
                host=self.DB_HOST,
                port=self.DB_PORT,
                database=self.DB_NAME,
                user=self.DB_USER,
                password=self.DB_PASSWORD
            )
            print("✅ Connected to PostgreSQL database")
            return True
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return False

    def get_student_by_rfid(self, rfid_card):
        """Get student information by RFID card"""
        try:
            if not self.db_conn:
                return None
            
            cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT student_id, name, department 
                FROM students 
                WHERE rfid_card = %s
            """, (rfid_card,))
            
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                return (result['student_id'], result['name'], result['department'])
            
        except Exception as e:
            print(f"❌ Error fetching student: {e}")
        
        return None

    def handle_registration_scan(self, card_id):
        """Handle RFID card scan during registration mode"""
        try:
            # Check if card is already registered
            existing_student = self.get_student_by_rfid(card_id)
            
            if existing_student:
                student_id, student_name, department = existing_student
                
                # Card already registered - send error
                registration_data = {
                    'success': False,
                    'cardId': card_id,
                    'message': f'Card already registered to {student_name} (ID: {student_id})',
                    'assignedTo': student_name,
                    'studentId': student_id,
                    'department': department,
                    'timestamp': datetime.now().isoformat()
                }
                
                self.socketio.emit('card_already_registered', registration_data)
                
                return jsonify(registration_data)
            else:
                # Card available for registration
                registration_data = {
                    'success': True,
                    'cardId': card_id,
                    'message': 'Card available for registration',
                    'available': True,
                    'timestamp': datetime.now().isoformat()
                }
                
                self.socketio.emit('card_scanned_for_registration', registration_data)
                
                # Turn off registration mode after successful scan
                self.registration_mode = False
                
                return jsonify(registration_data)
                
        except Exception as e:
            print(f"❌ Error handling registration scan: {e}")
            error_data = {
                'success': False,
                'cardId': card_id,
                'message': f'Error processing card scan: {str(e)}',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            
            self.socketio.emit('registration_scan_error', error_data)
            return jsonify(error_data), 500

    def mark_attendance(self, student_id, card_id):
        """Mark attendance for a student"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute("""
                INSERT INTO attendance (student_id, rfid_card, timestamp, method, device_id)
                VALUES (%s, %s, %s, %s, %s)
            """, (student_id, card_id, datetime.now(), 'rfid', 'TEST_DEVICE_001'))
            
            self.db_conn.commit()
            cursor.close()
            print(f"✅ Attendance marked for student {student_id}")
            return True
        except Exception as e:
            print(f"❌ Error marking attendance: {e}")
            return False

    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/api/test')
        def test_route():
            return jsonify({
                'status': 'Server running',
                'timestamp': datetime.now().isoformat(),
                'registration_mode': self.registration_mode
            })

        @self.app.route('/api/attendance')
        def get_attendance():
            """Get recent attendance records"""
            try:
                cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute("""
                    SELECT a.*, s.name, s.department 
                    FROM attendance a
                    JOIN students s ON a.student_id = s.student_id
                    ORDER BY a.timestamp DESC
                    LIMIT 10
                """)
                
                records = cursor.fetchall()
                cursor.close()
                
                return jsonify({
                    'attendance': [dict(record) for record in records]
                })
            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/api/simulate-scan/<card_id>')
        def simulate_scan(card_id):
            """Simulate an RFID card scan via API"""
            
            # Check if we're in registration mode
            if self.registration_mode:
                return self.handle_registration_scan(card_id)
            
            # Normal attendance mode
            student = self.get_student_by_rfid(card_id)
            
            if student:
                student_id, student_name, department = student
                success = self.mark_attendance(student_id, card_id)
                
                if success:
                    attendance_data = {
                        'id': int(datetime.now().timestamp() * 1000),
                        'studentId': student_id,
                        'studentName': student_name,
                        'rfidCard': card_id,
                        'department': department,
                        'deviceId': 'TEST_DEVICE_001',
                        'method': 'rfid',
                        'status': 'present',
                        'location': 'Test Lab',
                        'timestamp': datetime.now().isoformat(),
                        'className': f'{department} - RFID Scanner'
                    }
                    
                    self.socketio.emit('rfid_attendance', attendance_data)
                    self.socketio.emit('attendance_update', attendance_data)
                    
                    return jsonify({
                        'success': True,
                        'message': f'Attendance marked for {student_name}',
                        'data': attendance_data
                    })
                else:
                    return jsonify({'success': False, 'message': 'Failed to mark attendance'}), 500
            else:
                unknown_data = {
                    'id': int(datetime.now().timestamp() * 1000),
                    'rfidCard': card_id,
                    'deviceId': 'TEST_DEVICE_001',
                    'location': 'Test Lab',
                    'timestamp': datetime.now().isoformat()
                }
                
                self.socketio.emit('unknown_card', unknown_data)
                
                return jsonify({
                    'success': False,
                    'message': f'Unknown card: {card_id}',
                    'data': unknown_data
                })

        @self.app.route('/api/auto-simulation/start')
        def start_auto_simulation():
            """Start automatic card simulation"""
            if not self.auto_simulation:
                self.auto_simulation = True
                self.simulation_thread = threading.Thread(target=self.run_auto_simulation)
                self.simulation_thread.daemon = True
                self.simulation_thread.start()
                return jsonify({'message': 'Auto-simulation started'})
            return jsonify({'message': 'Auto-simulation already running'})

        @self.app.route('/api/auto-simulation/stop')
        def stop_auto_simulation():
            """Stop automatic card simulation"""
            self.auto_simulation = False
            return jsonify({'message': 'Auto-simulation stopped'})

    def setup_socketio_events(self):
        """Setup SocketIO event handlers"""
        
        @self.socketio.on('connect')
        def handle_connect():
            print(f"🔗 Client connected")
            emit('connected', {'message': 'Connected to RFID Test Server'})

        @self.socketio.on('disconnect')
        def handle_disconnect():
            print(f"🔌 Client disconnected")

        @self.socketio.on('start_registration_scan')
        def handle_start_registration_scan(data):
            """Handle request to start RFID scanning for registration"""
            print(f"🆔 Registration scan requested")
            
            # Store registration mode globally
            self.registration_mode = True
            
            emit('registration_scan_started', {
                'message': 'Registration scan mode activated',
                'timeout': data.get('timeout', 30000),
                'instructions': 'Present RFID card to scanner for registration'
            })
            
            print(f"✅ Registration mode activated")

        @self.socketio.on('stop_registration_scan')
        def handle_stop_registration_scan():
            """Handle request to stop RFID scanning"""
            print(f"🛑 Registration scan stopped")
            
            self.registration_mode = False
            
            emit('registration_scan_stopped', {
                'message': 'Registration scan mode deactivated'
            })

        @self.socketio.on('check_rfid_availability')
        def handle_check_rfid_availability(data):
            """Check if RFID card is available for registration"""
            card_id = data.get('cardId')
            
            if not card_id:
                emit('rfid_availability_result', {
                    'available': False,
                    'error': 'Card ID required'
                })
                return
            
            student = self.get_student_by_rfid(card_id)
            
            if student:
                student_id, student_name, department = student
                emit('rfid_availability_result', {
                    'available': False,
                    'cardId': card_id,
                    'assignedTo': student_name,
                    'studentId': student_id,
                    'department': department,
                    'message': f'Card already assigned to {student_name}'
                })
            else:
                emit('rfid_availability_result', {
                    'available': True,
                    'cardId': card_id,
                    'message': 'Card available for registration'
                })

    def run_auto_simulation(self):
        """Run automatic RFID card simulation"""
        print("🔄 Auto-simulation started")
        
        while self.auto_simulation:
            try:
                # Skip simulation if in registration mode
                if self.registration_mode:
                    time.sleep(2)
                    continue
                
                # Get next card
                card_id = self.test_cards[self.current_card_index]
                self.current_card_index = (self.current_card_index + 1) % len(self.test_cards)
                
                # Simulate scan
                student = self.get_student_by_rfid(card_id)
                
                if student:
                    student_id, student_name, department = student
                    success = self.mark_attendance(student_id, card_id)
                    
                    if success:
                        attendance_data = {
                            'id': int(datetime.now().timestamp() * 1000),
                            'studentId': student_id,
                            'studentName': student_name,
                            'rfidCard': card_id,
                            'department': department,
                            'deviceId': 'AUTO_SIM_001',
                            'method': 'rfid',
                            'status': 'present',
                            'location': 'Auto Simulation',
                            'timestamp': datetime.now().isoformat(),
                            'className': f'{department} - Auto Scanner'
                        }
                        
                        self.socketio.emit('rfid_attendance', attendance_data)
                        self.socketio.emit('attendance_update', attendance_data)
                        
                        print(f"🎯 Auto-scan: {student_name} ({card_id})")
                else:
                    unknown_data = {
                        'id': int(datetime.now().timestamp() * 1000),
                        'rfidCard': card_id,
                        'deviceId': 'AUTO_SIM_001',
                        'location': 'Auto Simulation',
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    self.socketio.emit('unknown_card', unknown_data)
                    print(f"❓ Auto-scan: Unknown card {card_id}")
                
                # Wait 8 seconds between scans
                time.sleep(8)
                
            except Exception as e:
                print(f"❌ Auto-simulation error: {e}")
                time.sleep(5)
        
        print("⏹️ Auto-simulation stopped")

    def run(self):
        """Start the server"""
        print("🚀 Starting SmartTrack RFID WebSocket Test Server...")
        
        # Connect to database
        if not self.connect_db():
            print("❌ Failed to connect to database. Exiting.")
            return
        
        print("📡 WebSocket server starting on http://localhost:5001")
        print("📝 Available endpoints:")
        print("   - GET  /api/test")
        print("   - GET  /api/attendance")
        print("   - GET  /api/simulate-scan/<card_id>")
        print("   - GET  /api/auto-simulation/start")
        print("   - GET  /api/auto-simulation/stop")
        print("🔌 WebSocket events:")
        print("   - start_registration_scan")
        print("   - stop_registration_scan")
        print("   - check_rfid_availability")
        print("🧪 Test with: http://localhost:5001/api/simulate-scan/BF74B21F")
        print("🎯 Registration mode: Present RFID card when mode is active")
        print("=" * 60)
        
        try:
            self.socketio.run(self.app, host='0.0.0.0', port=5001, debug=False)
        except KeyboardInterrupt:
            print("\n⏹️ Server stopped by user")
        except Exception as e:
            print(f"❌ Server error: {e}")

if __name__ == "__main__":
    server = SmartTrackRFIDTestServer()
    server.run()
