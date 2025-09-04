/*
 * SmartTrack Complete RFID Attendance System - FIXED VERSION
 * NodeMCU ESP8266 with RC522 RFID Module + LCD + LEDs + Buzzer
 * 
 * IMPORTANT PIN MAPPING (CORRECTED):
 * =====================================
 * 3.3V    → RC522 VCC & LCD VCC
 * GND     → Common Ground
 * 
 * RFID RC522 Connections:
 * D1 (5)  → RC522 RST
 * D2 (4)  → RC522 SDA
 * D5 (14) → RC522 SCK
 * D6 (12) → RC522 MISO
 * D7 (13) → RC522 MOSI
 * 
 * Feedback Components:
 * D3 (0)  → Green LED (+)
 * D4 (2)  → Red LED (+)
 * D8 (15) → Buzzer (+)
 * D0 (16) → Configuration Button
 * 
 * LCD I2C (20x4):
 * D1 (5)  → LCD SCL (I2C Clock) - CONFLICT WITH RFID RST!
 * D2 (4)  → LCD SDA (I2C Data)  - CONFLICT WITH RFID SDA!
 * 
 * SOLUTION: Use 16x2 LCD with parallel connection OR software I2C
 * For this version, we'll use Serial output instead of LCD to avoid conflicts
 */

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <EEPROM.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 PIN CONFIGURATION - CORRECTED FOR ESP8266
// ═══════════════════════════════════════════════════════════════════════════════

// RC522 RFID Module Pins
#define RST_PIN         5   // D1 - RC522 Reset pin
#define SS_PIN          4   // D2 - RC522 SDA pin  
#define SCK_PIN         14  // D5 - RC522 SCK pin
#define MISO_PIN        12  // D6 - RC522 MISO pin
#define MOSI_PIN        13  // D7 - RC522 MOSI pin

// Feedback Components
#define GREEN_LED_PIN   0   // D3 - Green LED for success
#define RED_LED_PIN     2   // D4 - Red LED for error/unauthorized
#define BUZZER_PIN      15  // D8 - Buzzer for audio feedback
#define CONFIG_BTN_PIN  16  // D0 - Configuration button

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// WiFi Configuration - UPDATE THESE!
const char* WIFI_SSID = "Dialog 4G 303";        // Your WiFi network name
const char* WIFI_PASSWORD = "Ba5315e7";         // Your WiFi password
const char* SERVER_HOST = "192.168.8.110";      // Your PC's IP address
const int websocket_port = 3001;                 // WebSocket port (Python backend)
const char* websocket_path = "/";                // WebSocket endpoint

// Device Configuration
const char* device_id = "RFID_SCANNER_001";    // Unique device identifier
const char* device_type = "RFID_READER";
const char* device_location = "Main Entrance"; // Physical location
const char* device_version = "SmartTrack_v3.1";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize RFID reader
MFRC522 rfid(SS_PIN, RST_PIN);

// WebSocket client
WebSocketsClient webSocket;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SYSTEM VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

// System Status
bool wifiConnected = false;
bool websocketConnected = false;
bool rfidReady = false;
unsigned long lastHeartbeat = 0;
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 3000; // 3 seconds between scans

// Statistics
unsigned long totalScans = 0;
unsigned long successfulScans = 0;
unsigned long failedScans = 0;

// Current student info
String currentStudent = "";
String currentStudentId = "";
bool studentDisplayActive = false;
unsigned long studentDisplayStart = 0;
const unsigned long DISPLAY_DURATION = 10000; // Show student info for 10 seconds

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 AUDIO PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

void playSuccessTone() {
  tone(BUZZER_PIN, 1000, 200);  // High pitch for success
  delay(250);
  tone(BUZZER_PIN, 1200, 200);
  delay(250);
  noTone(BUZZER_PIN);
}

void playErrorTone() {
  tone(BUZZER_PIN, 400, 500);   // Low pitch for error
  delay(600);
  tone(BUZZER_PIN, 300, 500);
  delay(600);
  noTone(BUZZER_PIN);
}

void playBootTone() {
  tone(BUZZER_PIN, 800, 100);
  delay(150);
  tone(BUZZER_PIN, 1000, 100);
  delay(150);
  tone(BUZZER_PIN, 1200, 150);
  delay(200);
  noTone(BUZZER_PIN);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💡 LED CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

void setLEDStatus(String status) {
  if (status == "success") {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, LOW);
    delay(2000);
    digitalWrite(GREEN_LED_PIN, LOW);
  } else if (status == "error") {
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(GREEN_LED_PIN, LOW);
    delay(2000);
    digitalWrite(RED_LED_PIN, LOW);
  } else if (status == "scanning") {
    // Blinking green during scan
    for (int i = 0; i < 3; i++) {
      digitalWrite(GREEN_LED_PIN, HIGH);
      delay(200);
      digitalWrite(GREEN_LED_PIN, LOW);
      delay(200);
    }
  } else if (status == "idle") {
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📺 DISPLAY FUNCTIONS (Serial Monitor)
// ═══════════════════════════════════════════════════════════════════════════════

void displaySystemStatus() {
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║       SmartTrack RFID v3.1        ║");
  Serial.println("╠════════════════════════════════════╣");
  
  if (wifiConnected) {
    Serial.println("║ WiFi: ✅ Connected                ║");
  } else {
    Serial.println("║ WiFi: ❌ Disconnected             ║");
  }
  
  if (websocketConnected) {
    Serial.println("║ Server: ✅ Online                 ║");
  } else {
    Serial.println("║ Server: ❌ Offline                ║");
  }
  
  Serial.println("║ Status: 🎯 Ready to Scan          ║");
  Serial.println("╚════════════════════════════════════╝");
}

void displayStudentInfo(JsonObject student) {
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║          🎉 WELCOME BACK!          ║");
  Serial.println("╠════════════════════════════════════╣");
  
  String name = student["fullName"].as<String>();
  Serial.println("║ Student: " + name);
  
  String studentId = student["studentId"].as<String>();
  String dept = student["department"].as<String>();
  Serial.println("║ ID: " + studentId + " | Dept: " + dept);
  
  float attendance = student["attendanceStats"]["attendancePercentage"].as<float>();
  Serial.println("║ Attendance: " + String(attendance, 1) + "%");
  
  Serial.println("╚════════════════════════════════════╝");
}

void displayErrorMessage(String message) {
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║           ❌ ACCESS DENIED         ║");
  Serial.println("╠════════════════════════════════════╣");
  Serial.println("║ Error: " + message);
  Serial.println("║ Please try again...                ║");
  Serial.println("╚════════════════════════════════════╝");
}

void displayScanningMessage() {
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║           📱 SCANNING...           ║");
  Serial.println("║   Present your RFID card now...    ║");
  Serial.println("╚════════════════════════════════════╝");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 WEBSOCKET FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WebSocket] 📴 Disconnected!");
      websocketConnected = false;
      displaySystemStatus();
      break;
      
    case WStype_CONNECTED:
      {
        Serial.printf("[WebSocket] 🔗 Connected to: %s\n", payload);
        websocketConnected = true;
        
        // Send device registration
        DynamicJsonDocument regDoc(1024);
        regDoc["type"] = "device_register";
        regDoc["deviceId"] = device_id;
        regDoc["deviceType"] = device_type;
        regDoc["location"] = device_location;
        regDoc["version"] = device_version;
        regDoc["capabilities"] = "rfid_scan,led_feedback,buzzer,serial_display";
        
        String regMessage;
        serializeJson(regDoc, regMessage);
        webSocket.sendTXT(regMessage);
        
        displaySystemStatus();
        playSuccessTone();
        break;
      }
      
    case WStype_TEXT:
      Serial.printf("[WebSocket] 📨 Received: %s\n", payload);
      handleWebSocketMessage((char*)payload);
      break;
      
    default:
      break;
  }
}

void handleWebSocketMessage(String message) {
  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("❌ JSON parsing failed: " + String(error.c_str()));
    return;
  }
  
  String type = doc["type"];
  
  if (type == "attendance_response") {
    bool success = doc["success"];
    String rfidCard = doc["rfidCard"];
    
    if (success) {
      JsonObject student = doc["student"];
      displayStudentInfo(student);
      setLEDStatus("success");
      playSuccessTone();
      successfulScans++;
      
      studentDisplayActive = true;
      studentDisplayStart = millis();
      currentStudent = student["fullName"].as<String>();
      currentStudentId = student["studentId"].as<String>();
    } else {
      String errorMsg = doc["message"].as<String>();
      displayErrorMessage(errorMsg);
      setLEDStatus("error");
      playErrorTone();
      failedScans++;
      
      // Return to scanning mode after 3 seconds
      delay(3000);
      displayScanningMessage();
    }
  }
  else if (type == "heartbeat_response") {
    Serial.println("[Heartbeat] 💓 Server acknowledged");
  }
  else if (type == "config_update") {
    Serial.println("[Config] ⚙️ Configuration updated from server");
  }
  else if (type == "registration_ack") {
    Serial.println("[Registration] ✅ Device registered successfully");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 COMMUNICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void sendHeartbeat() {
  if (websocketConnected) {
    DynamicJsonDocument doc(512);
    doc["type"] = "heartbeat";
    doc["deviceId"] = device_id;
    doc["timestamp"] = millis();
    doc["totalScans"] = totalScans;
    doc["successfulScans"] = successfulScans;
    doc["failedScans"] = failedScans;
    doc["memoryFree"] = ESP.getFreeHeap();
    doc["wifiSignal"] = WiFi.RSSI();
    doc["uptime"] = millis() / 1000; // Uptime in seconds
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
    
    Serial.println("[Heartbeat] 💓 Sent to server");
  }
}

void sendRFIDScan(String rfidCard) {
  if (websocketConnected) {
    DynamicJsonDocument doc(512);
    doc["type"] = "rfid_scan";
    doc["deviceId"] = device_id;
    doc["rfidCard"] = rfidCard;
    doc["timestamp"] = millis();
    doc["location"] = device_location;
    doc["signalStrength"] = WiFi.RSSI();
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
    
    Serial.println("[RFID] 📤 Sent to server: " + rfidCard);
  } else {
    Serial.println("[ERROR] ❌ WebSocket not connected, cannot send RFID data");
    displayErrorMessage("Server Offline");
    setLEDStatus("error");
    playErrorTone();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("🚀 SmartTrack RFID System Starting...");
  Serial.println("📍 Device: " + String(device_id));
  Serial.println("📍 Location: " + String(device_location));
  Serial.println("📍 Version: " + String(device_version));
  
  // Initialize pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);
  
  // Turn off LEDs initially
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  
  // Play boot sound
  playBootTone();
  
  // Initialize SPI bus for RFID
  SPI.begin();
  
  // Initialize RFID reader
  rfid.PCD_Init();
  
  // Test RFID reader
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("❌ RFID Reader not detected! Check wiring.");
    while(1) {
      digitalWrite(RED_LED_PIN, HIGH);
      delay(500);
      digitalWrite(RED_LED_PIN, LOW);
      delay(500);
    }
  } else {
    rfidReady = true;
    Serial.println("✅ RFID Reader initialized successfully");
    Serial.println("📡 RFID Firmware Version: 0x" + String(version, HEX));
  }
  
  // Connect to WiFi
  Serial.println("🔌 Connecting to WiFi: " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 30) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
    
    // Blink red LED while connecting
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(GREEN_LED_PIN, HIGH);
    
    Serial.println();
    Serial.println("✅ WiFi connected successfully!");
    Serial.println("📡 IP address: " + WiFi.localIP().toString());
    Serial.println("📶 Signal strength: " + String(WiFi.RSSI()) + " dBm");
    
    // Initialize WebSocket connection
    Serial.println("🔗 Connecting to server: " + String(SERVER_HOST) + ":" + String(websocket_port));
    webSocket.begin(SERVER_HOST, websocket_port, websocket_path);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    webSocket.enableHeartbeat(15000, 3000, 2); // 15s ping, 3s pong timeout, 2 retries
    
    digitalWrite(GREEN_LED_PIN, LOW);
    Serial.println("🔗 WebSocket client initialized");
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed!");
    Serial.println("💡 Please check WiFi credentials and network availability");
    playErrorTone();
    
    // Continue without WiFi for offline operation
    Serial.println("⚠️ Continuing in offline mode...");
  }
  
  // Show initial status
  delay(2000);
  displaySystemStatus();
  
  Serial.println("🎯 SmartTrack RFID System Ready!");
  Serial.println("📋 Place RFID card near the reader...");
  Serial.println("═══════════════════════════════════════");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // Handle WebSocket communication
  webSocket.loop();
  
  // Send periodic heartbeat
  if (millis() - lastHeartbeat > 30000) { // Every 30 seconds
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Handle student info display timeout
  if (studentDisplayActive && (millis() - studentDisplayStart > DISPLAY_DURATION)) {
    studentDisplayActive = false;
    displaySystemStatus();
    Serial.println("📺 Returned to main display");
  }
  
  // Check configuration button
  if (digitalRead(CONFIG_BTN_PIN) == LOW) {
    Serial.println("🔧 Configuration button pressed");
    displaySystemStatus();
    delay(1000); // Debounce
  }
  
  // Check for RFID cards
  if (!rfidReady || !rfid.PICC_IsNewCardPresent()) {
    return;
  }
  
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Prevent rapid scanning
  if (millis() - lastScanTime < SCAN_COOLDOWN) {
    Serial.println("⏳ Please wait " + String((SCAN_COOLDOWN - (millis() - lastScanTime)) / 1000) + " seconds between scans");
    return;
  }
  
  // Read RFID card
  String rfidCard = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) rfidCard += "0";
    rfidCard += String(rfid.uid.uidByte[i], HEX);
  }
  rfidCard.toUpperCase();
  
  Serial.println("📱 RFID Card Detected: " + rfidCard);
  
  // Show scanning feedback
  displayScanningMessage();
  setLEDStatus("scanning");
  
  // Send to server for processing
  sendRFIDScan(rfidCard);
  totalScans++;
  lastScanTime = millis();
  
  // Halt PICC and stop encryption
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  
  delay(100); // Small delay to prevent multiple reads
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void printSystemInfo() {
  Serial.println("\n📊 System Information:");
  Serial.println("═══════════════════════════════════════");
  Serial.println("Device ID: " + String(device_id));
  Serial.println("Version: " + String(device_version));
  Serial.println("Location: " + String(device_location));
  Serial.println("Uptime: " + String(millis() / 1000) + " seconds");
  Serial.println("Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("WiFi RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Total Scans: " + String(totalScans));
  Serial.println("Successful: " + String(successfulScans));
  Serial.println("Failed: " + String(failedScans));
  Serial.println("═══════════════════════════════════════");
}
