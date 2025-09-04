/**
 * Enhanced NodeMCU RFID Attendance System
 * Complete integration with SmartTrack backend
 * 
 * Features:
 * - WebSocket real-time communication
 * - Automatic reconnection
 * - Local data storage during offline mode
 * - Complete student information display
 * - Status LEDs and buzzer feedback
 * - Heartbeat monitoring
 * 
 * Version: 3.0.0
 * Compatible with: SmartTrack Enhanced RFID Service
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
// 📌 HARDWARE CONFIGURATION - VERIFIED PINOUT
// ═══════════════════════════════════════════════════════════════════════════════

// RC522 RFID Module Pins (Standard SPI Configuration)
#define RST_PIN         5   // D1 - RC522 Reset pin
#define SS_PIN          4   // D2 - RC522 SDA/SS pin  
#define SCK_PIN         14  // D5 - RC522 SCK pin (Hardware SPI)
#define MISO_PIN        12  // D6 - RC522 MISO pin (Hardware SPI)
#define MOSI_PIN        13  // D7 - RC522 MOSI pin (Hardware SPI)

// Feedback Components
#define GREEN_LED_PIN   0   // D3 - Green LED for success
#define RED_LED_PIN     2   // D4 - Red LED for error/unauthorized
#define BUZZER_PIN      15  // D8 - Buzzer for audio feedback
#define CONFIG_BTN_PIN  16  // D0 - Configuration button

// I2C LCD Display (16x2) - Uses default I2C pins
// SDA -> D2 (GPIO4) - Shared with SS_PIN, but different usage
// SCL -> D1 (GPIO5) - Shared with RST_PIN, but different usage
#define LCD_ADDRESS     0x27
#define LCD_COLS        16
#define LCD_ROWS        2

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK CONFIGURATION - UPDATE THESE!
// ═══════════════════════════════════════════════════════════════════════════════

const char* WIFI_SSID = "Dialog 4G 303";        // Your WiFi network name
const char* WIFI_PASSWORD = "Ba5315e7";         // Your WiFi password
const char* SERVER_HOST = "192.168.8.110";      // Your computer's IP address
const int SERVER_PORT = 9000;                   // WebSocket server port (Python RFID System)
const char* WEBSOCKET_PATH = "/";                // WebSocket path

// Device Configuration
const char* DEVICE_ID = "RFID_NODEMCU_001";
const char* DEVICE_LOCATION = "Main Entrance";
const char* DEFAULT_CLASS_ID = "CLASS_DEFAULT";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE OBJECTS
// ═══════════════════════════════════════════════════════════════════════════════

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);
WebSocketsClient webSocket;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SYSTEM STATE VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

// Connection Status
bool wifi_connected = false;
bool websocket_connected = false;
bool scanning_enabled = true;

// Timing
unsigned long last_heartbeat = 0;
unsigned long last_card_read = 0;
unsigned long last_display_update = 0;
unsigned long wifi_reconnect_timer = 0;
unsigned long websocket_reconnect_timer = 0;

// Card Reading
String last_card_id = "";
const unsigned long CARD_COOLDOWN = 3000;      // 3 seconds between same card reads
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds
const unsigned long DISPLAY_TIMEOUT = 10000;    // 10 seconds
const unsigned long RECONNECT_INTERVAL = 5000;  // 5 seconds

// Statistics
unsigned long total_scans = 0;
unsigned long successful_scans = 0;
unsigned long failed_scans = 0;

// Display State
bool display_active = false;
unsigned long display_timeout = 0;
String current_display_line1 = "";
String current_display_line2 = "";

// Student Information
struct StudentInfo {
  String name;
  String studentId;
  String department;
  float attendancePercentage;
  bool isValid;
};

StudentInfo lastStudent;

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 SYSTEM INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  // Initialize Serial Communication
  Serial.begin(115200);
  Serial.println();
  Serial.println("===========================================");
  Serial.println("  SmartTrack Enhanced RFID System v3.0");
  Serial.println("  NodeMCU ESP8266 - System Starting");
  Serial.println("===========================================");
  
  // Initialize EEPROM for statistics storage
  EEPROM.begin(512);
  loadStatistics();
  
  // Initialize GPIO pins
  initializeGPIO();
  
  // Initialize I2C and LCD
  initializeLCD();
  
  // Initialize SPI and RFID
  if (initializeRFID()) {
    Serial.println("✅ RFID reader initialized successfully");
    showMessage("RFID Ready", "Initializing...");
  } else {
    Serial.println("❌ RFID reader initialization failed");
    showMessage("RFID Error", "Check wiring");
    delay(3000);
  }
  
  // Run hardware self-test
  runSelfTest();
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize WebSocket connection
  if (wifi_connected) {
    initializeWebSocket();
  }
  
  // Show ready message
  showMessage("SmartTrack RFID", "System Ready");
  
  Serial.println("===========================================");
  Serial.println("  SYSTEM INITIALIZATION COMPLETE");
  Serial.println("===========================================");
  Serial.println();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // Handle WebSocket communication
  if (websocket_connected) {
    webSocket.loop();
  }
  
  // Check WiFi connection
  checkWiFiConnection();
  
  // Check WebSocket connection
  checkWebSocketConnection();
  
  // Scan for RFID cards
  if (scanning_enabled) {
    scanForRFIDCard();
  }
  
  // Send periodic heartbeat
  sendHeartbeat();
  
  // Handle display timeout
  handleDisplayTimeout();
  
  // Handle button press
  handleButton();
  
  // Small delay to prevent watchdog timeout
  delay(10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 INITIALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void initializeGPIO() {
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);
  
  // Turn off all LEDs initially
  digitalWrite(GREEN_LED_PIN, HIGH); // HIGH = OFF for active low LEDs
  digitalWrite(RED_LED_PIN, HIGH);
  
  Serial.println("✅ GPIO pins initialized");
}

void initializeLCD() {
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  // Show startup message
  lcd.setCursor(0, 0);
  lcd.print("SmartTrack RFID");
  lcd.setCursor(0, 1);
  lcd.print("Starting up...");
  
  Serial.println("✅ LCD initialized");
  delay(2000);
}

bool initializeRFID() {
  SPI.begin();
  rfid.PCD_Init();
  
  // Check if RFID reader is connected
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  
  if (version == 0x00 || version == 0xFF) {
    Serial.println("❌ RFID reader not found");
    return false;
  }
  
  Serial.printf("✅ RFID reader found (version: 0x%02X)\\n", version);
  return true;
}

void runSelfTest() {
  Serial.println("🔧 Running hardware self-test...");
  
  showMessage("Self Test", "Running...");
  
  // Test LEDs
  Serial.println("Testing LEDs...");
  digitalWrite(GREEN_LED_PIN, LOW);
  delay(300);
  digitalWrite(GREEN_LED_PIN, HIGH);
  
  digitalWrite(RED_LED_PIN, LOW);
  delay(300);
  digitalWrite(RED_LED_PIN, HIGH);
  
  // Test buzzer
  Serial.println("Testing Buzzer...");
  tone(BUZZER_PIN, 1000, 200);
  delay(300);
  tone(BUZZER_PIN, 1500, 200);
  delay(300);
  
  // Test button
  Serial.println("Testing Button (press within 3 seconds for confirmation)...");
  showMessage("Press Button", "3 seconds...");
  unsigned long buttonTest = millis();
  bool buttonPressed = false;
  while (millis() - buttonTest < 3000) {
    if (digitalRead(CONFIG_BTN_PIN) == LOW) {
      Serial.println("✅ Button press detected!");
      showMessage("Button OK", "Test passed!");
      tone(BUZZER_PIN, 1200, 100);
      buttonPressed = true;
      delay(1000);
      break;
    }
    delay(50);
  }
  if (!buttonPressed) {
    Serial.println("⚠️ Button not pressed during test");
    showMessage("Button Test", "Skipped");
    delay(1000);
  }
  
  // Test RFID Reader in detail
  Serial.println("Testing RFID Reader...");
  showMessage("Testing RFID", "Please wait...");
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("❌ RFID Reader not detected!");
    Serial.println("Check wiring: RST→D1, SDA→D2, SCK→D5, MOSI→D7, MISO→D6");
    showMessage("RFID Error", "Check wiring");
    tone(BUZZER_PIN, 400, 1000);
    delay(2000);
  } else {
    Serial.printf("✅ RFID Reader detected (Version: 0x%02X)\n", version);
    showMessage("RFID OK", "Version: 0x" + String(version, HEX));
    tone(BUZZER_PIN, 1000, 200);
    delay(1500);
  }
  
  Serial.println("✅ Hardware self-test completed");
  showMessage("Self Test", "Completed!");
  delay(1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORKING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void connectWiFi() {
  Serial.printf("🌐 Connecting to WiFi: %s\\n", WIFI_SSID);
  showMessage("Connecting WiFi", WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    // Update display
    String dots = "";
    for (int i = 0; i < (attempts % 4); i++) {
      dots += ".";
    }
    showMessage("Connecting WiFi", "Please wait" + dots);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.println();
    Serial.printf("✅ WiFi connected! IP: %s\\n", WiFi.localIP().toString().c_str());
    showMessage("WiFi Connected", WiFi.localIP().toString());
    delay(2000);
  } else {
    wifi_connected = false;
    Serial.println();
    Serial.println("❌ WiFi connection failed");
    showMessage("WiFi Failed", "Check settings");
    delay(3000);
  }
}

void checkWiFiConnection() {
  if (!wifi_connected && millis() - wifi_reconnect_timer > RECONNECT_INTERVAL) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("🔄 WiFi disconnected, attempting reconnection...");
      connectWiFi();
    } else {
      wifi_connected = true;
    }
    wifi_reconnect_timer = millis();
  }
}

void initializeWebSocket() {
  Serial.printf("🔌 Connecting to WebSocket: %s:%d\\n", SERVER_HOST, SERVER_PORT);
  showMessage("Connecting WS", SERVER_HOST);
  
  webSocket.begin(SERVER_HOST, SERVER_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  
  // Set user agent to identify as RFID device
  webSocket.setExtraHeaders("User-Agent: ESP32-RFID-Device");
}

void checkWebSocketConnection() {
  if (wifi_connected && !websocket_connected && 
      millis() - websocket_reconnect_timer > RECONNECT_INTERVAL) {
    
    Serial.println("🔄 WebSocket disconnected, attempting reconnection...");
    initializeWebSocket();
    websocket_reconnect_timer = millis();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 WEBSOCKET EVENT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      websocket_connected = false;
      Serial.println("❌ WebSocket Disconnected");
      showMessage("Server Offline", "Reconnecting...");
      break;
      
    case WStype_CONNECTED:
      websocket_connected = true;
      Serial.printf("✅ WebSocket Connected to: %s\\n", payload);
      showMessage("Server Online", "Connected!");
      
      // Send device registration
      sendDeviceRegistration();
      break;
      
    case WStype_TEXT:
      handleWebSocketMessage((char*)payload);
      break;
      
    case WStype_ERROR:
      Serial.printf("❌ WebSocket Error: %s\\n", payload);
      showMessage("Connection Error", "Check server");
      break;
      
    default:
      break;
  }
}

void handleWebSocketMessage(String message) {
  Serial.println("📨 Received: " + message);
  
  // Parse JSON message
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("❌ JSON parse error");
    return;
  }
  
  String type = doc["type"];
  
  if (type == "device_registered") {
    Serial.println("✅ Device registered with server");
    showMessage("Registered", "Ready to scan");
    
  } else if (type == "attendance_response") {
    handleAttendanceResponse(doc);
    
  } else if (type == "unknown_card") {
    handleUnknownCard(doc);
    
  } else if (type == "scan_error") {
    handleScanError(doc);
    
  } else if (type == "heartbeat_ack") {
    Serial.println("💓 Heartbeat acknowledged");
    
  } else {
    Serial.println("❓ Unknown message type: " + type);
  }
}

void handleAttendanceResponse(DynamicJsonDocument &doc) {
  bool success = doc["success"];
  String message = doc["message"];
  
  if (success) {
    successful_scans++;
    
    // Extract student information
    if (doc.containsKey("student")) {
      JsonObject student = doc["student"];
      lastStudent.name = student["name"].as<String>();
      lastStudent.studentId = student["studentId"].as<String>();
      lastStudent.department = student["department"].as<String>();
      lastStudent.attendancePercentage = student["attendancePercentage"];
      lastStudent.isValid = true;
    }
    
    // Show success feedback
    showAttendanceSuccess();
    
    Serial.println("✅ Attendance recorded: " + lastStudent.name);
    
  } else {
    failed_scans++;
    showAttendanceFailure(message);
    Serial.println("❌ Attendance failed: " + message);
  }
  
  saveStatistics();
}

void handleUnknownCard(DynamicJsonDocument &doc) {
  String cardId = doc["cardId"];
  failed_scans++;
  
  showMessage("Unknown Card", cardId.substring(0, 16));
  errorFeedback();
  
  Serial.println("❌ Unknown card: " + cardId);
  saveStatistics();
}

void handleScanError(DynamicJsonDocument &doc) {
  String cardId = doc["cardId"];
  String error = doc["error"];
  failed_scans++;
  
  showMessage("Scan Error", "Try again");
  errorFeedback();
  
  Serial.println("❌ Scan error for " + cardId + ": " + error);
  saveStatistics();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 RFID SCANNING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void scanForRFIDCard() {
  // Check if a new card is present
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }
  
  // Select the card
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Get card UID
  String cardId = getCardUID();
  
  // Check cooldown period
  if (cardId == last_card_id && millis() - last_card_read < CARD_COOLDOWN) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  last_card_id = cardId;
  last_card_read = millis();
  total_scans++;
  
  // Show card detected
  showMessage("Card Detected", cardId.substring(0, 16));
  cardDetectedFeedback();
  
  Serial.println("📱 RFID Card: " + cardId);
  
  // Send to server if connected
  if (websocket_connected) {
    sendRFIDScan(cardId);
  } else {
    // Store for offline sync
    storeOfflineCard(cardId);
    showMessage("Offline Mode", "Card stored");
  }
  
  // Halt the card
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

String getCardUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  
  // Format as RFID card ID
  if (!uid.startsWith("RFID")) {
    uid = "RFID" + uid;
  }
  
  return uid;
}

void sendRFIDScan(String cardId) {
  if (!websocket_connected) return;
  
  DynamicJsonDocument doc(512);
  doc["type"] = "rfid_scan";
  doc["cardId"] = cardId;
  doc["deviceId"] = DEVICE_ID;
  doc["classId"] = DEFAULT_CLASS_ID;
  doc["location"] = DEVICE_LOCATION;
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  
  webSocket.sendTXT(message);
  Serial.println("📤 Sent: " + message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 COMMUNICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void sendDeviceRegistration() {
  if (!websocket_connected) return;
  
  DynamicJsonDocument doc(512);
  doc["type"] = "device_register";
  doc["deviceId"] = DEVICE_ID;
  doc["deviceType"] = "rfid_reader";
  doc["location"] = DEVICE_LOCATION;
  doc["version"] = "3.0.0";
  doc["capabilities"] = "rfid_scan,offline_storage";
  doc["totalScans"] = total_scans;
  doc["successfulScans"] = successful_scans;
  
  String message;
  serializeJson(doc, message);
  
  webSocket.sendTXT(message);
  Serial.println("📤 Device registration sent");
}

void sendHeartbeat() {
  if (!websocket_connected || millis() - last_heartbeat < HEARTBEAT_INTERVAL) {
    return;
  }
  
  DynamicJsonDocument doc(512);
  doc["type"] = "heartbeat";
  doc["deviceId"] = DEVICE_ID;
  doc["status"] = scanning_enabled ? "scanning" : "idle";
  doc["totalScans"] = total_scans;
  doc["successfulScans"] = successful_scans;
  doc["failedScans"] = failed_scans;
  doc["uptime"] = millis();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  
  String message;
  serializeJson(doc, message);
  
  webSocket.sendTXT(message);
  last_heartbeat = millis();
  
  Serial.println("💓 Heartbeat sent");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📺 DISPLAY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void showMessage(String line1, String line2) {
  if (line1 == current_display_line1 && line2 == current_display_line2) {
    return; // No change needed
  }
  
  current_display_line1 = line1;
  current_display_line2 = line2;
  
  lcd.clear();
  
  // Center text if shorter than display width
  int pos1 = (LCD_COLS - line1.length()) / 2;
  int pos2 = (LCD_COLS - line2.length()) / 2;
  
  lcd.setCursor(max(0, pos1), 0);
  lcd.print(line1.substring(0, LCD_COLS));
  
  lcd.setCursor(max(0, pos2), 1);
  lcd.print(line2.substring(0, LCD_COLS));
  
  display_active = true;
  display_timeout = millis();
}

void showAttendanceSuccess() {
  if (lastStudent.isValid) {
    showMessage("Welcome!", lastStudent.name.substring(0, 16));
    delay(2000);
    
    // Show attendance percentage
    String percentage = String(lastStudent.attendancePercentage, 1) + "%";
    showMessage("Attendance", percentage);
    delay(2000);
    
    // Show department
    showMessage("Department", lastStudent.department.substring(0, 16));
  } else {
    showMessage("Attendance", "Recorded!");
  }
  
  successFeedback();
}

void showAttendanceFailure(String message) {
  showMessage("Failed", message.substring(0, 16));
  errorFeedback();
}

void handleDisplayTimeout() {
  if (display_active && millis() - display_timeout > DISPLAY_TIMEOUT) {
    display_active = false;
    
    // Show default status
    if (websocket_connected) {
      String status = "Ready [" + String(successful_scans) + "/" + String(total_scans) + "]";
      showMessage("SmartTrack RFID", status);
    } else if (wifi_connected) {
      showMessage("Server Offline", "Scan to store");
    } else {
      showMessage("WiFi Offline", "Check connection");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔔 FEEDBACK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void successFeedback() {
  // Green LED and success tone
  digitalWrite(GREEN_LED_PIN, LOW);
  tone(BUZZER_PIN, 1000, 200);
  delay(200);
  tone(BUZZER_PIN, 1200, 200);
  delay(200);
  digitalWrite(GREEN_LED_PIN, HIGH);
}

void errorFeedback() {
  // Red LED and error tone
  digitalWrite(RED_LED_PIN, LOW);
  tone(BUZZER_PIN, 400, 500);
  delay(500);
  digitalWrite(RED_LED_PIN, HIGH);
}

void cardDetectedFeedback() {
  // Brief beep for card detection
  tone(BUZZER_PIN, 800, 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 OFFLINE STORAGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void storeOfflineCard(String cardId) {
  // Simple offline storage in EEPROM
  // In a production system, you might want more sophisticated storage
  Serial.println("💾 Storing offline: " + cardId);
  
  // Increment offline counter
  int offlineCount = EEPROM.read(100);
  if (offlineCount < 255) {
    EEPROM.write(100, offlineCount + 1);
    EEPROM.commit();
  }
}

void loadStatistics() {
  // Load statistics from EEPROM
  total_scans = (EEPROM.read(0) << 24) | (EEPROM.read(1) << 16) | 
                (EEPROM.read(2) << 8) | EEPROM.read(3);
  successful_scans = (EEPROM.read(4) << 24) | (EEPROM.read(5) << 16) | 
                     (EEPROM.read(6) << 8) | EEPROM.read(7);
  failed_scans = (EEPROM.read(8) << 24) | (EEPROM.read(9) << 16) | 
                 (EEPROM.read(10) << 8) | EEPROM.read(11);
  
  Serial.printf("📊 Loaded stats - Total: %lu, Success: %lu, Failed: %lu\\n", 
                total_scans, successful_scans, failed_scans);
}

void saveStatistics() {
  // Save statistics to EEPROM
  EEPROM.write(0, (total_scans >> 24) & 0xFF);
  EEPROM.write(1, (total_scans >> 16) & 0xFF);
  EEPROM.write(2, (total_scans >> 8) & 0xFF);
  EEPROM.write(3, total_scans & 0xFF);
  
  EEPROM.write(4, (successful_scans >> 24) & 0xFF);
  EEPROM.write(5, (successful_scans >> 16) & 0xFF);
  EEPROM.write(6, (successful_scans >> 8) & 0xFF);
  EEPROM.write(7, successful_scans & 0xFF);
  
  EEPROM.write(8, (failed_scans >> 24) & 0xFF);
  EEPROM.write(9, (failed_scans >> 16) & 0xFF);
  EEPROM.write(10, (failed_scans >> 8) & 0xFF);
  EEPROM.write(11, failed_scans & 0xFF);
  
  EEPROM.commit();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔘 BUTTON HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

void handleButton() {
  static bool button_pressed = false;
  static unsigned long button_press_start = 0;
  
  bool button_state = digitalRead(CONFIG_BTN_PIN) == LOW;
  
  if (button_state && !button_pressed) {
    button_pressed = true;
    button_press_start = millis();
  } else if (!button_state && button_pressed) {
    button_pressed = false;
    unsigned long press_duration = millis() - button_press_start;
    
    if (press_duration > 3000) {
      // Long press - show statistics
      showStatistics();
    } else {
      // Short press - toggle scanning
      scanning_enabled = !scanning_enabled;
      String status = scanning_enabled ? "Enabled" : "Disabled";
      showMessage("Scanning", status);
      delay(1000);
    }
  }
}

void showStatistics() {
  showMessage("Total Scans", String(total_scans));
  delay(2000);
  showMessage("Successful", String(successful_scans));
  delay(2000);
  showMessage("Failed", String(failed_scans));
  delay(2000);
  
  if (total_scans > 0) {
    float success_rate = (float)successful_scans / total_scans * 100;
    showMessage("Success Rate", String(success_rate, 1) + "%");
    delay(2000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void resetSystem() {
  Serial.println("🔄 System reset requested");
  showMessage("Resetting", "Please wait...");
  delay(2000);
  ESP.restart();
}
