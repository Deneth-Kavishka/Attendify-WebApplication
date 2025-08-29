from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore
import face_recognition
import os
from datetime import datetime
import requests
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

# Initialize Firebase
cred = credentials.Certificate(os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY', 'firebase-service-account.json'))
firebase_admin.initialize_app(cred)
db = firestore.client()

# Face recognition service
from face_recognition_service import FaceRecognitionService
from firebase_service import FirebaseService

face_service = FaceRecognitionService()
firebase_service = FirebaseService(db)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/face/enroll', methods=['POST'])
def enroll_face():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        image_data = data.get('image')
        
        if not student_id or not image_data:
            return jsonify({"error": "Missing student_id or image"}), 400
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Enroll face
        success, face_encoding = face_service.enroll_face(image_bgr, student_id)
        
        if success:
            # Store in Firebase
            firebase_service.store_face_encoding(student_id, face_encoding.tolist())
            
            # Update student record in main database
            requests.post(f'http://localhost:5000/api/face-recognition/enroll', 
                         json={
                             'studentId': student_id,
                             'faceEmbedding': face_encoding.tolist()
                         })
            
            return jsonify({"message": "Face enrolled successfully"})
        else:
            return jsonify({"error": "Face enrollment failed"}), 400
            
    except Exception as e:
        print(f"Face enrollment error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/face/enroll-multiple', methods=['POST'])
def enroll_multiple_faces():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        images_data = data.get('images', [])
        
        if not student_id or not images_data:
            return jsonify({"error": "Missing student_id or images"}), 400
        
        if len(images_data) < 10:
            return jsonify({"error": "Minimum 10 images required for face training"}), 400
        
        processed_images = []
        for img_info in images_data:
            try:
                image_data = img_info.get('data')
                if not image_data:
                    continue
                    
                # Decode base64 image
                image_bytes = base64.b64decode(image_data.split(',')[1])
                image = Image.open(io.BytesIO(image_bytes))
                image_array = np.array(image)
                
                # Convert RGB to BGR for OpenCV
                image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
                processed_images.append(image_bgr)
                
            except Exception as e:
                print(f"Error processing image {img_info.get('name', 'unknown')}: {e}")
                continue
        
        if len(processed_images) < 10:
            return jsonify({"error": f"Could only process {len(processed_images)} images, minimum 10 required"}), 400
        
        # Enroll multiple faces
        success, encodings_count = face_service.enroll_multiple_faces(processed_images, student_id)
        
        if success:
            # Update student record in main database
            requests.post(f'http://localhost:5000/api/face-recognition/enroll-multiple', 
                         json={
                             'studentId': student_id,
                             'encodingsCount': encodings_count,
                             'status': 'completed'
                         })
            
            return jsonify({
                "message": f"Face training completed successfully with {encodings_count} encodings",
                "encodings_count": encodings_count,
                "images_processed": len(processed_images)
            })
        else:
            return jsonify({"error": "Face training failed - could not process any images"}), 400
            
    except Exception as e:
        print(f"Multiple face enrollment error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    try:
        data = request.get_json()
        image_data = data.get('image')
        device_id = data.get('device_id', 'ESP32_CAM_001')
        class_id = data.get('class_id')
        
        if not image_data or not class_id:
            return jsonify({"error": "Missing image or class_id"}), 400
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Recognize face
        student_id, confidence = face_service.recognize_face(image_bgr)
        
        if student_id and confidence > 0.85:
            # Mark attendance in main database
            response = requests.post('http://localhost:5000/api/face-recognition/recognize', 
                                   json={
                                       'faceEmbedding': 'matched',
                                       'deviceId': device_id,
                                       'classId': class_id,
                                       'confidence': confidence
                                   })
            
            # Store in Firebase for real-time updates
            firebase_service.add_attendance_record({
                'student_id': student_id,
                'class_id': class_id,
                'method': 'face_recognition',
                'confidence': confidence,
                'timestamp': datetime.now(),
                'device_id': device_id
            })
            
            return jsonify({
                "message": "Face recognized successfully",
                "student_id": student_id,
                "confidence": confidence
            })
        else:
            return jsonify({"error": "Face not recognized"}), 404
            
    except Exception as e:
        print(f"Face recognition error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/face/detect', methods=['POST'])
def detect_face():
    """Detect if there's a face in the image"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({"error": "Missing image"}), 400
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV
        image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        # Detect faces
        face_locations = face_recognition.face_locations(image_array)
        
        return jsonify({
            "faces_detected": len(face_locations),
            "face_locations": face_locations
        })
        
    except Exception as e:
        print(f"Face detection error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/hardware/heartbeat', methods=['POST'])
def hardware_heartbeat():
    """Receive heartbeat from hardware devices"""
    try:
        data = request.get_json()
        device_id = data.get('device_id')
        device_type = data.get('device_type', 'esp32_cam')
        location = data.get('location', 'Unknown')
        
        if not device_id:
            return jsonify({"error": "Missing device_id"}), 400
        
        # Update Firebase with hardware status
        firebase_service.update_hardware_status(device_id, {
            'status': 'online',
            'last_heartbeat': datetime.now(),
            'device_type': device_type,
            'location': location
        })
        
        # Forward to main backend
        requests.post('http://localhost:5000/api/hardware/heartbeat', 
                     json={'deviceId': device_id})
        
        return jsonify({"message": "Heartbeat received"})
        
    except Exception as e:
        print(f"Heartbeat error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    print("Starting Attendify Face Recognition Service...")
    print("Available endpoints:")
    print("- POST /api/face/enroll - Enroll a student's face")
    print("- POST /api/face/recognize - Recognize a face for attendance")
    print("- POST /api/face/detect - Detect faces in image")
    print("- POST /api/hardware/heartbeat - Hardware status update")
    
    app.run(host='0.0.0.0', port=8000, debug=True)
