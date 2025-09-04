import requests

# Test single student endpoint
token = "5dab67b4-b748-490c-8fec-010a38be418b"
headers = {"Authorization": f"Bearer {token}"}

# Get all students first
response = requests.get("http://localhost:5000/api/students", headers=headers)
if response.status_code == 200:
    students = response.json()
    if students:
        student_id = students[0]["id"]
        print(f"Testing single student: {student_id}")
        
        # Get single student
        single_response = requests.get(f"http://localhost:5000/api/students/{student_id}", headers=headers)
        if single_response.status_code == 200:
            student = single_response.json()
            print(f"✅ Single student data:")
            print(f"   Name: {student.get('fullName')}")
            print(f"   Email: {student.get('email')}")
            print(f"   Department: {student.get('department')}")
            print(f"   Student ID: {student.get('studentId')}")
        else:
            print(f"❌ Single student failed: {single_response.status_code}")
            print(single_response.text)
    else:
        print("No students found")
else:
    print(f"❌ Get students failed: {response.status_code}")
    print(response.text)
