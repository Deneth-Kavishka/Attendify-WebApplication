#!/usr/bin/env python3
"""
Test Flask server for ESP32 face recognition without face recognition dependencies
Only tests the communication flow
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import json
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logger.info("Health check requested")
    return jsonify({
        'status': 'ok',
        'service': 'ESP32 Test Server',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    """Test face recognition endpoint without actual face recognition"""
    try:
        logger.info("Face recognition request received")
        
        # Get request data
        data = request.get_json()
        if not data:
            logger.error("No JSON data received")
            return jsonify({'error': 'No data provided'}), 400
        
        # Log request details
        logger.info(f"Request data keys: {list(data.keys())}")
        
        # Check for required fields
        if 'image' not in data:
            logger.error("No image data in request")
            return jsonify({'error': 'No image data provided'}), 400
        
        image_data = data['image']
        logger.info(f"Image data length: {len(image_data)} characters")
        
        # Validate base64 format
        try:
            # Remove data URL prefix if present
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            # Try to decode base64
            img_bytes = base64.b64decode(image_data)
            logger.info(f"Successfully decoded base64 image: {len(img_bytes)} bytes")
            
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {str(e)}")
            return jsonify({'error': 'Invalid image format'}), 400
        
        # Simulate face recognition result
        # For testing, we'll randomly return success or unknown
        import random
        
        if random.choice([True, False]):
            # Simulate recognized student
            result = {
                'success': True,
                'student_id': 'STUDENT_001',
                'student_name': 'Test Student',
                'confidence': 0.95,
                'timestamp': datetime.now().isoformat()
            }
            logger.info(f"Simulated recognition: {result['student_name']}")
        else:
            # Simulate unknown person
            result = {
                'success': False,
                'student_id': None,
                'student_name': 'Unknown',
                'confidence': 0.0,
                'timestamp': datetime.now().isoformat()
            }
            logger.info("Simulated unknown person")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in face recognition: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/api/test', methods=['POST'])
def test_endpoint():
    """Simple test endpoint for debugging"""
    logger.info("Test endpoint called")
    data = request.get_json() or {}
    
    return jsonify({
        'message': 'Test endpoint working',
        'received_data': data,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    logger.info("Starting ESP32 Test Server...")
    logger.info("Server will be available at http://localhost:8000")
    logger.info("Endpoints:")
    logger.info("  GET  /health - Health check")
    logger.info("  POST /api/face/recognize - Face recognition test")
    logger.info("  POST /api/test - Simple test endpoint")
    
    app.run(host='0.0.0.0', port=8000, debug=True)
