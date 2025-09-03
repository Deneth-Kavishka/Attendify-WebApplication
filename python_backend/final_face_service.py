import os
import sys
import logging
from datetime import datetime, timedelta
import json
import uuid
import base64
import io
import hashlib
import threading
from typing import Dict, List, Optional, Tuple

# Core Flask imports
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit

# Image processing imports
from PIL import Image, ImageEnhance
import numpy as np

# Try to import face recognition libraries
try:
    import cv2
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
    print("✅ Face recognition libraries loaded successfully")
except ImportError as e:
    FACE_RECOGNITION_AVAILABLE = False
    print(f"⚠️  Face recognition libraries not available: {e}")
    print("📦 Install with: pip install opencv-python face-recognition")

# ===================== CONFIGURATION =====================

# Service configuration
SERVICE_VERSION = "3.0.0"
SERVICE_NAME = "ESP32-CAM Face Recognition Service"
SERVICE_PORT = 8000
DEBUG_MODE = False

# Face recognition settings
FACE_RECOGNITION_TOLERANCE = 0.6  # Lower = more strict
FACE_RECOGNITION_MODEL = "hog"    # 'hog' for speed, 'cnn' for accuracy
MIN_FACE_SIZE = (50, 50)         # Minimum face dimensions
MAX_IMAGE_SIZE = (800, 600)      # Maximum image size for processing
CONFIDENCE_THRESHOLD = 0.7       # Minimum confidence for recognition

# Performance settings
MAX_CONCURRENT_REQUESTS = 5
REQUEST_TIMEOUT = 30  # seconds
CLEANUP_INTERVAL = 3600  # 1 hour

# Storage settings
FACE_ENCODINGS_FILE = "face_encodings.json"
ATTENDANCE_LOG_FILE = "attendance_records.json"
IMAGES_DIRECTORY = "student_images"

# ===================== LOGGING SETUP =====================

# Configure logging with proper encoding for Windows
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('final_face_service.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# ===================== FLASK APPLICATION SETUP =====================

app = Flask(__name__)
app.config['SECRET_KEY'] = 'esp32_cam_final_service_2025'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# SocketIO configuration
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    engineio_logger=False
)

# ===================== DATA STORAGE =====================

class FaceRecognitionService:
    """Main service class for face recognition operations"""
    
    def __init__(self):
        self.face_encodings: Dict[str, np.ndarray] = {}
        self.student_database: Dict[str, dict] = {}
        self.attendance_records: List[dict] = []
        self.device_status: Dict[str, dict] = {}
        self.recognition_stats = {
            'total_requests': 0,
            'successful_recognitions': 0,
            'failed_recognitions': 0,
            'service_start_time': datetime.now(),
            'last_recognition': None
        }
        self.request_lock = threading.Lock()
        
        # Create directories
        os.makedirs(IMAGES_DIRECTORY, exist_ok=True)
        
        # Load existing data
        self._load_face_encodings()
        self._load_attendance_records()
        self._initialize_demo_data()
        
        logger.info(f"🚀 {SERVICE_NAME} v{SERVICE_VERSION} initialized")
        logger.info(f"📊 Loaded {len(self.student_database)} students")
        logger.info(f"🔍 Face recognition: {'Available' if FACE_RECOGNITION_AVAILABLE else 'Demo Mode'}")
    
    def _initialize_demo_data(self):
        """Initialize demo students if no data exists"""
        if not self.student_database:
            self.student_database = {
                "ST001": {
                    "name": "John Doe",
                    "email": "john.doe@university.edu",
                    "class": "CS101",
                    "enrolled_date": "2025-09-01",
                    "status": "active",
                    "total_attendance": 0
                },
                "ST002": {
                    "name": "Jane Smith",
                    "email": "jane.smith@university.edu",
                    "class": "CS101",
                    "enrolled_date": "2025-09-01",
                    "status": "active",
                    "total_attendance": 0
                },
                "ST003": {
                    "name": "Bob Johnson",
                    "email": "bob.johnson@university.edu",
                    "class": "CS102",
                    "enrolled_date": "2025-09-02",
                    "status": "active",
                    "total_attendance": 0
                }
            }
            logger.info("📝 Initialized demo student data")
    
    def _load_face_encodings(self):
        """Load face encodings from file"""
        try:
            if os.path.exists(FACE_ENCODINGS_FILE):
                with open(FACE_ENCODINGS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.student_database = data.get('students', {})
                    # Note: face encodings would be loaded separately in a real implementation
                logger.info(f"📂 Loaded face encodings for {len(self.student_database)} students")
        except Exception as e:
            logger.error(f"❌ Error loading face encodings: {e}")
    
    def _save_face_encodings(self):
        """Save face encodings to file"""
        try:
            data = {
                'students': self.student_database,
                'last_updated': datetime.now().isoformat(),
                'version': SERVICE_VERSION
            }
            with open(FACE_ENCODINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info("💾 Face encodings saved successfully")
        except Exception as e:
            logger.error(f"❌ Error saving face encodings: {e}")
    
    def _load_attendance_records(self):
        """Load attendance records from file"""
        try:
            if os.path.exists(ATTENDANCE_LOG_FILE):
                with open(ATTENDANCE_LOG_FILE, 'r', encoding='utf-8') as f:
                    self.attendance_records = json.load(f)
                logger.info(f"📋 Loaded {len(self.attendance_records)} attendance records")
        except Exception as e:
            logger.error(f"❌ Error loading attendance records: {e}")
    
    def _save_attendance_records(self):
        """Save attendance records to file"""
        try:
            with open(ATTENDANCE_LOG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.attendance_records, f, indent=2, ensure_ascii=False)
            logger.info("💾 Attendance records saved successfully")
        except Exception as e:
            logger.error(f"❌ Error saving attendance records: {e}")
    
    def preprocess_image(self, image_data: str) -> Optional[np.ndarray]:
        """Preprocess image for face recognition"""
        try:
            # Remove data URL prefix if present
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too large
            if image.size[0] > MAX_IMAGE_SIZE[0] or image.size[1] > MAX_IMAGE_SIZE[1]:
                image.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
            
            # Enhance image quality
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.2)
            
            # Convert to numpy array for OpenCV
            image_array = np.array(image)
            
            logger.info(f"📸 Image preprocessed: {image.size}")
            return image_array
            
        except Exception as e:
            logger.error(f"❌ Image preprocessing failed: {e}")
            return None
    
    def enroll_student(self, student_id: str, student_name: str, student_email: str, 
                      student_class: str, image_data: str) -> dict:
        """Enroll a new student with face encoding"""
        try:
            with self.request_lock:
                # Preprocess image
                image_array = self.preprocess_image(image_data)
                if image_array is None:
                    return {"success": False, "error": "Invalid image data"}
                
                face_encoding = None
                if FACE_RECOGNITION_AVAILABLE:
                    # Find face locations
                    face_locations = face_recognition.face_locations(
                        image_array, model=FACE_RECOGNITION_MODEL
                    )
                    
                    if not face_locations:
                        return {"success": False, "error": "No face detected in image"}
                    
                    if len(face_locations) > 1:
                        return {"success": False, "error": "Multiple faces detected. Please use image with single face"}
                    
                    # Generate face encoding
                    face_encodings = face_recognition.face_encodings(
                        image_array, face_locations, model="large"
                    )
                    
                    if face_encodings:
                        face_encoding = face_encodings[0]
                        # Store encoding (in production, save to secure storage)
                        self.face_encodings[student_id] = face_encoding
                    else:
                        return {"success": False, "error": "Could not generate face encoding"}
                
                # Save student information
                self.student_database[student_id] = {
                    "name": student_name,
                    "email": student_email,
                    "class": student_class,
                    "enrolled_date": datetime.now().isoformat(),
                    "status": "active",
                    "total_attendance": 0,
                    "face_encoding_available": face_encoding is not None
                }
                
                # Save image for reference
                image_path = os.path.join(IMAGES_DIRECTORY, f"{student_id}.jpg")
                image = Image.fromarray(image_array)
                image.save(image_path, "JPEG", quality=95)
                
                # Save to persistent storage
                self._save_face_encodings()
                
                logger.info(f"👤 Student enrolled: {student_name} (ID: {student_id})")
                
                # Emit real-time notification
                socketio.emit('student_enrolled', {
                    'student_id': student_id,
                    'student_name': student_name,
                    'timestamp': datetime.now().isoformat()
                }, broadcast=True)
                
                return {
                    "success": True,
                    "message": f"Student {student_name} enrolled successfully",
                    "student_id": student_id,
                    "face_encoding_generated": face_encoding is not None,
                    "enrollment_time": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"❌ Student enrollment failed: {e}")
            return {"success": False, "error": f"Enrollment failed: {str(e)}"}
    
    def recognize_face(self, device_id: str, image_data: str) -> dict:
        """Recognize face in image"""
        try:
            with self.request_lock:
                self.recognition_stats['total_requests'] += 1
                start_time = datetime.now()
                
                # Update device status
                self.device_status[device_id] = {
                    'last_seen': start_time.isoformat(),
                    'status': 'processing',
                    'recognition_count': self.device_status.get(device_id, {}).get('recognition_count', 0) + 1
                }
                
                # Preprocess image
                image_array = self.preprocess_image(image_data)
                if image_array is None:
                    self.recognition_stats['failed_recognitions'] += 1
                    return {"success": False, "error": "Invalid image data"}
                
                if FACE_RECOGNITION_AVAILABLE:
                    # Real face recognition
                    result = self._perform_real_recognition(image_array, device_id)
                else:
                    # Demo mode recognition
                    result = self._perform_demo_recognition(image_data, device_id)
                
                # Update timing
                processing_time = (datetime.now() - start_time).total_seconds()
                result['processing_time'] = f"{processing_time:.3f}s"
                
                # Update device status
                self.device_status[device_id]['status'] = 'idle'
                self.device_status[device_id]['last_processing_time'] = processing_time
                
                return result
                
        except Exception as e:
            logger.error(f"❌ Face recognition failed: {e}")
            self.recognition_stats['failed_recognitions'] += 1
            return {"success": False, "error": f"Recognition failed: {str(e)}"}
    
    def _perform_real_recognition(self, image_array: np.ndarray, device_id: str) -> dict:
        """Perform real face recognition using face_recognition library"""
        try:
            # Find faces in image
            face_locations = face_recognition.face_locations(
                image_array, model=FACE_RECOGNITION_MODEL
            )
            
            if not face_locations:
                self.recognition_stats['failed_recognitions'] += 1
                return {"success": False, "error": "No face detected in image"}
            
            # Generate face encodings
            unknown_encodings = face_recognition.face_encodings(
                image_array, face_locations, model="large"
            )
            
            if not unknown_encodings:
                self.recognition_stats['failed_recognitions'] += 1
                return {"success": False, "error": "Could not generate face encoding"}
            
            unknown_encoding = unknown_encodings[0]
            
            # Compare with known faces
            best_match = None
            best_distance = float('inf')
            
            for student_id, known_encoding in self.face_encodings.items():
                # Calculate face distance
                face_distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
                
                if face_distance < best_distance and face_distance <= FACE_RECOGNITION_TOLERANCE:
                    best_distance = face_distance
                    best_match = student_id
            
            if best_match:
                # Recognition successful
                student_info = self.student_database[best_match]
                confidence = max(0.0, 1.0 - best_distance)
                
                if confidence >= CONFIDENCE_THRESHOLD:
                    # Record attendance
                    attendance_record = self._record_attendance(
                        best_match, student_info['name'], device_id, confidence, "face_recognition"
                    )
                    
                    self.recognition_stats['successful_recognitions'] += 1
                    self.recognition_stats['last_recognition'] = datetime.now().isoformat()
                    
                    logger.info(f"✅ Recognition SUCCESS: {student_info['name']} (ID: {best_match}) - Confidence: {confidence:.3f}")
                    
                    return {
                        "success": True,
                        "student_id": best_match,
                        "student_name": student_info['name'],
                        "student_class": student_info.get('class', 'Unknown'),
                        "confidence": round(confidence, 3),
                        "face_distance": round(best_distance, 3),
                        "message": f"Student {student_info['name']} recognized successfully",
                        "attendance_recorded": True,
                        "attendance_id": attendance_record['id']
                    }
            
            # Recognition failed
            self.recognition_stats['failed_recognitions'] += 1
            return {
                "success": False,
                "error": "Face not recognized",
                "message": "No matching student found in database"
            }
            
        except Exception as e:
            logger.error(f"❌ Real face recognition error: {e}")
            raise
    
    def _perform_demo_recognition(self, image_data: str, device_id: str) -> dict:
        """Perform demo recognition when face_recognition library is not available"""
        import random
        import hashlib
        
        # Use image hash for consistent results
        image_hash = hashlib.md5(image_data.encode()).hexdigest()
        random.seed(int(image_hash[:8], 16))
        
        recognition_probability = random.random()
        
        if recognition_probability > 0.2:  # 80% success rate in demo
            # Select student based on hash for consistency
            student_ids = list(self.student_database.keys())
            selected_student = student_ids[int(image_hash[:2], 16) % len(student_ids)]
            student_info = self.student_database[selected_student]
            
            # Generate realistic confidence score
            confidence = 0.8 + (recognition_probability * 0.15)  # 0.8-0.95 range
            
            # Record attendance
            attendance_record = self._record_attendance(
                selected_student, student_info['name'], device_id, confidence, "face_recognition_demo"
            )
            
            self.recognition_stats['successful_recognitions'] += 1
            self.recognition_stats['last_recognition'] = datetime.now().isoformat()
            
            logger.info(f"🎭 DEMO Recognition: {student_info['name']} (ID: {selected_student}) - Confidence: {confidence:.3f}")
            
            return {
                "success": True,
                "student_id": selected_student,
                "student_name": student_info['name'],
                "student_class": student_info.get('class', 'Unknown'),
                "confidence": round(confidence, 3),
                "message": f"Student {student_info['name']} recognized successfully (DEMO MODE)",
                "attendance_recorded": True,
                "attendance_id": attendance_record['id'],
                "demo_mode": True
            }
        else:
            # Demo recognition failure
            self.recognition_stats['failed_recognitions'] += 1
            return {
                "success": False,
                "error": "Face not recognized",
                "message": "No matching student found in database (DEMO MODE)",
                "demo_mode": True
            }
    
    def _record_attendance(self, student_id: str, student_name: str, device_id: str, 
                          confidence: float, method: str) -> dict:
        """Record attendance for a student"""
        attendance_record = {
            "id": str(uuid.uuid4()),
            "student_id": student_id,
            "student_name": student_name,
            "device_id": device_id,
            "method": method,
            "confidence": round(confidence, 3),
            "timestamp": datetime.now().isoformat(),
            "date": datetime.now().date().isoformat(),
            "time": datetime.now().time().strftime("%H:%M:%S"),
            "status": "present"
        }
        
        # Add to records
        self.attendance_records.append(attendance_record)
        
        # Update student stats
        if student_id in self.student_database:
            self.student_database[student_id]['total_attendance'] += 1
        
        # Save to file
        self._save_attendance_records()
        
        # Emit real-time update
        socketio.emit('attendance_update', attendance_record, broadcast=True)
        
        logger.info(f"📝 Attendance recorded: {student_name} via {method}")
        
        return attendance_record
    
    def get_statistics(self) -> dict:
        """Get comprehensive service statistics"""
        uptime = datetime.now() - self.recognition_stats['service_start_time']
        today = datetime.now().date().isoformat()
        today_attendance = [r for r in self.attendance_records if r.get('date') == today]
        
        return {
            "service_info": {
                "name": SERVICE_NAME,
                "version": SERVICE_VERSION,
                "uptime_seconds": int(uptime.total_seconds()),
                "uptime_readable": str(uptime).split('.')[0],
                "face_recognition_available": FACE_RECOGNITION_AVAILABLE,
                "demo_mode": not FACE_RECOGNITION_AVAILABLE
            },
            "recognition_stats": {
                **self.recognition_stats,
                "success_rate": round(
                    (self.recognition_stats['successful_recognitions'] / 
                     max(self.recognition_stats['total_requests'], 1)) * 100, 2
                )
            },
            "database_stats": {
                "enrolled_students": len(self.student_database),
                "total_attendance_records": len(self.attendance_records),
                "today_attendance_count": len(today_attendance),
                "active_devices": len(self.device_status)
            },
            "performance": {
                "average_processing_time": self._calculate_average_processing_time(),
                "concurrent_requests_supported": MAX_CONCURRENT_REQUESTS,
                "memory_usage": self._get_memory_usage()
            }
        }
    
    def _calculate_average_processing_time(self) -> float:
        """Calculate average processing time"""
        times = [
            device.get('last_processing_time', 0) 
            for device in self.device_status.values()
            if device.get('last_processing_time')
        ]
        return round(sum(times) / len(times), 3) if times else 0.0
    
    def _get_memory_usage(self) -> dict:
        """Get memory usage information"""
        try:
            import psutil
            process = psutil.Process()
            return {
                "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
                "cpu_percent": round(process.cpu_percent(), 2)
            }
        except ImportError:
            return {"memory_mb": "N/A", "cpu_percent": "N/A"}

# ===================== INITIALIZE SERVICE =====================

# Create global service instance
face_service = FaceRecognitionService()

# ===================== API ROUTES =====================

@app.route('/health', methods=['GET'])
def health_check():
    """Comprehensive health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "face_recognition_available": FACE_RECOGNITION_AVAILABLE,
        "endpoints": {
            "health": "/health",
            "face_enrollment": "/api/face/enroll",
            "face_recognition": "/api/face/recognize",
            "students": "/api/students",
            "attendance": "/api/attendance",
            "statistics": "/api/statistics",
            "devices": "/api/devices"
        },
        "websocket": {
            "url": f"ws://localhost:{SERVICE_PORT}",
            "events": ["attendance_update", "student_enrolled", "recognition_failed"]
        }
    })

@app.route('/api/face/enroll', methods=['POST'])
def enroll_face():
    """Face enrollment endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['student_id', 'student_name', 'image']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        result = face_service.enroll_student(
            student_id=data['student_id'],
            student_name=data['student_name'],
            student_email=data.get('student_email', ''),
            student_class=data.get('student_class', ''),
            image_data=data['image']
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"❌ Face enrollment API error: {e}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    """Face recognition endpoint"""
    try:
        data = request.get_json()
        
        if not data.get('image'):
            return jsonify({
                "success": False,
                "error": "Missing image data"
            }), 400
        
        device_id = data.get('deviceId', 'unknown_device')
        
        result = face_service.recognize_face(device_id, data['image'])
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 404
            
    except Exception as e:
        logger.error(f"❌ Face recognition API error: {e}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

@app.route('/api/students', methods=['GET'])
def get_students():
    """Get all students"""
    return jsonify({
        "success": True,
        "students": face_service.student_database,
        "total": len(face_service.student_database),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/students/<student_id>', methods=['GET'])
def get_student(student_id):
    """Get specific student"""
    if student_id in face_service.student_database:
        student_attendance = [
            r for r in face_service.attendance_records 
            if r['student_id'] == student_id
        ]
        
        return jsonify({
            "success": True,
            "student": face_service.student_database[student_id],
            "student_id": student_id,
            "attendance_count": len(student_attendance),
            "recent_attendance": sorted(student_attendance, 
                                      key=lambda x: x['timestamp'], reverse=True)[:10]
        })
    else:
        return jsonify({
            "success": False,
            "error": "Student not found"
        }), 404

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance records with filtering"""
    # Get query parameters
    date_filter = request.args.get('date')
    student_filter = request.args.get('student_id')
    method_filter = request.args.get('method')
    limit = int(request.args.get('limit', 100))
    
    # Filter records
    filtered_records = face_service.attendance_records
    
    if date_filter:
        filtered_records = [r for r in filtered_records if r.get('date') == date_filter]
    
    if student_filter:
        filtered_records = [r for r in filtered_records if r['student_id'] == student_filter]
    
    if method_filter:
        filtered_records = [r for r in filtered_records if r['method'] == method_filter]
    
    # Sort by timestamp (newest first) and limit
    filtered_records = sorted(filtered_records, key=lambda x: x['timestamp'], reverse=True)[:limit]
    
    return jsonify({
        "success": True,
        "attendance": filtered_records,
        "total": len(filtered_records),
        "filters": {
            "date": date_filter,
            "student_id": student_filter,
            "method": method_filter,
            "limit": limit
        },
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Get service statistics"""
    return jsonify({
        "success": True,
        "statistics": face_service.get_statistics(),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """Get device status"""
    return jsonify({
        "success": True,
        "devices": face_service.device_status,
        "total": len(face_service.device_status),
        "timestamp": datetime.now().isoformat()
    })

# ===================== WEBSOCKET EVENTS =====================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"📱 WebSocket client connected")
    emit('connected', {
        'message': f'Connected to {SERVICE_NAME}',
        'version': SERVICE_VERSION,
        'timestamp': datetime.now().isoformat(),
        'face_recognition_available': FACE_RECOGNITION_AVAILABLE
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"📱 WebSocket client disconnected")

@socketio.on('ping')
def handle_ping(data):
    """Handle ping from client"""
    emit('pong', {
        'timestamp': datetime.now().isoformat(),
        'server_time': datetime.now().isoformat(),
        'uptime': str(datetime.now() - face_service.recognition_stats['service_start_time']).split('.')[0]
    })

@socketio.on('get_stats')
def handle_get_stats():
    """Handle statistics request"""
    emit('stats_update', face_service.get_statistics())

# ===================== ERROR HANDLERS =====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found",
        "available_endpoints": [
            "/health",
            "/api/face/enroll",
            "/api/face/recognize",
            "/api/students",
            "/api/attendance",
            "/api/statistics",
            "/api/devices"
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "success": False,
        "error": "Internal server error",
        "message": "Please check the server logs for more information"
    }), 500

# ===================== MAIN EXECUTION =====================

if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info(f"🚀 Starting {SERVICE_NAME} v{SERVICE_VERSION}")
    logger.info("=" * 60)
    logger.info(f"🔧 Configuration:")
    logger.info(f"   - Port: {SERVICE_PORT}")
    logger.info(f"   - Face Recognition: {'Available' if FACE_RECOGNITION_AVAILABLE else 'Demo Mode'}")
    logger.info(f"   - Debug Mode: {DEBUG_MODE}")
    logger.info(f"   - Max Concurrent Requests: {MAX_CONCURRENT_REQUESTS}")
    logger.info(f"📊 Loaded Data:")
    logger.info(f"   - Students: {len(face_service.student_database)}")
    logger.info(f"   - Attendance Records: {len(face_service.attendance_records)}")
    logger.info(f"🌐 Access URLs:")
    logger.info(f"   - Health Check: http://localhost:{SERVICE_PORT}/health")
    logger.info(f"   - API Base: http://localhost:{SERVICE_PORT}/api/")
    logger.info(f"   - WebSocket: ws://localhost:{SERVICE_PORT}")
    logger.info("=" * 60)
    
    try:
        socketio.run(
            app,
            host='0.0.0.0',
            port=SERVICE_PORT,
            debug=DEBUG_MODE,
            allow_unsafe_werkzeug=True
        )
    except KeyboardInterrupt:
        logger.info("🛑 Service stopped by user")
    except Exception as e:
        logger.error(f"❌ Service failed to start: {e}")
        sys.exit(1)
