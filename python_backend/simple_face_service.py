from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import base64
import io
import logging
from datetime import datetime
from PIL import Image
import json
import os

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('simple_face_service.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'esp32_simple_face_service'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Simple in-memory storage
students_database = {
    "ST001": {"name": "John Doe", "email": "john@example.com", "class": "CS101"},
    "ST002": {"name": "Jane Smith", "email": "jane@example.com", "class": "CS101"},
    "ST003": {"name": "Bob Johnson", "email": "bob@example.com", "class": "CS102"}
}

attendance_records = []
recognition_stats = {
    'total_recognitions': 0,
    'successful_recognitions': 0,
    'failed_recognitions': 0,
    'service_start_time': datetime.now()
}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    uptime = datetime.now() - recognition_stats['service_start_time']
    return jsonify({
        "status": "healthy",
        "service": "Simple ESP32-CAM Face Recognition",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": int(uptime.total_seconds()),
        "message": "Service running (demo mode - no actual face recognition)"
    })

@app.route('/api/face/enroll', methods=['POST'])
def enroll_face():
    """Simulate face enrollment"""
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        student_name = data.get('student_name', '')
        image_data = data.get('image')
        
        if not student_id or not image_data:
            return jsonify({"success": False, "error": "Missing student_id or image"}), 400
        
        logger.info(f"👤 Simulating face enrollment for: {student_id}")
        
        # Add to database
        students_database[student_id] = {
            "name": student_name,
            "enrolled_at": datetime.now().isoformat(),
            "status": "enrolled"
        }
        
        logger.info(f"✅ Successfully enrolled {student_id} ({student_name})")
        
        return jsonify({
            "success": True,
            "message": f"Face enrolled successfully for {student_id} (demo mode)",
            "student_id": student_id,
            "student_name": student_name,
            "note": "This is demo mode - actual face recognition not implemented yet"
        })
        
    except Exception as e:
        logger.error(f"❌ Error in face enrollment: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    """Simulate face recognition"""
    try:
        data = request.get_json()
        device_id = data.get('deviceId', 'unknown')
        image_data = data.get('image')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not image_data:
            return jsonify({"success": False, "error": "Missing image data"}), 400
        
        logger.info(f"🔍 Simulating face recognition from device: {device_id}")
        recognition_stats['total_recognitions'] += 1
        
        # Simulate random recognition (for demo)
        import random
        if random.random() > 0.3:  # 70% success rate simulation
            # Pick a random student for demo
            student_id = random.choice(list(students_database.keys()))
            student_name = students_database[student_id]["name"]
            confidence = random.uniform(0.75, 0.95)  # Random confidence
            
            logger.info(f"🎉 SIMULATED RECOGNITION SUCCESS!")
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
                "recognitionTime": datetime.now().isoformat(),
                "demo_mode": True
            }
            
            attendance_records.append(attendance_record)
            recognition_stats['successful_recognitions'] += 1
            
            # Emit real-time update
            socketio.emit('attendance_update', attendance_record, broadcast0=True)
            
            return jsonify({
                "success": True,
                "student_id": student_id,
                "student_name": student_name,
                "confidence": confidence,
                "message": f"Student {student_name} recognized successfully (demo mode)",
                "attendance_recorded": True
            })
        else:
            # Simulate recognition failure
            logger.warning(f"❌ Simulated recognition failure")
            recognition_stats['failed_recognitions'] += 1
            
            return jsonify({
                "success": False,
                "error": "Face not recognized",
                "message": "Student not found in database (demo mode)",
                "confidence": 0.0
            }), 404
        
    except Exception as e:
        logger.error(f"❌ Error in face recognition: {e}")
        recognition_stats['failed_recognitions'] += 1
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/students', methods=['GET'])
def get_students():
    """Get all registered students"""
    return jsonify({
        "success": True,
        "students": students_database,
        "total": len(students_database)
    })

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
    uptime = datetime.now() - recognition_stats['service_start_time']
    
    return jsonify({
        "success": True,
        "statistics": {
            **recognition_stats,
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_readable": str(uptime).split('.')[0],
            "enrolled_students": len(students_database),
            "registered_students": len(students_database),
            "attendance_records": len(attendance_records),
            "recognition_success_rate": (
                recognition_stats['successful_recognitions'] / max(recognition_stats['total_recognitions'], 1) * 100
            ),
            "demo_mode": True
        }
    })

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info(f"🔌 WebSocket client connected")
    emit('connected', {
        'message': 'Connected to ESP32-CAM Simple Face Recognition Service',
        'timestamp': datetime.now().isoformat(),
        'demo_mode': True
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info(f"🔌 WebSocket client disconnected")

if __name__ == '__main__':
    logger.info("🌟 ESP32-CAM Simple Face Recognition Service started!")
    logger.info("⚠️  DEMO MODE: Simulated face recognition for testing")
    logger.info(f"👥 Loaded {len(students_database)} demo students")
    logger.info("🔗 WebSocket support enabled for real-time updates")
    logger.info("🌐 Starting server on http://localhost:8000")
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=8000,
        debug=False,
        allow_unsafe_werkzeug=True
    )
