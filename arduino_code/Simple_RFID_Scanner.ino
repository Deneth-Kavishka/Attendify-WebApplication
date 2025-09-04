/*
 * Simple NodeMCU RFID Attendance Scanner
 * Works with Python WebSocket server for reliable attendance marking
 * 
 * Author: SmartTrack Team
 * Version: 1.0 (Simplified)
 */

#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 PIN CONFIGURATION (Your verified pinout)
// ═══════════════════════════════════════════════════════════════════════════════

// RFID RC522 Module (SPI)
#define RST_PIN    5    // D1 (GPIO5)
#define SS_PIN     4    // D2 (GPIO4)

// Feedback Components
#define GREEN_LED_PIN  0    // D3 (GPIO0)
#define RED_LED_PIN    2    // D4 (GPIO2)
#define BUZZER_PIN     15   // D8 (GPIO15)
#define CONFIG_BTN_PIN 16   // D0 (GPIO16)

// LCD I2C
#define LCD_ADDRESS 0x27
#define LCD_COLS    16
#define LCD_ROWS    2

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK CONFIGURATION - UPDATE THESE!
// ═══════════════════════════════════════════════════════════════════════════════

const char* WIFI_SSID = "Dialog 4G 303";        // Your WiFi network name
const char* WIFI_PASSWORD = "Ba5315e7";         // Your WiFi password
const char* SERVER_HOST = "192.168.8.110";      // Your computer's IP address
const int SERVER_PORT = 9000;                   // WebSocket server port (Python System)
const char* WEBSOCKET_PATH = "/";                // WebSocket path

// Device Configuration
const char* DEVICE_ID = "RFID_SCANNER_001";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE OBJECTS
// ═══════════════════════════════════════════════════════════════════════════════

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);
WebSocketsClient webSocket;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SYSTEM VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

bool wifi_connected = false;
bool websocket_connected = false;
String last_card_id = "";
unsigned long last_card_read = 0;
unsigned long last_heartbeat = 0;
const unsigned long CARD_COOLDOWN = 3000;      // 3 seconds between same card reads
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  Serial.println("🚀 SmartTrack Simple RFID Scanner Starting...");
  
  // Initialize hardware
  setupPins();
  setupLCD();
  setupRFID();
  
  // Run self-test
  runSelfTest();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup WebSocket
  setupWebSocket();
  
  Serial.println("✅ System ready for RFID scanning");
  showMessage("Ready to Scan", "Place RFID card");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // Handle WebSocket communication
  webSocket.loop();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (wifi_connected) {
      Serial.println("❌ WiFi disconnected, attempting reconnection...");
      wifi_connected = false;
      websocket_connected = false;
      showMessage("WiFi Lost", "Reconnecting...");
    }
    connectToWiFi();
    return;
  }
  
  // Send periodic heartbeat
  if (millis() - last_heartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    last_heartbeat = millis();
  }
  
  // Check for RFID cards
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String cardID = getCardID();
    
    // Prevent duplicate reads
    if (cardID != last_card_id || (millis() - last_card_read > CARD_COOLDOWN)) {
      processRFIDCard(cardID);
      last_card_id = cardID;
      last_card_read = millis();
    }
    
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
  
  delay(100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 INITIALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void setupPins() {
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);
  
  // Turn off LEDs initially
  digitalWrite(GREEN_LED_PIN, HIGH);  // Active LOW
  digitalWrite(RED_LED_PIN, HIGH);    // Active LOW
  
  Serial.println("✅ GPIO pins configured");
}

void setupLCD() {
  lcd.init();
  lcd.backlight();
  lcd.clear();
  showMessage("SmartTrack RFID", "Initializing...");
  Serial.println("✅ LCD initialized");
}

void setupRFID() {
  SPI.begin();
  rfid.PCD_Init();
  
  // Test RFID reader
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("❌ RFID Reader not detected!");
    showMessage("RFID Error", "Check wiring");
    while (true) {
      tone(BUZZER_PIN, 400, 500);
      delay(1000);
    }
  } else {
    Serial.printf("✅ RFID Reader detected (Version: 0x%02X)\n", version);
  }
}

void runSelfTest() {
  Serial.println("🔧 Running hardware self-test...");
  showMessage("Self Test", "Running...");
  
  // Test LEDs
  digitalWrite(GREEN_LED_PIN, LOW);
  delay(300);
  digitalWrite(GREEN_LED_PIN, HIGH);
  
  digitalWrite(RED_LED_PIN, LOW);
  delay(300);
  digitalWrite(RED_LED_PIN, HIGH);
  
  // Test buzzer
  tone(BUZZER_PIN, 1000, 200);
  delay(300);
  tone(BUZZER_PIN, 1500, 200);
  delay(300);
  
  Serial.println("✅ Hardware self-test completed");
  showMessage("Self Test", "Completed!");
  delay(1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void connectToWiFi() {
  if (wifi_connected) return;
  
  Serial.printf("📶 Connecting to WiFi: %s\n", WIFI_SSID);
  showMessage("Connecting WiFi", WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.printf("\n✅ Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    showMessage("WiFi Connected", WiFi.localIP().toString());
    delay(2000);
    
    // Now setup WebSocket
    setupWebSocket();
  } else {
    Serial.println("\n❌ WiFi connection failed");
    showMessage("WiFi Failed", "Check settings");
    delay(2000);
  }
}

void setupWebSocket() {
  if (!wifi_connected) return;
  
  Serial.printf("🔌 Connecting to WebSocket: %s:%d\n", SERVER_HOST, SERVER_PORT);
  showMessage("Connecting WS", SERVER_HOST);
  
  webSocket.begin(SERVER_HOST, SERVER_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 WEBSOCKET FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("🔄 WebSocket disconnected");
      websocket_connected = false;
      showMessage("WS Disconnected", "Reconnecting...");
      break;
      
    case WStype_CONNECTED:
      Serial.printf("✅ WebSocket connected to: %s\n", payload);
      websocket_connected = true;
      showMessage("WS Connected", "Ready to scan");
      
      // Send welcome message
      sendDeviceInfo();
      break;
      
    case WStype_TEXT:
      Serial.printf("📨 Received: %s\n", payload);
      handleWebSocketMessage((char*)payload);
      break;
      
    default:
      break;
  }
}

void sendDeviceInfo() {
  DynamicJsonDocument doc(1024);
  doc["type"] = "device_info";
  doc["device_id"] = DEVICE_ID;
  doc["device_type"] = "RFID_SCANNER";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["mac_address"] = WiFi.macAddress();
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void sendHeartbeat() {
  if (!websocket_connected) return;
  
  DynamicJsonDocument doc(512);
  doc["type"] = "heartbeat";
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = millis();
  doc["uptime"] = millis() / 1000;
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void handleWebSocketMessage(const char* message) {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, message);
  
  String messageType = doc["type"];
  
  if (messageType == "attendance_result") {
    bool success = doc["success"];
    String studentName = doc["student"]["name"];
    String msg = doc["message"];
    
    if (success) {
      Serial.printf("✅ Attendance marked: %s\n", studentName.c_str());
      showSuccessFeedback();
      showMessage(studentName.c_str(), "Attendance OK");
    } else {
      Serial.printf("❌ Attendance failed: %s\n", msg.c_str());
      showErrorFeedback();
      showMessage("Error", msg.c_str());
    }
    
    delay(3000);
    showMessage("Ready to Scan", "Place RFID card");
  }
  else if (messageType == "welcome") {
    Serial.println("📋 Received welcome from server");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📱 RFID FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

String getCardID() {
  String cardID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    cardID += String(rfid.uid.uidByte[i], DEC);
  }
  return cardID;
}

void processRFIDCard(String cardID) {
  Serial.printf("📱 RFID Card detected: %s\n", cardID.c_str());
  
  // Show scanning feedback
  showMessage("Card Detected", cardID);
  digitalWrite(GREEN_LED_PIN, LOW);
  tone(BUZZER_PIN, 1000, 100);
  delay(100);
  digitalWrite(GREEN_LED_PIN, HIGH);
  
  // Send to server if connected
  if (websocket_connected) {
    sendRFIDScan(cardID);
    showMessage("Processing...", "Please wait");
  } else {
    showMessage("No Connection", "Check network");
    showErrorFeedback();
    delay(2000);
    showMessage("Ready to Scan", "Place RFID card");
  }
}

void sendRFIDScan(String cardID) {
  DynamicJsonDocument doc(512);
  doc["type"] = "rfid_scan";
  doc["rfid_card"] = cardID;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.printf("📤 Sent RFID scan: %s\n", cardID.c_str());
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔊 FEEDBACK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void showMessage(const char* line1, const char* line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void showSuccessFeedback() {
  // Green LED and success tone
  digitalWrite(GREEN_LED_PIN, LOW);
  tone(BUZZER_PIN, 1000, 200);
  delay(200);
  tone(BUZZER_PIN, 1200, 200);
  delay(200);
  digitalWrite(GREEN_LED_PIN, HIGH);
}

void showErrorFeedback() {
  // Red LED and error tone
  digitalWrite(RED_LED_PIN, LOW);
  tone(BUZZER_PIN, 400, 500);
  delay(500);
  digitalWrite(RED_LED_PIN, HIGH);
}
