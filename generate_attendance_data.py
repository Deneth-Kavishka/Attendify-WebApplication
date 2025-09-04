# Generate attendance records for PostgreSQL
import random
from datetime import datetime, timedelta

# Generate dates for the last 30 days
start_date = datetime.now() - timedelta(days=30)
dates = [start_date + timedelta(days=i) for i in range(30)]

# Class IDs and their corresponding room hardware
class_hardware_mapping = {
    'class-cs-001': ('hw-cam-001', 'hw-rfid-006'),  # Room 101
    'class-cs-002': ('hw-cam-002', 'hw-rfid-007'),  # Room 102
    'class-cs-003': ('hw-cam-003', 'hw-rfid-008'),  # Room 103
    'class-cs-004': ('hw-cam-004', 'hw-rfid-009'),  # Room 104
    'class-cs-005': ('hw-cam-005', 'hw-rfid-010'),  # Room 105
    'class-cs-006': ('hw-cam-006', 'hw-rfid-011'),  # Room 106
    'class-cs-007': ('hw-cam-007', 'hw-rfid-012'),  # Room 107
    'class-cs-008': ('hw-cam-008', 'hw-rfid-013'),  # Room 108
    'class-cs-009': ('hw-cam-009', 'hw-rfid-014'),  # Room 109
    'class-cs-010': ('hw-cam-010', 'hw-rfid-015'),  # Room 110
    'class-it-001': ('hw-cam-011', 'hw-rfid-016'),  # Room 201
    'class-it-002': ('hw-cam-012', 'hw-rfid-017'),  # Room 202
    'class-it-003': ('hw-cam-013', 'hw-rfid-018'),  # Room 203
    'class-it-004': ('hw-cam-014', 'hw-rfid-019'),  # Room 204
    'class-it-005': ('hw-cam-015', 'hw-rfid-020'),  # Room 205
    'class-se-001': ('hw-cam-016', 'hw-rfid-021'),  # Room 301
    'class-se-002': ('hw-cam-017', 'hw-rfid-022'),  # Room 302
    'class-se-003': ('hw-cam-018', 'hw-rfid-023'),  # Room 303
    'class-se-004': ('hw-cam-019', 'hw-rfid-024'),  # Room 304
    'class-se-005': ('hw-cam-020', 'hw-rfid-025'),  # Room 305
    'class-ds-001': ('hw-cam-021', 'hw-rfid-026'),  # Room 401
    'class-ds-002': ('hw-cam-022', 'hw-rfid-027'),  # Room 402
    'class-ds-003': ('hw-cam-023', 'hw-rfid-028'),  # Room 403
    'class-ds-004': ('hw-cam-024', 'hw-rfid-029'),  # Room 404
    'class-ds-005': ('hw-cam-025', 'hw-rfid-030'),  # Room 405
}

# Student department mappings
departments = {
    'cs': list(range(1, 151)),  # CS students 001-150
    'in': list(range(1, 151)),  # IT students 001-150  
    'so': list(range(1, 126)),  # SE students 001-125
    'da': list(range(1, 76)),   # DS students 001-75
}

with open('sample-data-part4.sql', 'w') as f:
    f.write('-- Sample Data Part 4: Attendance Records\n')
    f.write('-- This script continues from previous parts and generates attendance records\n\n')
    f.write('-- ===========================================\n')
    f.write('-- ATTENDANCE RECORDS TABLE - Sample Records\n')
    f.write('-- ===========================================\n\n')
    f.write('INSERT INTO attendance_records (id, student_id, class_id, attendance_date, method, status, hardware_id, confidence, created_at) VALUES\n')
    
    attendance_values = []
    record_id = 1
    
    # Generate attendance for each class
    for class_id, hardware in class_hardware_mapping.items():
        cam_hardware, rfid_hardware = hardware
        
        # Determine which department students attend this class
        if class_id.startswith('class-cs'):
            dept_students = departments['cs']
            dept_code = 'cs'
        elif class_id.startswith('class-it'):
            dept_students = departments['in'] 
            dept_code = 'in'
        elif class_id.startswith('class-se'):
            dept_students = departments['so']
            dept_code = 'so'
        elif class_id.startswith('class-ds'):
            dept_students = departments['da']
            dept_code = 'da'
        else:
            continue
            
        # Generate attendance for random dates (3-4 times per week for 30 days)
        class_dates = random.sample(dates, min(15, len(dates)))  # 15 random days
        
        for attendance_date in class_dates:
            # Random subset of students attend each class (70-90% attendance)
            attending_students = random.sample(dept_students, int(len(dept_students) * random.uniform(0.7, 0.9)))
            
            for student_num in attending_students:
                student_id = f'student-profile-{dept_code}-{student_num:03d}'
                
                # Random method (60% face recognition, 40% RFID)
                if random.random() < 0.6:
                    method = 'face_recognition'
                    hardware_id = cam_hardware
                    confidence = f'{random.uniform(0.75, 0.98):.2f}'
                else:
                    method = 'rfid'
                    hardware_id = rfid_hardware
                    confidence = 'null'
                
                # 95% present, 5% late/absent
                status_rand = random.random()
                if status_rand < 0.95:
                    status = 'present'
                elif status_rand < 0.98:
                    status = 'late'
                else:
                    status = 'absent'
                
                # Format date
                date_str = attendance_date.strftime('%Y-%m-%d')
                
                record_uuid = f'attendance-{record_id:06d}'
                
                if confidence == 'null':
                    value = f"('{record_uuid}', '{student_id}', '{class_id}', '{date_str}', '{method}', '{status}', '{hardware_id}', null, NOW())"
                else:
                    value = f"('{record_uuid}', '{student_id}', '{class_id}', '{date_str}', '{method}', '{status}', '{hardware_id}', '{confidence}', NOW())"
                    
                attendance_values.append(value)
                record_id += 1
    
    # Write all attendance values
    for i, value in enumerate(attendance_values):
        if i == len(attendance_values) - 1:
            f.write(value + ';\n\n')
        else:
            f.write(value + ',\n')
    
    # Add completion message
    f.write('-- ===========================================\n')
    f.write('-- SAMPLE DATA COMPLETE\n')
    f.write('-- ===========================================\n\n')
    f.write('-- Summary:\n')
    f.write('-- - 500+ students across 4 departments\n')
    f.write('-- - 55+ lecturers with profiles\n')
    f.write(f'-- - {len(class_hardware_mapping)} classes with schedules\n')
    f.write('-- - 55+ hardware devices (ESP32-CAM + RFID readers)\n')
    f.write(f'-- - {len(attendance_values)} attendance records over 30 days\n')
    f.write('-- \n')
    f.write('-- To load this data:\n')
    f.write('-- 1. Run sample-data-part1.sql (users, lecturers)\n')
    f.write('-- 2. Run sample-data-part2.sql (students)\n')
    f.write('-- 3. Run sample-data-part3.sql (classes, hardware)\n')
    f.write('-- 4. Run sample-data-part4.sql (attendance records)\n')

print(f'Generated {len(attendance_values)} attendance records!')
print('Sample data generation complete!')
