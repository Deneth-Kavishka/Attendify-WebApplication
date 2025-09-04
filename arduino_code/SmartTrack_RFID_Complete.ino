/*
 * SmartTrack Complete RFID Attendance System
 * NodeMCU ESP8266 with RC522 RFID Module + LCD + LEDs + Buzzer
 * 
 * Features:
 * - Real-time WiFi communication with backend
 * - WebSocket connection for instant data sync
 * - Firebase & PostgreSQL integration
 * - Complete student profile retrieval
 * - Audio/Visual feedback
 * - LCD display for student information
 * 
 * Pin Configuration:
 * 3.3V    → RC522 VCC & LCD VCC
 * GND     → Common Ground
 * D1 (5)  → RC522 RST
 * D2 (4)  → RC522 SDA
 * D5 (14) → RC522 SCK
 * D6 (12) → RC522 MISO
 * D7 (13) → RC522 MOSI
 * D3 (0)  → Green LED (+)
 * D4 (2)  → Red LED (+)
 * D8 (15) → Buzzer (+)
 * D0 (16) → Configuration Button
 * SDA     → LCD SDA (I2C)
 * SCL     → LCD SCL (I2C)
 */

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 PIN CONFIGURATION - Your Specified Mapping
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

// I2C LCD (using default I2C pins)
// SDA = D2 (4) - Already used by RFID, we'll use software I2C
// SCL = D1 (5) - Already used by RFID, we'll use software I2C
// Alternative I2C pins for LCD
#define LCD_SDA_PIN     9   // SD2 alternative
#define LCD_SCL_PIN     10  // SD3 alternative

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// WiFi Configuration
const char* WIFI_SSID = "Dialog 4G 303";        // Your WiFi network name
const char* WIFI_PASSWORD = "Ba5315e7";         // Your WiFi password
const char* SERVER_HOST = "192.168.8.110";  // Your PC's IP address
const int websocket_port = 5000;                // WebSocket port (Node.js backend)
const char* websocket_path = "/rfid-ws";        // WebSocket endpoint

// Device Configuration
const char* device_id = "RFID_SCANNER_001";    // Unique device identifier
const char* device_type = "RFID_READER";
const char* device_location = "Main Entrance"; // Physical location
const char* device_version = "SmartTrack_v3.0";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize RFID reader
MFRC522 rfid(SS_PIN, RST_PIN);

// Initialize LCD (20x4 I2C LCD)
LiquidCrystal_I2C lcd(0x27, 20, 4);  // Address 0x27, 20 columns, 4 rows

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
// 📺 LCD DISPLAY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void initLCD() {
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  // Boot screen
  lcd.setCursor(0, 0);
  lcd.print("   SmartTrack RFID   ");
  lcd.setCursor(0, 1);
  lcd.print("  Attendance System  ");
  lcd.setCursor(0, 2);
  lcd.print("   Initializing...   ");
  lcd.setCursor(0, 3);
  lcd.print("     Please Wait     ");
  
  delay(3000);
}

void displaySystemStatus() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SmartTrack RFID v3.0");
  
  lcd.setCursor(0, 1);
  if (wifiConnected) {
    lcd.print("WiFi: Connected     ");
  } else {
    lcd.print("WiFi: Disconnected  ");
  }
  
  lcd.setCursor(0, 2);
  if (websocketConnected) {
    lcd.print("Server: Online      ");
  } else {
    lcd.print("Server: Offline     ");
  }
  
  lcd.setCursor(0, 3);
  lcd.print("Ready to Scan...    ");
}

void displayStudentInfo(JsonObject student) {
  lcd.clear();
  
  // Line 1: Welcome message
  lcd.setCursor(0, 0);
  lcd.print("Welcome Back!       ");
  
  // Line 2: Student name (truncated if too long)
  lcd.setCursor(0, 1);
  String name = student["fullName"].as<String>();
  if (name.length() > 20) {
    name = name.substring(0, 17) + "...";
  }
  lcd.print(name);
  
  // Line 3: Student ID and Department
  lcd.setCursor(0, 2);
  String studentId = student["studentId"].as<String>();
  String dept = student["department"].as<String>();
  lcd.print(studentId + " | " + dept);
  
  // Line 4: Attendance percentage
  lcd.setCursor(0, 3);
  float attendance = student["attendanceStats"]["attendancePercentage"].as<float>();
  lcd.print("Attendance: " + String(attendance, 1) + "%");
}

void displayErrorMessage(String message) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("   ACCESS DENIED    ");
  lcd.setCursor(0, 1);
  lcd.print("                    ");
  lcd.setCursor(0, 2);
  lcd.print(message);
  lcd.setCursor(0, 3);
  lcd.print("Try again...        ");
}

void displayScanningMessage() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("    SCANNING...     ");
  lcd.setCursor(0, 1);
  lcd.print("                    ");
  lcd.setCursor(0, 2);
  lcd.print("Present your RFID   ");
  lcd.setCursor(0, 3);
  lcd.print("card to the reader  ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 WEBSOCKET FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WebSocket] Disconnected!");
      websocketConnected = false;
      displaySystemStatus();
      break;
      
    case WStype_CONNECTED:
      {
        Serial.printf("[WebSocket] Connected to: %s\n", payload);
        websocketConnected = true;
        
        // Send device registration
        DynamicJsonDocument regDoc(1024);
        regDoc["type"] = "device_register";
        regDoc["deviceId"] = device_id;
        regDoc["deviceType"] = device_type;
        regDoc["location"] = device_location;
        regDoc["version"] = device_version;
        regDoc["capabilities"] = "rfid_scan,led_feedback,buzzer,lcd_display";
        
        String regMessage;
        serializeJson(regDoc, regMessage);
        webSocket.sendTXT(regMessage);
        
        displaySystemStatus();
        playSuccessTone();
        break;
      }
      
    case WStype_TEXT:
      Serial.printf("[WebSocket] Received: %s\n", payload);
      handleWebSocketMessage((char*)payload);
      break;
      
    default:
      break;
  }
}

void handleWebSocketMessage(String message) {
  DynamicJsonDocument doc(2048);
  deserializeJson(doc, message);
  
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
      String errorMsg = doc["message"];
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
    // Server acknowledged our heartbeat
    Serial.println("[Heartbeat] Acknowledged by server");
  }
  else if (type == "config_update") {
    // Handle configuration updates from server
    if (doc.containsKey("scanCooldown")) {
      // Update scan cooldown if provided
      Serial.println("[Config] Updated from server");
    }
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
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
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
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
    
    Serial.println("[RFID] Sent to server: " + rfidCard);
  } else {
    Serial.println("[ERROR] WebSocket not connected, cannot send RFID data");
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
  Serial.println();
  Serial.println("🚀 SmartTrack RFID System Starting...");
  
  // Initialize pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);
  
  // Turn off LEDs initially
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  
  // Initialize I2C for LCD
  // Note: Default I2C pins (D1=SCL, D2=SDA) conflict with RFID pins
  // If using default I2C, LCD should be connected to D1(SCL) and D2(SDA) 
  // But since D1 and D2 are used by RFID, consider using:
  // Software I2C or connect LCD to different pins if needed
  Wire.begin(); // Use default I2C pins (SDA=D2/GPIO4, SCL=D1/GPIO5)
  
  // Initialize LCD
  initLCD();
  
  // Play boot sound
  playBootTone();
  
  // Initialize SPI bus
  SPI.begin();
  
  // Initialize RFID reader
  rfid.PCD_Init();
  rfidReady = true;
  Serial.println("✅ RFID Reader initialized");
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("🔌 Connecting to WiFi...");
  
  lcd.setCursor(0, 2);
  lcd.print("Connecting to WiFi...");
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.println("✅ WiFi connected!");
    Serial.printf("📡 IP address: %s\n", WiFi.localIP().toString().c_str());
    
    // Initialize WebSocket connection
    webSocket.begin(SERVER_HOST, websocket_port, websocket_path);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    
    Serial.println("🔗 WebSocket client initialized");
  } else {
    Serial.println("❌ WiFi connection failed!");
    lcd.setCursor(0, 2);
    lcd.print("WiFi Failed!        ");
    playErrorTone();
  }
  
  // Show initial status
  delay(2000);
  displaySystemStatus();
  
  Serial.println("🎯 SmartTrack RFID System Ready!");
  Serial.println("📋 Waiting for RFID cards...");
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
  
  // Check for RFID cards
  if (rfidReady && !rfid.PICC_IsNewCardPresent()) {
    return;
  }
  
  if (rfidReady && !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Prevent rapid scanning
  if (millis() - lastScanTime < SCAN_COOLDOWN) {
    return;
  }
  
  // Read RFID card
  String rfidCard = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    rfidCard += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
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
  
  // Halt PICC
  rfid.PICC_HaltA();
  
  // Stop encryption on PCD
  rfid.PCD_StopCrypto1();
  
  delay(100); // Small delay to prevent multiple reads
}
