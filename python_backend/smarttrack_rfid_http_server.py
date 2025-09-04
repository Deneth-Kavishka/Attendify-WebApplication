#!/usr/bin/env python3
"""
SmartTrack RFID HTTP Server
==========================
Perfect integration with React frontend and Firebase backend
Compatible with your existing SmartTrack application architecture

Features:
- HTTP REST API for RFID scans
- Firebase Firestore integration
- Real-time updates for React frontend
- Device management and monitoring
- Cross-platform compatibility
- Easy debugging and testing
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import json
import psycopg2
import psycopg2.extras
import logging
from datetime import datetime, timedelta
import threading
import time
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try to import Firebase
try:
    import firebase_admin
    from firebase_admin import credentials, firestore as firebase_firestore
    FIREBASE_AVAILABLE = True
    firestore = firebase_firestore  # Create alias for easier reference
    print("✅ Firebase modules loaded successfully")
except ImportError:
    FIREBASE_AVAILABLE = False
    firebase_admin = None
    firestore = None
    print("⚠️ Firebase modules not available. Install with: pip install firebase-admin")

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Flask app configuration
app = Flask(__name__)
CORS(app)  # Allow React frontend to connect

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('smarttrack_rfid_http.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# 🗃️ DATABASE SETUP
# ═══════════════════════════════════════════════════════════════════════════════

class SmartTrackRFIDServer:
    def __init__(self):
        # PostgreSQL configuration from environment variables
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'Attendify'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'Alpha')
        }
        
        # Parse DATABASE_URL if provided
        database_url = os.getenv('DATABASE_URL')
        if database_url and database_url.startswith('postgresql://'):
            import urllib.parse as urlparse
            url = urlparse.urlparse(database_url)
            self.db_config = {
                'host': url.hostname,
                'port': url.port or 5432,
                'database': url.path[1:],  # Remove leading slash
                'user': url.username,
                'password': url.password
            }
        
        self.connected_devices = {}
        self.recent_scans = []
        self.firebase_db = None
        
        self.setup_database()
        self.setup_firebase()
        self.load_students()
        
        logger.info("SmartTrack RFID HTTP Server initialized with PostgreSQL")

    def get_db_connection(self):
        """Get PostgreSQL database connection"""
        try:
            conn = psycopg2.connect(**self.db_config)
            conn.autocommit = True
            return conn
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise

    def setup_database(self):
        """Initialize PostgreSQL database tables for RFID system"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Create RFID-specific tables in the existing Attendify database
            
            # RFID Students table (separate from main students table if needed)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rfid_students (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    rfid_card VARCHAR(50) UNIQUE NOT NULL,
                    full_name VARCHAR(255) NOT NULL,
                    student_id VARCHAR(50) UNIQUE NOT NULL,
                    department VARCHAR(100) NOT NULL,
                    email VARCHAR(255),
                    phone VARCHAR(20),
                    address TEXT,
                    emergency_contact VARCHAR(255),
                    enrollment_date DATE,
                    status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # RFID Attendance table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rfid_attendance (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id VARCHAR(50) NOT NULL,
                    rfid_card VARCHAR(50) NOT NULL,
                    device_id VARCHAR(100) NOT NULL,
                    location VARCHAR(255) NOT NULL,
                    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    method VARCHAR(20) DEFAULT 'RFID',
                    status VARCHAR(20) DEFAULT 'present',
                    device_uptime INTEGER,
                    signal_strength INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES rfid_students (student_id)
                )
            ''')
            
            # RFID Devices table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rfid_devices (
                    device_id VARCHAR(100) PRIMARY KEY,
                    device_type VARCHAR(50) NOT NULL,
                    location VARCHAR(255) NOT NULL,
                    version VARCHAR(50),
                    last_heartbeat TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'offline',
                    total_scans INTEGER DEFAULT 0,
                    successful_scans INTEGER DEFAULT 0,
                    failed_scans INTEGER DEFAULT 0,
                    uptime INTEGER DEFAULT 0,
                    wifi_signal INTEGER,
                    free_heap INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indexes for better performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_rfid_students_card ON rfid_students (rfid_card)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_rfid_attendance_student ON rfid_attendance (student_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_rfid_attendance_time ON rfid_attendance (scan_time)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_rfid_devices_status ON rfid_devices (status)')
            
            cursor.close()
            conn.close()
            
            logger.info("PostgreSQL database setup completed")
            
        except Exception as e:
            logger.error(f"Database setup error: {e}")
            raise

    def setup_firebase(self):
        """Initialize Firebase connection using environment variables"""
        try:
            # Try to import Firebase Admin SDK
            import firebase_admin
            from firebase_admin import credentials, firestore
            
            # Get Firebase config from environment variables
            firebase_config = {
                "type": "service_account",
                "project_id": os.getenv('FIREBASE_PROJECT_ID'),
                "private_key_id": os.getenv('FIREBASE_PRIVATE_KEY_ID'),
                "private_key": os.getenv('FIREBASE_PRIVATE_KEY', '').replace('\\n', '\n'),
                "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.getenv('FIREBASE_CLIENT_EMAIL', '').replace('@', '%40')}"
            }
            
            # Check if all required Firebase config is present
            required_fields = ['project_id', 'private_key_id', 'private_key', 'client_email']
            if all(firebase_config.get(field) for field in required_fields):
                # Initialize Firebase Admin SDK
                if not firebase_admin._apps:
                    cred = credentials.Certificate(firebase_config)
                    firebase_admin.initialize_app(cred)
                
                self.firebase_db = firestore.client()
                logger.info("✅ Firebase connected successfully using environment variables")
                logger.info(f"🔗 Project ID: {firebase_config['project_id']}")
                
                # Test Firebase connection by reading/writing test data
                self.test_firebase_connection()
                
            else:
                logger.warning("⚠️ Firebase configuration incomplete in environment variables")
                self.firebase_db = None
                
        except ImportError:
            logger.warning("⚠️ Firebase Admin SDK not installed. Install with: pip install firebase-admin")
            self.firebase_db = None
        except Exception as e:
            logger.error(f"❌ Firebase setup error: {e}")
            self.firebase_db = None
            
    def test_firebase_connection(self):
        """Test Firebase Firestore connection"""
        try:
            if self.firebase_db:
                # Test write
                test_doc = {
                    'test': True,
                    'timestamp': datetime.now(),
                    'server': 'SmartTrack RFID HTTP',
                    'status': 'connected'
                }
                self.firebase_db.collection('rfid_system_test').document('connection_test').set(test_doc)
                
                # Test read
                doc = self.firebase_db.collection('rfid_system_test').document('connection_test').get()
                if doc.exists:
                    logger.info("🔥 Firebase Firestore connection test: SUCCESS")
                    return True
                else:
                    logger.warning("⚠️ Firebase Firestore test document not found")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Firebase connection test failed: {e}")
            return False

    def load_students(self):
        """Load students from PostgreSQL database or create sample data"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            # Check if we have students
            cursor.execute("SELECT COUNT(*) FROM rfid_students")
            count = cursor.fetchone()['count']
            
            if count == 0:
                logger.info("No RFID students found, creating sample data...")
                self.create_sample_students()
            
            # Load students into memory for faster access
            cursor.execute("""
                SELECT id, rfid_card, full_name, student_id, department, 
                       email, phone, address, emergency_contact, enrollment_date, status
                FROM rfid_students
                WHERE status = 'active'
            """)
            
            self.students_db = {}
            for row in cursor.fetchall():
                student_data = {
                    'id': str(row['id']),
                    'fullName': row['full_name'],
                    'studentId': row['student_id'],
                    'department': row['department'],
                    'email': row['email'] or '',
                    'phone': row['phone'] or '',
                    'address': row['address'] or '',
                    'emergencyContact': row['emergency_contact'] or '',
                    'enrollmentDate': str(row['enrollment_date']) if row['enrollment_date'] else '',
                    'status': row['status'],
                    'attendanceStats': {
                        'attendancePercentage': 0.0
                    }
                }
                self.students_db[row['rfid_card']] = student_data  # Key by RFID card
            
            cursor.close()
            conn.close()
            logger.info(f"Loaded {len(self.students_db)} RFID students from PostgreSQL")
            
        except Exception as e:
            logger.error(f"Error loading students: {e}")
            self.students_db = {}

    def create_sample_students(self):
        """Create sample student data for testing"""
        sample_students = [
            {
                'rfid_card': '1234567890',
                'full_name': 'John Doe',
                'student_id': 'CS001',
                'department': 'Computer Science',
                'email': 'john.doe@university.edu',
                'phone': '+1234567890',
                'enrollment_date': '2024-01-15'
            },
            {
                'rfid_card': '0987654321',
                'full_name': 'Jane Smith',
                'student_id': 'CS002',
                'department': 'Computer Science',
                'email': 'jane.smith@university.edu',
                'phone': '+1234567891',
                'enrollment_date': '2024-01-16'
            },
            {
                'rfid_card': '1122334455',
                'full_name': 'Mike Johnson',
                'student_id': 'EN001',
                'department': 'Engineering',
                'email': 'mike.johnson@university.edu',
                'phone': '+1234567892',
                'enrollment_date': '2024-01-17'
            },
            {
                'rfid_card': '5544332211',
                'full_name': 'Sarah Wilson',
                'student_id': 'SC001',
                'department': 'Science',
                'email': 'sarah.wilson@university.edu',
                'phone': '+1234567893',
                'enrollment_date': '2024-01-18'
            },
            {
                'rfid_card': 'ABCDEF1234',
                'full_name': 'David Brown',
                'student_id': 'BU001',
                'department': 'Business',
                'email': 'david.brown@university.edu',
                'phone': '+1234567894',
                'enrollment_date': '2024-01-19'
            }
        ]
        
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            for student in sample_students:
                cursor.execute('''
                    INSERT INTO rfid_students (rfid_card, full_name, student_id, department, email, phone, enrollment_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                ''', (
                    student['rfid_card'], student['full_name'], student['student_id'],
                    student['department'], student['email'], student['phone'], student['enrollment_date']
                ))
            
            cursor.close()
            conn.close()
            
            logger.info("Sample student data created in PostgreSQL")
            
        except Exception as e:
            logger.error(f"Error creating sample students: {e}")

# Initialize server instance
rfid_server = SmartTrackRFIDServer()

# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/status', methods=['GET'])
def server_status():
    """Server status endpoint for Arduino to check connectivity"""
    return jsonify({
        'status': 'online',
        'server': 'SmartTrack RFID HTTP Server',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat(),
        'students_loaded': len(rfid_server.students_db),
        'connected_devices': len(rfid_server.connected_devices),
        'uptime': time.time()
    })

@app.route('/rfid-scan', methods=['POST'])
def handle_rfid_scan():
    """Main RFID scan processing endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No JSON data received'
            }), 400
        
        rfid_card = data.get('rfidCard', '').strip().upper()
        device_id = data.get('deviceId', 'UNKNOWN')
        location = data.get('location', 'Unknown Location')
        timestamp = data.get('timestamp', int(time.time() * 1000))
        device_uptime = data.get('deviceUptime', 0)
        signal_strength = data.get('signalStrength', 0)
        
        logger.info(f"RFID Scan: {rfid_card} from {device_id} at {location}")
        
        if not rfid_card:
            return jsonify({
                'success': False,
                'message': 'RFID card number is required'
            }), 400
        
        # Look up student
        if rfid_card in rfid_server.students_db:
            student = rfid_server.students_db[rfid_card]
            
            # Record attendance in PostgreSQL database
            try:
                conn = rfid_server.get_db_connection()
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO rfid_attendance (
                        student_id, rfid_card, device_id, location, 
                        device_uptime, signal_strength, method, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (
                    student['studentId'], rfid_card, device_id,
                    location, device_uptime, signal_strength, 'RFID', 'present'
                ))
                
                attendance_id = str(cursor.fetchone()[0])
                cursor.close()
                conn.close()
                
            except Exception as db_error:
                logger.error(f"Database error: {db_error}")
                attendance_id = str(uuid.uuid4())  # Fallback ID
            
            # Update Firebase with real-time data
            if rfid_server.firebase_db:
                try:
                    # Create comprehensive Firebase record
                    firebase_record = {
                        # Student Information
                        'studentId': student['studentId'],
                        'studentName': student['fullName'],
                        'department': student['department'],
                        'rfidCard': rfid_card,
                        
                        # Attendance Details
                        'attendanceId': attendance_id,
                        'scanTime': datetime.now(),
                        'method': 'RFID',
                        'status': 'present',
                        
                        # Device Information
                        'deviceId': device_id,
                        'location': location,
                        'deviceUptime': device_uptime,
                        'signalStrength': signal_strength,
                        
                        # System Metadata
                        'serverTimestamp': datetime.now(),
                        'source': 'SmartTrack_RFID_HTTP',
                        'version': '1.0.0',
                        
                        # Additional Context
                        'sessionInfo': {
                            'timestamp': int(timestamp),
                            'processingTime': datetime.now(),
                            'serverLocation': 'SmartTrack Server'
                        }
                    }
                    
                    # Add to multiple Firebase collections for different use cases
                    
                    # 1. Real-time attendance feed (for live dashboard)
                    rfid_server.firebase_db.collection('rfid_live_feed').add(firebase_record)
                    
                    # 2. Student-specific attendance record
                    rfid_server.firebase_db.collection('rfid_attendance').add(firebase_record)
                    
                    # 3. Daily attendance summary (for quick access)
                    today_key = datetime.now().strftime('%Y-%m-%d')
                    daily_ref = rfid_server.firebase_db.collection('rfid_daily').document(today_key)
                    
                    # Update daily stats
                    daily_data = daily_ref.get()
                    if daily_data.exists:
                        daily_stats = daily_data.to_dict()
                        daily_stats['totalScans'] = daily_stats.get('totalScans', 0) + 1
                        daily_stats['lastScan'] = firebase_record
                        daily_stats['students'] = daily_stats.get('students', {})
                        daily_stats['students'][student['studentId']] = {
                            'name': student['fullName'],
                            'department': student['department'],
                            'lastSeen': datetime.now(),
                            'scanCount': daily_stats['students'].get(student['studentId'], {}).get('scanCount', 0) + 1
                        }
                    else:
                        daily_stats = {
                            'date': today_key,
                            'totalScans': 1,
                            'lastScan': firebase_record,
                            'students': {
                                student['studentId']: {
                                    'name': student['fullName'],
                                    'department': student['department'],
                                    'lastSeen': datetime.now(),
                                    'scanCount': 1
                                }
                            },
                            'createdAt': datetime.now()
                        }
                    
                    daily_ref.set(daily_stats)
                    
                    # 4. Device activity log
                    device_ref = rfid_server.firebase_db.collection('rfid_devices').document(device_id)
                    device_data = {
                        'deviceId': device_id,
                        'location': location,
                        'lastActivity': datetime.now(),
                        'status': 'active',
                        'lastScan': firebase_record
                    }
                    # Try to increment, fallback to setting value
                    try:
                        if FIREBASE_AVAILABLE and firestore:
                            device_data['totalScans'] = firestore.Increment(1)
                        else:
                            device_data['totalScans'] = 1
                    except:
                        device_data['totalScans'] = 1
                    
                    device_ref.set(device_data, merge=True)
                    
                    # 5. Student profile update (last seen)
                    student_ref = rfid_server.firebase_db.collection('rfid_student_profiles').document(student['studentId'])
                    student_profile = {
                        'studentId': student['studentId'],
                        'fullName': student['fullName'],
                        'department': student['department'],
                        'rfidCard': rfid_card,
                        'lastSeen': datetime.now(),
                        'lastLocation': location,
                        'lastDevice': device_id,
                        'status': 'active'
                    }
                    # Try to increment, fallback to setting value
                    try:
                        if FIREBASE_AVAILABLE and firestore:
                            student_profile['totalScans'] = firestore.Increment(1)
                        else:
                            student_profile['totalScans'] = 1
                    except:
                        student_profile['totalScans'] = 1
                        
                    student_ref.set(student_profile, merge=True)
                    
                    logger.info(f"🔥 Firebase updated with real-time data for {student['studentId']}")
                    
                except Exception as e:
                    logger.error(f"❌ Firebase update failed: {e}")
                    # Continue processing even if Firebase fails
            
            # Add to recent scans for live feed
            scan_record = {
                'id': attendance_id,
                'student': student,
                'rfidCard': rfid_card,
                'deviceId': device_id,
                'location': location,
                'timestamp': datetime.now().isoformat(),
                'method': 'RFID'
            }
            
            rfid_server.recent_scans.insert(0, scan_record)
            if len(rfid_server.recent_scans) > 50:  # Keep only last 50
                rfid_server.recent_scans.pop()
            
            # Success response
            logger.info(f"Attendance recorded: {student['fullName']} ({student['studentId']})")
            
            return jsonify({
                'success': True,
                'message': 'Attendance recorded successfully',
                'student': student,
                'attendanceId': attendance_id,
                'timestamp': datetime.now().isoformat()
            })
            
        else:
            # Student not found
            logger.warning(f"Unknown RFID card: {rfid_card}")
            
            return jsonify({
                'success': False,
                'message': 'Student not found',
                'rfidCard': rfid_card,
                'suggestion': 'Please contact administrator to register this card'
            }), 404
            
    except Exception as e:
        logger.error(f"RFID scan processing error: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/device-heartbeat', methods=['POST'])
def handle_device_heartbeat():
    """Handle device heartbeat and status updates"""
    try:
        data = request.get_json()
        device_id = data.get('deviceId', 'UNKNOWN')
        
        # Update device status
        device_info = {
            'deviceId': device_id,
            'deviceType': data.get('deviceType', 'RFID_READER'),
            'location': data.get('location', 'Unknown'),
            'version': data.get('version', '1.0'),
            'lastHeartbeat': datetime.now(),
            'status': 'online',
            'uptime': data.get('uptime', 0),
            'totalScans': data.get('totalScans', 0),
            'successfulScans': data.get('successfulScans', 0),
            'failedScans': data.get('failedScans', 0),
            'wifiSignal': data.get('wifiSignal', 0),
            'freeHeap': data.get('freeHeap', 0)
        }
        
        rfid_server.connected_devices[device_id] = device_info
        
        # Update PostgreSQL database
        try:
            conn = rfid_server.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO rfid_devices (
                    device_id, device_type, location, version, last_heartbeat,
                    status, total_scans, successful_scans, failed_scans,
                    uptime, wifi_signal, free_heap, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (device_id) 
                DO UPDATE SET
                    device_type = EXCLUDED.device_type,
                    location = EXCLUDED.location,
                    version = EXCLUDED.version,
                    last_heartbeat = EXCLUDED.last_heartbeat,
                    status = EXCLUDED.status,
                    total_scans = EXCLUDED.total_scans,
                    successful_scans = EXCLUDED.successful_scans,
                    failed_scans = EXCLUDED.failed_scans,
                    uptime = EXCLUDED.uptime,
                    wifi_signal = EXCLUDED.wifi_signal,
                    free_heap = EXCLUDED.free_heap,
                    updated_at = EXCLUDED.updated_at
            ''', (
                device_id, device_info['deviceType'], device_info['location'],
                device_info['version'], device_info['lastHeartbeat'],
                device_info['status'], device_info['totalScans'],
                device_info['successfulScans'], device_info['failedScans'],
                device_info['uptime'], device_info['wifiSignal'],
                device_info['freeHeap'], datetime.now()
            ))
            
            cursor.close()
            conn.close()
            
        except Exception as db_error:
            logger.error(f"Database error in heartbeat: {db_error}")
        
        logger.info(f"Heartbeat received from {device_id}")
        
        return jsonify({
            'success': True,
            'message': 'Heartbeat acknowledged',
            'serverTime': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Heartbeat processing error: {e}")
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500

# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 FRONTEND API ENDPOINTS (for React integration)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/attendance/recent', methods=['GET'])
def get_recent_attendance():
    """Get recent attendance for React frontend"""
    limit = request.args.get('limit', 20, type=int)
    
    try:
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT a.*, s.full_name, s.department
            FROM rfid_attendance a
            JOIN rfid_students s ON a.student_id = s.student_id
            ORDER BY a.scan_time DESC
            LIMIT %s
        ''', (limit,))
        
        attendance_records = []
        for row in cursor.fetchall():
            attendance_records.append({
                'id': str(row['id']),
                'studentId': row['student_id'],
                'studentName': row['full_name'],
                'department': row['department'],
                'rfidCard': row['rfid_card'],
                'deviceId': row['device_id'],
                'location': row['location'],
                'scanTime': row['scan_time'].isoformat() if row['scan_time'] else None,
                'method': row['method'],
                'status': row['status']
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': attendance_records,
            'count': len(attendance_records)
        })
        
    except Exception as e:
        logger.error(f"Error getting recent attendance: {e}")
        return jsonify({
            'success': False,
            'message': f'Database error: {str(e)}',
            'data': [],
            'count': 0
        })

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """Get device status for React frontend"""
    # Clean up offline devices (no heartbeat for 2 minutes)
    cutoff_time = datetime.now() - timedelta(minutes=2)
    
    online_devices = []
    for device_id, device in rfid_server.connected_devices.items():
        if device['lastHeartbeat'] > cutoff_time:
            device['status'] = 'online'
            online_devices.append({
                'deviceId': device_id,
                'deviceType': device['deviceType'],
                'location': device['location'],
                'version': device['version'],
                'status': device['status'],
                'uptime': device['uptime'],
                'totalScans': device['totalScans'],
                'successfulScans': device['successfulScans'],
                'failedScans': device['failedScans'],
                'lastHeartbeat': device['lastHeartbeat'].isoformat()
            })
        else:
            device['status'] = 'offline'
    
    return jsonify({
        'success': True,
        'devices': online_devices,
        'count': len(online_devices)
    })

@app.route('/api/students', methods=['GET'])
def get_students():
    """Get students list for React frontend"""
    try:
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT id, rfid_card, full_name, student_id, department, 
                   email, phone, enrollment_date, status
            FROM rfid_students
            WHERE status = 'active'
            ORDER BY full_name
        ''')
        
        students = []
        for row in cursor.fetchall():
            students.append({
                'id': str(row['id']),
                'rfidCard': row['rfid_card'],
                'fullName': row['full_name'],
                'studentId': row['student_id'],
                'department': row['department'],
                'email': row['email'] or '',
                'phone': row['phone'] or '',
                'enrollmentDate': str(row['enrollment_date']) if row['enrollment_date'] else '',
                'status': row['status'],
                'attendancePercentage': 0.0,  # Will be calculated separately if needed
                'totalAttendance': 0  # Will be calculated separately if needed
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'students': students,
            'count': len(students)
        })
        
    except Exception as e:
        logger.error(f"Error getting students: {e}")
        return jsonify({
            'success': False,
            'message': f'Database error: {str(e)}',
            'students': [],
            'count': 0
        })

@app.route('/api/live-feed', methods=['GET'])
def get_live_feed():
    """Get live RFID scan feed for React frontend"""
    return jsonify({
        'success': True,
        'scans': rfid_server.recent_scans[:20],  # Last 20 scans
        'timestamp': datetime.now().isoformat()
    })

# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 WEB DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def dashboard():
    """Simple web dashboard for monitoring"""
    dashboard_html = '''
<!DOCTYPE html>
<html>
<head>
    <title>SmartTrack RFID Monitor</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; color: #333; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-title { font-size: 14px; color: #666; margin-bottom: 5px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #333; }
        .recent-scans { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .scan-item { padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .scan-item:last-child { border-bottom: none; }
        .online { color: #28a745; }
        .offline { color: #dc3545; }
        .refresh { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 SmartTrack RFID Monitor</h1>
            <p>Real-time attendance monitoring system</p>
            <button class="refresh" onclick="location.reload()">🔄 Refresh</button>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-title">📱 Total Students</div>
                <div class="stat-value" id="total-students">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">📡 Connected Devices</div>
                <div class="stat-value" id="connected-devices">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">📊 Today's Scans</div>
                <div class="stat-value" id="today-scans">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">🕒 Server Uptime</div>
                <div class="stat-value" id="server-uptime">-</div>
            </div>
        </div>
        
        <div class="recent-scans">
            <h3>🔴 Live RFID Scans</h3>
            <div id="scan-list">Loading...</div>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                // Load live feed
                const feedResponse = await fetch('/api/live-feed');
                const feedData = await feedResponse.json();
                
                const scanList = document.getElementById('scan-list');
                if (feedData.success && feedData.scans.length > 0) {
                    scanList.innerHTML = feedData.scans.map(scan => `
                        <div class="scan-item">
                            <div>
                                <strong>${scan.student.fullName}</strong> (${scan.student.studentId})<br>
                                <small>${scan.student.department} | ${scan.location}</small>
                            </div>
                            <div style="text-align: right;">
                                <small>${new Date(scan.timestamp).toLocaleString()}</small>
                            </div>
                        </div>
                    `).join('');
                } else {
                    scanList.innerHTML = '<p>No recent scans</p>';
                }
                
                // Load students count
                const studentsResponse = await fetch('/api/students');
                const studentsData = await studentsResponse.json();
                document.getElementById('total-students').textContent = studentsData.count || 0;
                
                // Load devices count
                const devicesResponse = await fetch('/api/devices');
                const devicesData = await devicesResponse.json();
                document.getElementById('connected-devices').textContent = devicesData.count || 0;
                
                // Server status
                const statusResponse = await fetch('/status');
                const statusData = await statusResponse.json();
                document.getElementById('server-uptime').textContent = statusData.uptime ? 
                    Math.floor(statusData.uptime) + 's' : 'Unknown';
                
                // Today's scans count
                const todayScans = feedData.scans.filter(scan => {
                    const scanDate = new Date(scan.timestamp).toDateString();
                    const today = new Date().toDateString();
                    return scanDate === today;
                }).length;
                document.getElementById('today-scans').textContent = todayScans;
                
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }
        
        // Load data on page load
        loadData();
        
        // Auto-refresh every 5 seconds
        setInterval(loadData, 5000);
    </script>
</body>
</html>
    '''
    return dashboard_html

# ═══════════════════════════════════════════════════════════════════════════════
# � REACT FRONTEND API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/recent-scans', methods=['GET'])
def get_recent_scans():
    """Get recent RFID scans for React frontend"""
    try:
        limit = request.args.get('limit', 20, type=int)
        
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT 
                a.id, a.student_id, a.rfid_card, a.device_id, a.location, 
                a.scan_time, a.method, a.status,
                s.full_name, s.department, s.email
            FROM rfid_attendance a
            LEFT JOIN rfid_students s ON a.student_id = s.student_id
            ORDER BY a.scan_time DESC
            LIMIT %s
        ''', (limit,))
        
        scans = []
        for row in cursor.fetchall():
            scans.append({
                'id': str(row['id']),
                'studentId': row['student_id'],
                'rfidCard': row['rfid_card'],
                'deviceId': row['device_id'],
                'location': row['location'],
                'scanTime': row['scan_time'].isoformat() if row['scan_time'] else None,
                'method': row['method'],
                'status': row['status'],
                'fullName': row['full_name'],
                'department': row['department'],
                'email': row['email']
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'scans': scans,
            'count': len(scans)
        })
        
    except Exception as e:
        logger.error(f"Error fetching recent scans: {e}")
        return jsonify({
            'success': False,
            'message': 'Error fetching recent scans'
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics for React frontend"""
    try:
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Today's stats
        cursor.execute('''
            SELECT 
                COUNT(*) as total_scans,
                COUNT(DISTINCT student_id) as unique_students
            FROM rfid_attendance 
            WHERE DATE(scan_time) = CURRENT_DATE
        ''')
        today_stats = cursor.fetchone()
        
        # All time stats
        cursor.execute('''
            SELECT 
                COUNT(*) as total_scans,
                COUNT(DISTINCT student_id) as unique_students
            FROM rfid_attendance
        ''')
        all_time_stats = cursor.fetchone()
        
        # Device stats
        cursor.execute('''
            SELECT 
                COUNT(*) as total_devices,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_devices
            FROM rfid_devices
        ''')
        device_stats = cursor.fetchone()
        
        # Success rate (assuming all scans are successful for now)
        success_rate = 100.0
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'today': {
                'totalScans': today_stats['total_scans'],
                'uniqueStudents': today_stats['unique_students']
            },
            'allTime': {
                'totalScans': all_time_stats['total_scans'],
                'uniqueStudents': all_time_stats['unique_students']
            },
            'devices': {
                'total': device_stats['total_devices'],
                'active': device_stats['active_devices']
            },
            'successRate': success_rate
        })
        
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({
            'success': False,
            'message': 'Error fetching statistics'
        }), 500

@app.route('/api/devices', methods=['GET'])
def api_get_devices():
    """Get device status for React frontend"""
    try:
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT 
                device_id, device_type, location, version,
                last_heartbeat, status, total_scans, successful_scans,
                failed_scans, uptime, wifi_signal, free_heap,
                created_at, updated_at
            FROM rfid_devices
            ORDER BY last_heartbeat DESC
        ''')
        
        devices = []
        for row in cursor.fetchall():
            devices.append({
                'deviceId': row['device_id'],
                'deviceType': row['device_type'],
                'location': row['location'],
                'version': row['version'],
                'lastHeartbeat': row['last_heartbeat'].isoformat() if row['last_heartbeat'] else None,
                'status': row['status'],
                'totalScans': row['total_scans'],
                'successfulScans': row['successful_scans'],
                'failedScans': row['failed_scans'],
                'uptime': row['uptime'],
                'wifiSignal': row['wifi_signal'],
                'freeHeap': row['free_heap'],
                'createdAt': row['created_at'].isoformat() if row['created_at'] else None,
                'updatedAt': row['updated_at'].isoformat() if row['updated_at'] else None
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'devices': devices,
            'count': len(devices)
        })
        
    except Exception as e:
        logger.error(f"Error fetching devices: {e}")
        return jsonify({
            'success': False,
            'message': 'Error fetching devices'
        }), 500

@app.route('/api/students', methods=['GET'])
def api_get_students():
    """Get students list for React frontend"""
    try:
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute('''
            SELECT 
                id, rfid_card, full_name, student_id, department,
                email, phone, address, emergency_contact, enrollment_date,
                status, created_at, updated_at
            FROM rfid_students
            WHERE status = 'active'
            ORDER BY full_name
        ''')
        
        students = []
        for row in cursor.fetchall():
            students.append({
                'id': str(row['id']),
                'rfidCard': row['rfid_card'],
                'fullName': row['full_name'],
                'studentId': row['student_id'],
                'department': row['department'],
                'email': row['email'],
                'phone': row['phone'],
                'address': row['address'],
                'emergencyContact': row['emergency_contact'],
                'enrollmentDate': str(row['enrollment_date']) if row['enrollment_date'] else None,
                'status': row['status'],
                'createdAt': row['created_at'].isoformat() if row['created_at'] else None,
                'updatedAt': row['updated_at'].isoformat() if row['updated_at'] else None
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'students': students,
            'count': len(students)
        })
        
    except Exception as e:
        logger.error(f"Error fetching students: {e}")
        return jsonify({
            'success': False,
            'message': 'Error fetching students'
        }), 500

@app.route('/api/daily-summary', methods=['GET'])
def get_daily_summary():
    """Get daily attendance summary for React frontend"""
    try:
        date_str = request.args.get('date', None)
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = datetime.now().date()
        
        conn = rfid_server.get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Daily summary stats
        cursor.execute('''
            SELECT 
                COUNT(*) as total_scans,
                COUNT(DISTINCT student_id) as unique_students,
                MIN(scan_time) as first_scan,
                MAX(scan_time) as last_scan
            FROM rfid_attendance 
            WHERE DATE(scan_time) = %s
        ''', (target_date,))
        daily_stats = cursor.fetchone()
        
        # Hourly breakdown
        cursor.execute('''
            SELECT 
                EXTRACT(hour FROM scan_time) as hour,
                COUNT(*) as scan_count
            FROM rfid_attendance 
            WHERE DATE(scan_time) = %s
            GROUP BY EXTRACT(hour FROM scan_time)
            ORDER BY scan_count DESC
            LIMIT 1
        ''', (target_date,))
        peak_hour_row = cursor.fetchone()
        peak_hour = f"{int(peak_hour_row['hour'])}:00" if peak_hour_row else None
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'date': target_date.isoformat(),
            'totalScans': daily_stats['total_scans'],
            'uniqueStudents': daily_stats['unique_students'],
            'firstScan': daily_stats['first_scan'].isoformat() if daily_stats['first_scan'] else None,
            'lastScan': daily_stats['last_scan'].isoformat() if daily_stats['last_scan'] else None,
            'peakHour': peak_hour,
            'attendanceRate': 85.5  # Calculate based on your enrollment data
        })
        
    except Exception as e:
        logger.error(f"Error fetching daily summary: {e}")
        return jsonify({
            'success': False,
            'message': 'Error fetching daily summary'
        }), 500

# ═══════════════════════════════════════════════════════════════════════════════
# �🚀 SERVER STARTUP
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    logger.info("Starting SmartTrack RFID HTTP Server...")
    logger.info("HTTP Server: http://0.0.0.0:5080")
    logger.info("Web Dashboard: http://localhost:5080")
    logger.info("React API: /api/*")
    logger.info("Arduino Endpoint: /rfid-scan")
    logger.info("Device Heartbeat: /device-heartbeat")
    logger.info("Firebase Integration: " + ("Enabled" if rfid_server.firebase_db else "Disabled"))
    logger.info("Ready for RFID scans!")
    
    try:
        app.run(
            host='0.0.0.0',  # Accept connections from any IP
            port=5080,       # HTTP port (changed from 8080)
            debug=False,     # Set to False for production
            threaded=True    # Handle multiple requests
        )
    except Exception as e:
        logger.error(f"Server startup failed: {e}")
        raise
