#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <EEPROM.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 PIN CONFIGURATION - NodeMCU ESP8266 Specific Mapping
// ═══════════════════════════════════════════════════════════════════════════════

// RC522 RFID Module Pins
#define RST_PIN         5   // D1 - RC522 Reset pin
#define SS_PIN          4   // D2 - RC522 SDA/SS pin  
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

// WiFi Configuration - Update these for your network
const char* ssid = "Dialog 4G 303";
const char* password = "Ba5315e7";  

// SmartTrack Backend Configuration
const char* websocket_host = "192.168.8.110";  // CHANGE THIS TO YOUR COMPUTER'S IP
const int websocket_port = 5000;                // WebSocket port (Node.js backend)
const char* websocket_path = "/";               // WebSocket endpoint

// Device Configuration
const char* device_id = "RFID_NODEMCU_001";    // Unique device identifier
const char* device_type = "RFID_READER";
const char* device_version = "NodeMCU_v2.0.1";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize RFID reader with custom SPI pins
MFRC522 rfid(SS_PIN, RST_PIN);

// WebSocket client
WebSocketsClient webSocket;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 GLOBAL VARIABLES & STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// System State
bool wifi_connected = false;
bool websocket_connected = false;
bool scanning_active = false;
bool config_mode = false;

// Timing Variables
unsigned long last_heartbeat = 0;
unsigned long last_card_read = 0;
unsigned long last_wifi_check = 0;
unsigned long last_display_update = 0;
unsigned long button_press_time = 0;

// Card Reading State
String last_card_id = "";
int total_cards_read = 0;
bool card_processing = false;

// Configuration
const unsigned long HEARTBEAT_INTERVAL = 30000;    // 30 seconds
const unsigned long CARD_READ_COOLDOWN = 2000;     // 2 seconds between same card reads
const unsigned long WIFI_CHECK_INTERVAL = 10000;   // 10 seconds
const unsigned long DISPLAY_UPDATE_INTERVAL = 1000; // 1 second
const unsigned long CONFIG_HOLD_TIME = 3000;       // 3 seconds for config mode

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 SYSTEM INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  // Initialize Serial with standard ESP8266 baud rate
  Serial.begin(115200);
  
  // Wait for serial to stabilize
  delay(2000);
  
  // Clear boot messages with just a few lines
  Serial.println();
  Serial.println();
  Serial.println();
  
  // System banner
  Serial.println("===========================================");
  Serial.println("    SmartTrack RFID Reader v2.0.1");
  Serial.println("    NodeMCU ESP8266 - System Starting");
  Serial.println("===========================================");
  Serial.println();
  
  // Initialize EEPROM for configuration storage
  EEPROM.begin(512);
  
  // Disable watchdog to prevent resets during initialization
  ESP.wdtDisable();
  
  // Step-by-step initialization with proper error handling
  Serial.println("[STEP 1] Initializing GPIO pins...");
  if (initializeGPIO()) {
    Serial.println("   SUCCESS: GPIO pins configured");
  } else {
    Serial.println("   ERROR: GPIO initialization failed");
    systemHalt();
  }
  
  Serial.println("[STEP 2] Initializing SPI and RFID reader...");
  if (initializeRFID()) {
    Serial.println("   SUCCESS: RFID reader initialized");
  } else {
    Serial.println("   WARNING: RFID reader may not be connected properly");
    Serial.println("   System will continue but card reading may not work");
  }
  
  Serial.println("[STEP 3] Running hardware self-test...");
  showStartupSequence();
  Serial.println("   SUCCESS: Hardware test completed");
  
  Serial.println("[STEP 4] Connecting to WiFi network...");
  connectToWiFi();
  
  if (wifi_connected) {
    Serial.println("[STEP 5] Initializing WebSocket connection...");
    initializeWebSocket();
    Serial.println("   WebSocket client configured");
  } else {
    Serial.println("[STEP 5] SKIPPED: WebSocket (no WiFi connection)");
  }
  
  // Re-enable watchdog with 8 second timeout
  ESP.wdtEnable(WDTO_8S);
  
  // Final status
  Serial.println();
  Serial.println("===========================================");
  Serial.println("    SYSTEM INITIALIZATION COMPLETE");
  Serial.println("===========================================");
  printSystemInfo();
  Serial.println("===========================================");
  Serial.println();
  
  // Start in scanning mode if everything is connected
  if (wifi_connected && websocket_connected) {
    Serial.println("Auto-starting RFID scanning...");
    startScanning();
  } else {
    Serial.println("Press the button to start manual RFID testing");
  }
}

bool initializeGPIO() {
  Serial.print("   Configuring pins... ");
  
  // Configure LED pins as outputs
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);
  
  // Set initial states - all LEDs and buzzer off
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("DONE");
  
  // Test pins briefly
  Serial.print("   Testing LEDs... ");
  digitalWrite(GREEN_LED_PIN, HIGH);
  delay(200);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, HIGH);
  delay(200);
  digitalWrite(RED_LED_PIN, LOW);
  Serial.println("DONE");
  
  return true;
}

bool initializeRFID() {
  Serial.print("   Starting SPI bus... ");
  SPI.begin();
  delay(100);
  Serial.println("DONE");
  
  Serial.print("   Initializing RC522... ");
  rfid.PCD_Init();
  delay(200);
  Serial.println("DONE");
  
  Serial.print("   Testing RFID communication... ");
  
  // Read version register to test communication
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  
  if (version == 0x00 || version == 0xFF) {
    Serial.println("FAILED");
    Serial.println("   ERROR: No response from RC522 module");
    Serial.println("   Check these connections:");
    Serial.println("     RST -> D1 (GPIO5)");
    Serial.println("     SDA -> D2 (GPIO4)"); 
    Serial.println("     SCK -> D5 (GPIO14)");
    Serial.println("     MISO -> D6 (GPIO12)");
    Serial.println("     MOSI -> D7 (GPIO13)");
    Serial.println("     3.3V -> 3.3V");
    Serial.println("     GND -> GND");
    return false;
  } else {
    Serial.println("SUCCESS");
    Serial.print("   RC522 Version: 0x");
    Serial.print(version, HEX);
    
    // Decode version
    if (version == 0x92) {
      Serial.println(" (v2.0)");
    } else if (version == 0x91) {
      Serial.println(" (v1.0)");
    } else {
      Serial.println(" (Unknown)");
    }
    
    return true;
  }
}

void showStartupSequence() {
  Serial.print("   LED sequence test... ");
  
  // Test sequence: Green -> Red -> Both -> Off
  for (int i = 0; i < 2; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    delay(150);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, HIGH);
    delay(150);
    digitalWrite(RED_LED_PIN, LOW);
  }
  
  Serial.println("DONE");
  
  Serial.print("   Buzzer test... ");
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
  Serial.println("DONE");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 WIFI CONNECTION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

void connectToWiFi() {
  Serial.print("   SSID: ");
  Serial.println(ssid);
  Serial.print("   Connecting");
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  int maxAttempts = 20; // 10 seconds total
  
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Blink red LED while connecting
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
  }
  
  // Turn off connection indicator LED
  digitalWrite(RED_LED_PIN, LOW);
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.println("   SUCCESS: WiFi connected!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    // Success feedback
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(300);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    
  } else {
    wifi_connected = false;
    Serial.println("   ERROR: WiFi connection failed!");
    Serial.print("   Status code: ");
    Serial.println(WiFi.status());
    Serial.println("   Please check:");
    Serial.println("     - WiFi SSID and password in code");
    Serial.println("     - WiFi network is available");
    Serial.println("     - Signal strength");
    
    // Error feedback
    showError("WiFi Failed");
  }
}

void checkWiFiConnection() {
  if (millis() - last_wifi_check > WIFI_CHECK_INTERVAL) {
    last_wifi_check = millis();
    
    if (WiFi.status() != WL_CONNECTED && wifi_connected) {
      wifi_connected = false;
      websocket_connected = false;
      Serial.println("WARNING: WiFi connection lost!");
      Serial.println("Attempting reconnection...");
      showError("WiFi Lost");
      connectToWiFi();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 WEBSOCKET COMMUNICATION
// ═══════════════════════════════════════════════════════════════════════════════

void initializeWebSocket() {
  if (!wifi_connected) {
    Serial.println("   ERROR: Cannot start WebSocket - no WiFi");
    return;
  }
  
  Serial.print("   Server: ");
  Serial.print(websocket_host);
  Serial.print(":");
  Serial.print(websocket_port);
  Serial.println(websocket_path);
  
  webSocket.begin(websocket_host, websocket_port, websocket_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 3000, 2);
  
  Serial.println("   WebSocket client started");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      websocket_connected = false;
      Serial.println("WebSocket: Disconnected from server");
      showError("Server Lost");
      break;
      
    case WStype_CONNECTED:
      websocket_connected = true;
      Serial.print("WebSocket: Connected to ");
      Serial.println((char*)payload);
      registerDevice();
      showConnected();
      break;
      
    case WStype_TEXT:
      Serial.print("WebSocket: Received -> ");
      Serial.println((char*)payload);
      handleWebSocketMessage((char*)payload);
      break;
      
    case WStype_ERROR:
      Serial.print("WebSocket: Error -> ");
      Serial.println((char*)payload);
      showError("WS Error");
      break;
      
    case WStype_PING:
      Serial.println("WebSocket: Ping received");
      break;
      
    case WStype_PONG:
      Serial.println("WebSocket: Pong received");
      break;
      
    default:
      Serial.print("WebSocket: Unknown event type ");
      Serial.println(type);
      break;
  }
}

void registerDevice() {
  if (!websocket_connected) return;
  
  Serial.println("Registering device with SmartTrack backend...");
  
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
  
  Serial.println("Device registration sent");
}

void handleWebSocketMessage(String message) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("ERROR: Failed to parse JSON message");
    return;
  }
  
  String type = doc["type"];
  
  if (type == "command") {
    String command = doc["command"];
    Serial.print("Command received: ");
    Serial.println(command);
    
    if (command == "START_SCAN") {
      startScanning();
    } else if (command == "STOP_SCAN") {
      stopScanning();
    } else if (command == "STATUS") {
      sendStatusUpdate();
    } else if (command == "REBOOT") {
      Serial.println("Rebooting device...");
      ESP.restart();
    }
  } else if (type == "card_response") {
    handleCardResponse(doc);
  }
}

void handleCardResponse(JsonDocument& doc) {
  String status = doc["status"];
  String studentName = doc["studentName"];
  String className = doc["className"];
  String cardId = doc["cardId"];
  
  Serial.print("Card response: ");
  Serial.print(status);
  Serial.print(" for card ");
  Serial.println(cardId);
  
  if (status == "success") {
    showCardSuccess(studentName, className);
    cardFeedbackSuccess();
  } else if (status == "unauthorized") {
    showCardUnauthorized();
    cardFeedbackError();
  } else if (status == "not_found") {
    showCardNotFound();
    cardFeedbackError();
  } else {
    Serial.print("Unknown response status: ");
    Serial.println(status);
    cardFeedbackError();
  }
  
  card_processing = false;
}

void sendHeartbeat() {
  if (!websocket_connected) return;
  
  if (millis() - last_heartbeat > HEARTBEAT_INTERVAL) {
    last_heartbeat = millis();
    
    StaticJsonDocument<512> doc;
    doc["type"] = "heartbeat";
    doc["deviceId"] = device_id;
    doc["timestamp"] = millis();
    doc["status"] = scanning_active ? "scanning" : "idle";
    doc["totalReads"] = total_cards_read;
    doc["wifiRSSI"] = WiFi.RSSI();
    doc["freeHeap"] = ESP.getFreeHeap();
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
    
    Serial.println("Heartbeat sent");
  }
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
  doc["wifi_rssi"] = WiFi.RSSI();
  
  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
  
  Serial.println("Status update sent");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ RFID CARD DETECTION & PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

void handleRFIDScanning() {
  if (!scanning_active || card_processing) return;
  
  // Look for new cards
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Read card UID and convert to hex string
  String cardId = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      cardId += "0"; // Add leading zero for single digits
    }
    cardId += String(rfid.uid.uidByte[i], HEX);
  }
  cardId.toUpperCase();
  
  // Check cooldown period to prevent multiple reads
  if (cardId == last_card_id && (millis() - last_card_read) < CARD_READ_COOLDOWN) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // Process new card read
  last_card_id = cardId;
  last_card_read = millis();
  total_cards_read++;
  card_processing = true;
  
  Serial.println();
  Serial.println("*** CARD DETECTED ***");
  Serial.print("Card ID: ");
  Serial.println(cardId);
  Serial.print("Read #");
  Serial.println(total_cards_read);
  Serial.println("*********************");
  
  // Visual/audio feedback
  showCardRead(cardId);
  
  // Send to backend if connected
  if (websocket_connected) {
    sendCardData(cardId);
  } else {
    // Local mode - just show the card was read
    Serial.println("OFFLINE MODE: Card read but not sent to server");
    card_processing = false;
  }
  
  // Properly halt the PICC and stop crypto
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void sendCardData(String cardId) {
  if (!websocket_connected) {
    Serial.println("ERROR: Cannot send card data - WebSocket not connected");
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
  
  Serial.println("Card data sent to SmartTrack backend");
  Serial.println("Waiting for server response...");
}

void startScanning() {
  scanning_active = true;
  Serial.println();
  Serial.println("========================================");
  Serial.println("    RFID SCANNING STARTED");
  Serial.println("========================================");
  Serial.println("Ready to read RFID cards...");
  Serial.println("Hold a card near the RC522 reader");
  Serial.println("========================================");
  
  // Visual indicator
  digitalWrite(GREEN_LED_PIN, HIGH);
  
  // Audio confirmation
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(BUZZER_PIN, LOW);
}

void stopScanning() {
  scanning_active = false;
  Serial.println();
  Serial.println("========================================");
  Serial.println("    RFID SCANNING STOPPED");
  Serial.println("========================================");
  Serial.println("Press button to resume scanning");
  Serial.println("========================================");
  
  // Turn off scanning indicator
  digitalWrite(GREEN_LED_PIN, LOW);
  
  // Audio confirmation
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💡 FEEDBACK & DISPLAY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void showConnected() {
  Serial.println();
  Serial.println("SUCCESS: SmartTrack System Connected!");
  Serial.println("Device registered with backend server");
  Serial.println("Web dashboard: http://localhost:3000");
  Serial.println("Ready for RFID card detection");
  
  // Success sequence - green LED and beep pattern
  for (int i = 0; i < 3; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(150);
  }
}

void showError(String error) {
  Serial.print("ERROR: ");
  Serial.println(error);
  
  // Error sequence - red LED flashing
  for (int i = 0; i < 5; i++) {
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

void showCardRead(String cardId) {
  Serial.println("Processing card with SmartTrack system...");
  
  // Brief positive feedback
  digitalWrite(GREEN_LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(200);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

void showCardSuccess(String studentName, String className) {
  Serial.println();
  Serial.println("*** ACCESS GRANTED ***");
  Serial.print("Welcome: ");
  Serial.println(studentName);
  if (className.length() > 0) {
    Serial.print("Class: ");
    Serial.println(className);
  }
  Serial.println("Attendance recorded successfully!");
  Serial.println("**********************");
}

void showCardUnauthorized() {
  Serial.println();
  Serial.println("*** ACCESS DENIED ***");
  Serial.println("Card not authorized for this system");
  Serial.println("Contact administrator");
  Serial.println("*********************");
}

void showCardNotFound() {
  Serial.println();
  Serial.println("*** CARD NOT REGISTERED ***");
  Serial.println("This card is not in the database");
  Serial.println("Please register via web dashboard");
  Serial.println("**************************");
}

void cardFeedbackSuccess() {
  // Success pattern - 3 long green flashes
  for (int i = 0; i < 3; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(300);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
}

void cardFeedbackError() {
  // Error pattern - 5 short red flashes
  for (int i = 0; i < 5; i++) {
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(150);
  }
}

void updateStatusDisplay() {
  if (millis() - last_display_update < DISPLAY_UPDATE_INTERVAL) return;
  last_display_update = millis();
  
  // Don't spam during card processing
  if (card_processing) return;
  
  // Status update every 30 seconds when idle
  static unsigned long last_status_print = 0;
  if (millis() - last_status_print > 30000) {
    last_status_print = millis();
    
    Serial.println();
    Serial.println("=== SYSTEM STATUS UPDATE ===");
    printSystemInfo();
    Serial.println("===========================");
  }
}

void printSystemInfo() {
  Serial.print("WiFi: ");
  if (wifi_connected) {
    Serial.print("Connected (");
    Serial.print(WiFi.localIP());
    Serial.print(", RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm)");
  } else {
    Serial.println("Disconnected");
  }
  
  Serial.print("WebSocket: ");
  Serial.println(websocket_connected ? "Connected" : "Disconnected");
  
  Serial.print("RFID Scanning: ");
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

// ═══════════════════════════════════════════════════════════════════════════════
// 🔘 BUTTON HANDLING & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

void handleConfigButton() {
  bool button_pressed = !digitalRead(CONFIG_BTN_PIN);
  
  if (button_pressed && button_press_time == 0) {
    button_press_time = millis();
    Serial.println("Button pressed...");
  } else if (!button_pressed && button_press_time > 0) {
    unsigned long press_duration = millis() - button_press_time;
    button_press_time = 0;
    
    Serial.print("Button released after ");
    Serial.print(press_duration);
    Serial.println(" ms");
    
    if (press_duration > CONFIG_HOLD_TIME) {
      // Long press - enter config mode
      Serial.println("Long press detected - entering config mode");
      enterConfigMode();
    } else if (press_duration > 100) {
      // Short press - toggle scanning
      Serial.println("Short press detected - toggling scan mode");
      if (scanning_active) {
        stopScanning();
      } else {
        startScanning();
      }
    }
  }
}

void enterConfigMode() {
  config_mode = true;
  Serial.println();
  Serial.println("========================================");
  Serial.println("    CONFIGURATION MODE ACTIVE");
  Serial.println("========================================");
  Serial.println("Current Configuration:");
  Serial.print("  WiFi SSID: ");
  Serial.println(ssid);
  Serial.print("  WebSocket Server: ");
  Serial.print(websocket_host);
  Serial.print(":");
  Serial.println(websocket_port);
  Serial.print("  Device ID: ");
  Serial.println(device_id);
  Serial.println();
  Serial.println("To change settings:");
  Serial.println("  1. Edit code and re-upload");
  Serial.println("  2. Use web dashboard for user management");
  Serial.println("  3. Register cards via web interface");
  Serial.println("========================================");
  
  // Config mode visual indicator
  for (int i = 0; i < 10; i++) {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
  
  Serial.println("Configuration mode completed");
  config_mode = false;
}

void systemHalt() {
  Serial.println("CRITICAL ERROR: System halted");
  Serial.println("Please check hardware connections and restart");
  
  while(true) {
    digitalWrite(RED_LED_PIN, HIGH);
    delay(500);
    digitalWrite(RED_LED_PIN, LOW);
    delay(500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // Feed watchdog timer to prevent system resets
  ESP.wdtFeed();
  
  // Handle WebSocket events and messages
  if (wifi_connected) {
    webSocket.loop();
  }
  
  // Check and maintain WiFi connection
  checkWiFiConnection();
  
  // Handle RFID card scanning
  handleRFIDScanning();
  
  // Handle button press events
  handleConfigButton();
  
  // Send periodic heartbeat to server
  if (websocket_connected) {
    sendHeartbeat();
  }
  
  // Update status display
  updateStatusDisplay();
  
  // Small delay to prevent excessive CPU usage and allow other processes
  delay(50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 ADDITIONAL UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void testRFIDOffline() {
  // Simple offline RFID test function
  Serial.println("Starting offline RFID test mode...");
  Serial.println("Present cards to test RFID functionality");
  
  while(true) {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      String cardId = "";
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) {
          cardId += "0";
        }
        cardId += String(rfid.uid.uidByte[i], HEX);
      }
      cardId.toUpperCase();
      
      Serial.print("OFFLINE TEST - Card detected: ");
      Serial.println(cardId);
      
      // Visual feedback
      digitalWrite(GREEN_LED_PIN, HIGH);
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(GREEN_LED_PIN, LOW);
      digitalWrite(BUZZER_PIN, LOW);
      
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
      delay(1000);
    }
    
    // Check for button press to exit test mode
    if (!digitalRead(CONFIG_BTN_PIN)) {
      delay(50); // Debounce
      while(!digitalRead(CONFIG_BTN_PIN)) { delay(10); } // Wait for release
      Serial.println("Exiting offline test mode...");
      break;
    }
    
    delay(100);
  }
}