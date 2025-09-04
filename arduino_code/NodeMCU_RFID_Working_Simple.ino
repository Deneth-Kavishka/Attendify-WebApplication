#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 PIN CONFIGURATION - NodeMCU ESP8266
// ═══════════════════════════════════════════════════════════════════════════════

// RC522 RFID Module Pins
#define RST_PIN         5   // D1 - RC522 Reset pin
#define SS_PIN          4   // D2 - RC522 SDA/SS pin  
#define SCK_PIN         14  // D5 - RC522 SCK pin
#define MISO_PIN        12  // D6 - RC522 MISO pin
#define MOSI_PIN        13  // D7 - RC522 MOSI pin

// Feedback Components
#define GREEN_LED_PIN   0   // D3 - Green LED for success
#define RED_LED_PIN     2   // D4 - Red LED for error
#define BUZZER_PIN      15  // D8 - Buzzer for audio feedback
#define CONFIG_BTN_PIN  16  // D0 - Configuration button

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// WiFi Configuration - Update these for your network
const char* ssid = "Dialog 4G 303";
const char* password = "Ba5315e7";  

// SmartTrack Backend Configuration
const char* websocket_host = "192.168.8.110";
const int websocket_port = 5000;
const char* websocket_path = "/";

// Device Configuration
const char* device_id = "RFID_NODEMCU_001";
const char* device_type = "RFID_READER";
const char* device_version = "NodeMCU_v2.1.0";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize RFID reader
MFRC522 rfid(SS_PIN, RST_PIN);

// WebSocket client
WebSocketsClient webSocket;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 GLOBAL VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

// System State
bool wifi_connected = false;
bool websocket_connected = false;
bool scanning_active = false;
bool rfid_working = false;

// Timing Variables
unsigned long last_heartbeat = 0;
unsigned long last_card_read = 0;
unsigned long last_wifi_check = 0;
unsigned long button_press_time = 0;

// Card Reading State
String last_card_id = "";
int total_cards_read = 0;
bool card_processing = false;

// Configuration
const unsigned long HEARTBEAT_INTERVAL = 30000;    // 30 seconds
const unsigned long CARD_READ_COOLDOWN = 2000;     // 2 seconds between same card reads
const unsigned long WIFI_CHECK_INTERVAL = 10000;   // 10 seconds
const unsigned long CONFIG_HOLD_TIME = 3000;       // 3 seconds for config mode

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  // Initialize Serial communication
  Serial.begin(115200);
  delay(1000);
  
  // Clear screen and show startup
  Serial.println();
  Serial.println("=========================================");
  Serial.println("   SmartTrack RFID System v2.1.0");
  Serial.println("   NodeMCU ESP8266 - Starting Up");
  Serial.println("=========================================");
  
  // Initialize components step by step
  Serial.println();
  Serial.println("[1] Initializing GPIO pins...");
  initializeGPIO();
  
  Serial.println("[2] Initializing RFID reader...");
  initializeRFID();
  
  Serial.println("[3] Running hardware tests...");
  testHardware();
  
  Serial.println("[4] Connecting to WiFi...");
  connectToWiFi();
  
  if (wifi_connected) {
    Serial.println("[5] Setting up WebSocket...");
    initializeWebSocket();
  } else {
    Serial.println("[5] Skipping WebSocket (no WiFi)");
  }
  
  // Final status
  Serial.println();
  Serial.println("=========================================");
  Serial.println("        INITIALIZATION COMPLETE");
  Serial.println("=========================================");
  printSystemStatus();
  Serial.println("=========================================");
  
  // Auto-start scanning
  Serial.println();
  if (rfid_working) {
    Serial.println("🚀 STARTING RFID SCANNING...");
    startScanning();
  } else {
    Serial.println("❌ RFID NOT WORKING - Check connections");
    Serial.println("Press button for offline test mode");
  }
  
  Serial.println();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 INITIALIZATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void initializeGPIO() {
  // Configure pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);
  
  // Set initial states
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("   ✅ GPIO pins configured");
}

void initializeRFID() {
  // Initialize SPI
  SPI.begin();
  delay(100);
  
  // Initialize RFID reader
  rfid.PCD_Init();
  delay(200);
  
  // Test RFID communication
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  
  if (version == 0x00 || version == 0xFF) {
    Serial.println("   ❌ RFID reader not detected!");
    Serial.println("   Check these connections:");
    Serial.println("     VCC -> 3V3 (NOT 5V!)");
    Serial.println("     GND -> GND");
    Serial.println("     RST -> D1 (GPIO5)");
    Serial.println("     SDA -> D2 (GPIO4)");
    Serial.println("     SCK -> D5 (GPIO14)");
    Serial.println("     MISO -> D6 (GPIO12)");
    Serial.println("     MOSI -> D7 (GPIO13)");
    rfid_working = false;
  } else {
    Serial.print("   ✅ RC522 detected - Version: 0x");
    Serial.print(version, HEX);
    if (version == 0x92) {
      Serial.println(" (v2.0)");
    } else if (version == 0x91) {
      Serial.println(" (v1.0)");
    } else {
      Serial.println(" (Unknown)");
    }
    rfid_working = true;
  }
}

void testHardware() {
  Serial.println("   Testing LEDs and buzzer...");
  
  // Test green LED
  digitalWrite(GREEN_LED_PIN, HIGH);
  delay(200);
  digitalWrite(GREEN_LED_PIN, LOW);
  
  // Test red LED
  digitalWrite(RED_LED_PIN, HIGH);
  delay(200);
  digitalWrite(RED_LED_PIN, LOW);
  
  // Test buzzer
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("   ✅ Hardware test completed");
}

void connectToWiFi() {
  Serial.print("   Connecting to: ");
  Serial.println(ssid);
  Serial.print("   ");
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Blink red LED while connecting
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
  }
  
  digitalWrite(RED_LED_PIN, LOW);
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.println("   ✅ WiFi connected!");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    // Success feedback
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(500);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    wifi_connected = false;
    Serial.println("   ❌ WiFi connection failed!");
    Serial.println("   System will work in offline mode");
    
    // Error feedback
    for (int i = 0; i < 3; i++) {
      digitalWrite(RED_LED_PIN, HIGH);
      delay(200);
      digitalWrite(RED_LED_PIN, LOW);
      delay(200);
    }
  }
}

void initializeWebSocket() {
  if (!wifi_connected) {
    Serial.println("   ❌ Cannot start WebSocket - no WiFi");
    return;
  }
  
  Serial.print("   Server: ");
  Serial.print(websocket_host);
  Serial.print(":");
  Serial.println(websocket_port);
  
  webSocket.begin(websocket_host, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  
  Serial.println("   ✅ WebSocket client started");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 WEBSOCKET FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      websocket_connected = false;
      Serial.println("🔗 WebSocket disconnected");
      break;
      
    case WStype_CONNECTED:
      websocket_connected = true;
      Serial.print("🔗 WebSocket connected to: ");
      Serial.println((char*)payload);
      registerDevice();
      break;
      
    case WStype_TEXT:
      Serial.print("📨 Message: ");
      Serial.println((char*)payload);
      handleWebSocketMessage((char*)payload);
      break;
      
    case WStype_ERROR:
      Serial.print("❌ WebSocket error: ");
      Serial.println((char*)payload);
      break;
  }
}

void registerDevice() {
  if (!websocket_connected) return;
  
  StaticJsonDocument<512> doc;
  doc["type"] = "device_register";
  doc["deviceId"] = device_id;
  doc["deviceType"] = device_type;
  doc["version"] = device_version;
  doc["capabilities"] = "rfid_read,led_feedback,buzzer_alert";
  doc["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("📝 Device registered with backend");
}

void handleWebSocketMessage(String message) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("❌ JSON parsing error");
    return;
  }
  
  String type = doc["type"];
  
  if (type == "command") {
    String command = doc["command"];
    
    if (command == "START_SCAN") {
      startScanning();
    } else if (command == "STOP_SCAN") {
      stopScanning();
    } else if (command == "STATUS") {
      sendStatusUpdate();
    }
  } else if (type == "card_response") {
    handleCardResponse(doc);
  }
}

void handleCardResponse(JsonDocument& doc) {
  String status = doc["status"];
  String studentName = doc["studentName"];
  String className = doc["className"];
  
  if (status == "success") {
    Serial.println("✅ ACCESS GRANTED");
    Serial.print("👤 Welcome: ");
    Serial.println(studentName);
    if (className.length() > 0) {
      Serial.print("📚 Class: ");
      Serial.println(className);
    }
    cardFeedbackSuccess();
  } else if (status == "unauthorized") {
    Serial.println("❌ ACCESS DENIED");
    Serial.println("Card not authorized");
    cardFeedbackError();
  } else if (status == "not_found") {
    Serial.println("❓ CARD NOT REGISTERED");
    Serial.println("Please register this card first");
    cardFeedbackError();
  }
  
  card_processing = false;
}

void sendStatusUpdate() {
  if (!websocket_connected) return;
  
  StaticJsonDocument<512> doc;
  doc["type"] = "status_update";
  doc["deviceId"] = device_id;
  doc["wifi_connected"] = wifi_connected;
  doc["websocket_connected"] = websocket_connected;
  doc["scanning_active"] = scanning_active;
  doc["total_reads"] = total_cards_read;
  doc["uptime"] = millis();
  doc["free_heap"] = ESP.getFreeHeap();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ RFID SCANNING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void handleRFIDScanning() {
  if (!scanning_active || !rfid_working || card_processing) return;
  
  // Look for new cards
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Read card UID
  String cardId = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      cardId += "0";
    }
    cardId += String(rfid.uid.uidByte[i], HEX);
  }
  cardId.toUpperCase();
  
  // Check cooldown
  if (cardId == last_card_id && (millis() - last_card_read) < CARD_READ_COOLDOWN) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Process card
  last_card_id = cardId;
  last_card_read = millis();
  total_cards_read++;
  card_processing = true;
  
  Serial.println();
  Serial.println("🏷️ ==================");
  Serial.println("   CARD DETECTED!");
  Serial.println("🏷️ ==================");
  Serial.print("Card ID: ");
  Serial.println(cardId);
  Serial.print("Read #: ");
  Serial.println(total_cards_read);
  Serial.println("==================");
  
  // Visual feedback
  digitalWrite(GREEN_LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Send to backend
  if (websocket_connected) {
    sendCardData(cardId);
  } else {
    Serial.println("📱 OFFLINE MODE");
    Serial.println("Card logged locally");
    card_processing = false;
  }
  
  // Halt PICC
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  
  Serial.println();
}

void sendCardData(String cardId) {
  if (!websocket_connected) {
    card_processing = false;
    return;
  }
  
  StaticJsonDocument<512> doc;
  doc["type"] = "card_detected";
  doc["deviceId"] = device_id;
  doc["cardId"] = cardId;
  doc["timestamp"] = millis();
  doc["readCount"] = total_cards_read;
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("📤 Card data sent to server");
  Serial.println("⏳ Waiting for response...");
}

void startScanning() {
  scanning_active = true;
  Serial.println();
  Serial.println("🔍 ========================");
  Serial.println("   RFID SCANNING ACTIVE");
  Serial.println("🔍 ========================");
  Serial.println("Ready to scan cards!");
  Serial.println("Hold card near RC522 reader");
  Serial.println("========================");
  
  digitalWrite(GREEN_LED_PIN, HIGH);
  
  // Startup beep
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);
}

void stopScanning() {
  scanning_active = false;
  Serial.println();
  Serial.println("⏹️ ========================");
  Serial.println("   RFID SCANNING STOPPED");
  Serial.println("⏹️ ========================");
  Serial.println("Press button to resume");
  Serial.println("========================");
  
  digitalWrite(GREEN_LED_PIN, LOW);
  
  // Stop beeps
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔊 FEEDBACK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void cardFeedbackSuccess() {
  // Success pattern
  for (int i = 0; i < 3; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void cardFeedbackError() {
  // Error pattern
  for (int i = 0; i < 5; i++) {
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void printSystemStatus() {
  Serial.print("WiFi: ");
  Serial.println(wifi_connected ? "✅ Connected" : "❌ Disconnected");
  
  Serial.print("WebSocket: ");
  Serial.println(websocket_connected ? "✅ Connected" : "❌ Disconnected");
  
  Serial.print("RFID Reader: ");
  Serial.println(rfid_working ? "✅ Working" : "❌ Not Detected");
  
  Serial.print("Scanning: ");
  Serial.println(scanning_active ? "🔍 ACTIVE" : "⏸️ IDLE");
  
  Serial.print("Cards Read: ");
  Serial.println(total_cards_read);
  
  Serial.print("Free Memory: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔘 BUTTON HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

void handleButton() {
  bool button_pressed = !digitalRead(CONFIG_BTN_PIN);
  
  if (button_pressed && button_press_time == 0) {
    button_press_time = millis();
  } else if (!button_pressed && button_press_time > 0) {
    unsigned long press_duration = millis() - button_press_time;
    button_press_time = 0;
    
    if (press_duration > CONFIG_HOLD_TIME) {
      // Long press - show config
      showConfig();
    } else if (press_duration > 100) {
      // Short press - toggle scanning
      if (scanning_active) {
        stopScanning();
      } else {
        startScanning();
      }
    }
  }
}

void showConfig() {
  Serial.println();
  Serial.println("⚙️ ========================");
  Serial.println("   CONFIGURATION INFO");
  Serial.println("⚙️ ========================");
  Serial.print("Device ID: ");
  Serial.println(device_id);
  Serial.print("WiFi SSID: ");
  Serial.println(ssid);
  Serial.print("Server: ");
  Serial.print(websocket_host);
  Serial.print(":");
  Serial.println(websocket_port);
  Serial.println("========================");
  
  // Config mode feedback
  for (int i = 0; i < 5; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, HIGH);
    delay(100);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
    delay(100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // Handle WebSocket
  if (wifi_connected) {
    webSocket.loop();
  }
  
  // Handle RFID scanning
  handleRFIDScanning();
  
  // Handle button
  handleButton();
  
  // Send heartbeat every 30 seconds
  if (websocket_connected && millis() - last_heartbeat > HEARTBEAT_INTERVAL) {
    last_heartbeat = millis();
    sendStatusUpdate();
    Serial.println("💓 Heartbeat sent");
  }
  
  // Status update every 60 seconds
  static unsigned long last_status = 0;
  if (millis() - last_status > 60000) {
    last_status = millis();
    Serial.println();
    Serial.println("📊 === STATUS UPDATE ===");
    printSystemStatus();
    Serial.println("=====================");
  }
  
  delay(50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🧪 TESTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void offlineRFIDTest() {
  Serial.println();
  Serial.println("🧪 OFFLINE RFID TEST MODE");
  Serial.println("Present cards to test...");
  Serial.println("Press button to exit");
  
  while(true) {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      String cardId = "";
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) cardId += "0";
        cardId += String(rfid.uid.uidByte[i], HEX);
      }
      cardId.toUpperCase();
      
      Serial.print("🏷️ TEST CARD: ");
      Serial.println(cardId);
      
      digitalWrite(GREEN_LED_PIN, HIGH);
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(GREEN_LED_PIN, LOW);
      digitalWrite(BUZZER_PIN, LOW);
      
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
      delay(1000);
    }
    
    if (!digitalRead(CONFIG_BTN_PIN)) {
      delay(100);
      while(!digitalRead(CONFIG_BTN_PIN)) delay(10);
      Serial.println("🧪 Exiting test mode");
      break;
    }
    delay(100);
  }
}
