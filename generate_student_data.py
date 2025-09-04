# Generate 500 student users for PostgreSQL
departments = ['Computer Science', 'Information Technology', 'Software Engineering', 'Data Science']
student_counts = [150, 150, 125, 75]

with open('sample-data-part2.sql', 'w') as f:
    f.write('-- Student Users and Profiles (500+ students)\n')
    f.write('-- This script continues from sample-data-part1.sql\n\n')
    f.write('-- ===========================================\n')
    f.write('-- STUDENT USERS (500 students across 4 departments)\n')
    f.write('-- ===========================================\n\n')
    
    # Generate student users
    f.write('INSERT INTO users (id, username, password, email, full_name, role, department, created_at) VALUES\n')
    
    student_id = 1
    values = []
    
    for dept_idx, dept in enumerate(departments):
        count = student_counts[dept_idx]
        dept_short = dept.replace(' ', '').lower()[:2]
        
        for i in range(1, count + 1):
            user_id = f'stu-{dept_short}-{i:03d}'
            username = f'student.{dept_short}.{i:03d}'
            email = f'student.{dept_short}.{i:03d}@attendify.com'
            full_name = f'Student {dept_short.upper()}{i:03d} Name'
            
            value = f"('{user_id}', '{username}', 'student123', '{email}', '{full_name}', 'student', '{dept}', NOW())"
            values.append(value)
            student_id += 1
    
    # Write all values
    for i, value in enumerate(values):
        if i == len(values) - 1:
            f.write(value + ';\n\n')
        else:
            f.write(value + ',\n')
    
    # Generate student profiles
    f.write('-- ===========================================\n')
    f.write('-- STUDENTS TABLE - Student Profiles\n')
    f.write('-- ===========================================\n\n')
    f.write('INSERT INTO students (id, user_id, student_id, enrollment_year, rfid_card, active, nic, mobile_number, gender, date_of_birth, address, guardian_name, guardian_contact, emergency_contact, batch, semester, gpa, face_registration_status, created_at) VALUES\n')
    
    profile_values = []
    student_id = 1
    
    for dept_idx, dept in enumerate(departments):
        count = student_counts[dept_idx]
        dept_short = dept.replace(' ', '').lower()[:2]
        
        for i in range(1, count + 1):
            profile_id = f'student-profile-{dept_short}-{i:03d}'
            user_id = f'stu-{dept_short}-{i:03d}'
            student_code = f'{dept_short.upper()}{2024}{i:03d}'
            rfid_card = f'RFID{dept_short.upper()}{i:06d}'
            nic = f'{1990 + (i % 30)}{(i % 12) + 1:02d}{(i % 28) + 1:02d}V'
            mobile = f'077{i:07d}'
            gender = 'Male' if i % 2 == 0 else 'Female'
            birth_year = 1998 + (i % 6)
            birth_month = (i % 12) + 1
            birth_day = (i % 28) + 1
            date_of_birth = f'{birth_year}-{birth_month:02d}-{birth_day:02d}'
            address = f'{i} Main Street, City {(i % 10) + 1}, Province'
            guardian_name = f'Guardian Name {i}'
            guardian_contact = f'071{i:07d}'
            emergency_contact = f'070{i:07d}'
            batch = f'Batch {2024 + (i % 4)}'
            semester = f'Semester {(i % 8) + 1}'
            gpa = f'{2.5 + (i % 20) * 0.1:.2f}'
            face_status = 'registered' if i % 3 == 0 else 'pending'
            
            value = f"('{profile_id}', '{user_id}', '{student_code}', {2024 + (i % 4)}, '{rfid_card}', true, '{nic}', '{mobile}', '{gender}', '{date_of_birth}', '{address}', '{guardian_name}', '{guardian_contact}', '{emergency_contact}', '{batch}', '{semester}', '{gpa}', '{face_status}', NOW())"
            profile_values.append(value)
            student_id += 1
    
    # Write all profile values
    for i, value in enumerate(profile_values):
        if i == len(profile_values) - 1:
            f.write(value + ';\n\n')
        else:
            f.write(value + ',\n')

print('Generated 500 student users and profiles!')
