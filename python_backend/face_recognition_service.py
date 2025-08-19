import cv2
import numpy as np
import face_recognition
import os
import pickle
from datetime import datetime

class FaceRecognitionService:
    def __init__(self, encodings_path="face_encodings.pkl"):
        self.encodings_path = encodings_path
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_encodings()
    
    def load_encodings(self):
        """Load face encodings from file"""
        if os.path.exists(self.encodings_path):
            try:
                with open(self.encodings_path, 'rb') as f:
                    data = pickle.load(f)
                    self.known_face_encodings = data['encodings']
                    self.known_face_names = data['names']
                print(f"Loaded {len(self.known_face_encodings)} face encodings")
            except Exception as e:
                print(f"Error loading encodings: {e}")
                self.known_face_encodings = []
                self.known_face_names = []
        else:
            print("No existing face encodings found, starting fresh")
    
    def save_encodings(self):
        """Save face encodings to file"""
        try:
            data = {
                'encodings': self.known_face_encodings,
                'names': self.known_face_names
            }
            with open(self.encodings_path, 'wb') as f:
                pickle.dump(data, f)
            print(f"Saved {len(self.known_face_encodings)} face encodings")
        except Exception as e:
            print(f"Error saving encodings: {e}")
    
    def enroll_face(self, image, student_id):
        """Enroll a new face for a student"""
        try:
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Find face locations
            face_locations = face_recognition.face_locations(rgb_image)
            
            if len(face_locations) == 0:
                print("No face found in the image")
                return False, None
            
            if len(face_locations) > 1:
                print("Multiple faces found, please use an image with only one face")
                return False, None
            
            # Get face encoding
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            
            if len(face_encodings) == 0:
                print("Could not encode face")
                return False, None
            
            face_encoding = face_encodings[0]
            
            # Check if student already enrolled
            if student_id in self.known_face_names:
                # Update existing encoding
                index = self.known_face_names.index(student_id)
                self.known_face_encodings[index] = face_encoding
                print(f"Updated face encoding for student {student_id}")
            else:
                # Add new encoding
                self.known_face_encodings.append(face_encoding)
                self.known_face_names.append(student_id)
                print(f"Added new face encoding for student {student_id}")
            
            # Save encodings
            self.save_encodings()
            
            return True, face_encoding
            
        except Exception as e:
            print(f"Error enrolling face: {e}")
            return False, None
    
    def recognize_face(self, image, tolerance=0.6):
        """Recognize a face in the image"""
        try:
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Find face locations
            face_locations = face_recognition.face_locations(rgb_image)
            
            if len(face_locations) == 0:
                print("No face found in the image")
                return None, 0.0
            
            # Get face encodings
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            
            if len(face_encodings) == 0:
                print("Could not encode face")
                return None, 0.0
            
            # Compare with known faces
            for face_encoding in face_encodings:
                if len(self.known_face_encodings) == 0:
                    print("No enrolled faces to compare against")
                    return None, 0.0
                
                # Calculate distances to all known faces
                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                best_match_index = np.argmin(face_distances)
                
                # Check if the best match is within tolerance
                if face_distances[best_match_index] <= tolerance:
                    confidence = 1.0 - face_distances[best_match_index]
                    student_id = self.known_face_names[best_match_index]
                    print(f"Recognized student {student_id} with confidence {confidence:.2f}")
                    return student_id, confidence
            
            print("No matching face found")
            return None, 0.0
            
        except Exception as e:
            print(f"Error recognizing face: {e}")
            return None, 0.0
    
    def get_face_locations(self, image):
        """Get face locations in the image"""
        try:
            # Convert BGR to RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Find face locations
            face_locations = face_recognition.face_locations(rgb_image)
            
            return face_locations
            
        except Exception as e:
            print(f"Error detecting faces: {e}")
            return []
    
    def draw_face_boxes(self, image, face_locations, names=None):
        """Draw bounding boxes around faces"""
        for i, (top, right, bottom, left) in enumerate(face_locations):
            # Draw rectangle around face
            cv2.rectangle(image, (left, top), (right, bottom), (0, 255, 0), 2)
            
            # Draw label
            if names and i < len(names):
                name = names[i]
                cv2.putText(image, name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        
        return image
    
    def delete_student_encoding(self, student_id):
        """Delete a student's face encoding"""
        if student_id in self.known_face_names:
            index = self.known_face_names.index(student_id)
            del self.known_face_encodings[index]
            del self.known_face_names[index]
            self.save_encodings()
            print(f"Deleted face encoding for student {student_id}")
            return True
        else:
            print(f"No face encoding found for student {student_id}")
            return False
    
    def get_enrolled_students(self):
        """Get list of enrolled students"""
        return self.known_face_names.copy()
    
    def get_encoding_count(self):
        """Get number of enrolled face encodings"""
        return len(self.known_face_encodings)
