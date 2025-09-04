-- Complete Sample Data Setup for Attendify PostgreSQL Database
-- Run this script after setting up the database schema
-- 
-- This script includes:
-- - 5 Admin users
-- - 55 Lecturers across 4 departments  
-- - 500 Students across 4 departments
-- - 60+ Classes with schedules
-- - 55+ Hardware devices (ESP32-CAM + RFID readers)
-- - 38,000+ Attendance records over 30 days

-- ===========================================
-- CLEAR EXISTING DATA (OPTIONAL)
-- ===========================================
-- Uncomment the following lines if you want to clear existing data
-- TRUNCATE TABLE attendance_records RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE students RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE lecturers RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE classes RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE hardware_devices RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- ===========================================
-- LOAD SAMPLE DATA
-- ===========================================

-- Step 1: Load users and lecturers
\i sample-data-part1.sql

-- Step 2: Load students  
\i sample-data-part2.sql

-- Step 3: Load classes and hardware devices
\i sample-data-part3.sql

-- Step 4: Load attendance records
\i sample-data-part4.sql

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check data counts
SELECT 'Users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'Lecturers', COUNT(*) FROM lecturers
UNION ALL  
SELECT 'Students', COUNT(*) FROM students
UNION ALL
SELECT 'Classes', COUNT(*) FROM classes
UNION ALL
SELECT 'Hardware Devices', COUNT(*) FROM hardware_devices
UNION ALL
SELECT 'Attendance Records', COUNT(*) FROM attendance_records;

-- Check department distribution
SELECT department, COUNT(*) as student_count
FROM users 
WHERE role = 'student' AND department IS NOT NULL
GROUP BY department
ORDER BY student_count DESC;

-- Check attendance summary
SELECT 
    c.class_name,
    COUNT(ar.id) as total_attendance_records,
    AVG(CASE WHEN ar.status = 'present' THEN 1.0 ELSE 0.0 END) * 100 as attendance_rate
FROM classes c
LEFT JOIN attendance_records ar ON c.id = ar.class_id
GROUP BY c.id, c.class_name
ORDER BY attendance_rate DESC
LIMIT 10;

-- Check hardware status
SELECT device_type, status, COUNT(*) as device_count
FROM hardware_devices
GROUP BY device_type, status
ORDER BY device_type, status;

-- ===========================================
-- SAMPLE DATA COMPLETE
-- ===========================================

SELECT 'Attendify sample data setup completed successfully!' as status;
