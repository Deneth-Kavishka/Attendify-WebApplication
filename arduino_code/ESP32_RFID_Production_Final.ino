/*
 * Enhanced RFID Reader for SmartTrack - Production Version
 * ESP32/NodeMCU with RC522 RFID Module
 * Real-time WiFi connectivity with WebSocket integration
 * 
 * Hardware Setup:
 * ESP32: SDA(GPIO5), SCK(GPIO18), MOSI(GPIO23), MISO(GPIO19), RST(GPIO4)
 * NodeMCU: SDA(D10=GPIO15), SCK(D13=GPIO14), MOSI(D11=GPIO13), MISO(D12=GPIO12), RST(D9=GPIO2)
 * 
 * Features:
 * - WiFi connectivity with auto-reconnection
 * - WebSocket communication with backend
 * - Real-time card detection and transmission
 * - LED/Buzzer feedback
 * - Heartbeat monitoring
 * - Error handling and recovery
 * 
 * Version: 3.0.0 - Production Ready
 * Date: 2024
 */

#include <WiFi.h>              // ESP32 WiFi library
// #include <ESP8266WiFi.h>    // Uncomment for NodeMCU/ESP8266
#include <WebSocketsClient.h>   // WebSocket client library
#include <ArduinoJson.h>        // JSON handling
#include <SPI.h>                // SPI communication
#include <MFRC522.h>            // RFID library

// ===========================================
// PIN CONFIGURATION
// ===========================================
#ifdef ESP32
  // ESP32 Pin Configuration
  #define SS_PIN          5     // SDA/SS pin
  #define RST_PIN         4     // Reset pin
  #define LED_PIN         2     // Status LED
  #define BUZZER_PIN      33    // Buzzer pin
  #define BUTTON_PIN      32    // Manual scan button
#else
  // NodeMCU/ESP8266 Pin Configuration
  #define SS_PIN          15    // D8 - SDA/SS pin
  #define RST_PIN         2     // D4 - Reset pin
  #define LED_PIN         16    // D0 - Status LED
  #define BUZZER_PIN      14    // D5 - Buzzer pin
  #define BUTTON_PIN      12    // D6 - Manual scan button
#endif

// ===========================================
// NETWORK CONFIGURATION
// ===========================================
const char* ssid = "YourWiFiNetwork";        // Replace with your WiFi SSID
const char* password = "YourWiFiPassword";   // Replace with your WiFi password
const char* websocket_server = "192.168.1.100"; // Replace with your server IP
const int websocket_port = 5000;             // WebSocket server port

// ===========================================
// RFID AND TIMING CONFIGURATION
// ===========================================
#define CARD_READ_DELAY     2000    // Minimum delay between card reads (ms)
#define HEARTBEAT_INTERVAL  30000   // Heartbeat every 30 seconds
#define WIFI_TIMEOUT        20000   // WiFi connection timeout
#define RECONNECT_DELAY     5000    // Delay before reconnection attempts

// ===========================================
// GLOBAL OBJECTS AND VARIABLES
// ===========================================
MFRC522 mfrc522(SS_PIN, RST_PIN);  // RFID reader instance
WebSocketsClient webSocket;         // WebSocket client

// State variables
bool scanningActive = false;        // Scanning state
bool wifiConnected = false;         // WiFi connection status
bool wsConnected = false;           // WebSocket connection status
unsigned long lastCardRead = 0;    // Last card read timestamp
unsigned long lastHeartbeat = 0;   // Last heartbeat timestamp
unsigned long lastWiFiCheck = 0;   // Last WiFi status check
unsigned long lastButtonPress = 0; // Button debouncing
String deviceID = "";               // Unique device identifier

// Button state
bool lastButtonState = HIGH;
bool buttonState = HIGH;

// ===========================================
// SETUP FUNCTION
// ===========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n===========================================");
  Serial.println("     SmartTrack RFID Reader v3.0.0");
  Serial.println("===========================================");
  
  // Initialize pins
  setupPins();
  
  // Initialize RFID reader
  setupRFID();
  
  // Generate unique device ID
  generateDeviceID();
  
  // Initialize WiFi connection
  setupWiFi();
  
  // Initialize WebSocket connection
  setupWebSocket();
  
  // Startup sequence
  startupSequence();
  
  Serial.println("✅ RFID Reader initialized successfully!");
  Serial.println("📡 Ready for card detection...\n");
}

// ===========================================
// MAIN LOOP
// ===========================================
void loop() {
  // Handle WebSocket events
  webSocket.loop();
  
  // Check WiFi connection status
  checkWiFiConnection();
  
  // Handle button press for manual scan toggle
  handleButton();
  
  // Send periodic heartbeat
  sendHeartbeat();
  
  // Scan for RFID cards when active
  if (scanningActive && wsConnected) {
    scanForCard();
  }
  
  // Update status LED
  updateStatusLED();
  
  delay(50); // Small delay to prevent overwhelming
}

// ===========================================
// INITIALIZATION FUNCTIONS
// ===========================================
void setupPins() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  digitalWrite(LED_PIN, HIGH); // LED off initially
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("📌 GPIO pins configured");
}

void setupRFID() {
  SPI.begin();
  mfrc522.PCD_Init();
  
  // Verify RFID connection
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("❌ RFID reader connection failed!");
    errorSequence();
    while (true) { delay(1000); } // Halt execution
  }
  
  Serial.println("📡 RFID reader initialized");
  Serial.print("📋 Firmware version: 0x");
  Serial.println(version, HEX);
}

void generateDeviceID() {
  #ifdef ESP32
    uint64_t chipid = ESP.getEfuseMac();
    deviceID = "ESP32_RFID_" + String((uint32_t)(chipid >> 32), HEX) + String((uint32_t)chipid, HEX);
  #else
    deviceID = "ESP8266_RFID_" + String(ESP.getChipId(), HEX);
  #endif
  
  deviceID.toUpperCase();
  Serial.println("🆔 Device ID: " + deviceID);
}

void setupWiFi() {
  Serial.println("🌐 Connecting to WiFi: " + String(ssid));
  
  WiFi.begin(ssid, password);
  
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime > WIFI_TIMEOUT) {
      Serial.println("❌ WiFi connection timeout!");
      errorSequence();
      return;
    }
    
    delay(500);
    Serial.print(".");
  }
  
  wifiConnected = true;
  Serial.println("\n✅ WiFi connected!");
  Serial.println("📍 IP Address: " + WiFi.localIP().toString());
  Serial.println("📶 Signal Strength: " + String(WiFi.RSSI()) + " dBm");
}

void setupWebSocket() {
  if (!wifiConnected) {
    Serial.println("❌ Cannot setup WebSocket - WiFi not connected");
    return;
  }
  
  Serial.println("🔌 Connecting to WebSocket server...");
  Serial.println("🌐 Server: " + String(websocket_server) + ":" + String(websocket_port));
  
  webSocket.begin(websocket_server, websocket_port, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_DELAY);
  
  Serial.println("⏳ WebSocket connection initiated...");
}

// ===========================================
// WEBSOCKET EVENT HANDLER
// ===========================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("🔌 WebSocket Disconnected");
      break;
      
    case WStype_CONNECTED:
      wsConnected = true;
      Serial.println("✅ WebSocket Connected");
      Serial.println("🌐 Server URL: " + String((char*)payload));
      
      // Send device registration
      registerDevice();
      break;
      
    case WStype_TEXT:
      handleWebSocketMessage((char*)payload);
      break;
      
    case WStype_ERROR:
      Serial.println("❌ WebSocket Error: " + String((char*)payload));
      break;
      
    default:
      break;
  }
}

void handleWebSocketMessage(const char* message) {
  Serial.println("📨 WebSocket Message: " + String(message));
  
  // Parse JSON message
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("❌ JSON parsing failed: " + String(error.c_str()));
    return;
  }
  
  String type = doc["type"];
  
  if (type == "rfid_command") {
    String command = doc["command"];
    
    if (command == "START_SCAN") {
      startScanning();
    } else if (command == "STOP_SCAN") {
      stopScanning();
    } else if (command == "GET_STATUS") {
      sendStatusUpdate();
    }
  } else if (type == "ping") {
    sendPong();
  }
}

// ===========================================
// RFID SCANNING FUNCTIONS
// ===========================================
void scanForCard() {
  // Check if a new card is present
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  
  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  
  // Prevent duplicate reads
  if (millis() - lastCardRead < CARD_READ_DELAY) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }
  
  lastCardRead = millis();
  
  // Read card UID
  String cardID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      cardID += "0";
    }
    cardID += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardID.toUpperCase();
  
  // Get card type
  MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);
  String cardType = mfrc522.PICC_GetTypeName(piccType);
  
  Serial.println("🔍 Card Detected!");
  Serial.println("🆔 Card ID: " + cardID);
  Serial.println("📇 Card Type: " + cardType);
  
  // Send card data to server
  sendCardData(cardID, cardType);
  
  // Visual/audio feedback
  cardReadFeedback();
  
  // Halt PICC and stop encryption
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

// ===========================================
// WEBSOCKET COMMUNICATION FUNCTIONS
// ===========================================
void registerDevice() {
  DynamicJsonDocument doc(512);
  doc["type"] = "device_register";
  doc["deviceId"] = deviceID;
  doc["deviceType"] = "rfid_reader";
  doc["version"] = "3.0.0";
  doc["capabilities"] = "card_detection,real_time_updates";
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("📋 Device registered with server");
}

void sendCardData(String cardID, String cardType) {
  if (!wsConnected) {
    Serial.println("❌ Cannot send card data - WebSocket not connected");
    return;
  }
  
  DynamicJsonDocument doc(1024);
  doc["type"] = "rfid_card_detected";
  doc["deviceId"] = deviceID;
  doc["cardId"] = cardID;
  doc["cardType"] = cardType;
  doc["timestamp"] = WiFi.getTime();
  doc["rssi"] = WiFi.RSSI();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("📤 Card data sent to server");
}

void sendStatusUpdate() {
  DynamicJsonDocument doc(512);
  doc["type"] = "rfid_status";
  doc["deviceId"] = deviceID;
  doc["status"] = scanningActive ? "scanning" : "idle";
  doc["scanning"] = scanningActive;
  doc["wifiConnected"] = wifiConnected;
  doc["wsConnected"] = wsConnected;
  doc["rssi"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void sendHeartbeat() {
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    lastHeartbeat = millis();
    
    if (wsConnected) {
      DynamicJsonDocument doc(256);
      doc["type"] = "rfid_heartbeat";
      doc["deviceId"] = deviceID;
      doc["timestamp"] = WiFi.getTime();
      doc["status"] = scanningActive ? "scanning" : "idle";
      
      String message;
      serializeJson(doc, message);
      webSocket.sendTXT(message);
    }
  }
}

void sendPong() {
  DynamicJsonDocument doc(128);
  doc["type"] = "pong";
  doc["deviceId"] = deviceID;
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

// ===========================================
// CONTROL FUNCTIONS
// ===========================================
void startScanning() {
  scanningActive = true;
  Serial.println("▶️  RFID scanning started");
  
  // Success feedback
  successSequence();
  
  // Send status update
  sendStatusUpdate();
}

void stopScanning() {
  scanningActive = false;
  Serial.println("⏹️  RFID scanning stopped");
  
  // Stop feedback
  stopSequence();
  
  // Send status update
  sendStatusUpdate();
}

void handleButton() {
  buttonState = digitalRead(BUTTON_PIN);
  
  if (buttonState != lastButtonState) {
    if (buttonState == LOW && (millis() - lastButtonPress > 200)) {
      lastButtonPress = millis();
      
      // Toggle scanning state
      if (scanningActive) {
        stopScanning();
      } else {
        startScanning();
      }
      
      Serial.println("🔘 Manual toggle button pressed");
    }
  }
  
  lastButtonState = buttonState;
}

// ===========================================
// FEEDBACK AND STATUS FUNCTIONS
// ===========================================
void cardReadFeedback() {
  // LED feedback - quick flashes
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
  }
  
  // Buzzer feedback - ascending tones
  tone(BUZZER_PIN, 800, 100);
  delay(150);
  tone(BUZZER_PIN, 1000, 100);
  delay(150);
  tone(BUZZER_PIN, 1200, 100);
}

void successSequence() {
  // LED: 2 quick flashes
  for (int i = 0; i < 2; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(150);
    digitalWrite(LED_PIN, HIGH);
    delay(150);
  }
  
  // Buzzer: success tone
  tone(BUZZER_PIN, 1000, 200);
}

void stopSequence() {
  // LED: single long flash
  digitalWrite(LED_PIN, LOW);
  delay(500);
  digitalWrite(LED_PIN, HIGH);
  
  // Buzzer: descending tone
  tone(BUZZER_PIN, 800, 300);
}

void errorSequence() {
  // LED: rapid flashing
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
  }
  
  // Buzzer: error tone
  tone(BUZZER_PIN, 400, 500);
}

void startupSequence() {
  Serial.println("🎵 Playing startup sequence...");
  
  // LED sweep
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(200);
    digitalWrite(LED_PIN, HIGH);
    delay(200);
  }
  
  // Buzzer melody
  int melody[] = {523, 659, 784, 1047}; // C, E, G, C
  for (int i = 0; i < 4; i++) {
    tone(BUZZER_PIN, melody[i], 150);
    delay(200);
  }
  
  delay(500);
}

void updateStatusLED() {
  static unsigned long lastLEDUpdate = 0;
  static bool ledState = false;
  
  if (millis() - lastLEDUpdate > 1000) {
    lastLEDUpdate = millis();
    
    if (!wifiConnected || !wsConnected) {
      // Fast blink for connection issues
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? LOW : HIGH);
    } else if (scanningActive) {
      // Slow pulse while scanning
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? LOW : HIGH);
    } else {
      // Solid on when idle and connected
      digitalWrite(LED_PIN, HIGH);
    }
  }
}

// ===========================================
// WIFI MANAGEMENT
// ===========================================
void checkWiFiConnection() {
  if (millis() - lastWiFiCheck > 10000) { // Check every 10 seconds
    lastWiFiCheck = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      wsConnected = false;
      
      Serial.println("🌐 WiFi connection lost! Attempting reconnection...");
      
      WiFi.disconnect();
      WiFi.begin(ssid, password);
      
      unsigned long startTime = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - startTime < WIFI_TIMEOUT) {
        delay(500);
        Serial.print(".");
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.println("\n✅ WiFi reconnected!");
        setupWebSocket(); // Reconnect WebSocket
      } else {
        Serial.println("\n❌ WiFi reconnection failed!");
        errorSequence();
      }
    } else if (!wifiConnected) {
      wifiConnected = true;
      Serial.println("✅ WiFi connection restored");
    }
  }
}

// ===========================================
// SERIAL COMMAND INTERFACE (Backup)
// ===========================================
void handleSerialCommands() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    command.toUpperCase();
    
    if (command == "START_SCAN") {
      startScanning();
    } else if (command == "STOP_SCAN") {
      stopScanning();
    } else if (command == "STATUS") {
      printStatus();
    } else if (command == "RESTART") {
      ESP.restart();
    } else {
      Serial.println("❓ Unknown command: " + command);
      Serial.println("Available commands: START_SCAN, STOP_SCAN, STATUS, RESTART");
    }
  }
}

void printStatus() {
  Serial.println("\n===========================================");
  Serial.println("           RFID READER STATUS");
  Serial.println("===========================================");
  Serial.println("🆔 Device ID: " + deviceID);
  Serial.println("🌐 WiFi: " + String(wifiConnected ? "Connected" : "Disconnected"));
  Serial.println("🔌 WebSocket: " + String(wsConnected ? "Connected" : "Disconnected"));
  Serial.println("📡 Scanning: " + String(scanningActive ? "Active" : "Inactive"));
  Serial.println("📍 IP Address: " + WiFi.localIP().toString());
  Serial.println("📶 RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("💾 Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("⏰ Uptime: " + String(millis() / 1000) + " seconds");
  Serial.println("===========================================\n");
}
