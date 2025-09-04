#!/usr/bin/env python3
"""
SmartTrack Student Management System - Standalone Version
Manage students without database dependency - uses CSV files
"""

import csv
import os
from datetime import datetime, date

class StudentManagementStandalone:
    def __init__(self):
        self.STUDENTS_FILE = 'students_database.csv'
        self.ATTENDANCE_FILE = 'attendance_records.csv'
        self.DAILY_SUMMARY_FILE = 'daily_summary.csv'
        
        print("=" * 60)
        print("🎓 SmartTrack Student Management System (Standalone)")
        print("=" * 60)
        print("📁 Data stored in local CSV files")
        print("=" * 60)

    def display_menu(self):
        """Display main menu"""
        print("\n📋 STUDENT MANAGEMENT MENU")
        print("=" * 40)
        print("1. 👥 View All Students")
        print("2. ➕ Add New Student")
        print("3. 🔍 Search Student")
        print("4. ✏️  Edit Student")
        print("5. 🗑️  Delete Student")
        print("6. 📊 Attendance Reports")
        print("7. 📈 Department Summary")
        print("8. 📱 Unknown Cards Report")
        print("9. 🔄 Export Data")
        print("0. ❌ Exit")
        print("=" * 40)

    def load_students(self):
        """Load all students from CSV"""
        students = []
        try:
            with open(self.STUDENTS_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    students.append(row)
        except FileNotFoundError:
            print("❌ Students file not found")
        return students

    def save_students(self, students):
        """Save students to CSV"""
        if not students:
            return
        
        with open(self.STUDENTS_FILE, 'w', newline='', encoding='utf-8') as file:
            fieldnames = ['student_id', 'rfid_card', 'name', 'email', 'department', 'year', 'phone', 'status']
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(students)

    def view_all_students(self):
        """Display all students"""
        students = self.load_students()
        
        if not students:
            print("❌ No students found")
            return
        
        print(f"\n👥 ALL STUDENTS ({len(students)} total)")
        print("=" * 120)
        print(f"{'ID':<10} {'RFID Card':<12} {'Name':<25} {'Email':<30} {'Department':<20} {'Year':<6} {'Status':<8}")
        print("-" * 120)
        
        for student in students:
            print(f"{student['student_id']:<10} {student['rfid_card']:<12} {student['name']:<25} {student['email']:<30} {student['department']:<20} {student['year']:<6} {student['status']:<8}")

    def add_student(self):
        """Add new student"""
        print("\n➕ ADD NEW STUDENT")
        print("=" * 30)
        
        students = self.load_students()
        
        # Get student details
        student_id = input("Student ID: ").strip()
        rfid_card = input("RFID Card ID: ").strip().upper()
        name = input("Full Name: ").strip()
        email = input("Email: ").strip()
        department = input("Department: ").strip()
        year = input("Year (1-4): ").strip()
        phone = input("Phone: ").strip()
        status = input("Status (active/inactive) [active]: ").strip() or "active"
        
        # Validate input
        if not all([student_id, rfid_card, name, email, department, year]):
            print("❌ All fields are required")
            return
        
        # Check for duplicates
        for student in students:
            if student['student_id'] == student_id:
                print(f"❌ Student ID {student_id} already exists")
                return
            if student['rfid_card'] == rfid_card:
                print(f"❌ RFID Card {rfid_card} already assigned")
                return
        
        # Add new student
        new_student = {
            'student_id': student_id,
            'rfid_card': rfid_card,
            'name': name,
            'email': email,
            'department': department,
            'year': year,
            'phone': phone,
            'status': status
        }
        
        students.append(new_student)
        self.save_students(students)
        
        print("✅ Student added successfully!")
        print(f"👤 {name} ({student_id}) with RFID {rfid_card}")

    def search_student(self):
        """Search for students"""
        print("\n🔍 SEARCH STUDENT")
        print("=" * 25)
        
        search_term = input("Enter Student ID, RFID Card, or Name: ").strip().lower()
        
        students = self.load_students()
        found_students = []
        
        for student in students:
            if (search_term in student['student_id'].lower() or
                search_term in student['rfid_card'].lower() or
                search_term in student['name'].lower() or
                search_term in student['email'].lower()):
                found_students.append(student)
        
        if not found_students:
            print(f"❌ No students found matching '{search_term}'")
            return
        
        print(f"\n🔍 SEARCH RESULTS ({len(found_students)} found)")
        print("=" * 120)
        print(f"{'ID':<10} {'RFID Card':<12} {'Name':<25} {'Email':<30} {'Department':<20} {'Year':<6} {'Status':<8}")
        print("-" * 120)
        
        for student in found_students:
            print(f"{student['student_id']:<10} {student['rfid_card']:<12} {student['name']:<25} {student['email']:<30} {student['department']:<20} {student['year']:<6} {student['status']:<8}")

    def edit_student(self):
        """Edit student information"""
        print("\n✏️ EDIT STUDENT")
        print("=" * 20)
        
        student_id = input("Enter Student ID to edit: ").strip()
        students = self.load_students()
        
        student_index = -1
        for i, student in enumerate(students):
            if student['student_id'] == student_id:
                student_index = i
                break
        
        if student_index == -1:
            print(f"❌ Student {student_id} not found")
            return
        
        student = students[student_index]
        
        print(f"\n👤 Current information for {student['name']}:")
        print(f"1. Student ID: {student['student_id']}")
        print(f"2. RFID Card: {student['rfid_card']}")
        print(f"3. Name: {student['name']}")
        print(f"4. Email: {student['email']}")
        print(f"5. Department: {student['department']}")
        print(f"6. Year: {student['year']}")
        print(f"7. Phone: {student['phone']}")
        print(f"8. Status: {student['status']}")
        
        field = input("\nEnter field number to edit (1-8) or 0 to cancel: ").strip()
        
        if field == '0':
            return
        
        field_map = {
            '1': 'student_id',
            '2': 'rfid_card', 
            '3': 'name',
            '4': 'email',
            '5': 'department',
            '6': 'year',
            '7': 'phone',
            '8': 'status'
        }
        
        if field not in field_map:
            print("❌ Invalid field number")
            return
        
        field_name = field_map[field]
        current_value = student[field_name]
        new_value = input(f"Enter new {field_name} [{current_value}]: ").strip()
        
        if new_value:
            # Check for duplicates on ID and RFID changes
            if field_name in ['student_id', 'rfid_card']:
                for other_student in students:
                    if other_student != student and other_student[field_name] == new_value:
                        print(f"❌ {field_name} {new_value} already exists")
                        return
            
            student[field_name] = new_value
            self.save_students(students)
            print(f"✅ Updated {field_name} to '{new_value}'")
        else:
            print("❌ No changes made")

    def delete_student(self):
        """Delete student"""
        print("\n🗑️ DELETE STUDENT")
        print("=" * 20)
        
        student_id = input("Enter Student ID to delete: ").strip()
        students = self.load_students()
        
        student_to_delete = None
        for student in students:
            if student['student_id'] == student_id:
                student_to_delete = student
                break
        
        if not student_to_delete:
            print(f"❌ Student {student_id} not found")
            return
        
        print(f"\n👤 Student to delete:")
        print(f"Name: {student_to_delete['name']}")
        print(f"ID: {student_to_delete['student_id']}")
        print(f"RFID: {student_to_delete['rfid_card']}")
        
        confirm = input("\nAre you sure? (yes/no): ").strip().lower()
        
        if confirm == 'yes':
            students.remove(student_to_delete)
            self.save_students(students)
            print(f"✅ Student {student_id} deleted successfully")
        else:
            print("❌ Deletion cancelled")

    def attendance_reports(self):
        """Generate attendance reports"""
        print("\n📊 ATTENDANCE REPORTS")
        print("=" * 30)
        print("1. Today's Attendance")
        print("2. Student Attendance History")
        print("3. Date Range Report")
        print("4. Absent Students Today")
        
        choice = input("Choose report (1-4): ").strip()
        
        if choice == '1':
            self.todays_attendance()
        elif choice == '2':
            self.student_attendance_history()
        elif choice == '3':
            self.date_range_report()
        elif choice == '4':
            self.absent_students_today()
        else:
            print("❌ Invalid choice")

    def todays_attendance(self):
        """Show today's attendance"""
        today = date.today().strftime('%Y-%m-%d')
        
        try:
            with open(self.DAILY_SUMMARY_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                todays_data = [row for row in reader if row['date'] == today]
        except FileNotFoundError:
            todays_data = []
        
        print(f"\n📋 TODAY'S ATTENDANCE ({today})")
        print("=" * 100)
        
        if not todays_data:
            print("❌ No attendance records for today")
            return
        
        print(f"{'Name':<25} {'ID':<10} {'Department':<20} {'First Scan':<12} {'Total Scans':<12}")
        print("-" * 100)
        
        for record in todays_data:
            print(f"{record['name']:<25} {record['student_id']:<10} {record['department']:<20} {record['first_scan']:<12} {record['total_scans']:<12}")
        
        print(f"\nTotal Students Present: {len(todays_data)}")

    def student_attendance_history(self):
        """Show attendance history for a specific student"""
        student_id = input("Enter Student ID: ").strip()
        
        try:
            with open(self.ATTENDANCE_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                student_records = [row for row in reader if row['student_id'] == student_id]
        except FileNotFoundError:
            student_records = []
        
        if not student_records:
            print(f"❌ No attendance records found for {student_id}")
            return
        
        print(f"\n📈 ATTENDANCE HISTORY FOR {student_id}")
        print("=" * 80)
        print(f"{'Date':<12} {'Time':<10} {'Location':<20} {'Type':<15} {'Status':<10}")
        print("-" * 80)
        
        for record in student_records:
            date_time = record['timestamp'].split(' ')
            date_part = date_time[0] if len(date_time) > 1 else record['timestamp']
            time_part = date_time[1] if len(date_time) > 1 else ""
            
            print(f"{date_part:<12} {time_part:<10} {record['location']:<20} {record['scan_type']:<15} {record['status']:<10}")
        
        print(f"\nTotal Records: {len(student_records)}")

    def date_range_report(self):
        """Generate report for date range"""
        start_date = input("Start date (YYYY-MM-DD): ").strip()
        end_date = input("End date (YYYY-MM-DD): ").strip()
        
        try:
            with open(self.ATTENDANCE_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                range_records = []
                
                for row in reader:
                    record_date = row['timestamp'].split(' ')[0]
                    if start_date <= record_date <= end_date:
                        range_records.append(row)
        except FileNotFoundError:
            range_records = []
        
        if not range_records:
            print(f"❌ No records found between {start_date} and {end_date}")
            return
        
        print(f"\n📅 ATTENDANCE REPORT ({start_date} to {end_date})")
        print("=" * 100)
        print(f"{'Date':<12} {'Name':<25} {'ID':<10} {'Department':<20} {'Location':<15}")
        print("-" * 100)
        
        for record in range_records:
            date_part = record['timestamp'].split(' ')[0]
            print(f"{date_part:<12} {record['name']:<25} {record['student_id']:<10} {record['department']:<20} {record['location']:<15}")
        
        print(f"\nTotal Records: {len(range_records)}")

    def absent_students_today(self):
        """Show students absent today"""
        today = date.today().strftime('%Y-%m-%d')
        
        # Get all students
        all_students = self.load_students()
        
        # Get students present today
        try:
            with open(self.DAILY_SUMMARY_FILE, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                present_today = {row['student_id'] for row in reader if row['date'] == today}
        except FileNotFoundError:
            present_today = set()
        
        # Find absent students
        absent_students = [s for s in all_students if s['student_id'] not in present_today and s['status'] == 'active']
        
        print(f"\n❌ ABSENT STUDENTS TODAY ({today})")
        print("=" * 80)
        
        if not absent_students:
            print("✅ All active students are present!")
            return
        
        print(f"{'Name':<25} {'ID':<10} {'Department':<20} {'Phone':<15}")
        print("-" * 80)
        
        for student in absent_students:
            print(f"{student['name']:<25} {student['student_id']:<10} {student['department']:<20} {student['phone']:<15}")
        
        print(f"\nTotal Absent: {len(absent_students)}")

    def department_summary(self):
        """Show department-wise summary"""
        students = self.load_students()
        
        if not students:
            print("❌ No students found")
            return
        
        # Group by department
        dept_summary = {}
        for student in students:
            dept = student['department']
            if dept not in dept_summary:
                dept_summary[dept] = {'total': 0, 'active': 0, 'inactive': 0}
            
            dept_summary[dept]['total'] += 1
            if student['status'] == 'active':
                dept_summary[dept]['active'] += 1
            else:
                dept_summary[dept]['inactive'] += 1
        
        print("\n📈 DEPARTMENT SUMMARY")
        print("=" * 70)
        print(f"{'Department':<30} {'Total':<8} {'Active':<8} {'Inactive':<10}")
        print("-" * 70)
        
        for dept, stats in sorted(dept_summary.items()):
            print(f"{dept:<30} {stats['total']:<8} {stats['active']:<8} {stats['inactive']:<10}")
        
        total_students = sum(stats['total'] for stats in dept_summary.values())
        total_active = sum(stats['active'] for stats in dept_summary.values())
        
        print("-" * 70)
        print(f"{'TOTAL':<30} {total_students:<8} {total_active:<8} {total_students - total_active:<10}")

    def unknown_cards_report(self):
        """Show unknown RFID cards report"""
        try:
            with open('unknown_cards.csv', 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                unknown_cards = list(reader)
        except FileNotFoundError:
            print("❌ No unknown cards file found")
            return
        
        if not unknown_cards:
            print("✅ No unknown cards recorded")
            return
        
        print("\n📱 UNKNOWN RFID CARDS REPORT")
        print("=" * 80)
        print(f"{'Timestamp':<20} {'RFID Card':<15} {'Device':<20} {'Location':<20}")
        print("-" * 80)
        
        for card in unknown_cards:
            print(f"{card['timestamp']:<20} {card['rfid_card']:<15} {card['device_id']:<20} {card['location']:<20}")
        
        print(f"\nTotal Unknown Cards: {len(unknown_cards)}")

    def export_data(self):
        """Export data to timestamped files"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        print("\n🔄 EXPORT DATA")
        print("=" * 20)
        print("1. Export Students")
        print("2. Export Attendance Records")
        print("3. Export Daily Summary")
        print("4. Export All Data")
        
        choice = input("Choose export option (1-4): ").strip()
        
        try:
            if choice in ['1', '4']:
                # Export students
                students = self.load_students()
                if students:
                    export_file = f'export_students_{timestamp}.csv'
                    with open(export_file, 'w', newline='', encoding='utf-8') as file:
                        fieldnames = ['student_id', 'rfid_card', 'name', 'email', 'department', 'year', 'phone', 'status']
                        writer = csv.DictWriter(file, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(students)
                    print(f"✅ Students exported to {export_file}")
            
            if choice in ['2', '4']:
                # Export attendance
                try:
                    with open(self.ATTENDANCE_FILE, 'r', newline='', encoding='utf-8') as src:
                        export_file = f'export_attendance_{timestamp}.csv'
                        with open(export_file, 'w', newline='', encoding='utf-8') as dst:
                            dst.write(src.read())
                    print(f"✅ Attendance exported to {export_file}")
                except FileNotFoundError:
                    print("❌ No attendance file to export")
            
            if choice in ['3', '4']:
                # Export daily summary
                try:
                    with open(self.DAILY_SUMMARY_FILE, 'r', newline='', encoding='utf-8') as src:
                        export_file = f'export_daily_summary_{timestamp}.csv'
                        with open(export_file, 'w', newline='', encoding='utf-8') as dst:
                            dst.write(src.read())
                    print(f"✅ Daily summary exported to {export_file}")
                except FileNotFoundError:
                    print("❌ No daily summary file to export")
            
            if choice not in ['1', '2', '3', '4']:
                print("❌ Invalid choice")
                
        except Exception as e:
            print(f"❌ Export failed: {e}")

    def run(self):
        """Run the student management system"""
        while True:
            self.display_menu()
            choice = input("\nEnter your choice (0-9): ").strip()
            
            if choice == '0':
                print("👋 Goodbye!")
                break
            elif choice == '1':
                self.view_all_students()
            elif choice == '2':
                self.add_student()
            elif choice == '3':
                self.search_student()
            elif choice == '4':
                self.edit_student()
            elif choice == '5':
                self.delete_student()
            elif choice == '6':
                self.attendance_reports()
            elif choice == '7':
                self.department_summary()
            elif choice == '8':
                self.unknown_cards_report()
            elif choice == '9':
                self.export_data()
            else:
                print("❌ Invalid choice. Please try again.")
            
            input("\nPress Enter to continue...")

def main():
    system = StudentManagementStandalone()
    system.run()

if __name__ == "__main__":
    main()
