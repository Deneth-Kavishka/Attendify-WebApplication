from firebase_admin import firestore
from datetime import datetime
import json

class FirebaseService:
    def __init__(self, db):
        self.db = db
    
    def store_face_encoding(self, student_id, face_encoding):
        """Store face encoding in Firebase"""
        try:
            doc_ref = self.db.collection('face_encodings').document(student_id)
            doc_ref.set({
                'student_id': student_id,
                'encoding': face_encoding,
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            })
            print(f"Stored face encoding for student {student_id}")
            return True
        except Exception as e:
            print(f"Error storing face encoding: {e}")
            return False
    
    def get_face_encoding(self, student_id):
        """Get face encoding from Firebase"""
        try:
            doc_ref = self.db.collection('face_encodings').document(student_id)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                return data.get('encoding')
            return None
        except Exception as e:
            print(f"Error getting face encoding: {e}")
            return None
    
    def get_all_face_encodings(self):
        """Get all face encodings from Firebase"""
        try:
            docs = self.db.collection('face_encodings').stream()
            encodings = {}
            for doc in docs:
                data = doc.to_dict()
                encodings[data['student_id']] = data['encoding']
            return encodings
        except Exception as e:
            print(f"Error getting all face encodings: {e}")
            return {}
    
    def delete_face_encoding(self, student_id):
        """Delete face encoding from Firebase"""
        try:
            doc_ref = self.db.collection('face_encodings').document(student_id)
            doc_ref.delete()
            print(f"Deleted face encoding for student {student_id}")
            return True
        except Exception as e:
            print(f"Error deleting face encoding: {e}")
            return False
    
    def add_attendance_record(self, record_data):
        """Add attendance record to Firebase for real-time updates"""
        try:
            doc_ref = self.db.collection('attendance_records').add({
                'student_id': record_data['student_id'],
                'class_id': record_data['class_id'],
                'method': record_data['method'],
                'confidence': record_data.get('confidence'),
                'timestamp': record_data['timestamp'],
                'device_id': record_data['device_id'],
                'status': 'present',
                'created_at': datetime.now()
            })
            print(f"Added attendance record to Firebase")
            return True
        except Exception as e:
            print(f"Error adding attendance record: {e}")
            return False
    
    def update_hardware_status(self, device_id, status_data):
        """Update hardware device status in Firebase"""
        try:
            doc_ref = self.db.collection('hardware_devices').document(device_id)
            doc_ref.set({
                'device_id': device_id,
                'status': status_data['status'],
                'last_heartbeat': status_data['last_heartbeat'],
                'device_type': status_data['device_type'],
                'location': status_data['location'],
                'updated_at': datetime.now()
            }, merge=True)
            print(f"Updated hardware status for device {device_id}")
            return True
        except Exception as e:
            print(f"Error updating hardware status: {e}")
            return False
    
    def get_hardware_devices(self):
        """Get all hardware devices from Firebase"""
        try:
            docs = self.db.collection('hardware_devices').stream()
            devices = []
            for doc in docs:
                data = doc.to_dict()
                devices.append(data)
            return devices
        except Exception as e:
            print(f"Error getting hardware devices: {e}")
            return []
    
    def add_system_log(self, log_type, message, details=None):
        """Add system log to Firebase"""
        try:
            doc_ref = self.db.collection('system_logs').add({
                'type': log_type,
                'message': message,
                'details': details or {},
                'timestamp': datetime.now()
            })
            return True
        except Exception as e:
            print(f"Error adding system log: {e}")
            return False
    
    def get_attendance_stats(self, date_from=None, date_to=None):
        """Get attendance statistics from Firebase"""
        try:
            query = self.db.collection('attendance_records')
            
            if date_from:
                query = query.where('timestamp', '>=', date_from)
            if date_to:
                query = query.where('timestamp', '<=', date_to)
            
            docs = query.stream()
            
            stats = {
                'total_records': 0,
                'face_recognition': 0,
                'rfid': 0,
                'by_class': {},
                'by_student': {}
            }
            
            for doc in docs:
                data = doc.to_dict()
                stats['total_records'] += 1
                
                if data['method'] == 'face_recognition':
                    stats['face_recognition'] += 1
                else:
                    stats['rfid'] += 1
                
                # Group by class
                class_id = data['class_id']
                if class_id not in stats['by_class']:
                    stats['by_class'][class_id] = 0
                stats['by_class'][class_id] += 1
                
                # Group by student
                student_id = data['student_id']
                if student_id not in stats['by_student']:
                    stats['by_student'][student_id] = 0
                stats['by_student'][student_id] += 1
            
            return stats
        except Exception as e:
            print(f"Error getting attendance stats: {e}")
            return {}
    
    def sync_student_data(self, student_data):
        """Sync student data with Firebase"""
        try:
            doc_ref = self.db.collection('students').document(student_data['id'])
            doc_ref.set({
                'student_id': student_data['student_id'],
                'user_id': student_data['user_id'],
                'rfid_card': student_data.get('rfid_card'),
                'enrollment_year': student_data['enrollment_year'],
                'active': student_data.get('active', True),
                'synced_at': datetime.now()
            }, merge=True)
            return True
        except Exception as e:
            print(f"Error syncing student data: {e}")
            return False
    
    def sync_class_data(self, class_data):
        """Sync class data with Firebase"""
        try:
            doc_ref = self.db.collection('classes').document(class_data['id'])
            doc_ref.set({
                'class_code': class_data['class_code'],
                'class_name': class_data['class_name'],
                'lecturer_id': class_data['lecturer_id'],
                'room': class_data['room'],
                'schedule': class_data.get('schedule'),
                'semester': class_data['semester'],
                'academic_year': class_data['academic_year'],
                'active': class_data.get('active', True),
                'synced_at': datetime.now()
            }, merge=True)
            return True
        except Exception as e:
            print(f"Error syncing class data: {e}")
            return False
    
    def backup_attendance_data(self):
        """Backup attendance data to Firebase Storage"""
        try:
            # Get all attendance records
            docs = self.db.collection('attendance_records').stream()
            backup_data = []
            
            for doc in docs:
                data = doc.to_dict()
                # Convert timestamp to string for JSON serialization
                if 'timestamp' in data:
                    data['timestamp'] = data['timestamp'].isoformat()
                if 'created_at' in data:
                    data['created_at'] = data['created_at'].isoformat()
                backup_data.append(data)
            
            # Store backup
            backup_ref = self.db.collection('backups').document(f"attendance_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            backup_ref.set({
                'type': 'attendance_backup',
                'data': backup_data,
                'created_at': datetime.now(),
                'record_count': len(backup_data)
            })
            
            print(f"Backed up {len(backup_data)} attendance records")
            return True
        except Exception as e:
            print(f"Error backing up attendance data: {e}")
            return False
    
    def get_real_time_feed(self, limit=50):
        """Get real-time attendance feed"""
        try:
            docs = self.db.collection('attendance_records')\
                          .order_by('timestamp', direction=firestore.Query.DESCENDING)\
                          .limit(limit)\
                          .stream()
            
            feed = []
            for doc in docs:
                data = doc.to_dict()
                feed.append(data)
            
            return feed
        except Exception as e:
            print(f"Error getting real-time feed: {e}")
            return []
