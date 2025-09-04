-- Attendify PostgreSQL Sample Data Script
-- Contains 500+ students, 50+ lecturers, classes, attendance records, and all required data
-- Run this script after setting up the database schema

-- Clean existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE attendance_records, students, lecturers, classes, users, hardware_devices RESTART IDENTITY CASCADE;

-- ===========================================
-- USERS TABLE - Admin, Lecturers, Students
-- ===========================================

-- Admin Users (5)
INSERT INTO users (id, username, password, email, full_name, role, department, created_at) VALUES
('admin-001', 'admin', 'admin123', 'admin@attendify.com', 'System Administrator', 'admin', 'IT Department', NOW()),
('admin-002', 'superadmin', 'super123', 'superadmin@attendify.com', 'Super Administrator', 'admin', 'IT Department', NOW()),
('admin-003', 'itadmin', 'itadmin123', 'itadmin@attendify.com', 'IT Administrator', 'admin', 'IT Department', NOW()),
('admin-004', 'dbadmin', 'dbadmin123', 'dbadmin@attendify.com', 'Database Administrator', 'admin', 'IT Department', NOW()),
('admin-005', 'sysadmin', 'sysadmin123', 'sysadmin@attendify.com', 'System Administrator', 'admin', 'IT Department', NOW());

-- Lecturer Users (55)
INSERT INTO users (id, username, password, email, full_name, role, department, created_at) VALUES
-- Computer Science Department (15)
('lec-cs-001', 'dr.sarah.johnson', 'lecturer123', 'sarah.johnson@attendify.com', 'Dr. Sarah Johnson', 'lecturer', 'Computer Science', NOW()),
('lec-cs-002', 'prof.michael.brown', 'lecturer123', 'michael.brown@attendify.com', 'Prof. Michael Brown', 'lecturer', 'Computer Science', NOW()),
('lec-cs-003', 'dr.emily.davis', 'lecturer123', 'emily.davis@attendify.com', 'Dr. Emily Davis', 'lecturer', 'Computer Science', NOW()),
('lec-cs-004', 'prof.david.wilson', 'lecturer123', 'david.wilson@attendify.com', 'Prof. David Wilson', 'lecturer', 'Computer Science', NOW()),
('lec-cs-005', 'dr.lisa.garcia', 'lecturer123', 'lisa.garcia@attendify.com', 'Dr. Lisa Garcia', 'lecturer', 'Computer Science', NOW()),
('lec-cs-006', 'prof.james.martinez', 'lecturer123', 'james.martinez@attendify.com', 'Prof. James Martinez', 'lecturer', 'Computer Science', NOW()),
('lec-cs-007', 'dr.jennifer.anderson', 'lecturer123', 'jennifer.anderson@attendify.com', 'Dr. Jennifer Anderson', 'lecturer', 'Computer Science', NOW()),
('lec-cs-008', 'prof.robert.taylor', 'lecturer123', 'robert.taylor@attendify.com', 'Prof. Robert Taylor', 'lecturer', 'Computer Science', NOW()),
('lec-cs-009', 'dr.maria.rodriguez', 'lecturer123', 'maria.rodriguez@attendify.com', 'Dr. Maria Rodriguez', 'lecturer', 'Computer Science', NOW()),
('lec-cs-010', 'prof.john.lee', 'lecturer123', 'john.lee@attendify.com', 'Prof. John Lee', 'lecturer', 'Computer Science', NOW()),
('lec-cs-011', 'dr.karen.white', 'lecturer123', 'karen.white@attendify.com', 'Dr. Karen White', 'lecturer', 'Computer Science', NOW()),
('lec-cs-012', 'prof.thomas.clark', 'lecturer123', 'thomas.clark@attendify.com', 'Prof. Thomas Clark', 'lecturer', 'Computer Science', NOW()),
('lec-cs-013', 'dr.nancy.lewis', 'lecturer123', 'nancy.lewis@attendify.com', 'Dr. Nancy Lewis', 'lecturer', 'Computer Science', NOW()),
('lec-cs-014', 'prof.mark.walker', 'lecturer123', 'mark.walker@attendify.com', 'Prof. Mark Walker', 'lecturer', 'Computer Science', NOW()),
('lec-cs-015', 'dr.susan.hall', 'lecturer123', 'susan.hall@attendify.com', 'Dr. Susan Hall', 'lecturer', 'Computer Science', NOW()),

-- Information Technology Department (15)
('lec-it-001', 'dr.alex.thompson', 'lecturer123', 'alex.thompson@attendify.com', 'Dr. Alex Thompson', 'lecturer', 'Information Technology', NOW()),
('lec-it-002', 'prof.rachel.young', 'lecturer123', 'rachel.young@attendify.com', 'Prof. Rachel Young', 'lecturer', 'Information Technology', NOW()),
('lec-it-003', 'dr.kevin.king', 'lecturer123', 'kevin.king@attendify.com', 'Dr. Kevin King', 'lecturer', 'Information Technology', NOW()),
('lec-it-004', 'prof.amanda.wright', 'lecturer123', 'amanda.wright@attendify.com', 'Prof. Amanda Wright', 'lecturer', 'Information Technology', NOW()),
('lec-it-005', 'dr.brian.lopez', 'lecturer123', 'brian.lopez@attendify.com', 'Dr. Brian Lopez', 'lecturer', 'Information Technology', NOW()),
('lec-it-006', 'prof.stephanie.hill', 'lecturer123', 'stephanie.hill@attendify.com', 'Prof. Stephanie Hill', 'lecturer', 'Information Technology', NOW()),
('lec-it-007', 'dr.daniel.scott', 'lecturer123', 'daniel.scott@attendify.com', 'Dr. Daniel Scott', 'lecturer', 'Information Technology', NOW()),
('lec-it-008', 'prof.michelle.green', 'lecturer123', 'michelle.green@attendify.com', 'Prof. Michelle Green', 'lecturer', 'Information Technology', NOW()),
('lec-it-009', 'dr.christopher.adams', 'lecturer123', 'christopher.adams@attendify.com', 'Dr. Christopher Adams', 'lecturer', 'Information Technology', NOW()),
('lec-it-010', 'prof.laura.baker', 'lecturer123', 'laura.baker@attendify.com', 'Prof. Laura Baker', 'lecturer', 'Information Technology', NOW()),
('lec-it-011', 'dr.joshua.gonzalez', 'lecturer123', 'joshua.gonzalez@attendify.com', 'Dr. Joshua Gonzalez', 'lecturer', 'Information Technology', NOW()),
('lec-it-012', 'prof.kimberly.nelson', 'lecturer123', 'kimberly.nelson@attendify.com', 'Prof. Kimberly Nelson', 'lecturer', 'Information Technology', NOW()),
('lec-it-013', 'dr.andrew.carter', 'lecturer123', 'andrew.carter@attendify.com', 'Dr. Andrew Carter', 'lecturer', 'Information Technology', NOW()),
('lec-it-014', 'prof.donna.mitchell', 'lecturer123', 'donna.mitchell@attendify.com', 'Prof. Donna Mitchell', 'lecturer', 'Information Technology', NOW()),
('lec-it-015', 'dr.ryan.perez', 'lecturer123', 'ryan.perez@attendify.com', 'Dr. Ryan Perez', 'lecturer', 'Information Technology', NOW()),

-- Software Engineering Department (15)
('lec-se-001', 'dr.jonathan.roberts', 'lecturer123', 'jonathan.roberts@attendify.com', 'Dr. Jonathan Roberts', 'lecturer', 'Software Engineering', NOW()),
('lec-se-002', 'prof.elizabeth.turner', 'lecturer123', 'elizabeth.turner@attendify.com', 'Prof. Elizabeth Turner', 'lecturer', 'Software Engineering', NOW()),
('lec-se-003', 'dr.matthew.phillips', 'lecturer123', 'matthew.phillips@attendify.com', 'Dr. Matthew Phillips', 'lecturer', 'Software Engineering', NOW()),
('lec-se-004', 'prof.helen.campbell', 'lecturer123', 'helen.campbell@attendify.com', 'Prof. Helen Campbell', 'lecturer', 'Software Engineering', NOW()),
('lec-se-005', 'dr.nicholas.parker', 'lecturer123', 'nicholas.parker@attendify.com', 'Dr. Nicholas Parker', 'lecturer', 'Software Engineering', NOW()),
('lec-se-006', 'prof.barbara.evans', 'lecturer123', 'barbara.evans@attendify.com', 'Prof. Barbara Evans', 'lecturer', 'Software Engineering', NOW()),
('lec-se-007', 'dr.anthony.edwards', 'lecturer123', 'anthony.edwards@attendify.com', 'Dr. Anthony Edwards', 'lecturer', 'Software Engineering', NOW()),
('lec-se-008', 'prof.carol.collins', 'lecturer123', 'carol.collins@attendify.com', 'Prof. Carol Collins', 'lecturer', 'Software Engineering', NOW()),
('lec-se-009', 'dr.steven.stewart', 'lecturer123', 'steven.stewart@attendify.com', 'Dr. Steven Stewart', 'lecturer', 'Software Engineering', NOW()),
('lec-se-010', 'prof.sandra.sanchez', 'lecturer123', 'sandra.sanchez@attendify.com', 'Prof. Sandra Sanchez', 'lecturer', 'Software Engineering', NOW()),
('lec-se-011', 'dr.paul.morris', 'lecturer123', 'paul.morris@attendify.com', 'Dr. Paul Morris', 'lecturer', 'Software Engineering', NOW()),
('lec-se-012', 'prof.ruth.rogers', 'lecturer123', 'ruth.rogers@attendify.com', 'Prof. Ruth Rogers', 'lecturer', 'Software Engineering', NOW()),
('lec-se-013', 'dr.jason.reed', 'lecturer123', 'jason.reed@attendify.com', 'Dr. Jason Reed', 'lecturer', 'Software Engineering', NOW()),
('lec-se-014', 'prof.sharon.cook', 'lecturer123', 'sharon.cook@attendify.com', 'Prof. Sharon Cook', 'lecturer', 'Software Engineering', NOW()),
('lec-se-015', 'dr.gary.morgan', 'lecturer123', 'gary.morgan@attendify.com', 'Dr. Gary Morgan', 'lecturer', 'Software Engineering', NOW()),

-- Data Science Department (10)
('lec-ds-001', 'dr.frank.bell', 'lecturer123', 'frank.bell@attendify.com', 'Dr. Frank Bell', 'lecturer', 'Data Science', NOW()),
('lec-ds-002', 'prof.diana.murphy', 'lecturer123', 'diana.murphy@attendify.com', 'Prof. Diana Murphy', 'lecturer', 'Data Science', NOW()),
('lec-ds-003', 'dr.gerald.bailey', 'lecturer123', 'gerald.bailey@attendify.com', 'Dr. Gerald Bailey', 'lecturer', 'Data Science', NOW()),
('lec-ds-004', 'prof.julie.rivera', 'lecturer123', 'julie.rivera@attendify.com', 'Prof. Julie Rivera', 'lecturer', 'Data Science', NOW()),
('lec-ds-005', 'dr.harold.cooper', 'lecturer123', 'harold.cooper@attendify.com', 'Dr. Harold Cooper', 'lecturer', 'Data Science', NOW()),
('lec-ds-006', 'prof.joyce.richardson', 'lecturer123', 'joyce.richardson@attendify.com', 'Prof. Joyce Richardson', 'lecturer', 'Data Science', NOW()),
('lec-ds-007', 'dr.arthur.cox', 'lecturer123', 'arthur.cox@attendify.com', 'Dr. Arthur Cox', 'lecturer', 'Data Science', NOW()),
('lec-ds-008', 'prof.virginia.ward', 'lecturer123', 'virginia.ward@attendify.com', 'Prof. Virginia Ward', 'lecturer', 'Data Science', NOW()),
('lec-ds-009', 'dr.eugene.torres', 'lecturer123', 'eugene.torres@attendify.com', 'Dr. Eugene Torres', 'lecturer', 'Data Science', NOW()),
('lec-ds-010', 'prof.kathryn.peterson', 'lecturer123', 'kathryn.peterson@attendify.com', 'Prof. Kathryn Peterson', 'lecturer', 'Data Science', NOW());

-- ===========================================
-- LECTURERS TABLE - Lecturer Profiles
-- ===========================================

INSERT INTO lecturers (id, user_id, lecturer_id, specialization, active, created_at) VALUES
-- Computer Science Department
('lec-profile-cs-001', 'lec-cs-001', 'CS-LEC-001', 'Artificial Intelligence', true, NOW()),
('lec-profile-cs-002', 'lec-cs-002', 'CS-LEC-002', 'Machine Learning', true, NOW()),
('lec-profile-cs-003', 'lec-cs-003', 'CS-LEC-003', 'Database Systems', true, NOW()),
('lec-profile-cs-004', 'lec-cs-004', 'CS-LEC-004', 'Computer Networks', true, NOW()),
('lec-profile-cs-005', 'lec-cs-005', 'CS-LEC-005', 'Computer Graphics', true, NOW()),
('lec-profile-cs-006', 'lec-cs-006', 'CS-LEC-006', 'Operating Systems', true, NOW()),
('lec-profile-cs-007', 'lec-cs-007', 'CS-LEC-007', 'Algorithms', true, NOW()),
('lec-profile-cs-008', 'lec-cs-008', 'CS-LEC-008', 'Data Structures', true, NOW()),
('lec-profile-cs-009', 'lec-cs-009', 'CS-LEC-009', 'Cybersecurity', true, NOW()),
('lec-profile-cs-010', 'lec-cs-010', 'CS-LEC-010', 'Human-Computer Interaction', true, NOW()),
('lec-profile-cs-011', 'lec-cs-011', 'CS-LEC-011', 'Software Architecture', true, NOW()),
('lec-profile-cs-012', 'lec-cs-012', 'CS-LEC-012', 'Distributed Systems', true, NOW()),
('lec-profile-cs-013', 'lec-cs-013', 'CS-LEC-013', 'Computer Vision', true, NOW()),
('lec-profile-cs-014', 'lec-cs-014', 'CS-LEC-014', 'Natural Language Processing', true, NOW()),
('lec-profile-cs-015', 'lec-cs-015', 'CS-LEC-015', 'Parallel Computing', true, NOW()),

-- Information Technology Department
('lec-profile-it-001', 'lec-it-001', 'IT-LEC-001', 'Network Administration', true, NOW()),
('lec-profile-it-002', 'lec-it-002', 'IT-LEC-002', 'System Administration', true, NOW()),
('lec-profile-it-003', 'lec-it-003', 'IT-LEC-003', 'Cloud Computing', true, NOW()),
('lec-profile-it-004', 'lec-it-004', 'IT-LEC-004', 'IT Security', true, NOW()),
('lec-profile-it-005', 'lec-it-005', 'IT-LEC-005', 'DevOps', true, NOW()),
('lec-profile-it-006', 'lec-it-006', 'IT-LEC-006', 'IT Project Management', true, NOW()),
('lec-profile-it-007', 'lec-it-007', 'IT-LEC-007', 'Enterprise Systems', true, NOW()),
('lec-profile-it-008', 'lec-it-008', 'IT-LEC-008', 'Business Intelligence', true, NOW()),
('lec-profile-it-009', 'lec-it-009', 'IT-LEC-009', 'IT Governance', true, NOW()),
('lec-profile-it-010', 'lec-it-010', 'IT-LEC-010', 'IT Service Management', true, NOW()),
('lec-profile-it-011', 'lec-it-011', 'IT-LEC-011', 'Infrastructure Management', true, NOW()),
('lec-profile-it-012', 'lec-it-012', 'IT-LEC-012', 'IT Risk Management', true, NOW()),
('lec-profile-it-013', 'lec-it-013', 'IT-LEC-013', 'Digital Transformation', true, NOW()),
('lec-profile-it-014', 'lec-it-014', 'IT-LEC-014', 'IT Consulting', true, NOW()),
('lec-profile-it-015', 'lec-it-015', 'IT-LEC-015', 'IT Operations', true, NOW()),

-- Software Engineering Department
('lec-profile-se-001', 'lec-se-001', 'SE-LEC-001', 'Software Design Patterns', true, NOW()),
('lec-profile-se-002', 'lec-se-002', 'SE-LEC-002', 'Agile Development', true, NOW()),
('lec-profile-se-003', 'lec-se-003', 'SE-LEC-003', 'Software Testing', true, NOW()),
('lec-profile-se-004', 'lec-se-004', 'SE-LEC-004', 'Requirements Engineering', true, NOW()),
('lec-profile-se-005', 'lec-se-005', 'SE-LEC-005', 'Software Quality Assurance', true, NOW()),
('lec-profile-se-006', 'lec-se-006', 'SE-LEC-006', 'Software Project Management', true, NOW()),
('lec-profile-se-007', 'lec-se-007', 'SE-LEC-007', 'Software Maintenance', true, NOW()),
('lec-profile-se-008', 'lec-se-008', 'SE-LEC-008', 'Software Metrics', true, NOW()),
('lec-profile-se-009', 'lec-se-009', 'SE-LEC-009', 'Software Configuration Management', true, NOW()),
('lec-profile-se-010', 'lec-se-010', 'SE-LEC-010', 'Software Process Improvement', true, NOW()),
('lec-profile-se-011', 'lec-se-011', 'SE-LEC-011', 'Software Engineering Ethics', true, NOW()),
('lec-profile-se-012', 'lec-se-012', 'SE-LEC-012', 'Software Documentation', true, NOW()),
('lec-profile-se-013', 'lec-se-013', 'SE-LEC-013', 'Software Reverse Engineering', true, NOW()),
('lec-profile-se-014', 'lec-se-014', 'SE-LEC-014', 'Software Reengineering', true, NOW()),
('lec-profile-se-015', 'lec-se-015', 'SE-LEC-015', 'Software Evolution', true, NOW()),

-- Data Science Department
('lec-profile-ds-001', 'lec-ds-001', 'DS-LEC-001', 'Statistical Analysis', true, NOW()),
('lec-profile-ds-002', 'lec-ds-002', 'DS-LEC-002', 'Data Mining', true, NOW()),
('lec-profile-ds-003', 'lec-ds-003', 'DS-LEC-003', 'Big Data Analytics', true, NOW()),
('lec-profile-ds-004', 'lec-ds-004', 'DS-LEC-004', 'Data Visualization', true, NOW()),
('lec-profile-ds-005', 'lec-ds-005', 'DS-LEC-005', 'Predictive Modeling', true, NOW()),
('lec-profile-ds-006', 'lec-ds-006', 'DS-LEC-006', 'Business Analytics', true, NOW()),
('lec-profile-ds-007', 'lec-ds-007', 'DS-LEC-007', 'Deep Learning', true, NOW()),
('lec-profile-ds-008', 'lec-ds-008', 'DS-LEC-008', 'Data Engineering', true, NOW()),
('lec-profile-ds-009', 'lec-ds-009', 'DS-LEC-009', 'Data Warehousing', true, NOW()),
('lec-profile-ds-010', 'lec-ds-010', 'DS-LEC-010', 'Research Methods', true, NOW());
