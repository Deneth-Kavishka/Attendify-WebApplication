#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ===============================================================================
// PIN CONFIGURATION - NodeMCU ESP8266
// ===============================================================================

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

// ===============================================================================
// NETWORK CONFIGURATION
// ===============================================================================

// WiFi Configuration - Update these for your network
const char* ssid = "Dialog 4G 303";
const char* password = "Ba5315e7";  

// SmartTrack Backend Configuration
const char* websocket_host = "192.168.8.110";
const int websocket_port = 8080;
const char* websocket_path = "/rfid";  // Changed to include "rfid" identifier

// Device Configuration
const char* device_id = "RFID_NODEMCU_001";
const char* device_type = "RFID_READER";
const char* device_version = "NodeMCU_v2.2.0";

// ===============================================================================
// HARDWARE INITIALIZATION
// ===============================================================================

// Initialize RFID reader
MFRC522 rfid(SS_PIN, RST_PIN);

// WebSocket client
WebSocketsClient webSocket;

// ===============================================================================
// GLOBAL VARIABLES
// ===============================================================================

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

// ===============================================================================
// SETUP FUNCTION
// ===============================================================================

void setup() {
  // Initialize Serial communication
  Serial.begin(115200);
  delay(1000);
  
  // Clear screen and show startup
  Serial.println();
  Serial.println("=========================================");
  Serial.println("   SmartTrack RFID System v2.2.0");
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
    Serial.println("STARTING RFID SCANNING...");
    startScanning();
  } else {
    Serial.println("RFID NOT WORKING - Check connections");
    Serial.println("Press button for offline test mode");
  }
  
  Serial.println();
}

// ===============================================================================
// INITIALIZATION FUNCTIONS
// ===============================================================================

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
  
  Serial.println("   GPIO pins configured");
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
    Serial.println("   RFID reader not detected!");
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
    Serial.print("   RC522 detected - Version: 0x");
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
  
  Serial.println("   Hardware test completed");
}

void connectToWiFi() {
  Serial.print("   Connecting to: ");
  Serial.println(ssid);
  
  // IMPROVED WiFi Connection Logic
  // 1. Set WiFi mode to station
  WiFi.mode(WIFI_STA);
  delay(100);
  
  // 2. Disable WiFi persistence to avoid stored bad configs
  WiFi.persistent(false);
  
  // 3. Disconnect any existing connections
  WiFi.disconnect(true);
  delay(500);
  
  // 4. Set power level to maximum
  WiFi.setOutputPower(20.5);
  
  // 5. Disable power saving mode
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  
  // 6. Begin WiFi connection
  Serial.println("   Starting WiFi connection...");
  WiFi.begin(ssid, password);
  
  Serial.print("   ");
  int attempts = 0;
  unsigned long start_time = millis();
  
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    // Blink red LED while connecting
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
    
    // Print detailed status every 5 attempts
    if (attempts % 5 == 0) {
      Serial.println();
      Serial.print("   Attempt ");
      Serial.print(attempts);
      Serial.print(" - Status: ");
      printWiFiStatus(WiFi.status());
      Serial.print("   ");
    }
    
    // Force restart WiFi every 15 attempts
    if (attempts == 15) {
      Serial.println();
      Serial.println("   Restarting WiFi...");
      WiFi.disconnect();
      delay(1000);
      WiFi.begin(ssid, password);
      Serial.print("   ");
    }
  }
  
  digitalWrite(RED_LED_PIN, LOW);
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.println("   WiFi connected successfully!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Subnet Mask: ");
    Serial.println(WiFi.subnetMask());
    Serial.print("   Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("   DNS: ");
    Serial.println(WiFi.dnsIP());
    Serial.print("   MAC Address: ");
    Serial.println(WiFi.macAddress());
    Serial.print("   Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("   Channel: ");
    Serial.println(WiFi.channel());
    
    // Success feedback
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(500);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    wifi_connected = false;
    Serial.println("   WiFi connection FAILED!");
    Serial.print("   Final Status: ");
    printWiFiStatus(WiFi.status());
    Serial.println("   System will work in offline mode");
    Serial.println("   ");
    Serial.println("   TROUBLESHOOTING:");
    Serial.println("   1. Check WiFi credentials");
    Serial.println("   2. Verify network is 2.4GHz");
    Serial.println("   3. Check router settings");
    Serial.println("   4. Try moving closer to router");
    
    // Error feedback
    for (int i = 0; i < 3; i++) {
      digitalWrite(RED_LED_PIN, HIGH);
      delay(200);
      digitalWrite(RED_LED_PIN, LOW);
      delay(200);
    }
  }
}

void printWiFiStatus(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      Serial.print("IDLE");
      break;
    case WL_NO_SSID_AVAIL:
      Serial.print("NO_SSID_AVAILABLE");
      break;
    case WL_SCAN_COMPLETED:
      Serial.print("SCAN_COMPLETED");
      break;
    case WL_CONNECTED:
      Serial.print("CONNECTED");
      break;
    case WL_CONNECT_FAILED:
      Serial.print("CONNECT_FAILED");
      break;
    case WL_CONNECTION_LOST:
      Serial.print("CONNECTION_LOST");
      break;
    case WL_DISCONNECTED:
      Serial.print("DISCONNECTED");
      break;
    default:
      Serial.print("UNKNOWN(");
      Serial.print(status);
      Serial.print(")");
      break;
  }
  Serial.println();
}

void initializeWebSocket() {
  if (!wifi_connected) {
    Serial.println("   Cannot start WebSocket - no WiFi");
    return;
  }
  
  Serial.print("   WebSocket Server: ");
  Serial.print(websocket_host);
  Serial.print(":");
  Serial.print(websocket_port);
  Serial.print(websocket_path);
  Serial.println();
  
  // Configure WebSocket with better settings
  webSocket.begin(websocket_host, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 3000, 2);
  
  // Set proper headers for RFID device identification
  webSocket.setExtraHeaders("User-Agent: ESP8266-NodeMCU-RFID-Device/2.2.0");
  
  Serial.println("   WebSocket client started");
  Serial.println("   Attempting connection...");
}

// ===============================================================================
// WEBSOCKET FUNCTIONS
// ===============================================================================

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      websocket_connected = false;
      Serial.print("WebSocket disconnected - Reason: ");
      if (length > 0) {
        Serial.println((char*)payload);
      } else {
        Serial.println("Unknown");
      }
      break;
      
    case WStype_CONNECTED:
      websocket_connected = true;
      Serial.print("WebSocket connected successfully to: ");
      Serial.println((char*)payload);
      Serial.println("Registering device...");
      registerDevice();
      break;
      
    case WStype_TEXT:
      Serial.print("Message received: ");
      Serial.println((char*)payload);
      handleWebSocketMessage((char*)payload);
      break;
      
    case WStype_ERROR:
      websocket_connected = false;
      Serial.print("WebSocket ERROR: ");
      Serial.println((char*)payload);
      Serial.println("Will attempt reconnection...");
      break;
      
    case WStype_PING:
      Serial.println("WebSocket ping received");
      break;
      
    case WStype_PONG:
      Serial.println("WebSocket pong received");
      break;
      
    case WStype_BIN:
      Serial.println("Binary data received (not supported)");
      break;
      
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      Serial.println("Fragmented message received (not fully supported)");
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
  doc["ip"] = WiFi.localIP().toString();
  doc["mac"] = WiFi.macAddress();
  doc["rssi"] = WiFi.RSSI();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("Device registered with backend");
}

void handleWebSocketMessage(String message) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("JSON parsing error");
    return;
  }
  
  String type = doc["type"];
  
  if (type == "welcome") {
    Serial.println("Received welcome message from server");
    String welcomeMsg = doc["message"];
    Serial.print("Server says: ");
    Serial.println(welcomeMsg);
  } else if (type == "command") {
    String command = doc["command"];
    
    if (command == "START_SCAN") {
      startScanning();
    } else if (command == "STOP_SCAN") {
      stopScanning();
    } else if (command == "STATUS") {
      sendStatusUpdate();
    } else if (command == "RESTART") {
      Serial.println("Remote restart requested");
      ESP.restart();
    }
  } else if (type == "card_response" || type == "rfid_response") {
    handleCardResponse(doc);
  } else {
    Serial.print("Unknown message type: ");
    Serial.println(type);
  }
}

void handleCardResponse(JsonDocument& doc) {
  String status = doc["status"];
  String studentName = doc["studentName"];
  String className = doc["className"];
  
  if (status == "success") {
    Serial.println("ACCESS GRANTED");
    Serial.print("Welcome: ");
    Serial.println(studentName);
    if (className.length() > 0) {
      Serial.print("Class: ");
      Serial.println(className);
    }
    cardFeedbackSuccess();
  } else if (status == "unauthorized") {
    Serial.println("ACCESS DENIED");
    Serial.println("Card not authorized");
    cardFeedbackError();
  } else if (status == "not_found") {
    Serial.println("CARD NOT REGISTERED");
    Serial.println("Please register this card first");
    cardFeedbackError();
  }
  
  card_processing = false;
}

void sendStatusUpdate() {
  if (!websocket_connected) return;
  
  StaticJsonDocument<512> doc;
  doc["type"] = "rfid_status";  // Changed to match server expectation
  doc["deviceId"] = device_id;
  doc["status"] = scanning_active ? "scanning" : "idle";
  doc["wifi_connected"] = wifi_connected;
  doc["websocket_connected"] = websocket_connected;
  doc["scanning_active"] = scanning_active;
  doc["total_reads"] = total_cards_read;
  doc["uptime"] = millis();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

// ===============================================================================
// RFID SCANNING FUNCTIONS
// ===============================================================================

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
  Serial.println("==================");
  Serial.println("   CARD DETECTED!");
  Serial.println("==================");
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
    Serial.println("OFFLINE MODE");
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
  doc["type"] = "rfid_card_detected";  // Changed to match server expectation
  doc["deviceId"] = device_id;
  doc["cardId"] = cardId;
  doc["cardType"] = "RFID";
  doc["timestamp"] = millis();
  doc["readCount"] = total_cards_read;
  doc["rssi"] = WiFi.RSSI();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("Card data sent to server");
  Serial.println("Waiting for response...");
}

void startScanning() {
  scanning_active = true;
  Serial.println();
  Serial.println("========================");
  Serial.println("   RFID SCANNING ACTIVE");
  Serial.println("========================");
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
  Serial.println("========================");
  Serial.println("   RFID SCANNING STOPPED");
  Serial.println("========================");
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

// ===============================================================================
// FEEDBACK FUNCTIONS
// ===============================================================================

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
  Serial.println(wifi_connected ? "Connected" : "Disconnected");
  
  if (wifi_connected) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  }
  
  Serial.print("WebSocket: ");
  Serial.println(websocket_connected ? "Connected" : "Disconnected");
  
  Serial.print("RFID Reader: ");
  Serial.println(rfid_working ? "Working" : "Not Detected");
  
  Serial.print("Scanning: ");
  Serial.println(scanning_active ? "ACTIVE" : "IDLE");
  
  Serial.print("Cards Read: ");
  Serial.println(total_cards_read);
  
  Serial.print("Free Memory: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");
  
  Serial.print("Uptime: ");
  Serial.print(millis() / 1000);
  Serial.println(" seconds");
}

// ===============================================================================
// BUTTON HANDLING
// ===============================================================================

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
      // Short press - toggle scanning or reconnect WiFi
      if (!wifi_connected) {
        Serial.println("Attempting WiFi reconnection...");
        connectToWiFi();
      } else if (scanning_active) {
        stopScanning();
      } else {
        startScanning();
      }
    }
  }
}

void showConfig() {
  Serial.println();
  Serial.println("========================");
  Serial.println("   CONFIGURATION INFO");
  Serial.println("========================");
  Serial.print("Device ID: ");
  Serial.println(device_id);
  Serial.print("WiFi SSID: ");
  Serial.println(ssid);
  Serial.print("Server: ");
  Serial.print(websocket_host);
  Serial.print(":");
  Serial.println(websocket_port);
  Serial.print("Version: ");
  Serial.println(device_version);
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

// ===============================================================================
// WIFI MONITORING
// ===============================================================================

void checkWiFiConnection() {
  static unsigned long last_check = 0;
  static unsigned long last_websocket_attempt = 0;
  
  if (millis() - last_check > WIFI_CHECK_INTERVAL) {
    last_check = millis();
    
    // Check WiFi connection
    if (wifi_connected && WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi connection lost! Attempting reconnection...");
      wifi_connected = false;
      websocket_connected = false;
      connectToWiFi();
      
      if (wifi_connected) {
        initializeWebSocket();
      }
    }
    
    // Check WebSocket connection
    if (wifi_connected && !websocket_connected && 
        (millis() - last_websocket_attempt > 30000)) { // Try every 30 seconds
      last_websocket_attempt = millis();
      Serial.println("WebSocket not connected. Attempting reconnection...");
      initializeWebSocket();
    }
  }
}

// ===============================================================================
// MAIN LOOP
// ===============================================================================

void loop() {
  // Monitor WiFi connection
  checkWiFiConnection();
  
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
    
    // Send RFID heartbeat
    StaticJsonDocument<256> doc;
    doc["type"] = "rfid_heartbeat";
    doc["deviceId"] = device_id;
    doc["timestamp"] = millis();
    doc["status"] = scanning_active ? "scanning" : "idle";
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
    
    Serial.println("Heartbeat sent");
  }
  
  // Status update every 60 seconds
  static unsigned long last_status = 0;
  if (millis() - last_status > 60000) {
    last_status = millis();
    Serial.println();
    Serial.println("=== STATUS UPDATE ===");
    printSystemStatus();
    Serial.println("====================");
  }
  
  delay(50);
}

// ===============================================================================
// TESTING FUNCTIONS
// ===============================================================================

void offlineRFIDTest() {
  Serial.println();
  Serial.println("OFFLINE RFID TEST MODE");
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
      
      Serial.print("TEST CARD: ");
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
      Serial.println("Exiting test mode");
      break;
    }
    delay(100);
  }
}
