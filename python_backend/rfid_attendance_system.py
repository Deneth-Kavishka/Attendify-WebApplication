#!/usr/bin/env python3
"""
SmartTrack RFID Attendance System
Comprehensive Python backend for RFID-based student attendance
"""

import asyncio
import websockets
import json
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import socket
from flask import Flask, render_template_string, jsonify, request
from flask_cors import CORS
import threading
import time
import os

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rfid_attendance.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SmartTrackRFIDSystem:
    def __init__(self):
        self.clients = set()
        self.devices = {}
        self.students_db = {}
        self.setup_database()
        self.load_students()
        
    def setup_database(self):
        """Setup SQLite database for attendance records"""
        db_path = os.path.join(os.path.dirname(__file__), 'rfid_attendance.db')
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = self.conn.cursor()
        
        # Create students table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                student_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                rfid_card TEXT UNIQUE NOT NULL,
                department TEXT,
                batch TEXT,
                year INTEGER,
                email TEXT,
                phone TEXT,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create attendance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                rfid_card TEXT,
                device_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'present',
                class_id TEXT,
                location TEXT,
                FOREIGN KEY (student_id) REFERENCES students(student_id)
            )
        ''')
        
        # Create classes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                lecturer TEXT,
                start_time TIME,
                end_time TIME,
                days TEXT,
                location TEXT,
                status TEXT DEFAULT 'active'
            )
        ''')
        
        # Create devices table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT,
                type TEXT,
                location TEXT,
                ip_address TEXT,
                status TEXT DEFAULT 'offline',
                last_seen DATETIME,
                total_scans INTEGER DEFAULT 0
            )
        ''')
        
        self.conn.commit()
        logger.info("✅ Database setup completed")
    
    def load_students(self):
        """Load students from database and create sample data if empty"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM students")
        count = cursor.fetchone()[0]
        
        if count == 0:
            # Add sample students
            sample_students = [
                ("STU001", "2024CS001", "John Doe", "1234567890", "Computer Science", "2024", 2024, "john@university.edu", "+94771234567"),
                ("STU002", "2024CS002", "Jane Smith", "0987654321", "Computer Science", "2024", 2024, "jane@university.edu", "+94771234568"),
                ("STU003", "2024EN001", "Mike Johnson", "1122334455", "Engineering", "2024", 2024, "mike@university.edu", "+94771234569"),
                ("STU004", "2024SC001", "Sarah Wilson", "5544332211", "Science", "2024", 2024, "sarah@university.edu", "+94771234570"),
                ("STU005", "2023CS001", "David Brown", "9988776655", "Computer Science", "2023", 2023, "david@university.edu", "+94771234571"),
                ("STU006", "2024CS003", "Emma Davis", "1357924680", "Computer Science", "2024", 2024, "emma@university.edu", "+94771234572"),
                ("STU007", "2024EN002", "Alex Johnson", "2468135790", "Engineering", "2024", 2024, "alex@university.edu", "+94771234573"),
                ("STU008", "2023SC001", "Lisa Anderson", "9876543210", "Science", "2023", 2023, "lisa@university.edu", "+94771234574"),
            ]
            
            for student in sample_students:
                cursor.execute('''
                    INSERT INTO students (id, student_id, name, rfid_card, department, batch, year, email, phone)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', student)
                
                # Store in memory for quick access
                self.students_db[student[3]] = {
                    'id': student[0],
                    'student_id': student[1],
                    'name': student[2],
                    'rfid_card': student[3],
                    'department': student[4],
                    'batch': student[5],
                    'year': student[6],
                    'email': student[7],
                    'phone': student[8]
                }
            
            # Add sample classes
            sample_classes = [
                ("CS101", "Programming Fundamentals", "Computer Science", "Dr. Smith", "09:00", "11:00", "Monday,Wednesday,Friday", "Lab A"),
                ("CS201", "Data Structures", "Computer Science", "Dr. Johnson", "14:00", "16:00", "Tuesday,Thursday", "Lab B"),
                ("EN101", "Engineering Mathematics", "Engineering", "Dr. Wilson", "10:00", "12:00", "Monday,Wednesday", "Room 101"),
                ("SC101", "Physics", "Science", "Dr. Brown", "08:00", "10:00", "Tuesday,Thursday,Friday", "Lab C"),
            ]
            
            for class_info in sample_classes:
                cursor.execute('''
                    INSERT INTO classes (id, name, department, lecturer, start_time, end_time, days, location)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', class_info)
            
            self.conn.commit()
            logger.info(f"✅ Loaded {len(sample_students)} sample students and {len(sample_classes)} classes")
        else:
            # Load existing students into memory
            cursor.execute("SELECT * FROM students WHERE status = 'active'")
            for row in cursor.fetchall():
                self.students_db[row[3]] = {  # rfid_card is index 3
                    'id': row[0],
                    'student_id': row[1],
                    'name': row[2],
                    'rfid_card': row[3],
                    'department': row[4],
                    'batch': row[5],
                    'year': row[6],
                    'email': row[7],
                    'phone': row[8]
                }
            logger.info(f"✅ Loaded {len(self.students_db)} students from database")
    
    def get_student_by_rfid(self, rfid_card: str) -> Optional[Dict[str, Any]]:
        """Get student details by RFID card"""
        return self.students_db.get(rfid_card.strip())
    
    def get_student_attendance_stats(self, student_id: str) -> Dict[str, Any]:
        """Get comprehensive attendance statistics for a student"""
        cursor = self.conn.cursor()
        
        # Today's attendance
        today = datetime.now().strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*) FROM attendance 
            WHERE student_id = ? AND DATE(timestamp) = ?
        ''', (student_id, today))
        today_count = cursor.fetchone()[0]
        
        # This week's attendance
        week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*) FROM attendance 
            WHERE student_id = ? AND DATE(timestamp) >= ?
        ''', (student_id, week_start))
        week_count = cursor.fetchone()[0]
        
        # This month's attendance
        month_start = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*) FROM attendance 
            WHERE student_id = ? AND DATE(timestamp) >= ?
        ''', (student_id, month_start))
        month_count = cursor.fetchone()[0]
        
        # Total attendance
        cursor.execute('''
            SELECT COUNT(*) FROM attendance WHERE student_id = ?
        ''', (student_id,))
        total_count = cursor.fetchone()[0]
        
        # Last attendance
        cursor.execute('''
            SELECT timestamp, location FROM attendance 
            WHERE student_id = ? ORDER BY timestamp DESC LIMIT 1
        ''', (student_id,))
        last_attendance = cursor.fetchone()
        
        return {
            'today': today_count,
            'this_week': week_count,
            'this_month': month_count,
            'total': total_count,
            'last_attendance': {
                'timestamp': last_attendance[0] if last_attendance else None,
                'location': last_attendance[1] if last_attendance else None
            }
        }
    
    def mark_attendance(self, rfid_card: str, device_id: str = "UNKNOWN", location: str = "Main Entrance") -> Dict[str, Any]:
        """Mark attendance for a student"""
        student = self.get_student_by_rfid(rfid_card)
        
        if not student:
            return {
                'success': False,
                'message': 'Student not found - Please register this RFID card',
                'rfid_card': rfid_card,
                'timestamp': datetime.now().isoformat()
            }
        
        # Check for duplicate attendance (within 5 minutes)
        cursor = self.conn.cursor()
        five_minutes_ago = (datetime.now() - timedelta(minutes=5)).isoformat()
        cursor.execute('''
            SELECT COUNT(*) FROM attendance 
            WHERE student_id = ? AND timestamp > ?
        ''', (student['student_id'], five_minutes_ago))
        
        recent_count = cursor.fetchone()[0]
        if recent_count > 0:
            return {
                'success': False,
                'message': f'Duplicate scan - {student["name"]} already marked within 5 minutes',
                'student': student,
                'rfid_card': rfid_card,
                'timestamp': datetime.now().isoformat()
            }
        
        # Record attendance
        cursor.execute('''
            INSERT INTO attendance (student_id, rfid_card, device_id, timestamp, location)
            VALUES (?, ?, ?, ?, ?)
        ''', (student['student_id'], rfid_card, device_id, datetime.now().isoformat(), location))
        self.conn.commit()
        
        # Get attendance statistics
        stats = self.get_student_attendance_stats(student['student_id'])
        
        response = {
            'success': True,
            'message': f'Welcome {student["name"]}! Attendance marked successfully',
            'student': student,
            'attendance_stats': stats,
            'scan_info': {
                'device_id': device_id,
                'location': location,
                'timestamp': datetime.now().isoformat()
            }
        }
        
        logger.info(f"✅ Attendance marked: {student['name']} ({student['student_id']}) - {rfid_card}")
        return response
    
    async def handle_websocket_connection(self, websocket, path):
        """Handle WebSocket connections from RFID devices and web clients"""
        client_ip = websocket.remote_address[0]
        logger.info(f"🔌 New connection from {client_ip}")
        
        self.clients.add(websocket)
        
        try:
            # Send welcome message
            welcome_msg = {
                'type': 'welcome',
                'message': 'Connected to SmartTrack RFID Attendance System',
                'server_time': datetime.now().isoformat(),
                'students_count': len(self.students_db)
            }
            await websocket.send(json.dumps(welcome_msg))
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.info(f"📨 Received from {client_ip}: {data}")
                    
                    message_type = data.get('type', '')
                    
                    if message_type == 'rfid_scan':
                        await self.handle_rfid_scan(websocket, data)
                    elif message_type == 'device_info':
                        await self.handle_device_info(websocket, data)
                    elif message_type == 'heartbeat':
                        await self.handle_heartbeat(websocket, data)
                    elif message_type == 'get_students':
                        await self.handle_get_students(websocket, data)
                    elif message_type == 'get_attendance':
                        await self.handle_get_attendance(websocket, data)
                    else:
                        logger.warning(f"Unknown message type: {message_type}")
                        
                except json.JSONDecodeError:
                    logger.error(f"❌ Invalid JSON from {client_ip}: {message}")
                except Exception as e:
                    logger.error(f"❌ Error processing message from {client_ip}: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Connection closed: {client_ip}")
        finally:
            self.clients.remove(websocket)
    
    async def handle_rfid_scan(self, websocket, data):
        """Handle RFID scan from device"""
        rfid_card = data.get('rfid_card', '').strip()
        device_id = data.get('device_id', 'UNKNOWN')
        
        if not rfid_card:
            error_msg = {
                'type': 'error',
                'message': 'Invalid RFID card data'
            }
            await websocket.send(json.dumps(error_msg))
            return
        
        # Process attendance
        result = self.mark_attendance(rfid_card, device_id)
        
        # Send response back to device
        response = {
            'type': 'attendance_result',
            **result
        }
        
        await websocket.send(json.dumps(response))
        
        # Broadcast to all connected clients
        await self.broadcast_to_clients(response)
    
    async def handle_device_info(self, websocket, data):
        """Handle device information registration"""
        device_id = data.get('device_id', 'UNKNOWN')
        device_type = data.get('device_type', 'RFID_SCANNER')
        ip_address = data.get('ip_address', websocket.remote_address[0])
        
        # Update device info in database
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO devices (id, type, ip_address, status, last_seen)
            VALUES (?, ?, ?, 'online', ?)
        ''', (device_id, device_type, ip_address, datetime.now().isoformat()))
        self.conn.commit()
        
        self.devices[device_id] = {
            'websocket': websocket,
            'type': device_type,
            'ip_address': ip_address,
            'last_seen': datetime.now()
        }
        
        logger.info(f"📱 Device registered: {device_id} ({device_type}) - {ip_address}")
    
    async def handle_heartbeat(self, websocket, data):
        """Handle heartbeat from device"""
        device_id = data.get('device_id', 'UNKNOWN')
        
        # Update last seen
        if device_id in self.devices:
            self.devices[device_id]['last_seen'] = datetime.now()
        
        # Send heartbeat acknowledgment
        response = {
            'type': 'heartbeat_ack',
            'timestamp': datetime.now().isoformat()
        }
        await websocket.send(json.dumps(response))
    
    async def handle_get_students(self, websocket, data):
        """Send list of all students"""
        students_list = list(self.students_db.values())
        response = {
            'type': 'students_list',
            'students': students_list,
            'count': len(students_list)
        }
        await websocket.send(json.dumps(response))
    
    async def handle_get_attendance(self, websocket, data):
        """Send attendance records"""
        cursor = self.conn.cursor()
        
        # Get recent attendance (last 50 records)
        cursor.execute('''
            SELECT a.*, s.name, s.department, s.batch 
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            ORDER BY a.timestamp DESC
            LIMIT 50
        ''')
        
        records = []
        for row in cursor.fetchall():
            records.append({
                'id': row[0],
                'student_id': row[1],
                'rfid_card': row[2],
                'device_id': row[3],
                'timestamp': row[4],
                'status': row[5],
                'location': row[7],
                'student_name': row[8],
                'department': row[9],
                'batch': row[10]
            })
        
        response = {
            'type': 'attendance_records',
            'records': records,
            'count': len(records)
        }
        await websocket.send(json.dumps(response))
    
    async def broadcast_to_clients(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if self.clients:
            disconnected = set()
            for client in self.clients:
                try:
                    await client.send(json.dumps(message))
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)
            
            # Remove disconnected clients
            self.clients -= disconnected
    
    def get_local_ip(self):
        """Get local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except:
            return "localhost"

# Flask web interface
app = Flask(__name__)
CORS(app)

# Global system instance
rfid_system = None

@app.route('/')
def dashboard():
    """Main dashboard"""
    html_template = '''
<!DOCTYPE html>
<html>
<head>
    <title>SmartTrack RFID Attendance</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 15px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white; 
            padding: 30px; 
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.2em; opacity: 0.9; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            text-align: center;
            border-left: 5px solid #4CAF50;
        }
        .stat-number { font-size: 2.5em; font-weight: bold; color: #333; }
        .stat-label { color: #666; margin-top: 10px; }
        
        .controls {
            padding: 20px 30px;
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
        }
        .control-group {
            display: flex;
            gap: 15px;
            align-items: center;
            margin-bottom: 15px;
        }
        .control-group label { min-width: 120px; font-weight: 600; }
        .control-group input, .control-group button {
            padding: 12px 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
        }
        .control-group button {
            background: #007bff;
            color: white;
            border: none;
            cursor: pointer;
            transition: background 0.3s;
        }
        .control-group button:hover { background: #0056b3; }
        
        .status {
            padding: 15px 30px;
            margin: 20px 30px;
            border-radius: 8px;
            border-left: 5px solid #28a745;
            background: #d4edda;
            color: #155724;
        }
        
        .attendance-log {
            padding: 30px;
            max-height: 400px;
            overflow-y: auto;
        }
        .attendance-item {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .student-info h4 { color: #333; margin-bottom: 5px; }
        .student-info p { color: #666; margin: 3px 0; }
        .scan-time { float: right; color: #888; font-size: 0.9em; }
        
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 25px;
            color: white;
            font-weight: bold;
            z-index: 1000;
        }
        .connected { background: #28a745; }
        .disconnected { background: #dc3545; }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">Connecting...</div>
    
    <div class="container">
        <div class="header">
            <h1>🎓 SmartTrack RFID Attendance</h1>
            <p>Real-time Student Attendance Management System</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalStudents">{{ total_students }}</div>
                <div class="stat-label">Total Students</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="todayAttendance">0</div>
                <div class="stat-label">Today's Attendance</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="onlineDevices">0</div>
                <div class="stat-label">Online Devices</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="activeConnections">0</div>
                <div class="stat-label">Active Connections</div>
            </div>
        </div>
        
        <div class="status">
            <strong>🌐 WebSocket Server:</strong> <span id="wsUrl">ws://{{ local_ip }}:9000</span><br>
            <strong>📊 Status:</strong> <span id="systemStatus">Active</span><br>
            <strong>🕒 Server Time:</strong> <span id="serverTime">{{ current_time }}</span>
        </div>
        
        <div class="controls">
            <div class="control-group">
                <label>Test RFID Scan:</label>
                <input type="text" id="testRfid" placeholder="Enter RFID card number (e.g., 1234567890)">
                <button onclick="testScan()">Test Scan</button>
            </div>
            <div class="control-group">
                <label>Quick Actions:</label>
                <button onclick="loadStudents()">Refresh Students</button>
                <button onclick="loadAttendance()">Refresh Attendance</button>
                <button onclick="clearLog()">Clear Log</button>
            </div>
        </div>
        
        <div class="attendance-log">
            <h3>📋 Recent Attendance</h3>
            <div id="attendanceLog"></div>
        </div>
    </div>
    
    <script>
        const wsUrl = 'ws://{{ local_ip }}:9000';
        let ws = null;
        let reconnectInterval = null;
        
        function connectWebSocket() {
            ws = new WebSocket(wsUrl);
            
            ws.onopen = function() {
                console.log('✅ WebSocket connected');
                document.getElementById('connectionStatus').textContent = 'Connected';
                document.getElementById('connectionStatus').className = 'connection-status connected';
                
                if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                }
                
                // Request initial data
                loadStudents();
                loadAttendance();
            };
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                console.log('📨 Received:', data);
                
                if (data.type === 'attendance_result' && data.success) {
                    addAttendanceToLog(data);
                    updateStats();
                } else if (data.type === 'students_list') {
                    document.getElementById('totalStudents').textContent = data.count;
                } else if (data.type === 'attendance_records') {
                    displayAttendanceRecords(data.records);
                }
            };
            
            ws.onerror = function(error) {
                console.error('❌ WebSocket error:', error);
            };
            
            ws.onclose = function() {
                console.log('🔌 WebSocket disconnected');
                document.getElementById('connectionStatus').textContent = 'Disconnected';
                document.getElementById('connectionStatus').className = 'connection-status disconnected';
                
                // Auto-reconnect
                if (!reconnectInterval) {
                    reconnectInterval = setInterval(connectWebSocket, 5000);
                }
            };
        }
        
        function testScan() {
            const rfid = document.getElementById('testRfid').value.trim();
            if (rfid && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'rfid_scan',
                    rfid_card: rfid,
                    device_id: 'WEB_DASHBOARD'
                }));
                document.getElementById('testRfid').value = '';
            } else {
                alert('Please enter RFID card number and ensure WebSocket is connected');
            }
        }
        
        function loadStudents() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'get_students' }));
            }
        }
        
        function loadAttendance() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'get_attendance' }));
            }
        }
        
        function clearLog() {
            document.getElementById('attendanceLog').innerHTML = '';
        }
        
        function addAttendanceToLog(data) {
            const log = document.getElementById('attendanceLog');
            const item = document.createElement('div');
            item.className = 'attendance-item';
            
            const student = data.student;
            const stats = data.attendance_stats;
            const time = new Date(data.scan_info.timestamp).toLocaleString();
            
            item.innerHTML = `
                <div class="scan-time">${time}</div>
                <div class="student-info">
                    <h4>${student.name} (${student.student_id})</h4>
                    <p><strong>Department:</strong> ${student.department} | <strong>Batch:</strong> ${student.batch}</p>
                    <p><strong>RFID:</strong> ${student.rfid_card} | <strong>Location:</strong> ${data.scan_info.location}</p>
                    <p><strong>Today:</strong> ${stats.today} scans | <strong>Total:</strong> ${stats.total} scans</p>
                </div>
            `;
            
            log.insertBefore(item, log.firstChild);
            
            // Keep only last 20 items
            while (log.children.length > 20) {
                log.removeChild(log.lastChild);
            }
        }
        
        function displayAttendanceRecords(records) {
            const log = document.getElementById('attendanceLog');
            log.innerHTML = '';
            
            records.forEach(record => {
                const item = document.createElement('div');
                item.className = 'attendance-item';
                
                const time = new Date(record.timestamp).toLocaleString();
                
                item.innerHTML = `
                    <div class="scan-time">${time}</div>
                    <div class="student-info">
                        <h4>${record.student_name} (${record.student_id})</h4>
                        <p><strong>Department:</strong> ${record.department} | <strong>Batch:</strong> ${record.batch}</p>
                        <p><strong>RFID:</strong> ${record.rfid_card} | <strong>Device:</strong> ${record.device_id}</p>
                        <p><strong>Location:</strong> ${record.location || 'Main Entrance'}</p>
                    </div>
                `;
                
                log.appendChild(item);
            });
        }
        
        function updateStats() {
            // Update today's attendance count
            const today = new Date().toDateString();
            const attendanceItems = document.querySelectorAll('.attendance-item');
            let todayCount = 0;
            
            attendanceItems.forEach(item => {
                const timeText = item.querySelector('.scan-time').textContent;
                const itemDate = new Date(timeText).toDateString();
                if (itemDate === today) {
                    todayCount++;
                }
            });
            
            document.getElementById('todayAttendance').textContent = todayCount;
        }
        
        // Update server time every second
        setInterval(() => {
            document.getElementById('serverTime').textContent = new Date().toLocaleString();
        }, 1000);
        
        // Enter key support for test input
        document.getElementById('testRfid').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                testScan();
            }
        });
        
        // Initialize connection
        connectWebSocket();
    </script>
</body>
</html>
    '''
    
    return render_template_string(html_template, 
                                total_students=len(rfid_system.students_db) if rfid_system else 0,
                                local_ip=rfid_system.get_local_ip() if rfid_system else 'localhost',
                                current_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

@app.route('/api/students')
def get_students():
    """API endpoint to get all students"""
    if rfid_system:
        return jsonify({
            'success': True,
            'students': list(rfid_system.students_db.values()),
            'count': len(rfid_system.students_db)
        })
    return jsonify({'success': False, 'message': 'System not initialized'})

@app.route('/api/attendance')
def get_attendance():
    """API endpoint to get attendance records"""
    if rfid_system:
        cursor = rfid_system.conn.cursor()
        cursor.execute('''
            SELECT a.*, s.name, s.department, s.batch 
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            ORDER BY a.timestamp DESC
            LIMIT 100
        ''')
        
        records = []
        for row in cursor.fetchall():
            records.append({
                'id': row[0],
                'student_id': row[1],
                'rfid_card': row[2],
                'device_id': row[3],
                'timestamp': row[4],
                'status': row[5],
                'location': row[7],
                'student_name': row[8],
                'department': row[9],
                'batch': row[10]
            })
        
        return jsonify({
            'success': True,
            'records': records,
            'count': len(records)
        })
    return jsonify({'success': False, 'message': 'System not initialized'})

async def main():
    global rfid_system
    rfid_system = SmartTrackRFIDSystem()
    
    local_ip = rfid_system.get_local_ip()
    
    print(f"""
╔══════════════════════════════════════════════════════════════════════════════════╗
║                          SmartTrack RFID Attendance System                      ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ 🌐 WebSocket Server:     ws://{local_ip}:9000                               ║
║ 🌍 Web Dashboard:        http://{local_ip}:5000                             ║
║ 📊 Database:             rfid_attendance.db                                     ║
║ 📝 Students Loaded:      {len(rfid_system.students_db)} students                                         ║
║ 📋 Log File:             rfid_attendance.log                                    ║
╚══════════════════════════════════════════════════════════════════════════════════╝

📋 Sample RFID Cards for Testing:
   • 1234567890 - John Doe (Computer Science, 2024)
   • 0987654321 - Jane Smith (Computer Science, 2024) 
   • 1122334455 - Mike Johnson (Engineering, 2024)
   • 5544332211 - Sarah Wilson (Science, 2024)
   • 9988776655 - David Brown (Computer Science, 2023)
   • 1357924680 - Emma Davis (Computer Science, 2024)
   • 2468135790 - Alex Johnson (Engineering, 2024)
   • 9876543210 - Lisa Anderson (Science, 2023)

🔧 Arduino Configuration:
   Update your NodeMCU code with:
   const char* SERVER_HOST = "{local_ip}";
   const int SERVER_PORT = 9000;

🚀 System Starting...
    """)
    
    # Start Flask web server in a separate thread
    def start_flask():
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
    
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()
    
    # Start WebSocket server
    logger.info("Starting WebSocket server...")
    await websockets.serve(rfid_system.handle_websocket_connection, "0.0.0.0", 9000)
    logger.info(f"WebSocket server running on ws://0.0.0.0:9000")
    logger.info(f"Web dashboard available at http://{local_ip}:5000")
    
    # Keep running
    await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Shutting down SmartTrack RFID System...")
        logger.info("System shutdown by user")
