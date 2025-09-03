"""
ESP32-CAM Face Recognition Service
==================================

Complete Python backend for ESP32-CAM face recognition system.
Handles face enrollment, recognition, and real-time attendance updates.

Features:
- Face enrollment with multiple images
- Real-time face recognition
- Student database management
- Attendance logging
- WebSocket notifications
- Firebase integration
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import face_recognition
import os
import pickle
import base64
import io
import logging
from datetime import datetime
from PIL import Image
import requests
import json

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('face_recognition.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'esp32_face_recognition_secret'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration
ENCODINGS_FILE = "face_encodings.pkl"
STUDENTS_FILE = "students.json"
ATTENDANCE_FILE = "attendance.json"
NODE_SERVER_URL = "http://localhost:5000"

# In-memory storage for real-time data
known_face_encodings = []
known_face_names = []
students_database = {}
attendance_records = []

# Statistics
stats = {
    'total_recognitions': 0,
    'successful_recognitions': 0,
    'failed_recognitions': 0,
    'enrolled_students': 0,
    'service_start_time': datetime.now()
}

def load_face_encodings():
    """Load face encodings from file"""
    global known_face_encodings, known_face_names
    
    if os.path.exists(ENCODINGS_FILE):
        try:
            with open(ENCODINGS_FILE, 'rb') as f:
                data = pickle.load(f)
                known_face_encodings = data.get('encodings', [])
                known_face_names = data.get('names', [])
            logger.info(f"✅ Loaded {len(known_face_encodings)} face encodings")
        except Exception as e:
            logger.error(f"❌ Error loading encodings: {e}")
            known_face_encodings = []
            known_face_names = []
    else:
        logger.info("📁 No existing face encodings found, starting fresh")

def save_face_encodings():
    """Save face encodings to file"""
    try:
        data = {
            'encodings': known_face_encodings,
            'names': known_face_names
        }
        with open(ENCODINGS_FILE, 'wb') as f:
            pickle.dump(data, f)
        logger.info(f"💾 Saved {len(known_face_encodings)} face encodings")
    except Exception as e:
        logger.error(f"❌ Error saving encodings: {e}")

def load_students_database():
    """Load students database from file"""
    global students_database
    
    if os.path.exists(STUDENTS_FILE):
        try:
            with open(STUDENTS_FILE, 'r') as f:
                students_database = json.load(f)
            logger.info(f"👥 Loaded {len(students_database)} students from database")
        except Exception as e:
            logger.error(f"❌ Error loading students database: {e}")
            students_database = {}
    else:
        # Create sample students for testing
        students_database = {
            "ST001": {"name": "John Doe", "email": "john@example.com", "class": "CS101"},
            "ST002": {"name": "Jane Smith", "email": "jane@example.com", "class": "CS101"},
            "ST003": {"name": "Bob Johnson", "email": "bob@example.com", "class": "CS102"}
        }
        save_students_database()
        logger.info("👥 Created sample students database")

def save_students_database():
    """Save students database to file"""
    try:
        with open(STUDENTS_FILE, 'w') as f:
            json.dump(students_database, f, indent=2)
        logger.info(f"💾 Saved students database with {len(students_database)} students")
    except Exception as e:
        logger.error(f"❌ Error saving students database: {e}")

def load_attendance_records():
    """Load attendance records from file"""
    global attendance_records
    
    if os.path.exists(ATTENDANCE_FILE):
        try:
            with open(ATTENDANCE_FILE, 'r') as f:
                attendance_records = json.load(f)
            logger.info(f"📝 Loaded {len(attendance_records)} attendance records")
        except Exception as e:
            logger.error(f"❌ Error loading attendance records: {e}")
            attendance_records = []

def save_attendance_record(record):
    """Save attendance record to file and send to Node.js server"""
    global attendance_records
    
    # Add timestamp if not present
    if 'timestamp' not in record:
        record['timestamp'] = datetime.now().isoformat()
    
    # Add to local records
    attendance_records.append(record)
    
    # Save to file
    try:
        with open(ATTENDANCE_FILE, 'w') as f:
            json.dump(attendance_records, f, indent=2)
        logger.info(f"💾 Saved attendance record for {record.get('studentId', 'unknown')}")
    except Exception as e:
        logger.error(f"❌ Error saving attendance record: {e}")
    
    # Send to Node.js server
    try:
        response = requests.post(
            f"{NODE_SERVER_URL}/api/attendance",
            json=record,
            timeout=5
        )
        if response.status_code == 200:
            logger.info(f"📤 Sent attendance to Node.js server")
        else:
            logger.warning(f"⚠️ Failed to send attendance to Node.js: {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️ Could not reach Node.js server: {e}")
    
    # Emit real-time update via WebSocket
    socketio.emit('attendance_update', record, broadcast=True)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    uptime = datetime.now() - stats['service_start_time']
    return jsonify({
        "status": "healthy",
        "service": "ESP32-CAM Face Recognition",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": int(uptime.total_seconds()),
        "statistics": stats,
        "database": {
            "enrolled_faces": len(known_face_encodings),
            "registered_students": len(students_database),
            "attendance_records": len(attendance_records)
        }
    })

@app.route('/api/face/enroll', methods=['POST'])
def enroll_face():
    """Enroll a new face for a student"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        student_name = data.get('student_name', '')
        image_data = data.get('image')
        
        if not student_id or not image_data:
            return jsonify({"success": False, "error": "Missing student_id or image"}), 400
        
        logger.info(f"👤 Enrolling face for student: {student_id}")
        
        # Decode base64 image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert RGB to BGR for face_recognition
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_rgb = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
        else:
            image_rgb = image_array
        
        # Find face encodings
        face_locations = face_recognition.face_locations(image_rgb)
        
        if len(face_locations) == 0:
            logger.warning(f"⚠️ No face found in enrollment image for {student_id}")
            return jsonify({"success": False, "error": "No face detected in image"}), 400
        
        if len(face_locations) > 1:
            logger.warning(f"⚠️ Multiple faces found in enrollment image for {student_id}")
            return jsonify({"success": False, "error": "Multiple faces detected. Please use image with single face"}), 400
        
        # Get face encoding
        face_encodings = face_recognition.face_encodings(image_rgb, face_locations)
        if len(face_encodings) == 0:
            return jsonify({"success": False, "error": "Could not extract face features"}), 400
        
        # Remove existing encodings for this student
        while student_id in known_face_names:
            index = known_face_names.index(student_id)
            known_face_names.pop(index)
            known_face_encodings.pop(index)
        
        # Add new encoding
        known_face_encodings.append(face_encodings[0])
        known_face_names.append(student_id)
        
        # Update student database
        if student_name:
            students_database[student_id] = {
                "name": student_name,
                "enrolled_at": datetime.now().isoformat()
            }
            save_students_database()
        
        # Save encodings
        save_face_encodings()
        
        stats['enrolled_students'] = len(set(known_face_names))
        
        logger.info(f"✅ Successfully enrolled face for {student_id} ({student_name})")
        
        return jsonify({
            "success": True,
            "message": f"Face enrolled successfully for {student_id}",
            "student_id": student_id,
            "student_name": student_name,
            "total_enrolled": len(known_face_encodings)
        })
        
    except Exception as e:
        logger.error(f"❌ Error in face enrollment: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    """Recognize a face from ESP32-CAM"""
    try:
        data = request.get_json()
        device_id = data.get('deviceId', 'unknown')
        image_data = data.get('image')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not image_data:
            return jsonify({"success": False, "error": "Missing image data"}), 400
        
        logger.info(f"🔍 Face recognition request from device: {device_id}")
        stats['total_recognitions'] += 1
        
        # Decode base64 image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert to RGB for face_recognition
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_rgb = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
        else:
            image_rgb = image_array
        
        logger.info(f"📷 Processing image: {image_rgb.shape}")
        
        # Check if we have any enrolled faces
        if len(known_face_encodings) == 0:
            logger.warning("⚠️ No enrolled faces in database")
            stats['failed_recognitions'] += 1
            return jsonify({
                "success": False,
                "error": "No enrolled faces in database",
                "message": "Please enroll student faces first"
            }), 400
        
        # Find faces in the image
        face_locations = face_recognition.face_locations(image_rgb)
        
        if len(face_locations) == 0:
            logger.warning("⚠️ No face detected in recognition image")
            stats['failed_recognitions'] += 1
            return jsonify({
                "success": False,
                "error": "No face detected in image",
                "message": "Please ensure face is clearly visible"
            }), 400
        
        logger.info(f"👤 Found {len(face_locations)} face(s) in image")
        
        # Get face encodings
        face_encodings = face_recognition.face_encodings(image_rgb, face_locations)
        
        if len(face_encodings) == 0:
            logger.warning("⚠️ Could not extract face features")
            stats['failed_recognitions'] += 1
            return jsonify({
                "success": False,
                "error": "Could not extract face features",
                "message": "Face quality too low for recognition"
            }), 400
        
        # Process the first (largest) face
        face_encoding = face_encodings[0]
        
        # Compare with known faces
        matches = face_recognition.compare_faces(known_face_encodings, face_encoding, tolerance=0.6)
        face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
        
        logger.info(f"🔍 Comparing against {len(known_face_encodings)} known faces")
        logger.info(f"📊 Face distances: {face_distances.tolist()}")
        
        student_id = None
        confidence = 0.0
        student_name = "Unknown"
        
        if True in matches:
            # Find the best match
            best_match_index = np.argmin(face_distances)
            if matches[best_match_index]:
                student_id = known_face_names[best_match_index]
                confidence = 1 - face_distances[best_match_index]  # Convert distance to confidence
                
                # Get student name from database
                if student_id in students_database:
                    student_name = students_database[student_id].get('name', student_id)
                else:
                    student_name = student_id
                
                logger.info(f"🎉 RECOGNITION SUCCESS!")
                logger.info(f"👤 Student: {student_name} (ID: {student_id})")
                logger.info(f"📊 Confidence: {confidence:.2%}")
                
                # Record attendance
                attendance_record = {
                    "studentId": student_id,
                    "studentName": student_name,
                    "deviceId": device_id,
                    "method": "face_recognition",
                    "confidence": confidence,
                    "timestamp": timestamp,
                    "recognitionTime": datetime.now().isoformat()
                }
                
                save_attendance_record(attendance_record)
                stats['successful_recognitions'] += 1
                
                return jsonify({
                    "success": True,
                    "student_id": student_id,
                    "student_name": student_name,
                    "confidence": confidence,
                    "message": f"Student {student_name} recognized successfully",
                    "attendance_recorded": True
                })
        
        # No match found
        logger.warning(f"❌ No matching face found. Best distance: {min(face_distances):.3f}")
        stats['failed_recognitions'] += 1
        
        return jsonify({
            "success": False,
            "error": "Face not recognized",
            "message": "Student not found in database",
            "confidence": 0.0,
            "best_distance": float(min(face_distances))
        }), 404
        
    except Exception as e:
        logger.error(f"❌ Error in face recognition: {e}")
        stats['failed_recognitions'] += 1
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/students', methods=['GET'])
def get_students():
    """Get all registered students"""
    return jsonify({
        "success": True,
        "students": students_database,
        "total": len(students_database)
    })

@app.route('/api/students', methods=['POST'])
def add_student():
    """Add a new student to database"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        student_name = data.get('student_name', '')
        email = data.get('email', '')
        class_name = data.get('class', '')
        
        if not student_id:
            return jsonify({"success": False, "error": "Missing student_id"}), 400
        
        students_database[student_id] = {
            "name": student_name,
            "email": email,
            "class": class_name,
            "created_at": datetime.now().isoformat()
        }
        
        save_students_database()
        
        logger.info(f"👥 Added new student: {student_id} ({student_name})")
        
        return jsonify({
            "success": True,
            "message": f"Student {student_id} added successfully",
            "student": students_database[student_id]
        })
        
    except Exception as e:
        logger.error(f"❌ Error adding student: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance records"""
    return jsonify({
        "success": True,
        "attendance": attendance_records,
        "total": len(attendance_records)
    })

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Get service statistics"""
    uptime = datetime.now() - stats['service_start_time']
    
    return jsonify({
        "success": True,
        "statistics": {
            **stats,
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_readable": str(uptime).split('.')[0],
            "enrolled_students": len(set(known_face_names)),
            "registered_students": len(students_database),
            "attendance_records": len(attendance_records),
            "recognition_success_rate": (
                stats['successful_recognitions'] / max(stats['total_recognitions'], 1) * 100
            )
        }
    })

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info(f"🔌 WebSocket client connected")
    emit('connected', {
        'message': 'Connected to ESP32-CAM Face Recognition Service',
        'timestamp': datetime.now().isoformat()
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info(f"🔌 WebSocket client disconnected")

@socketio.on('get_stats')
def handle_get_stats():
    """Send current statistics to client"""
    uptime = datetime.now() - stats['service_start_time']
    emit('stats_update', {
        **stats,
        'uptime_seconds': int(uptime.total_seconds()),
        'enrolled_students': len(set(known_face_names)),
        'registered_students': len(students_database)
    })

# Initialize data on startup
logger.info("🚀 Starting ESP32-CAM Face Recognition Service...")
load_face_encodings()
load_students_database()
load_attendance_records()

# Update stats
stats['enrolled_students'] = len(set(known_face_names))

if __name__ == '__main__':
    logger.info("🌟 ESP32-CAM Face Recognition Service started!")
    logger.info(f"📊 Loaded {len(known_face_encodings)} face encodings")
    logger.info(f"👥 Loaded {len(students_database)} students")
    logger.info(f"📝 Loaded {len(attendance_records)} attendance records")
    logger.info("🔗 WebSocket support enabled for real-time updates")
    logger.info("🌐 Starting server on http://localhost:8000")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=8000,
        debug=False,
        allow_unsafe_werkzeug=True
    )
