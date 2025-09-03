#!/usr/bin/env python3
"""
Enhanced Debug Face Recognition Service
Comprehensive logging and debugging for ESP32 face recognition connectivity
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import base64
import io
from PIL import Image
import logging
import datetime
import os
import time

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('debug_face_recognition.log'),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)
CORS(app)

# Statistics tracking
request_count = 0
successful_recognitions = 0
failed_recognitions = 0
start_time = time.time()

@app.before_request
def log_request_info():
    global request_count
    request_count += 1
    
    logging.info("="*60)
    logging.info(f"🌐 INCOMING REQUEST #{request_count}")
    logging.info(f"📍 Method: {request.method}")
    logging.info(f"🎯 URL: {request.url}")
    logging.info(f"🔗 Path: {request.path}")
    logging.info(f"📋 Headers: {dict(request.headers)}")
    logging.info(f"🔍 Content-Type: {request.content_type}")
    logging.info(f"📊 Content-Length: {request.content_length}")
    logging.info(f"🌐 Remote Address: {request.remote_addr}")
    
    if request.is_json:
        try:
            data = request.get_json()
            if data:
                # Don't log the full image data, just metadata
                safe_data = data.copy()
                if 'imageData' in safe_data:
                    image_data = safe_data['imageData']
                    if image_data.startswith('data:image/'):
                        safe_data['imageData'] = f"[IMAGE DATA: {len(image_data)} characters]"
                    else:
                        safe_data['imageData'] = f"[BASE64 DATA: {len(image_data)} characters]"
                
                logging.info(f"📝 JSON Data: {json.dumps(safe_data, indent=2)}")
            else:
                logging.info("📝 JSON Data: None")
        except Exception as e:
            logging.error(f"❌ Error parsing JSON: {e}")
    
    logging.info("="*60)

@app.after_request
def log_response_info(response):
    logging.info("="*60)
    logging.info(f"📤 RESPONSE")
    logging.info(f"📊 Status Code: {response.status_code}")
    logging.info(f"📋 Headers: {dict(response.headers)}")
    logging.info(f"📝 Content-Type: {response.content_type}")
    
    # Log response data for non-image responses
    if response.content_type and 'application/json' in response.content_type:
        try:
            response_data = response.get_json()
            logging.info(f"📄 Response Data: {json.dumps(response_data, indent=2)}")
        except:
            logging.info(f"📄 Response Data: {response.get_data(as_text=True)[:500]}...")
    
    logging.info("="*60)
    return response

@app.route('/', methods=['GET'])
def home():
    """Home page with debug information"""
    logging.info("🏠 Home page accessed")
    
    uptime = time.time() - start_time
    hours = int(uptime // 3600)
    minutes = int((uptime % 3600) // 60)
    seconds = int(uptime % 60)
    
    stats = {
        'service': 'ESP32 Face Recognition Debug Service',
        'status': 'running',
        'uptime': f"{hours:02d}:{minutes:02d}:{seconds:02d}",
        'total_requests': request_count,
        'successful_recognitions': successful_recognitions,
        'failed_recognitions': failed_recognitions,
        'endpoints': {
            '/': 'Service information',
            '/health': 'Health check',
            '/api/face/recognize': 'Face recognition endpoint (POST)',
            '/api/test': 'Test endpoint',
            '/debug/stats': 'Detailed statistics'
        }
    }
    
    return jsonify(stats)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logging.info("💓 Health check requested")
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.datetime.now().isoformat(),
        'requests_processed': request_count
    })

@app.route('/api/test', methods=['GET', 'POST'])
def test_endpoint():
    """Test endpoint for connectivity verification"""
    logging.info("🧪 Test endpoint accessed")
    
    response_data = {
        'status': 'success',
        'message': 'ESP32 Debug Service is responding',
        'method': request.method,
        'timestamp': datetime.datetime.now().isoformat(),
        'server_info': {
            'python_version': '3.x',
            'flask_version': '2.x',
            'request_count': request_count
        }
    }
    
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            response_data['received_data'] = data
            logging.info(f"📝 POST data received: {data}")
        else:
            response_data['received_data'] = 'No JSON data'
    
    return jsonify(response_data)

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    """Face recognition endpoint - Debug version"""
    global successful_recognitions, failed_recognitions
    
    logging.info("🔍 === FACE RECOGNITION REQUEST RECEIVED ===")
    
    try:
        # Validate request format
        if not request.is_json:
            logging.error("❌ Request is not JSON")
            failed_recognitions += 1
            return jsonify({
                'success': False,
                'error': 'Request must be JSON',
                'debug_info': {
                    'content_type': request.content_type,
                    'has_data': bool(request.data)
                }
            }), 400
        
        data = request.get_json()
        if not data:
            logging.error("❌ No JSON data received")
            failed_recognitions += 1
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        # Log received fields
        logging.info(f"📝 Received fields: {list(data.keys())}")
        
        # Validate required fields
        required_fields = ['deviceId', 'imageData']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            logging.error(f"❌ Missing required fields: {missing_fields}")
            failed_recognitions += 1
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'missing_fields': missing_fields,
                'received_fields': list(data.keys())
            }), 400
        
        device_id = data.get('deviceId')
        image_data = data.get('imageData')
        class_id = data.get('classId', 'unknown')
        timestamp = data.get('timestamp', 'unknown')
        location = data.get('location', 'unknown')
        
        logging.info(f"🏷️ Device ID: {device_id}")
        logging.info(f"🎓 Class ID: {class_id}")
        logging.info(f"⏰ Timestamp: {timestamp}")
        logging.info(f"📍 Location: {location}")
        
        # Validate image data
        if not image_data:
            logging.error("❌ No image data provided")
            failed_recognitions += 1
            return jsonify({
                'success': False,
                'error': 'No image data provided'
            }), 400
        
        # Process image data
        logging.info(f"🖼️ Image data length: {len(image_data)} characters")
        
        if image_data.startswith('data:image/'):
            # Extract base64 data from data URL
            try:
                header, base64_data = image_data.split(',', 1)
                logging.info(f"📄 Image header: {header}")
                logging.info(f"📊 Base64 data length: {len(base64_data)} characters")
            except ValueError:
                logging.error("❌ Invalid data URL format")
                failed_recognitions += 1
                return jsonify({
                    'success': False,
                    'error': 'Invalid image data URL format'
                }), 400
        else:
            # Assume it's raw base64
            base64_data = image_data
            logging.info(f"📊 Raw base64 data length: {len(base64_data)} characters")
        
        # Validate and decode base64
        try:
            image_bytes = base64.b64decode(base64_data)
            logging.info(f"🔄 Decoded image size: {len(image_bytes)} bytes")
        except Exception as e:
            logging.error(f"❌ Base64 decode error: {e}")
            failed_recognitions += 1
            return jsonify({
                'success': False,
                'error': 'Invalid base64 image data',
                'details': str(e)
            }), 400
        
        # Validate image format
        try:
            image = Image.open(io.BytesIO(image_bytes))
            logging.info(f"🖼️ Image format: {image.format}")
            logging.info(f"📏 Image size: {image.size}")
            logging.info(f"🎨 Image mode: {image.mode}")
        except Exception as e:
            logging.error(f"❌ Image validation error: {e}")
            failed_recognitions += 1
            return jsonify({
                'success': False,
                'error': 'Invalid image format',
                'details': str(e)
            }), 400
        
        # Save image for debugging (optional)
        try:
            debug_dir = 'debug_images'
            os.makedirs(debug_dir, exist_ok=True)
            
            timestamp_str = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{debug_dir}/esp32_capture_{device_id}_{timestamp_str}.jpg"
            
            with open(filename, 'wb') as f:
                f.write(image_bytes)
            
            logging.info(f"💾 Debug image saved: {filename}")
        except Exception as e:
            logging.warning(f"⚠️ Could not save debug image: {e}")
        
        # Simulate face recognition processing
        logging.info("🔍 Simulating face recognition processing...")
        time.sleep(0.5)  # Simulate processing time
        
        # For debug purposes, randomly succeed or return "not recognized"
        import random
        if random.random() > 0.3:  # 70% success rate for testing
            # Simulate successful recognition
            successful_recognitions += 1
            logging.info("✅ Face recognition successful (simulated)")
            
            response_data = {
                'success': True,
                'recognized': True,
                'student': {
                    'id': 'DEBUG_STUDENT_001',
                    'name': 'Debug Test Student',
                    'email': 'debug@example.com'
                },
                'confidence': round(random.uniform(0.85, 0.99), 2),
                'attendance': {
                    'marked': True,
                    'timestamp': datetime.datetime.now().isoformat(),
                    'class_id': class_id,
                    'device_id': device_id,
                    'location': location
                },
                'debug_info': {
                    'processing_time_ms': 500,
                    'image_size_bytes': len(image_bytes),
                    'image_dimensions': f"{image.size[0]}x{image.size[1]}",
                    'request_count': request_count
                }
            }
            
            logging.info(f"🎉 Returning success response: {response_data['student']['name']}")
            return jsonify(response_data)
            
        else:
            # Simulate face not recognized
            failed_recognitions += 1
            logging.info("🔍 Face not recognized (simulated)")
            
            response_data = {
                'success': False,
                'recognized': False,
                'message': 'Face not recognized',
                'debug_info': {
                    'processing_time_ms': 500,
                    'image_size_bytes': len(image_bytes),
                    'image_dimensions': f"{image.size[0]}x{image.size[1]}",
                    'request_count': request_count
                }
            }
            
            logging.info("🚫 Returning 'not recognized' response")
            return jsonify(response_data), 404
    
    except Exception as e:
        logging.error(f"💥 Unexpected error in face recognition: {e}")
        logging.error(f"📍 Error type: {type(e).__name__}")
        
        import traceback
        logging.error(f"📚 Traceback: {traceback.format_exc()}")
        
        failed_recognitions += 1
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'details': str(e),
            'type': type(e).__name__
        }), 500

@app.route('/debug/stats', methods=['GET'])
def debug_stats():
    """Detailed statistics for debugging"""
    logging.info("📊 Debug statistics requested")
    
    uptime = time.time() - start_time
    
    stats = {
        'service_info': {
            'name': 'ESP32 Face Recognition Debug Service',
            'version': '1.0',
            'start_time': datetime.datetime.fromtimestamp(start_time).isoformat(),
            'uptime_seconds': round(uptime, 2),
            'uptime_human': f"{int(uptime // 3600):02d}:{int((uptime % 3600) // 60):02d}:{int(uptime % 60):02d}"
        },
        'request_statistics': {
            'total_requests': request_count,
            'successful_recognitions': successful_recognitions,
            'failed_recognitions': failed_recognitions,
            'success_rate': round((successful_recognitions / max(1, successful_recognitions + failed_recognitions)) * 100, 2),
            'requests_per_minute': round(request_count / max(1, uptime / 60), 2)
        },
        'system_info': {
            'timestamp': datetime.datetime.now().isoformat(),
            'log_file': 'debug_face_recognition.log'
        },
        'endpoints_hit': {
            'last_health_check': 'N/A',
            'last_face_recognition': 'N/A'
        }
    }
    
    return jsonify(stats)

@app.errorhandler(404)
def not_found(error):
    logging.warning(f"🔍 404 Not Found: {request.path}")
    return jsonify({
        'error': 'Endpoint not found',
        'path': request.path,
        'available_endpoints': [
            '/',
            '/health',
            '/api/test',
            '/api/face/recognize',
            '/debug/stats'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    logging.error(f"💥 500 Internal Server Error: {error}")
    return jsonify({
        'error': 'Internal server error',
        'details': str(error)
    }), 500

if __name__ == '__main__':
    logging.info("🚀 Starting ESP32 Face Recognition Debug Service")
    logging.info("📍 Service will be available at:")
    logging.info("   - http://127.0.0.1:8000")
    logging.info("   - http://192.168.8.110:8000")
    logging.info("🔧 Debug features enabled:")
    logging.info("   - Comprehensive request/response logging")
    logging.info("   - Image validation and saving")
    logging.info("   - Detailed error analysis")
    logging.info("   - Statistics tracking")
    logging.info("="*60)
    
    # Run on all interfaces to accept connections from ESP32
    app.run(
        host='0.0.0.0',  # Accept connections from any IP
        port=8000,
        debug=True,
        threaded=True
    )
