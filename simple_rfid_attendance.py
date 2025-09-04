#!/usr/bin/env python3
"""
Simple RFID Attendance System
Direct Python implementation for reliable RFID-based student attendance marking
"""

import asyncio
import websockets
import json
import sqlite3
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import socket

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SimpleRFIDAttendanceSystem:
    def __init__(self):
        self.clients = set()
        self.students_db = {}
        self.setup_database()
        self.load_sample_students()
        
    def setup_database(self):
        """Setup SQLite database for attendance records"""
        self.conn = sqlite3.connect('attendance.db', check_same_thread=False)
        cursor = self.conn.cursor()
        
        # Create tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                rfid_card TEXT UNIQUE NOT NULL,
                department TEXT,
                batch TEXT,
                email TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                rfid_card TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'present',
                FOREIGN KEY (student_id) REFERENCES students(id)
            )
        ''')
        
        self.conn.commit()
        logger.info("✅ Database setup completed")
    
    def load_sample_students(self):
        """Load sample student data"""
        sample_students = [
            ("STU001", "John Doe", "1234567890", "Computer Science", "2024", "john@university.edu"),
            ("STU002", "Jane Smith", "0987654321", "Engineering", "2024", "jane@university.edu"),
            ("STU003", "Mike Johnson", "1122334455", "Mathematics", "2023", "mike@university.edu"),
            ("STU004", "Sarah Wilson", "5544332211", "Physics", "2024", "sarah@university.edu"),
            ("STU005", "David Brown", "9988776655", "Chemistry", "2023", "david@university.edu")
        ]
        
        cursor = self.conn.cursor()
        for student in sample_students:
            cursor.execute('''
                INSERT OR REPLACE INTO students (id, name, rfid_card, department, batch, email)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', student)
            
            # Store in memory for quick access
            self.students_db[student[2]] = {
                'id': student[0],
                'name': student[1],
                'rfid_card': student[2],
                'department': student[3],
                'batch': student[4],
                'email': student[5]
            }
        
        self.conn.commit()
        logger.info(f"✅ Loaded {len(sample_students)} sample students")
    
    def get_student_by_rfid(self, rfid_card: str) -> Optional[Dict[str, Any]]:
        """Get student details by RFID card"""
        return self.students_db.get(rfid_card)
    
    def mark_attendance(self, rfid_card: str) -> Dict[str, Any]:
        """Mark attendance for a student"""
        student = self.get_student_by_rfid(rfid_card)
        
        if not student:
            return {
                'success': False,
                'message': 'Student not found',
                'rfid_card': rfid_card
            }
        
        # Record attendance
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO attendance (student_id, rfid_card, timestamp, status)
            VALUES (?, ?, ?, ?)
        ''', (student['id'], rfid_card, datetime.now(), 'present'))
        self.conn.commit()
        
        # Get attendance count for today
        today = datetime.now().strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*) FROM attendance 
            WHERE student_id = ? AND DATE(timestamp) = ?
        ''', (student['id'], today))
        today_count = cursor.fetchone()[0]
        
        # Get total attendance count
        cursor.execute('''
            SELECT COUNT(*) FROM attendance WHERE student_id = ?
        ''', (student['id'],))
        total_count = cursor.fetchone()[0]
        
        response = {
            'success': True,
            'message': f'Attendance marked for {student["name"]}',
            'student': student,
            'attendance': {
                'today_count': today_count,
                'total_count': total_count,
                'last_scan': datetime.now().isoformat()
            }
        }
        
        logger.info(f"✅ Attendance marked: {student['name']} ({rfid_card})")
        return response
    
    async def handle_rfid_device(self, websocket, path):
        """Handle WebSocket connections from RFID devices"""
        client_ip = websocket.remote_address[0]
        logger.info(f"🔌 RFID Device connected from {client_ip}")
        
        self.clients.add(websocket)
        
        try:
            # Send welcome message
            welcome_msg = {
                'type': 'welcome',
                'message': 'Connected to SmartTrack RFID System',
                'server_time': datetime.now().isoformat()
            }
            await websocket.send(json.dumps(welcome_msg))
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    logger.info(f"📨 Received: {data}")
                    
                    if data.get('type') == 'rfid_scan':
                        rfid_card = data.get('rfid_card', '').strip()
                        if rfid_card:
                            # Process attendance
                            result = self.mark_attendance(rfid_card)
                            
                            # Send response back to device
                            response = {
                                'type': 'attendance_result',
                                'rfid_card': rfid_card,
                                'success': result['success'],
                                'message': result['message'],
                                'student': result.get('student'),
                                'attendance': result.get('attendance'),
                                'timestamp': datetime.now().isoformat()
                            }
                            
                            await websocket.send(json.dumps(response))
                            
                            # Broadcast to all connected clients
                            await self.broadcast_to_clients(response)
                            
                        else:
                            error_msg = {
                                'type': 'error',
                                'message': 'Invalid RFID card data'
                            }
                            await websocket.send(json.dumps(error_msg))
                    
                    elif data.get('type') == 'heartbeat':
                        # Respond to heartbeat
                        heartbeat_response = {
                            'type': 'heartbeat_ack',
                            'timestamp': datetime.now().isoformat()
                        }
                        await websocket.send(json.dumps(heartbeat_response))
                        
                except json.JSONDecodeError:
                    logger.error(f"❌ Invalid JSON received: {message}")
                except Exception as e:
                    logger.error(f"❌ Error processing message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Device {client_ip} disconnected")
        finally:
            self.clients.remove(websocket)
    
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
            # Connect to a remote address to get local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except:
            return "localhost"

# Simple HTTP server for web interface
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

class WebHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            html_content = '''
<!DOCTYPE html>
<html>
<head>
    <title>SmartTrack RFID Attendance</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        .header { background: #4CAF50; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .attendance-log { margin-top: 20px; }
        .student-card { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 5px; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 SmartTrack RFID Attendance System</h1>
        </div>
        
        <div class="status info">
            <strong>System Status:</strong> <span id="status">Connecting...</span>
        </div>
        
        <div class="status success">
            <strong>WebSocket Server:</strong> ws://192.168.8.110:8080
        </div>
        
        <div>
            <h3>Recent Attendance</h3>
            <div id="attendance-log"></div>
        </div>
        
        <div>
            <h3>Test RFID Scan</h3>
            <input type="text" id="testRfid" placeholder="Enter RFID card number" style="padding: 10px; margin: 5px;">
            <button onclick="testScan()">Test Scan</button>
        </div>
    </div>
    
    <script>
        const ws = new WebSocket('ws://192.168.8.110:8080');
        const statusEl = document.getElementById('status');
        const logEl = document.getElementById('attendance-log');
        
        ws.onopen = function() {
            statusEl.textContent = 'Connected';
            statusEl.style.color = 'green';
        };
        
        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('Received:', data);
            
            if (data.type === 'attendance_result' && data.success) {
                const student = data.student;
                const attendance = data.attendance;
                
                const card = document.createElement('div');
                card.className = 'student-card';
                card.innerHTML = `
                    <h4>${student.name} (${student.id})</h4>
                    <p><strong>Department:</strong> ${student.department} | <strong>Batch:</strong> ${student.batch}</p>
                    <p><strong>RFID:</strong> ${student.rfid_card}</p>
                    <p><strong>Today's Scans:</strong> ${attendance.today_count} | <strong>Total:</strong> ${attendance.total_count}</p>
                    <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
                `;
                
                logEl.insertBefore(card, logEl.firstChild);
            }
        };
        
        ws.onerror = function() {
            statusEl.textContent = 'Error';
            statusEl.style.color = 'red';
        };
        
        function testScan() {
            const rfid = document.getElementById('testRfid').value;
            if (rfid) {
                ws.send(JSON.stringify({
                    type: 'rfid_scan',
                    rfid_card: rfid,
                    device_id: 'WEB_TEST'
                }));
                document.getElementById('testRfid').value = '';
            }
        }
    </script>
</body>
</html>
            '''
            self.wfile.write(html_content.encode())
        else:
            self.send_response(404)
            self.end_headers()

async def main():
    system = SimpleRFIDAttendanceSystem()
    
    # Get local IP
    local_ip = system.get_local_ip()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║               SmartTrack RFID Attendance System             ║
╠══════════════════════════════════════════════════════════════╣
║ 🌐 WebSocket Server: ws://{local_ip}:8080                ║
║ 🌍 Web Interface:    http://{local_ip}:3000               ║
║ 📊 Database:         attendance.db                          ║
║ 📝 Students Loaded:  5 sample students                      ║
╚══════════════════════════════════════════════════════════════╝

📋 Sample RFID Cards:
   • 1234567890 - John Doe (Computer Science)
   • 0987654321 - Jane Smith (Engineering) 
   • 1122334455 - Mike Johnson (Mathematics)
   • 5544332211 - Sarah Wilson (Physics)
   • 9988776655 - David Brown (Chemistry)

🔧 Arduino Configuration:
   Update your NodeMCU code with:
   const char* SERVER_HOST = "{local_ip}";
   const int SERVER_PORT = 8080;

🚀 System Starting...
    """)
    
    # Start HTTP server in a separate thread
    def start_http_server():
        httpd = HTTPServer(('0.0.0.0', 3000), WebHandler)
        httpd.serve_forever()
    
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()
    
    # Start WebSocket server
    logger.info("🔌 Starting WebSocket server...")
    await websockets.serve(system.handle_rfid_device, "0.0.0.0", 8080)
    logger.info(f"✅ WebSocket server running on ws://0.0.0.0:8080")
    logger.info(f"🌍 Web interface available at http://{local_ip}:3000")
    
    # Keep running
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Shutting down SmartTrack RFID System...")
