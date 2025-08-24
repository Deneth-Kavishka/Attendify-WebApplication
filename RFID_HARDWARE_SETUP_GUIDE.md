# 🎯 RFID Hardware Integration Guide for SmartTrack

## 🔧 **Hardware Requirements**

### **RFID Module: RC522**

- **Operating Frequency**: 13.56MHz
- **Communication**: SPI interface
- **Reading Distance**: 2-3cm
- **Compatible Cards**: MIFARE Classic 1K, MIFARE Ultralight
- **Voltage**: 3.3V (Arduino provides 3.3V output)

### **Microcontroller Options**

1. **Arduino Uno/Nano** (Recommended for beginners)
2. **ESP32** (Recommended for wireless/advanced features)
3. **Arduino Mega** (For multiple RFID readers)

### **Additional Components**

- Jumper wires (Male-to-Female)
- Breadboard (optional)
- USB cable for programming
- RFID cards/keyfobs for testing

## 📋 **Wiring Connections**

### **RC522 to Arduino Uno/Nano:**

```
RC522 Pin    Arduino Pin    Description
---------    -----------    -----------
SDA          D10            Chip Select
SCK          D13            Clock
MOSI         D11            Data In
MISO         D12            Data Out
IRQ          Not Connected  Interrupt (optional)
GND          GND            Ground
RST          D9             Reset
3.3V         3.3V           Power Supply
```

### **RC522 to ESP32:**

```
RC522 Pin    ESP32 Pin      Description
---------    ---------      -----------
SDA          GPIO5          Chip Select
SCK          GPIO18         Clock
MOSI         GPIO23         Data In
MISO         GPIO19         Data Out
IRQ          Not Connected  Interrupt (optional)
GND          GND            Ground
RST          GPIO4          Reset
3.3V         3.3V           Power Supply
```

### **Optional Components:**

```
Component    Arduino Pin    ESP32 Pin      Description
---------    -----------    ---------      -----------
LED          D13            GPIO2          Status indicator
Buzzer       D8             GPIO25         Audio feedback
Button       D7             GPIO0          Manual trigger
```

## 💻 **Software Setup**

### **1. Arduino IDE Setup**

1. Install Arduino IDE from: https://www.arduino.cc/en/software
2. Install MFRC522 Library:
   - Go to: Sketch → Include Library → Manage Libraries
   - Search for "MFRC522"
   - Install "MFRC522 by GithubCommunity"

### **2. Upload RFID Reader Code**

1. Open `arduino_code/RFID_Reader_SmartTrack.ino`
2. Select your board: Tools → Board → Arduino Uno (or ESP32)
3. Select correct COM port: Tools → Port → COMx
4. Upload the code: Click Upload button

### **3. Install Node.js Dependencies**

```bash
# Install serialport for hardware communication
npm install serialport@12.0.0

# Start RFID service
npm run rfid
```

## 🚀 **Integration Steps**

### **1. Start the RFID Hardware Service**

```bash
# Terminal 1: Start main application
npm run dev

# Terminal 2: Start RFID hardware service
npm run rfid
```

### **2. Connect Hardware**

1. Connect Arduino/ESP32 to computer via USB
2. Verify connection in Device Manager (Windows) or dmesg (Linux)
3. Note the COM port (e.g., COM3, /dev/ttyUSB0)

### **3. Test RFID Reading**

1. Open Arduino IDE Serial Monitor (115200 baud)
2. You should see: "SmartTrack RFID Reader v1.0"
3. Type `START_SCAN` to begin scanning
4. Present RFID card - you should see: `RFID:XXXXXXXX`

### **4. Integration with Web Application**

1. Open Student Registration form
2. Select "Scan RFID Card" option
3. Click "Start RFID Scan"
4. Present RFID card to reader
5. Card ID automatically populates in form

## 🔧 **Configuration Options**

### **Environment Variables**

```bash
# .env file
RFID_WEBSOCKET_URL=ws://localhost:8081/rfid
RFID_SERIAL_PORT=COM3          # Windows
RFID_SERIAL_PORT=/dev/ttyUSB0  # Linux
RFID_BAUD_RATE=9600
```

### **Auto-Detection Settings**

The system automatically detects RFID readers based on:

- **Vendor IDs**: 1A86 (CH340), 0403 (FTDI), 10C4 (CP210x)
- **Manufacturers**: Arduino, Silicon Labs, FTDI
- **Device Names**: Contains "Arduino" or "CH340"

## 🛠️ **Troubleshooting**

### **Common Issues & Solutions**

#### **1. RFID Module Not Detected**

```
Error: RFID module not found!
```

**Solutions:**

- Check wiring connections (especially SDA, SCK, MOSI, MISO)
- Verify 3.3V power supply (NOT 5V!)
- Ensure RST pin is connected
- Try different jumper wires

#### **2. Serial Port Access Denied**

```
Error: Access denied to COM port
```

**Solutions:**

- Close Arduino IDE Serial Monitor
- Check if another program is using the port
- Run terminal as Administrator (Windows)
- Add user to dialout group (Linux): `sudo usermod -a -G dialout $USER`

#### **3. Cards Not Reading**

```
No response when presenting cards
```

**Solutions:**

- Ensure scanning is active (send `START_SCAN`)
- Try different RFID cards (MIFARE Classic 1K recommended)
- Check reader distance (2-3cm maximum)
- Verify antenna connections on RC522 module

#### **4. WebSocket Connection Failed**

```
Failed to connect to RFID reader
```

**Solutions:**

- Ensure RFID service is running: `npm run rfid`
- Check WebSocket URL: `ws://localhost:8081/rfid`
- Verify firewall settings
- Use Chrome or Edge browser (Web Serial API support)

### **5. Multiple Reads of Same Card**

```
Card reading multiple times rapidly
```

**Solutions:**

- Code includes 2-second delay between reads
- Move card away after successful read
- Adjust `CARD_READ_DELAY` in Arduino code

## 📊 **Testing Procedures**

### **1. Hardware Test**

```bash
# Connect via serial terminal
screen /dev/ttyUSB0 9600  # Linux
# or use Arduino IDE Serial Monitor

# Commands to test:
START_SCAN    # Begin scanning
STOP_SCAN     # Stop scanning
PING          # Test communication
VERSION       # Get firmware version
```

### **2. Web Integration Test**

1. Start both services (main app + RFID service)
2. Open browser console for debugging
3. Navigate to Student Registration
4. Test each RFID option:
   - ✅ No RFID Card
   - ✅ Generate New RFID
   - ✅ Enter Manually
   - ✅ **Scan RFID Card** ← Test this

### **3. Multiple Card Test**

1. Test with 5-10 different RFID cards
2. Verify each card gets unique ID
3. Check for duplicate detection
4. Test card assignment validation

## 🔒 **Security Considerations**

### **RFID Security**

- **Card Cloning**: MIFARE Classic cards can be cloned
- **Recommendation**: Use cards for convenience, rely on face recognition for security
- **Encryption**: Consider MIFARE DESFire for high-security applications

### **Network Security**

- **WebSocket**: Runs on localhost only by default
- **Serial Access**: Requires physical access to computer
- **Data Validation**: All RFID data is validated before database storage

## 📈 **Production Deployment**

### **1. Dedicated RFID Station**

- Use Raspberry Pi for dedicated RFID reading station
- Connect multiple RFID readers for simultaneous scanning
- Implement MQTT for wireless communication

### **2. Multiple Reader Setup**

```javascript
// Support for multiple RFID readers
const readers = [
  { port: "/dev/ttyUSB0", location: "Main Entrance" },
  { port: "/dev/ttyUSB1", location: "Lab Entry" },
  { port: "/dev/ttyUSB2", location: "Registration Desk" },
];
```

### **3. Performance Optimization**

- **Card Whitelist**: Only accept pre-registered cards
- **Rate Limiting**: Prevent card spam attacks
- **Caching**: Cache card-to-student mappings
- **Monitoring**: Log all RFID events for audit

## 🎯 **Summary**

The RFID hardware integration provides:

- ✅ **Real-time card scanning** with Arduino/ESP32
- ✅ **Web Serial API** integration for direct USB access
- ✅ **WebSocket fallback** for network-based readers
- ✅ **Auto-detection** of RFID reader hardware
- ✅ **Comprehensive error handling** and user feedback
- ✅ **Production-ready** architecture with security considerations

**Ready for deployment with any RC522-based RFID reader! 🚀**
