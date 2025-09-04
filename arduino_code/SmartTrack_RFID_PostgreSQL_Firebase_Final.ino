/*
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                       SmartTrack RFID Scanner                               ║
 * ║                    Complete PostgreSQL + Firebase                           ║
 * ║                     Integration - Production Ready                           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * Hardware: NodeMCU ESP8266 + RC522 RFID Module
 * Backend: Python Flask with PostgreSQL + Firebase Real-time
 * Frontend: React SmartTrack Application
 * 
 * FEATURES:
 * ✓ HTTP communication (more reliable than WebSocket)
 * ✓ Automatic WiFi reconnection
 * ✓ PostgreSQL database integration
 * ✓ Firebase real-time updates
 * ✓ LED/Buzzer feedback
 * ✓ Device heartbeat monitoring
 * ✓ Error handling and recovery
 * ✓ React frontend compatibility
 * 
 * WIRING DIAGRAM:
 * RC522 Module → NodeMCU ESP8266
 * VCC      → 3.3V
 * RST      → D1 (GPIO5)
 * GND      → GND
 * MISO     → D6 (GPIO12)
 * MOSI     → D7 (GPIO13)
 * SCK      → D5 (GPIO14)
 * SDA      → D2 (GPIO4)
 * 
 * LED: D8 (GPIO15) → 220Ω resistor → LED → GND
 * Buzzer: D0 (GPIO16) → Buzzer → GND
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// WiFi Configuration
const char* WIFI_SSID = "Dialog 4G 303";
const char* WIFI_PASSWORD = "Ba5315e7";

// Server Configuration (Updated for your PostgreSQL + Firebase server)
const char* serverURL = "http://192.168.1.100:5080";  // Update with your computer's IP
const char* scanEndpoint = "/rfid-scan";
const char* heartbeatEndpoint = "/device-heartbeat";

// Device Configuration
const char* deviceId = "ESP8266_RFID_001";
const char* location = "Main Entrance";

// Hardware Pin Configuration
#define RST_PIN     D1    // GPIO5
#define SS_PIN      D2    // GPIO4
#define LED_PIN     D8    // GPIO15
#define BUZZER_PIN  D0    // GPIO16

// Timing Configuration
const unsigned long SCAN_COOLDOWN = 2000;       // 2 seconds between scans
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds
const unsigned long WIFI_CHECK_INTERVAL = 60000; // 1 minute

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 GLOBAL VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

MFRC522 rfid(SS_PIN, RST_PIN);
WiFiClient wifiClient;
HTTPClient http;

unsigned long lastScanTime = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastWiFiCheck = 0;
String lastRFIDCard = "";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  // Print startup banner
  Serial.println("\n╔══════════════════════════════════════════════════════════════╗");
  Serial.println("║               SmartTrack RFID Scanner v3.0                  ║");
  Serial.println("║                PostgreSQL + Firebase Ready                  ║");
  Serial.println("╚══════════════════════════════════════════════════════════════╝");
  Serial.println();
  
  // Initialize hardware
  setupHardware();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Test server connection
  testServerConnection();
  
  Serial.println("🎯 SmartTrack RFID Scanner ready for PostgreSQL + Firebase!");
  Serial.println("📱 Place an RFID card near the reader...");
  Serial.println();
  
  // Success feedback
  playStartupSound();
  blinkLED(3, 200);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  // Check WiFi connection periodically
  if (millis() - lastWiFiCheck > WIFI_CHECK_INTERVAL) {
    checkWiFiConnection();
    lastWiFiCheck = millis();
  }
  
  // Send heartbeat periodically
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check for RFID cards
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    handleRFIDScan();
  }
  
  delay(100); // Small delay to prevent overwhelming the system
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HARDWARE SETUP
// ═══════════════════════════════════════════════════════════════════════════════

void setupHardware() {
  Serial.println("🔧 Initializing hardware...");
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  
  // Test RFID module
  if (rfid.PCD_PerformSelfTest()) {
    Serial.println("✅ RC522 RFID module initialized successfully");
  } else {
    Serial.println("❌ RC522 RFID module failed to initialize");
  }
  
  rfid.PCD_Init(); // Re-initialize after self-test
  
  Serial.println("✅ Hardware initialization complete");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 WIFI CONNECTION
// ═══════════════════════════════════════════════════════════════════════════════

void connectToWiFi() {
  Serial.println("📡 Connecting to WiFi...");
  Serial.printf("   SSID: %s\n", WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    // Blink LED during connection
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
  
  digitalWrite(LED_PIN, LOW);
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected successfully!");
    Serial.printf("   IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Signal Strength: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    Serial.println("   Please check your WiFi credentials and try again");
  }
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected! Attempting to reconnect...");
    connectToWiFi();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SERVER COMMUNICATION
// ═══════════════════════════════════════════════════════════════════════════════

void testServerConnection() {
  Serial.println("🌐 Testing server connection...");
  Serial.printf("   Server URL: %s\n", serverURL);
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Cannot test server - WiFi not connected");
    return;
  }
  
  http.begin(wifiClient, String(serverURL) + "/health");
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.GET();
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("✅ Server responded with code: %d\n", httpCode);
    Serial.println("✅ PostgreSQL + Firebase server is ready!");
  } else {
    Serial.printf("❌ Server connection failed with code: %d\n", httpCode);
    Serial.println("   Please check your server URL and ensure the Python server is running");
  }
  
  http.end();
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceId;
  doc["location"] = location;
  doc["status"] = "online";
  doc["signal_strength"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  http.begin(wifiClient, String(serverURL) + heartbeatEndpoint);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200) {
    Serial.println("💓 Heartbeat sent successfully");
  } else {
    Serial.printf("⚠️ Heartbeat failed with code: %d\n", httpCode);
  }
  
  http.end();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 RFID HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

void handleRFIDScan() {
  // Check scan cooldown
  if (millis() - lastScanTime < SCAN_COOLDOWN) {
    return;
  }
  
  // Read RFID card
  String rfidCard = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    rfidCard += String(rfid.uid.uidByte[i], HEX);
  }
  rfidCard.toUpperCase();
  
  // Prevent duplicate scans
  if (rfidCard == lastRFIDCard && (millis() - lastScanTime) < SCAN_COOLDOWN * 2) {
    rfid.PICC_HaltA();
    return;
  }
  
  Serial.println("📱 RFID Card Detected!");
  Serial.printf("   Card ID: %s\n", rfidCard.c_str());
  Serial.printf("   Device: %s\n", deviceId);
  Serial.printf("   Location: %s\n", location);
  
  // Visual feedback
  digitalWrite(LED_PIN, HIGH);
  tone(BUZZER_PIN, 2000, 200);
  
  // Send to PostgreSQL + Firebase server
  bool success = sendRFIDScan(rfidCard);
  
  if (success) {
    Serial.println("✅ Scan sent successfully to PostgreSQL + Firebase!");
    playSuccessSound();
    blinkLED(2, 100);
  } else {
    Serial.println("❌ Failed to send scan to server");
    playErrorSound();
    blinkLED(5, 50);
  }
  
  // Update tracking variables
  lastScanTime = millis();
  lastRFIDCard = rfidCard;
  
  // Halt card and prepare for next scan
  rfid.PICC_HaltA();
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("📱 Ready for next scan...\n");
}

bool sendRFIDScan(String rfidCard) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Cannot send scan - WiFi not connected");
    return false;
  }
  
  // Create JSON payload
  StaticJsonDocument<300> doc;
  doc["rfid_card"] = rfidCard;
  doc["device_id"] = deviceId;
  doc["location"] = location;
  doc["timestamp"] = millis();
  doc["signal_strength"] = WiFi.RSSI();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("🚀 Sending to PostgreSQL + Firebase server...");
  Serial.printf("   Payload: %s\n", jsonString.c_str());
  
  // Send HTTP POST request
  http.begin(wifiClient, String(serverURL) + scanEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout
  
  int httpCode = http.POST(jsonString);
  String response = http.getString();
  
  Serial.printf("   Response Code: %d\n", httpCode);
  Serial.printf("   Response: %s\n", response.c_str());
  
  http.end();
  
  return (httpCode == 200);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 FEEDBACK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void playStartupSound() {
  tone(BUZZER_PIN, 1000, 200);
  delay(250);
  tone(BUZZER_PIN, 1500, 200);
  delay(250);
  tone(BUZZER_PIN, 2000, 300);
}

void playSuccessSound() {
  tone(BUZZER_PIN, 2000, 100);
  delay(150);
  tone(BUZZER_PIN, 2500, 100);
}

void playErrorSound() {
  tone(BUZZER_PIN, 500, 200);
  delay(250);
  tone(BUZZER_PIN, 400, 200);
  delay(250);
  tone(BUZZER_PIN, 300, 300);
}

void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_PIN, LOW);
    delay(delayMs);
  }
}
