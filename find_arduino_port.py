#!/usr/bin/env python3
"""
COM Port Finder for Arduino
Helps you find the correct COM port for your Arduino device
"""

import serial.tools.list_ports
import time

def find_arduino_ports():
    """Find all available COM ports and identify potential Arduino ports"""
    print("🔍 Scanning for available COM ports...")
    print("="*50)
    
    ports = serial.tools.list_ports.comports()
    arduino_ports = []
    
    if not ports:
        print("❌ No COM ports found!")
        return []
    
    for i, port in enumerate(ports):
        print(f"{i+1}. {port.device}")
        print(f"   Description: {port.description}")
        print(f"   Hardware ID: {port.hwid}")
        
        # Check if it's likely an Arduino
        description_lower = port.description.lower()
        hwid_lower = port.hwid.lower()
        
        if any(keyword in description_lower for keyword in ['arduino', 'ch340', 'cp210', 'ftdi', 'usb serial']):
            arduino_ports.append(port.device)
            print(f"   ✅ Likely Arduino device!")
        elif any(keyword in hwid_lower for keyword in ['0403:6001', '1a86:7523', '10c4:ea60']):
            arduino_ports.append(port.device)
            print(f"   ✅ Arduino-compatible USB-Serial device!")
        
        print()
    
    return arduino_ports

def test_port(port, baud_rate=115200):
    """Test a COM port to see if Arduino is responding"""
    try:
        print(f"🔌 Testing {port} at {baud_rate} baud...")
        
        ser = serial.Serial(port, baud_rate, timeout=2)
        time.sleep(2)  # Wait for Arduino reset
        
        # Send a test command
        ser.write(b'STATUS\n')
        time.sleep(1)
        
        # Read response
        response_lines = []
        start_time = time.time()
        
        while time.time() - start_time < 3:  # Wait up to 3 seconds
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    response_lines.append(line)
                    print(f"   📝 Arduino: {line}")
        
        ser.close()
        
        if response_lines:
            print(f"   ✅ {port} is responding!")
            return True
        else:
            print(f"   ❌ {port} not responding")
            return False
            
    except serial.SerialException as e:
        print(f"   ❌ Error testing {port}: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Unexpected error testing {port}: {e}")
        return False

def main():
    print("🔍 Arduino COM Port Finder")
    print("="*30)
    print()
    
    # Find all ports
    arduino_ports = find_arduino_ports()
    
    if arduino_ports:
        print(f"🎯 Found {len(arduino_ports)} potential Arduino port(s):")
        for port in arduino_ports:
            print(f"   - {port}")
        print()
        
        # Test each potential Arduino port
        print("🧪 Testing Arduino ports...")
        print("-" * 30)
        
        working_ports = []
        for port in arduino_ports:
            if test_port(port):
                working_ports.append(port)
            print()
        
        if working_ports:
            print("✅ Working Arduino ports found:")
            for port in working_ports:
                print(f"   - {port}")
            
            print("\n📋 To use with SmartTrack RFID Serial Reader:")
            print(f"   Update SERIAL_PORT = '{working_ports[0]}' in the Python script")
        else:
            print("❌ No responding Arduino found")
            print("\n💡 Troubleshooting tips:")
            print("   1. Make sure Arduino is connected via USB")
            print("   2. Check if the correct drivers are installed")
            print("   3. Try uploading the SmartTrack_RFID_Serial.ino sketch")
            print("   4. Check Arduino IDE Serial Monitor for activity")
    
    else:
        print("❌ No potential Arduino ports found")
        print("\n💡 Make sure:")
        print("   1. Arduino is connected via USB cable")
        print("   2. USB drivers are installed")
        print("   3. Arduino appears in Device Manager")

if __name__ == "__main__":
    main()
    input("\nPress Enter to exit...")
