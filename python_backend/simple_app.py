from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import io
from PIL import Image
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Simple in-memory face recognition for testing
class SimpleFaceRecognition:
    def __init__(self):
        self.enrolled_faces = {}  # student_id -> face_encoding
    
    def enroll_face(self, image, student_id):
        # For demo, just store a simple hash of the image
        import hashlib
        image_hash = hashlib.md5(image.tobytes()).hexdigest()
        self.enrolled_faces[student_id] = image_hash
        return True, image_hash
    
    def recognize_face(self, image):
        # For demo, just return a mock student if any faces are enrolled
        if self.enrolled_faces:
            # Return first enrolled student with high confidence for demo
            student_id = list(self.enrolled_faces.keys())[0]
            return student_id, 0.95
        return None, 0.0

face_service = SimpleFaceRecognition()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    try:
        data = request.get_json()
        image_data = data.get('image')
        device_id = data.get('device_id', 'ESP32_CAM_001')
        class_id = data.get('class_id')
        
        print(f"Received recognition request from {device_id} for class {class_id}")
        
        if not image_data or not class_id:
            return jsonify({"error": "Missing image or class_id"}), 400
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
            image = Image.open(io.BytesIO(image_bytes))
            image_array = np.array(image)
            
            print(f"Image decoded successfully: {image_array.shape}")
            
            # Convert RGB to BGR for OpenCV if needed
            if len(image_array.shape) == 3:
                image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            else:
                image_bgr = image_array
            
        except Exception as e:
            print(f"Image decode error: {e}")
            return jsonify({"error": "Invalid image data"}), 400
        
        # For demo purposes, auto-enroll a test student if none exist
        if not face_service.enrolled_faces:
            print("No faces enrolled, auto-enrolling demo student...")
            face_service.enroll_face(image_bgr, "DEMO_STUDENT_001")
        
        # Recognize face
        student_id, confidence = face_service.recognize_face(image_bgr)
        
        print(f"Recognition result: student_id={student_id}, confidence={confidence}")
        
        if student_id and confidence > 0.8:
            return jsonify({
                "message": "Face recognized successfully",
                "student_id": student_id,
                "confidence": float(confidence)
            })
        else:
            return jsonify({"error": "Face not recognized"}), 404
            
    except Exception as e:
        print(f"Face recognition error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

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
            return jsonify({"message": "Face enrolled successfully"})
        else:
            return jsonify({"error": "Face enrollment failed"}), 400
            
    except Exception as e:
        print(f"Face enrollment error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("Python Face Recognition Service Starting...")
    print("=" * 50)
    print("Available endpoints:")
    print("- GET  /health - Health check")
    print("- POST /api/face/enroll - Enroll a student's face")
    print("- POST /api/face/recognize - Recognize a face for attendance")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=8000, debug=True)
