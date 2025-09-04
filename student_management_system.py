#!/usr/bin/env python3
"""
SmartTrack Student Management System
Complete student registration and management interface
"""

import psycopg2
from datetime import datetime, date, timedelta
import sys

class StudentManagementSystem:
    def __init__(self):
        self.DB_CONFIG = {
            'host': 'localhost',
            'database': 'attendify',
            'user': 'postgres',
            'password': 'admin123'
        }
        
        try:
            self.db_conn = psycopg2.connect(**self.DB_CONFIG)
            print("✅ Connected to database")
        except psycopg2.Error as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)

    def add_student(self):
        """Add a new student to the system"""
        print("\n📝 ADD NEW STUDENT")
        print("=" * 40)
        
        try:
            student_id = input("Student ID: ").strip()
            rfid_card = input("RFID Card ID: ").strip().upper()
            name = input("Full Name: ").strip()
            email = input("Email: ").strip()
            department = input("Department: ").strip()
            year = int(input("Year of Study (1-4): "))
            phone = input("Phone Number: ").strip()
            emergency_contact = input("Emergency Contact: ").strip()
            
            cursor = self.db_conn.cursor()
            cursor.execute('''
                INSERT INTO rfid_students (
                    student_id, rfid_card, name, email, department, 
                    year_of_study, phone, emergency_contact, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (student_id, rfid_card, name, email, department, year, phone, emergency_contact, 'active'))
            
            self.db_conn.commit()
            cursor.close()
            
            print(f"✅ Student {name} added successfully!")
            
        except psycopg2.IntegrityError as e:
            print(f"❌ Error: Student ID or RFID card already exists")
            self.db_conn.rollback()
        except Exception as e:
            print(f"❌ Error adding student: {e}")
            self.db_conn.rollback()

    def view_all_students(self):
        """View all registered students"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT student_id, rfid_card, name, department, year_of_study, status, created_at
            FROM rfid_students 
            ORDER BY created_at DESC
        ''')
        
        print(f"\n👥 ALL REGISTERED STUDENTS")
        print("=" * 100)
        print(f"{'ID':<10} {'RFID Card':<12} {'Name':<25} {'Department':<20} {'Year':<5} {'Status':<8} {'Registered'}")
        print("-" * 100)
        
        for row in cursor.fetchall():
            print(f"{row[0]:<10} {row[1]:<12} {row[2]:<25} {row[3]:<20} {row[4]:<5} {row[5]:<8} {row[6].strftime('%Y-%m-%d')}")
        
        cursor.close()

    def search_student(self):
        """Search for a student"""
        print("\n🔍 SEARCH STUDENT")
        print("=" * 30)
        
        search_term = input("Enter Student ID, RFID Card, or Name: ").strip()
        
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT student_id, rfid_card, name, email, department, year_of_study, 
                   phone, emergency_contact, status, created_at
            FROM rfid_students 
            WHERE student_id ILIKE %s OR rfid_card ILIKE %s OR name ILIKE %s
        ''', (f'%{search_term}%', f'%{search_term}%', f'%{search_term}%'))
        
        results = cursor.fetchall()
        
        if results:
            for row in results:
                print(f"\n📋 STUDENT DETAILS")
                print("-" * 40)
                print(f"Student ID: {row[0]}")
                print(f"RFID Card: {row[1]}")
                print(f"Name: {row[2]}")
                print(f"Email: {row[3]}")
                print(f"Department: {row[4]}")
                print(f"Year: {row[5]}")
                print(f"Phone: {row[6]}")
                print(f"Emergency Contact: {row[7]}")
                print(f"Status: {row[8]}")
                print(f"Registered: {row[9].strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print("❌ No students found")
        
        cursor.close()

    def view_attendance_report(self):
        """View attendance reports"""
        print("\n📊 ATTENDANCE REPORTS")
        print("=" * 40)
        print("1. Today's Attendance")
        print("2. Weekly Attendance")
        print("3. Student Attendance History")
        print("4. Department Summary")
        
        choice = input("\nSelect option (1-4): ").strip()
        
        if choice == '1':
            self.todays_attendance()
        elif choice == '2':
            self.weekly_attendance()
        elif choice == '3':
            self.student_attendance_history()
        elif choice == '4':
            self.department_summary()

    def todays_attendance(self):
        """Show today's attendance"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT s.name, s.student_id, s.department, 
                   das.first_scan_time, das.total_scans, das.location
            FROM daily_attendance_summary das
            JOIN rfid_students s ON das.student_id = s.student_id
            WHERE das.attendance_date = CURRENT_DATE
            ORDER BY das.first_scan_time
        ''')
        
        print(f"\n📅 TODAY'S ATTENDANCE ({date.today()})")
        print("=" * 90)
        print(f"{'Name':<25} {'ID':<10} {'Department':<20} {'First Scan':<12} {'Total Scans':<12} {'Location'}")
        print("-" * 90)
        
        total_students = 0
        for row in cursor.fetchall():
            print(f"{row[0]:<25} {row[1]:<10} {row[2]:<20} {row[3].strftime('%H:%M:%S'):<12} {row[4]:<12} {row[5]}")
            total_students += 1
        
        print(f"\nTotal Students Present: {total_students}")
        cursor.close()

    def weekly_attendance(self):
        """Show weekly attendance summary"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT s.name, s.student_id, s.department,
                   COUNT(das.attendance_date) as days_present,
                   STRING_AGG(das.attendance_date::text, ', ' ORDER BY das.attendance_date) as dates
            FROM rfid_students s
            LEFT JOIN daily_attendance_summary das ON s.student_id = das.student_id
                AND das.attendance_date >= CURRENT_DATE - INTERVAL '7 days'
            WHERE s.status = 'active'
            GROUP BY s.student_id, s.name, s.department
            ORDER BY days_present DESC, s.name
        ''')
        
        print(f"\n📊 WEEKLY ATTENDANCE SUMMARY (Last 7 Days)")
        print("=" * 100)
        print(f"{'Name':<25} {'ID':<10} {'Department':<20} {'Days Present':<12} {'Attendance Dates'}")
        print("-" * 100)
        
        for row in cursor.fetchall():
            dates = row[4] if row[4] else "No attendance"
            print(f"{row[0]:<25} {row[1]:<10} {row[2]:<20} {row[3]:<12} {dates}")
        
        cursor.close()

    def student_attendance_history(self):
        """Show individual student attendance history"""
        student_id = input("\nEnter Student ID: ").strip()
        
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT s.name, s.department,
                   ra.scan_time, ra.location, ra.scan_type, ra.status
            FROM rfid_attendance ra
            JOIN rfid_students s ON ra.student_id = s.student_id
            WHERE ra.student_id = %s
            ORDER BY ra.scan_time DESC
            LIMIT 50
        ''', (student_id,))
        
        results = cursor.fetchall()
        
        if results:
            student_name = results[0][0]
            department = results[0][1]
            
            print(f"\n📋 ATTENDANCE HISTORY - {student_name} ({student_id})")
            print(f"Department: {department}")
            print("=" * 80)
            print(f"{'Date':<12} {'Time':<10} {'Location':<20} {'Type':<15} {'Status'}")
            print("-" * 80)
            
            for row in results:
                scan_time = row[2]
                print(f"{scan_time.strftime('%Y-%m-%d'):<12} {scan_time.strftime('%H:%M:%S'):<10} {row[3]:<20} {row[4]:<15} {row[5]}")
        else:
            print(f"❌ No attendance records found for {student_id}")
        
        cursor.close()

    def department_summary(self):
        """Show department-wise attendance summary"""
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT s.department,
                   COUNT(DISTINCT s.student_id) as total_students,
                   COUNT(DISTINCT CASE WHEN das.attendance_date = CURRENT_DATE THEN s.student_id END) as present_today,
                   ROUND(
                       COUNT(DISTINCT CASE WHEN das.attendance_date = CURRENT_DATE THEN s.student_id END) * 100.0 /
                       COUNT(DISTINCT s.student_id), 2
                   ) as attendance_percentage
            FROM rfid_students s
            LEFT JOIN daily_attendance_summary das ON s.student_id = das.student_id
            WHERE s.status = 'active'
            GROUP BY s.department
            ORDER BY attendance_percentage DESC
        ''')
        
        print(f"\n🏫 DEPARTMENT ATTENDANCE SUMMARY")
        print("=" * 70)
        print(f"{'Department':<25} {'Total Students':<15} {'Present Today':<15} {'Attendance %'}")
        print("-" * 70)
        
        for row in cursor.fetchall():
            percentage = row[3] if row[3] else 0
            print(f"{row[0]:<25} {row[1]:<15} {row[2]:<15} {percentage}%")
        
        cursor.close()

    def update_student(self):
        """Update student information"""
        print("\n✏️ UPDATE STUDENT")
        print("=" * 30)
        
        student_id = input("Enter Student ID to update: ").strip()
        
        # First, check if student exists
        cursor = self.db_conn.cursor()
        cursor.execute('''
            SELECT student_id, rfid_card, name, email, department, year_of_study, phone, emergency_contact
            FROM rfid_students WHERE student_id = %s
        ''', (student_id,))
        
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ Student {student_id} not found")
            cursor.close()
            return
        
        print(f"\nCurrent details for {result[2]} ({result[0]}):")
        print(f"RFID Card: {result[1]}")
        print(f"Email: {result[3]}")
        print(f"Department: {result[4]}")
        print(f"Year: {result[5]}")
        print(f"Phone: {result[6]}")
        print(f"Emergency Contact: {result[7]}")
        
        print("\nEnter new values (press Enter to keep current):")
        
        new_name = input(f"Name [{result[2]}]: ").strip() or result[2]
        new_email = input(f"Email [{result[3]}]: ").strip() or result[3]
        new_department = input(f"Department [{result[4]}]: ").strip() or result[4]
        new_year = input(f"Year [{result[5]}]: ").strip()
        new_year = int(new_year) if new_year else result[5]
        new_phone = input(f"Phone [{result[6]}]: ").strip() or result[6]
        new_emergency = input(f"Emergency Contact [{result[7]}]: ").strip() or result[7]
        
        try:
            cursor.execute('''
                UPDATE rfid_students SET
                    name = %s, email = %s, department = %s, year_of_study = %s,
                    phone = %s, emergency_contact = %s, updated_at = CURRENT_TIMESTAMP
                WHERE student_id = %s
            ''', (new_name, new_email, new_department, new_year, new_phone, new_emergency, student_id))
            
            self.db_conn.commit()
            print(f"✅ Student {new_name} updated successfully!")
            
        except Exception as e:
            print(f"❌ Error updating student: {e}")
            self.db_conn.rollback()
        
        cursor.close()

    def deactivate_student(self):
        """Deactivate a student"""
        print("\n🚫 DEACTIVATE STUDENT")
        print("=" * 30)
        
        student_id = input("Enter Student ID to deactivate: ").strip()
        
        cursor = self.db_conn.cursor()
        cursor.execute('''
            UPDATE rfid_students SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
            WHERE student_id = %s AND status = 'active'
        ''')
        
        if cursor.rowcount > 0:
            self.db_conn.commit()
            print(f"✅ Student {student_id} deactivated successfully!")
        else:
            print(f"❌ Student {student_id} not found or already inactive")
        
        cursor.close()

    def main_menu(self):
        """Main menu interface"""
        while True:
            print("\n" + "🎓" + "=" * 48 + "🎓")
            print("║" + " " * 12 + "SMARTTRACK STUDENT MANAGEMENT" + " " * 7 + "║")
            print("╠" + "=" * 48 + "╣")
            print("║ 1. Add New Student                            ║")
            print("║ 2. View All Students                          ║")
            print("║ 3. Search Student                            ║")
            print("║ 4. Update Student                            ║")
            print("║ 5. Deactivate Student                        ║")
            print("║ 6. Attendance Reports                        ║")
            print("║ 7. Exit                                      ║")
            print("╚" + "=" * 48 + "╝")
            
            choice = input("\nSelect option (1-7): ").strip()
            
            if choice == '1':
                self.add_student()
            elif choice == '2':
                self.view_all_students()
            elif choice == '3':
                self.search_student()
            elif choice == '4':
                self.update_student()
            elif choice == '5':
                self.deactivate_student()
            elif choice == '6':
                self.view_attendance_report()
            elif choice == '7':
                print("👋 Goodbye!")
                break
            else:
                print("❌ Invalid option. Please try again.")

    def close(self):
        """Close database connection"""
        if self.db_conn:
            self.db_conn.close()

def main():
    try:
        sms = StudentManagementSystem()
        sms.main_menu()
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    finally:
        if 'sms' in locals():
            sms.close()

if __name__ == "__main__":
    main()
