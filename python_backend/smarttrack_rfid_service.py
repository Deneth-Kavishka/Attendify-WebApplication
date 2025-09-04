#!/usr/bin/env python3
"""
SmartTrack Enhanced RFID Attendance System
Complete Python backend with Firebase & PostgreSQL integration
Real-time communication with NodeMCU RFID devices

Features:
- WebSocket server for real-time device communication
- Firebase Firestore for real-time updates
- PostgreSQL for persistent data storage
- Complete student profile management
- Attendance tracking and analytics
- Device management and monitoring

Author: SmartTrack Team
Version: 3.0.0
"""

import asyncio
import websockets
import json
import sqlite3
import psycopg2
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import socket
from flask import Flask, render_template_string, jsonify, request
from flask_cors import CORS
import threading
import time
import os
import firebase_admin
from firebase_admin import credentials, firestore
from dataclasses import dataclass

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('smarttrack_rfid.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class StudentProfile:
    """Complete student profile structure"""
    id: str
    student_id: str
    full_name: str
    email: str
    rfid_card: str
    department: str
    batch: str
    semester: str
    enrollment_year: int
    gpa: float
    mobile_number: str
    guardian_contact: str
    emergency_contact: str
    attendance_stats: Dict[str, Any]
    fee_status: Dict[str, Any]
    results: Dict[str, Any]
    current_classes: List[Dict[str, Any]]

class SmartTrackRFIDService:
    def __init__(self):
        self.clients = set()
        self.devices = {}
        self.students_db = {}
        self.setup_database()
        self.setup_firebase()
        self.load_students()
        self.websocket_server = None
        self.flask_app = self.create_flask_app()
        
    def setup_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Initialize Firebase Admin SDK
            # You'll need to download the service account key from Firebase Console
            cred_path = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
            
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                self.firestore_db = firestore.client()
                logger.info("✅ Firebase Admin SDK initialized")
            else:
                logger.warning("⚠️ Firebase service account key not found. Creating mock setup...")
                self.firestore_db = None
                
        except Exception as e:
            logger.error(f"❌ Firebase initialization failed: {e}")
            self.firestore_db = None
    
    def setup_database(self):
        """Setup both SQLite (local) and PostgreSQL (main) databases"""
        
        # SQLite for local backup and testing
        self.setup_sqlite()
        
        # PostgreSQL for production
        self.setup_postgresql()
        
    def setup_sqlite(self):
        """Setup local SQLite database"""
        db_path = os.path.join(os.path.dirname(__file__), 'smarttrack_rfid.db')
        self.sqlite_conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = self.sqlite_conn.cursor()
        
        # Create comprehensive tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                student_id TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE,
                rfid_card TEXT UNIQUE NOT NULL,
                department TEXT,
                batch TEXT,
                semester TEXT,
                enrollment_year INTEGER,
                gpa REAL DEFAULT 0.0,
                mobile_number TEXT,
                guardian_contact TEXT,
                emergency_contact TEXT,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                rfid_card TEXT,
                device_id TEXT,
                class_id TEXT,
                method TEXT DEFAULT 'rfid',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'present',
                location TEXT,
                confidence REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(student_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT UNIQUE,
                department TEXT,
                lecturer_id TEXT,
                lecturer_name TEXT,
                start_time TIME,
                end_time TIME,
                days TEXT,
                location TEXT,
                semester TEXT,
                credits INTEGER DEFAULT 3,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS enrollments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                class_id TEXT,
                enrollment_date DATE DEFAULT CURRENT_DATE,
                status TEXT DEFAULT 'enrolled',
                FOREIGN KEY (student_id) REFERENCES students(student_id),
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT,
                type TEXT,
                location TEXT,
                ip_address TEXT,
                status TEXT DEFAULT 'offline',
                last_heartbeat DATETIME,
                total_scans INTEGER DEFAULT 0,
                successful_scans INTEGER DEFAULT 0,
                failed_scans INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fee_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                semester TEXT,
                total_amount REAL,
                paid_amount REAL DEFAULT 0.0,
                due_date DATE,
                payment_date DATE,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (student_id) REFERENCES students(student_id)
            )
        ''')
        
        self.sqlite_conn.commit()
        logger.info("✅ SQLite database setup completed")
    
    def setup_postgresql(self):
        """Setup PostgreSQL connection"""
        try:
            # PostgreSQL connection parameters
            pg_config = {
                'host': 'localhost',
                'database': 'smarttrack_attendance',
                'user': 'postgres',
                'password': 'password',  # Update with your PostgreSQL password
                'port': 5432
            }
            
            self.pg_conn = psycopg2.connect(**pg_config)
            self.pg_conn.autocommit = True
            
            # Create tables if they don't exist
            cursor = self.pg_conn.cursor()
            
            # Create students table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS students (
                    id VARCHAR(50) PRIMARY KEY,
                    student_id VARCHAR(20) UNIQUE NOT NULL,
                    full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE,
                    rfid_card VARCHAR(20) UNIQUE NOT NULL,
                    department VARCHAR(50),
                    batch VARCHAR(10),
                    semester VARCHAR(10),
                    enrollment_year INTEGER,
                    gpa DECIMAL(3,2) DEFAULT 0.0,
                    mobile_number VARCHAR(15),
                    guardian_contact VARCHAR(15),
                    emergency_contact VARCHAR(15),
                    status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create attendance_records table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS attendance_records (
                    id SERIAL PRIMARY KEY,
                    student_id VARCHAR(20),
                    rfid_card VARCHAR(20),
                    device_id VARCHAR(50),
                    class_id VARCHAR(50),
                    method VARCHAR(20) DEFAULT 'rfid',
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'present',
                    location VARCHAR(100),
                    confidence DECIMAL(3,2) DEFAULT 1.0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(student_id)
                )
            ''')
            
            logger.info("✅ PostgreSQL database setup completed")
            
        except Exception as e:
            logger.error(f"❌ PostgreSQL setup failed: {e}")
            self.pg_conn = None
    
    def load_students(self):
        """Load students and create sample data if empty"""
        cursor = self.sqlite_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM students")
        count = cursor.fetchone()[0]
        
        if count == 0:
            self.create_sample_data()
        
        # Load all students into memory for quick RFID lookups
        cursor.execute("SELECT * FROM students WHERE status = 'active'")
        students = cursor.fetchall()
        
        for student in students:
            self.students_db[student[4]] = {  # rfid_card is index 4
                'id': student[0],
                'student_id': student[1],
                'full_name': student[2],
                'email': student[3],
                'rfid_card': student[4],
                'department': student[5],
                'batch': student[6],
                'semester': student[7],
                'enrollment_year': student[8],
                'gpa': student[9],
                'mobile_number': student[10],
                'guardian_contact': student[11],
                'emergency_contact': student[12]
            }
        
        logger.info(f"✅ Loaded {len(self.students_db)} students into memory")
    
    def create_sample_data(self):
        """Create comprehensive sample data"""
        cursor = self.sqlite_conn.cursor()
        
        # Sample students with realistic data
        sample_students = [
            ("STU001", "2024CS001", "John Doe", "john.doe@university.edu", "1234567890", "Computer Science", "2024A", "S1", 2024, 3.75, "+94771234567", "+94701234567", "+94777654321"),
            ("STU002", "2024CS002", "Jane Smith", "jane.smith@university.edu", "0987654321", "Computer Science", "2024A", "S1", 2024, 3.82, "+94771234568", "+94701234568", "+94777654322"),
            ("STU003", "2024EN001", "Mike Johnson", "mike.johnson@university.edu", "1122334455", "Engineering", "2024B", "S1", 2024, 3.45, "+94771234569", "+94701234569", "+94777654323"),
            ("STU004", "2024SC001", "Sarah Wilson", "sarah.wilson@university.edu", "5544332211", "Science", "2024A", "S1", 2024, 3.91, "+94771234570", "+94701234570", "+94777654324"),
            ("STU005", "2023CS001", "David Brown", "david.brown@university.edu", "9988776655", "Computer Science", "2023A", "S3", 2023, 3.67, "+94771234571", "+94701234571", "+94777654325"),
            ("STU006", "2024CS003", "Emma Davis", "emma.davis@university.edu", "1357924680", "Computer Science", "2024B", "S1", 2024, 3.55, "+94771234572", "+94701234572", "+94777654326"),
            ("STU007", "2024EN002", "Alex Johnson", "alex.johnson@university.edu", "2468135790", "Engineering", "2024A", "S1", 2024, 3.72, "+94771234573", "+94701234573", "+94777654327"),
            ("STU008", "2023SC001", "Lisa Anderson", "lisa.anderson@university.edu", "9876543210", "Science", "2023B", "S3", 2023, 3.88, "+94771234574", "+94701234574", "+94777654328"),
        ]
        
        for student in sample_students:
            cursor.execute('''
                INSERT INTO students (id, student_id, full_name, email, rfid_card, department, batch, semester, enrollment_year, gpa, mobile_number, guardian_contact, emergency_contact)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', student)
        
        # Sample classes
        sample_classes = [
            ("CS101", "Programming Fundamentals", "CS101", "Computer Science", "LEC001", "Dr. Smith", "09:00", "11:00", "Monday,Wednesday,Friday", "Lab A", "S1", 3),
            ("CS102", "Data Structures", "CS102", "Computer Science", "LEC002", "Dr. Johnson", "13:00", "15:00", "Tuesday,Thursday", "Lab B", "S1", 4),
            ("EN101", "Engineering Mathematics", "EN101", "Engineering", "LEC003", "Dr. Wilson", "08:00", "10:00", "Monday,Wednesday", "Hall 1", "S1", 3),
            ("SC101", "General Physics", "SC101", "Science", "LEC004", "Dr. Davis", "10:00", "12:00", "Tuesday,Friday", "Lab C", "S1", 3),
        ]
        
        for class_data in sample_classes:
            cursor.execute('''
                INSERT INTO classes (id, name, code, department, lecturer_id, lecturer_name, start_time, end_time, days, location, semester, credits)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', class_data)
        
        # Sample enrollments
        enrollments = [
            ("2024CS001", "CS101"), ("2024CS001", "CS102"),
            ("2024CS002", "CS101"), ("2024CS002", "CS102"),
            ("2024EN001", "EN101"), ("2024SC001", "SC101"),
            ("2023CS001", "CS101"), ("2024CS003", "CS102"),
        ]
        
        for enrollment in enrollments:
            cursor.execute('''
                INSERT INTO enrollments (student_id, class_id)
                VALUES (?, ?)
            ''', enrollment)
        
        # Sample fee records
        fee_records = [
            ("2024CS001", "S1", 150000.00, 150000.00, "2024-02-28", "2024-01-15", "paid"),
            ("2024CS002", "S1", 150000.00, 100000.00, "2024-02-28", None, "partial"),
            ("2024EN001", "S1", 175000.00, 0.00, "2024-02-28", None, "pending"),
            ("2024SC001", "S1", 140000.00, 140000.00, "2024-02-28", "2024-01-20", "paid"),
        ]
        
        for fee in fee_records:
            cursor.execute('''
                INSERT INTO fee_records (student_id, semester, total_amount, paid_amount, due_date, payment_date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', fee)
        
        self.sqlite_conn.commit()
        logger.info("✅ Sample data created successfully")
    
    def get_student_profile(self, rfid_card: str) -> Optional[StudentProfile]:
        """Get complete student profile by RFID card"""
        try:
            if rfid_card not in self.students_db:
                return None
            
            student_data = self.students_db[rfid_card]
            
            # Get attendance statistics
            attendance_stats = self.get_attendance_stats(student_data['student_id'])
            
            # Get fee status
            fee_status = self.get_fee_status(student_data['student_id'])
            
            # Get academic results
            results = self.get_academic_results(student_data['student_id'])
            
            # Get current classes
            current_classes = self.get_current_classes(student_data['student_id'])
            
            profile = StudentProfile(
                id=student_data['id'],
                student_id=student_data['student_id'],
                full_name=student_data['full_name'],
                email=student_data['email'],
                rfid_card=student_data['rfid_card'],
                department=student_data['department'],
                batch=student_data['batch'],
                semester=student_data['semester'],
                enrollment_year=student_data['enrollment_year'],
                gpa=student_data['gpa'],
                mobile_number=student_data['mobile_number'],
                guardian_contact=student_data['guardian_contact'],
                emergency_contact=student_data['emergency_contact'],
                attendance_stats=attendance_stats,
                fee_status=fee_status,
                results=results,
                current_classes=current_classes
            )
            
            return profile
            
        except Exception as e:
            logger.error(f"Error getting student profile: {e}")
            return None
    
    def get_attendance_stats(self, student_id: str) -> Dict[str, Any]:
        """Get attendance statistics for student"""
        cursor = self.sqlite_conn.cursor()
        
        # Get total lectures for student's enrolled classes
        cursor.execute('''
            SELECT COUNT(*) FROM classes c
            JOIN enrollments e ON c.id = e.class_id
            WHERE e.student_id = ? AND c.status = 'active'
        ''', (student_id,))
        
        enrolled_classes = cursor.fetchone()[0] or 0
        
        # Estimate total lectures (assuming 3 lectures per week for 15 weeks)
        total_lectures = enrolled_classes * 45
        
        # Get attended lectures
        cursor.execute('''
            SELECT COUNT(*) FROM attendance_records
            WHERE student_id = ? AND status = 'present'
        ''', (student_id,))
        
        attended_lectures = cursor.fetchone()[0] or 0
        
        # Get last attendance
        cursor.execute('''
            SELECT MAX(timestamp) FROM attendance_records
            WHERE student_id = ?
        ''', (student_id,))
        
        last_attendance = cursor.fetchone()[0]
        
        attendance_percentage = (attended_lectures / max(total_lectures, 1)) * 100
        
        return {
            'totalLectures': total_lectures,
            'attendedLectures': attended_lectures,
            'attendancePercentage': round(attendance_percentage, 2),
            'lastAttendance': last_attendance
        }
    
    def get_fee_status(self, student_id: str) -> Dict[str, Any]:
        """Get fee status for student"""
        cursor = self.sqlite_conn.cursor()
        
        cursor.execute('''
            SELECT total_amount, paid_amount, due_date, payment_date, status
            FROM fee_records
            WHERE student_id = ?
            ORDER BY due_date DESC
            LIMIT 1
        ''', (student_id,))
        
        fee_record = cursor.fetchone()
        
        if fee_record:
            total_amount, paid_amount, due_date, payment_date, status = fee_record
            pending_amount = (total_amount or 0) - (paid_amount or 0)
            
            return {
                'totalFees': total_amount or 0,
                'paidAmount': paid_amount or 0,
                'pendingAmount': pending_amount,
                'lastPayment': payment_date,
                'status': status or 'pending'
            }
        else:
            return {
                'totalFees': 0,
                'paidAmount': 0,
                'pendingAmount': 0,
                'lastPayment': None,
                'status': 'unknown'
            }
    
    def get_academic_results(self, student_id: str) -> Dict[str, Any]:
        """Get academic results for student"""
        cursor = self.sqlite_conn.cursor()
        
        cursor.execute('''
            SELECT gpa FROM students WHERE student_id = ?
        ''', (student_id,))
        
        result = cursor.fetchone()
        gpa = result[0] if result else 0.0
        
        # Mock data for demonstration
        return {
            'currentSemesterGPA': gpa,
            'overallGPA': gpa,
            'completedCredits': 45,
            'totalCredits': 120,
            'academicStatus': 'good' if gpa >= 3.0 else 'warning' if gpa >= 2.0 else 'probation'
        }
    
    def get_current_classes(self, student_id: str) -> List[Dict[str, Any]]:
        """Get current enrolled classes for student"""
        cursor = self.sqlite_conn.cursor()
        
        cursor.execute('''
            SELECT c.id, c.name, c.lecturer_name, c.days, c.start_time, c.end_time
            FROM classes c
            JOIN enrollments e ON c.id = e.class_id
            WHERE e.student_id = ? AND c.status = 'active'
        ''', (student_id,))
        
        classes = cursor.fetchall()
        
        current_classes = []
        for class_data in classes:
            class_id, name, lecturer, days, start_time, end_time = class_data
            
            # Get attendance for this class
            cursor.execute('''
                SELECT COUNT(*) FROM attendance_records
                WHERE student_id = ? AND class_id = ? AND status = 'present'
            ''', (student_id, class_id))
            
            attendance_count = cursor.fetchone()[0] or 0
            
            current_classes.append({
                'classId': class_id,
                'subjectName': name,
                'lecturerName': lecturer,
                'schedule': f"{days} {start_time}-{end_time}",
                'attendance': attendance_count
            })
        
        return current_classes
    
    async def handle_rfid_scan(self, websocket, data):
        """Handle RFID scan from device"""
        try:
            device_id = data.get('deviceId')
            rfid_card = data.get('rfidCard')
            timestamp = data.get('timestamp')
            location = data.get('location')
            
            logger.info(f"📱 RFID scan from {device_id}: {rfid_card}")
            
            # Update device statistics
            if device_id in self.devices:
                self.devices[device_id]['totalScans'] += 1
                self.devices[device_id]['lastSeen'] = datetime.now()
            
            # Get student profile
            student_profile = self.get_student_profile(rfid_card)
            
            if student_profile:
                # Record attendance
                attendance_id = self.record_attendance(student_profile, device_id, location)
                
                # Send to Firebase for real-time updates
                if self.firestore_db:
                    self.sync_to_firebase(student_profile, device_id, attendance_id)
                
                # Send success response to device
                response = {
                    'type': 'attendance_response',
                    'success': True,
                    'rfidCard': rfid_card,
                    'attendanceId': attendance_id,
                    'student': {
                        'id': student_profile.id,
                        'studentId': student_profile.student_id,
                        'fullName': student_profile.full_name,
                        'department': student_profile.department,
                        'batch': student_profile.batch,
                        'attendanceStats': student_profile.attendance_stats,
                        'feeStatus': student_profile.fee_status,
                        'academicStatus': student_profile.results['academicStatus']
                    }
                }
                
                if device_id in self.devices:
                    self.devices[device_id]['successfulScans'] += 1
                
                logger.info(f"✅ Attendance recorded for {student_profile.full_name}")
                
            else:
                # Student not found
                response = {
                    'type': 'attendance_response',
                    'success': False,
                    'rfidCard': rfid_card,
                    'message': 'Student not found'
                }
                
                if device_id in self.devices:
                    self.devices[device_id]['failedScans'] += 1
                
                logger.warning(f"⚠️ Unknown RFID card: {rfid_card}")
            
            await websocket.send(json.dumps(response))
            
        except Exception as e:
            logger.error(f"Error handling RFID scan: {e}")
            error_response = {
                'type': 'attendance_response',
                'success': False,
                'rfidCard': rfid_card,
                'message': 'Server error'
            }
            await websocket.send(json.dumps(error_response))
    
    def record_attendance(self, student_profile: StudentProfile, device_id: str, location: str) -> str:
        """Record attendance in both SQLite and PostgreSQL"""
        try:
            timestamp = datetime.now()
            
            # Insert into SQLite
            cursor = self.sqlite_conn.cursor()
            cursor.execute('''
                INSERT INTO attendance_records (student_id, rfid_card, device_id, method, timestamp, location)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (student_profile.student_id, student_profile.rfid_card, device_id, 'rfid', timestamp, location))
            
            attendance_id = str(cursor.lastrowid)
            self.sqlite_conn.commit()
            
            # Insert into PostgreSQL if available
            if self.pg_conn:
                pg_cursor = self.pg_conn.cursor()
                pg_cursor.execute('''
                    INSERT INTO attendance_records (student_id, rfid_card, device_id, method, timestamp, location)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                ''', (student_profile.student_id, student_profile.rfid_card, device_id, 'rfid', timestamp, location))
                
                pg_result = pg_cursor.fetchone()
                if pg_result:
                    attendance_id = str(pg_result[0])
            
            return attendance_id
            
        except Exception as e:
            logger.error(f"Error recording attendance: {e}")
            return "error"
    
    def sync_to_firebase(self, student_profile: StudentProfile, device_id: str, attendance_id: str):
        """Sync attendance record to Firebase Firestore"""
        try:
            if not self.firestore_db:
                return
                
            # Add to attendance_records collection
            doc_ref = self.firestore_db.collection('attendance_records').document(attendance_id)
            doc_ref.set({
                'studentId': student_profile.student_id,
                'fullName': student_profile.full_name,
                'department': student_profile.department,
                'rfidCard': student_profile.rfid_card,
                'deviceId': device_id,
                'method': 'rfid',
                'timestamp': firestore.SERVER_TIMESTAMP,
                'status': 'present',
                'attendanceStats': student_profile.attendance_stats,
                'feeStatus': student_profile.fee_status
            })
            
            # Update real-time attendance feed
            feed_ref = self.firestore_db.collection('live_attendance').document()
            feed_ref.set({
                'studentId': student_profile.student_id,
                'fullName': student_profile.full_name,
                'department': student_profile.department,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'method': 'rfid',
                'deviceId': device_id
            })
            
            logger.info(f"📡 Synced to Firebase: {student_profile.student_id}")
            
        except Exception as e:
            logger.error(f"Error syncing to Firebase: {e}")
    
    async def handle_device_register(self, websocket, data):
        """Handle device registration"""
        device_id = data.get('deviceId')
        device_type = data.get('deviceType')
        location = data.get('location')
        version = data.get('version')
        
        # Register device
        self.devices[device_id] = {
            'socket': websocket,
            'type': device_type,
            'location': location,
            'version': version,
            'status': 'online',
            'lastSeen': datetime.now(),
            'totalScans': 0,
            'successfulScans': 0,
            'failedScans': 0
        }
        
        # Update database
        cursor = self.sqlite_conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO devices (id, name, type, location, status, last_heartbeat)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (device_id, device_id, device_type, location, 'online', datetime.now()))
        self.sqlite_conn.commit()
        
        logger.info(f"🔗 Device registered: {device_id} ({device_type}) at {location}")
        
        # Send acknowledgment
        response = {
            'type': 'registration_ack',
            'deviceId': device_id,
            'status': 'registered'
        }
        await websocket.send(json.dumps(response))
    
    async def handle_heartbeat(self, websocket, data):
        """Handle device heartbeat"""
        device_id = data.get('deviceId')
        
        if device_id in self.devices:
            self.devices[device_id]['lastSeen'] = datetime.now()
            
            # Update statistics
            if 'totalScans' in data:
                self.devices[device_id]['totalScans'] = data['totalScans']
            if 'successfulScans' in data:
                self.devices[device_id]['successfulScans'] = data['successfulScans']
            if 'failedScans' in data:
                self.devices[device_id]['failedScans'] = data['failedScans']
        
        # Send heartbeat response
        response = {
            'type': 'heartbeat_response',
            'deviceId': device_id,
            'timestamp': int(time.time() * 1000)
        }
        await websocket.send(json.dumps(response))
    
    async def handle_websocket_message(self, websocket, path):
        """Handle WebSocket connections from devices"""
        try:
            self.clients.add(websocket)
            logger.info(f"🔗 New WebSocket connection from {websocket.remote_address}")
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type')
                    
                    if msg_type == 'device_register':
                        await self.handle_device_register(websocket, data)
                    elif msg_type == 'rfid_scan':
                        await self.handle_rfid_scan(websocket, data)
                    elif msg_type == 'heartbeat':
                        await self.handle_heartbeat(websocket, data)
                    else:
                        logger.warning(f"Unknown message type: {msg_type}")
                        
                except json.JSONDecodeError:
                    logger.error("Invalid JSON received")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            self.clients.discard(websocket)
            
            # Update device status to offline
            for device_id, device in self.devices.items():
                if device['socket'] == websocket:
                    device['status'] = 'offline'
                    logger.info(f"📴 Device offline: {device_id}")
                    break
    
    def create_flask_app(self):
        """Create Flask web interface for monitoring"""
        app = Flask(__name__)
        CORS(app)
        
        @app.route('/')
        def dashboard():
            return render_template_string(DASHBOARD_HTML)
        
        @app.route('/api/devices')
        def get_devices():
            devices_list = []
            for device_id, device in self.devices.items():
                devices_list.append({
                    'id': device_id,
                    'type': device['type'],
                    'location': device['location'],
                    'status': device['status'],
                    'lastSeen': device['lastSeen'].isoformat() if device['lastSeen'] else None,
                    'totalScans': device['totalScans'],
                    'successfulScans': device['successfulScans'],
                    'failedScans': device['failedScans']
                })
            return jsonify(devices_list)
        
        @app.route('/api/students')
        def get_students():
            return jsonify(list(self.students_db.values()))
        
        @app.route('/api/attendance/recent')
        def get_recent_attendance():
            cursor = self.sqlite_conn.cursor()
            cursor.execute('''
                SELECT ar.*, s.full_name, s.department
                FROM attendance_records ar
                JOIN students s ON ar.student_id = s.student_id
                ORDER BY ar.timestamp DESC
                LIMIT 50
            ''')
            
            records = cursor.fetchall()
            attendance_list = []
            
            for record in records:
                attendance_list.append({
                    'id': record[0],
                    'studentId': record[1],
                    'fullName': record[-2],
                    'department': record[-1],
                    'deviceId': record[3],
                    'timestamp': record[6],
                    'status': record[7],
                    'location': record[8]
                })
            
            return jsonify(attendance_list)
        
        return app
    
    def start_services(self):
        """Start all services"""
        logger.info("🚀 Starting SmartTrack RFID Service...")
        
        # Start WebSocket server
        websocket_thread = threading.Thread(
            target=self.start_websocket_server,
            daemon=True
        )
        websocket_thread.start()
        
        # Start Flask web interface
        flask_thread = threading.Thread(
            target=lambda: self.flask_app.run(host='0.0.0.0', port=5001, debug=False),
            daemon=True
        )
        flask_thread.start()
        
        logger.info("✅ All services started successfully!")
        logger.info("📡 WebSocket Server: ws://localhost:3001/rfid-ws")
        logger.info("🌐 Web Dashboard: http://localhost:5001")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down SmartTrack RFID Service...")
    
    def start_websocket_server(self):
        """Start WebSocket server"""
        async def run_server():
            async with websockets.serve(
                self.handle_websocket_message,
                "0.0.0.0",
                3001,
                subprotocols=["rfid-protocol"]
            ):
                logger.info("📡 WebSocket server started on ws://0.0.0.0:3001")
                await asyncio.Future()  # Run forever
        
        asyncio.run(run_server())

# HTML Dashboard Template
DASHBOARD_HTML = '''
<!DOCTYPE html>
<html>
<head>
    <title>SmartTrack RFID Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .device-online { color: #4CAF50; }
        .device-offline { color: #f44336; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .refresh-btn { background: #2196F3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1 class="header">🎯 SmartTrack RFID Dashboard</h1>
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
        </div>

        <div class="status-grid">
            <div class="card">
                <h3>📱 Connected Devices</h3>
                <div id="devices"></div>
            </div>
            
            <div class="card">
                <h3>📊 System Statistics</h3>
                <div id="stats"></div>
            </div>
        </div>

        <div class="card">
            <h3>📋 Recent Attendance</h3>
            <div id="attendance"></div>
        </div>
    </div>

    <script>
        async function loadData() {
            try {
                // Load devices
                const devicesResponse = await fetch('/api/devices');
                const devices = await devicesResponse.json();
                
                let devicesHtml = '';
                let totalScans = 0;
                let onlineCount = 0;
                
                devices.forEach(device => {
                    const statusClass = device.status === 'online' ? 'device-online' : 'device-offline';
                    devicesHtml += `
                        <div style="margin: 10px 0; padding: 10px; border-left: 4px solid ${device.status === 'online' ? '#4CAF50' : '#f44336'};">
                            <strong>${device.id}</strong> <span class="${statusClass}">[${device.status.toUpperCase()}]</span><br>
                            📍 ${device.location} | 🔢 ${device.totalScans} scans | ✅ ${device.successfulScans} success
                        </div>
                    `;
                    totalScans += device.totalScans;
                    if (device.status === 'online') onlineCount++;
                });
                
                document.getElementById('devices').innerHTML = devicesHtml || 'No devices connected';
                
                // Load stats
                const statsHtml = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>📱 Online Devices: <strong>${onlineCount}</strong></div>
                        <div>📊 Total Scans: <strong>${totalScans}</strong></div>
                        <div>👥 Registered Students: <strong id="studentCount">Loading...</strong></div>
                        <div>🕒 Last Update: <strong>${new Date().toLocaleTimeString()}</strong></div>
                    </div>
                `;
                document.getElementById('stats').innerHTML = statsHtml;
                
                // Load students count
                const studentsResponse = await fetch('/api/students');
                const students = await studentsResponse.json();
                document.getElementById('studentCount').textContent = students.length;
                
                // Load recent attendance
                const attendanceResponse = await fetch('/api/attendance/recent');
                const attendance = await attendanceResponse.json();
                
                let attendanceHtml = '<table><tr><th>Time</th><th>Student</th><th>Department</th><th>Device</th><th>Location</th></tr>';
                attendance.slice(0, 10).forEach(record => {
                    const time = new Date(record.timestamp).toLocaleString();
                    attendanceHtml += `
                        <tr>
                            <td>${time}</td>
                            <td><strong>${record.fullName}</strong><br><small>${record.studentId}</small></td>
                            <td>${record.department}</td>
                            <td>${record.deviceId}</td>
                            <td>${record.location || 'N/A'}</td>
                        </tr>
                    `;
                });
                attendanceHtml += '</table>';
                
                document.getElementById('attendance').innerHTML = attendanceHtml;
                
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }
        
        // Load data on page load
        loadData();
        
        // Auto-refresh every 30 seconds
        setInterval(loadData, 30000);
    </script>
</body>
</html>
'''

if __name__ == "__main__":
    service = SmartTrackRFIDService()
    service.start_services()
