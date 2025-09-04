/*
 * SmartTrack RFID HTTP Integration - Final Version
 * NodeMCU ESP8266 with RC522 RFID Module
 * 
 * This version uses simple HTTP POST requests instead of WebSocket
 * Perfect integration with your React app and Firebase backend
 * 
 * Pin Configuration:
 * D1 (5)  → RC522 RST
 * D2 (4)  → RC522 SDA
 * D5 (14) → RC522 SCK
 * D6 (12) → RC522 MISO
 * D7 (13) → RC522 MOSI
 * D3 (0)  → Green LED (+)
 * D4 (2)  → Red LED (+)
 * D8 (15) → Buzzer (+)
 * D0 (16) → Config Button
 * 3.3V → RC522 VCC
 * GND  → Common Ground
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// ═══════════════════════════════════════════════════════════════════════════════
// 📌 PIN CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// RFID RC522 Pins
#define RST_PIN         5   // D1
#define SS_PIN          4   // D2
#define SCK_PIN         14  // D5
#define MISO_PIN        12  // D6
#define MOSI_PIN        13  // D7

// Feedback Components
#define GREEN_LED_PIN   0   // D3
#define RED_LED_PIN     2   // D4
#define BUZZER_PIN      15  // D8
#define CONFIG_BTN_PIN  16  // D0

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 NETWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// WiFi Configuration - UPDATE THESE!
const char* WIFI_SSID = "Dialog 4G 303";
const char* WIFI_PASSWORD = "Ba5315e7";

// HTTP Server Configuration
const char* SERVER_HOST = "192.168.8.110";    // Your PC's IP address
const int SERVER_PORT = 5080;                 // HTTP server port (updated)
const char* RFID_ENDPOINT = "/rfid-scan";     // API endpoint
const char* STATUS_ENDPOINT = "/status";      // Server status endpoint

// Device Configuration
const char* DEVICE_ID = "RFID_SCANNER_001";
const char* DEVICE_LOCATION = "Main Entrance";
const char* DEVICE_VERSION = "HTTP_v1.0";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

MFRC522 rfid(SS_PIN, RST_PIN);
WiFiClient wifiClient;
HTTPClient http;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SYSTEM VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

bool wifiConnected = false;
bool serverOnline = false;
unsigned long lastScanTime = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastStatusCheck = 0;

const unsigned long SCAN_COOLDOWN = 3000;      // 3 seconds between scans
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds
const unsigned long STATUS_CHECK_INTERVAL = 10000; // 10 seconds

// Statistics
unsigned long totalScans = 0;
unsigned long successfulScans = 0;
unsigned long failedScans = 0;
unsigned long bootTime = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 AUDIO & LED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void playSuccessTone() {
  tone(BUZZER_PIN, 1000, 200);
  delay(250);
  tone(BUZZER_PIN, 1200, 200);
  delay(250);
  noTone(BUZZER_PIN);
}

void playErrorTone() {
  tone(BUZZER_PIN, 400, 500);
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

void playConnectedTone() {
  tone(BUZZER_PIN, 1500, 100);
  delay(120);
  tone(BUZZER_PIN, 1800, 100);
  delay(120);
  tone(BUZZER_PIN, 2000, 150);
  delay(200);
  noTone(BUZZER_PIN);
}

void setLEDs(String status) {
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
    // Quick blink during scan
    for (int i = 0; i < 3; i++) {
      digitalWrite(GREEN_LED_PIN, HIGH);
      delay(100);
      digitalWrite(GREEN_LED_PIN, LOW);
      delay(100);
    }
  } else if (status == "offline") {
    // Slow red blink when server offline
    digitalWrite(RED_LED_PIN, HIGH);
    delay(500);
    digitalWrite(RED_LED_PIN, LOW);
    delay(500);
  } else if (status == "online") {
    // Quick green flash when server online
    digitalWrite(GREEN_LED_PIN, HIGH);
    delay(200);
    digitalWrite(GREEN_LED_PIN, LOW);
  } else {
    // Turn off all LEDs
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📺 DISPLAY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void displaySystemStatus() {
  Serial.println("\n╔══════════════════════════════════════════╗");
  Serial.println("║        SmartTrack RFID HTTP v1.0        ║");
  Serial.println("╠══════════════════════════════════════════╣");
  
  Serial.print("║ WiFi: ");
  if (wifiConnected) {
    Serial.println("✅ Connected                     ║");
    Serial.println("║ IP: " + WiFi.localIP().toString() + "                ║");
  } else {
    Serial.println("❌ Disconnected                  ║");
  }
  
  Serial.print("║ Server: ");
  if (serverOnline) {
    Serial.println("✅ Online                       ║");
  } else {
    Serial.println("❌ Offline                      ║");
  }
  
  Serial.println("║ Device: " + String(DEVICE_ID) + "      ║");
  Serial.println("║ Location: " + String(DEVICE_LOCATION) + "            ║");
  Serial.println("║ Scans: " + String(totalScans) + " | Success: " + String(successfulScans) + "       ║");
  Serial.println("║ Status: 🎯 Ready to Scan                ║");
  Serial.println("╚══════════════════════════════════════════╝");
}

void displayStudentInfo(JsonObject student) {
  Serial.println("\n╔══════════════════════════════════════════╗");
  Serial.println("║              🎉 WELCOME BACK!            ║");
  Serial.println("╠══════════════════════════════════════════╣");
  
  String name = student["fullName"].as<String>();
  String studentId = student["studentId"].as<String>();
  String department = student["department"].as<String>();
  float attendance = student["attendanceStats"]["attendancePercentage"].as<float>();
  
  Serial.println("║ Student: " + name);
  Serial.println("║ ID: " + studentId + " | Dept: " + department);
  Serial.println("║ Attendance: " + String(attendance, 1) + "%");
  Serial.println("║ Time: " + String(millis()/1000) + "s since boot");
  Serial.println("╚══════════════════════════════════════════╝");
}

void displayErrorMessage(String message) {
  Serial.println("\n╔══════════════════════════════════════════╗");
  Serial.println("║             ❌ ACCESS DENIED             ║");
  Serial.println("╠══════════════════════════════════════════╣");
  Serial.println("║ Error: " + message);
  Serial.println("║ Please try again or contact admin...    ║");
  Serial.println("╚══════════════════════════════════════════╝");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 HTTP COMMUNICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

bool checkServerStatus() {
  if (!wifiConnected) return false;
  
  http.begin(wifiClient, "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/status");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000); // 5 second timeout
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("📡 Server Status: Online");
    serverOnline = true;
    setLEDs("online");
  } else {
    Serial.println("📡 Server Status: Offline (Code: " + String(httpCode) + ")");
    serverOnline = false;
    setLEDs("offline");
  }
  
  http.end();
  return serverOnline;
}

void sendDeviceHeartbeat() {
  if (!wifiConnected || !serverOnline) return;
  
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/device-heartbeat";
  
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  
  // Create heartbeat JSON
  DynamicJsonDocument doc(512);
  doc["deviceId"] = DEVICE_ID;
  doc["deviceType"] = "RFID_READER";
  doc["location"] = DEVICE_LOCATION;
  doc["version"] = DEVICE_VERSION;
  doc["timestamp"] = millis();
  doc["uptime"] = (millis() - bootTime) / 1000;
  doc["totalScans"] = totalScans;
  doc["successfulScans"] = successfulScans;
  doc["failedScans"] = failedScans;
  doc["wifiSignal"] = WiFi.RSSI();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["status"] = "online";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == 200) {
    Serial.println("💓 Heartbeat sent successfully");
  } else {
    Serial.println("💓 Heartbeat failed: " + String(httpCode));
  }
  
  http.end();
}

void sendRFIDToServer(String rfidCard) {
  if (!wifiConnected) {
    Serial.println("❌ WiFi not connected");
    displayErrorMessage("WiFi Offline");
    setLEDs("error");
    playErrorTone();
    failedScans++;
    return;
  }
  
  if (!serverOnline) {
    Serial.println("❌ Server offline");
    displayErrorMessage("Server Offline");
    setLEDs("error");
    playErrorTone();
    failedScans++;
    return;
  }
  
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + String(RFID_ENDPOINT);
  
  Serial.println("📤 Sending to: " + url);
  
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout for RFID requests
  
  // Create RFID scan JSON payload (matching server expectations)
  DynamicJsonDocument doc(400);
  doc["rfidCard"] = rfidCard;         // Server expects 'rfidCard' (camelCase)
  doc["deviceId"] = DEVICE_ID;        // Server expects 'deviceId' (camelCase)
  doc["location"] = DEVICE_LOCATION;
  doc["timestamp"] = millis();
  doc["deviceUptime"] = (millis() - bootTime) / 1000;
  doc["signalStrength"] = WiFi.RSSI();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("📤 Payload: " + jsonString);
  
  int httpCode = http.POST(jsonString);
  
  Serial.println("📨 Response Code: " + String(httpCode));
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("📨 Response: " + response);
    handleServerResponse(response, rfidCard);
  } else if (httpCode > 0) {
    String errorResponse = http.getString();
    Serial.println("❌ HTTP Error " + String(httpCode) + ": " + errorResponse);
    displayErrorMessage("HTTP Error " + String(httpCode));
    setLEDs("error");
    playErrorTone();
    failedScans++;
  } else {
    Serial.println("❌ Connection Error: " + String(httpCode));
    displayErrorMessage("Connection Failed");
    setLEDs("error");
    playErrorTone();
    failedScans++;
    serverOnline = false; // Mark server as offline for next check
  }
  
  http.end();
}

void handleServerResponse(String response, String rfidCard) {
  DynamicJsonDocument doc(2048);
  DeserializationError error = deserializeJson(doc, response);
  
  if (error) {
    Serial.println("❌ JSON Parse Error: " + String(error.c_str()));
    displayErrorMessage("Invalid Response");
    setLEDs("error");
    playErrorTone();
    failedScans++;
    return;
  }
  
  bool success = doc["success"].as<bool>();
  
  if (success) {
    // Success - display student info
    JsonObject student = doc["student"];
    displayStudentInfo(student);
    setLEDs("success");
    playSuccessTone();
    successfulScans++;
    
    Serial.println("✅ Attendance recorded for RFID: " + rfidCard);
    
  } else {
    // Failed - show error message
    String errorMessage = doc["message"].as<String>();
    displayErrorMessage(errorMessage);
    setLEDs("error");
    playErrorTone();
    failedScans++;
    
    Serial.println("❌ RFID rejected: " + rfidCard + " - " + errorMessage);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  bootTime = millis();
  
  Serial.println("\n🚀 SmartTrack RFID HTTP System Starting...");
  Serial.println("📍 Device: " + String(DEVICE_ID));
  Serial.println("📍 Location: " + String(DEVICE_LOCATION)); 
  Serial.println("📍 Version: " + String(DEVICE_VERSION));
  Serial.println("🌐 Server: http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT));
  
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
  
  // Initialize SPI for RFID
  SPI.begin();
  
  // Initialize RFID reader
  rfid.PCD_Init();
  
  // Test RFID reader
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("❌ RFID Reader not detected! Check wiring.");
    while(1) {
      setLEDs("error");
      delay(1000);
    }
  } else {
    Serial.println("✅ RFID Reader initialized (Version: 0x" + String(version, HEX) + ")");
  }
  
  // Connect to WiFi
  Serial.println("🔌 Connecting to WiFi: " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Blink red LED while connecting
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(RED_LED_PIN, LOW);
    
    Serial.println("\n✅ WiFi Connected!");
    Serial.println("📡 IP Address: " + WiFi.localIP().toString());
    Serial.println("📶 Signal Strength: " + String(WiFi.RSSI()) + " dBm");
    
    // Check server status
    Serial.println("🔍 Checking server connection...");
    checkServerStatus();
    
    if (serverOnline) {
      playConnectedTone();
      Serial.println("✅ System fully operational!");
    } else {
      Serial.println("⚠️ Server offline - will retry automatically");
    }
    
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    Serial.println("⚠️ Running in offline mode...");
    playErrorTone();
  }
  
  // Display initial status
  delay(1000);
  displaySystemStatus();
  
  Serial.println("🎯 SmartTrack RFID System Ready!");
  Serial.println("📋 Present RFID card to reader...");
  Serial.println("═════════════════════════════════════════════");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  unsigned long currentTime = millis();
  
  // Check server status periodically
  if (currentTime - lastStatusCheck > STATUS_CHECK_INTERVAL) {
    if (wifiConnected) {
      checkServerStatus();
    }
    lastStatusCheck = currentTime;
  }
  
  // Send heartbeat periodically
  if (currentTime - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendDeviceHeartbeat();
    lastHeartbeat = currentTime;
  }
  
  // Check configuration button
  if (digitalRead(CONFIG_BTN_PIN) == LOW) {
    Serial.println("🔧 Configuration button pressed");
    displaySystemStatus();
    delay(1000); // Debounce
  }
  
  // Handle RFID scanning
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  // Prevent rapid scanning
  if (currentTime - lastScanTime < SCAN_COOLDOWN) {
    Serial.println("⏳ Please wait " + String((SCAN_COOLDOWN - (currentTime - lastScanTime)) / 1000) + " seconds between scans");
    return;
  }
  
  // Read RFID card
  String rfidCard = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) rfidCard += "0";
    rfidCard += String(rfid.uid.uidByte[i], HEX);
  }
  rfidCard.toUpperCase();
  
  Serial.println("\n📱 RFID Card Detected: " + rfidCard);
  Serial.println("🕒 Scan Time: " + String(currentTime/1000) + "s since boot");
  
  // Visual feedback during scan
  setLEDs("scanning");
  
  // Send to server
  totalScans++;
  sendRFIDToServer(rfidCard);
  lastScanTime = currentTime;
  
  // Halt PICC and stop encryption
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  
  delay(100); // Small delay to prevent multiple reads
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void printDetailedSystemInfo() {
  Serial.println("\n📊 Detailed System Information:");
  Serial.println("═════════════════════════════════════════════");
  Serial.println("Device ID: " + String(DEVICE_ID));
  Serial.println("Location: " + String(DEVICE_LOCATION));
  Serial.println("Version: " + String(DEVICE_VERSION));
  Serial.println("Boot Time: " + String(bootTime) + "ms");
  Serial.println("Uptime: " + String((millis() - bootTime) / 1000) + " seconds");
  Serial.println("Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
  Serial.println("WiFi SSID: " + String(WIFI_SSID));
  Serial.println("WiFi RSSI: " + String(WiFi.RSSI()) + " dBm");
  Serial.println("Server: " + String(SERVER_HOST) + ":" + String(SERVER_PORT));
  Serial.println("Total Scans: " + String(totalScans));
  Serial.println("Successful: " + String(successfulScans));
  Serial.println("Failed: " + String(failedScans));
  float successRate = (totalScans > 0) ? ((float)successfulScans / totalScans * 100) : 0.0;
  Serial.println("Success Rate: " + String(successRate, 1) + "%");
  Serial.println("═════════════════════════════════════════════");
}
