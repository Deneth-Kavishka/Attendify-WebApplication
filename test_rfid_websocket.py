#!/usr/bin/env python3
"""
Test script for RFID WebSocket system without hardware
Simulates RFID card scans to test the web dashboard integration
"""

import time
import random
from datetime import datetime
from smarttrack_rfid_websocket import SmartTrackRFIDWebSocket

def simulate_rfid_scans():
    """Simulate RFID card scans for testing"""
    
    # Test RFID cards (your registered cards)
    test_cards = [
        "BF74B21F",  # Deneth Kavishka (ST004)
        "F6C9D600",  # Your second card
        "12345678",  # Unknown card for testing
        "ABCDEF00",  # Another unknown card
    ]
    
    print("🧪 Starting RFID WebSocket Test Simulation")
    print("=" * 60)
    print("📡 WebSocket server should be running on http://localhost:5001")
    print("🌐 Open your React client to see real-time updates")
    print("📱 Simulating RFID card scans every 5 seconds...")
    print("=" * 60)
    
    # Initialize system without serial connection
    system = SmartTrackRFIDWebSocket()
    system.connect_database()
    
    scan_count = 0
    
    try:
        while True:
            scan_count += 1
            card_id = random.choice(test_cards)
            
            print(f"\n🎯 Scan #{scan_count}: Testing card {card_id}")
            
            # Check if card is registered
            student = system.get_student_by_rfid(card_id)
            
            if student:
                # Simulate successful attendance
                student_id, student_name, department = student
                success = system.mark_attendance(student_id, card_id)
                
                if success:
                    # Broadcast to WebSocket clients
                    attendance_data = {
                        'id': int(datetime.now().timestamp() * 1000),
                        'studentId': student_id,
                        'studentName': student_name,
                        'rfidCard': card_id,
                        'department': department,
                        'deviceId': 'RFID_TEST_001',
                        'method': 'rfid',
                        'status': 'present',
                        'location': 'Test Lab',
                        'timestamp': datetime.now().isoformat(),
                        'className': f'{department} - RFID Scanner'
                    }
                    
                    system.socketio.emit('rfid_attendance', attendance_data)
                    system.socketio.emit('attendance_update', attendance_data)
                    
                    print(f"✅ Attendance marked for {student_name} ({student_id})")
                    print(f"📤 WebSocket event broadcasted")
                else:
                    print(f"❌ Failed to mark attendance for {student_name}")
            else:
                # Simulate unknown card
                unknown_data = {
                    'id': int(datetime.now().timestamp() * 1000),
                    'rfidCard': card_id,
                    'deviceId': 'RFID_TEST_001',
                    'location': 'Test Lab',
                    'timestamp': datetime.now().isoformat()
                }
                
                system.socketio.emit('unknown_card', unknown_data)
                
                print(f"❌ Unknown card: {card_id}")
                print(f"📤 Unknown card event broadcasted")
            
            # Wait before next scan
            print(f"⏳ Waiting 5 seconds for next scan...")
            time.sleep(5)
            
    except KeyboardInterrupt:
        print(f"\n🛑 Test simulation stopped after {scan_count} scans")
        print("✅ WebSocket test complete")

if __name__ == "__main__":
    simulate_rfid_scans()
