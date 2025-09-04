/*
 * SmartTrack RFID Serial Direct Communication
 * NodeMCU ESP8266 with RC522 RFID Module
 * 
 * This version sends RFID data directly via USB Serial port
 * No WiFi or HTTP server required - perfect for direct PC communication
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
// 🔧 DEVICE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Device Configuration
const char* DEVICE_ID = "RFID_SCANNER_001";
const char* DEVICE_LOCATION = "Main Entrance";
const char* DEVICE_VERSION = "SERIAL_v1.0";

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 HARDWARE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

MFRC522 rfid(SS_PIN, RST_PIN);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SYSTEM VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

unsigned long lastScanTime = 0;
unsigned long lastHeartbeat = 0;
unsigned long bootTime = 0;

const unsigned long SCAN_COOLDOWN = 2000;      // 2 seconds between scans
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Statistics
unsigned long totalScans = 0;
unsigned long bootTimestamp = 0;

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
  tone(BUZZER_PIN, 400, 300);
  delay(350);
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

void setLEDs(String status) {
  if (status == "success") {
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, LOW);
    delay(1000);
    digitalWrite(GREEN_LED_PIN, LOW);
  } else if (status == "error") {
    digitalWrite(RED_LED_PIN, HIGH);
    digitalWrite(GREEN_LED_PIN, LOW);
    delay(1000);
    digitalWrite(RED_LED_PIN, LOW);
  } else if (status == "scanning") {
    // Quick blink during scan
    for (int i = 0; i < 3; i++) {
      digitalWrite(GREEN_LED_PIN, HIGH);
      delay(100);
      digitalWrite(GREEN_LED_PIN, LOW);
      delay(100);
    }
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
  Serial.println("║      SmartTrack RFID Serial v1.0        ║");
  Serial.println("╠══════════════════════════════════════════╣");
  Serial.println("║ Mode: 📡 Direct Serial Communication     ║");
  Serial.println("║ Device: " + String(DEVICE_ID) + "      ║");
  Serial.println("║ Location: " + String(DEVICE_LOCATION) + "            ║");
  Serial.println("║ Total Scans: " + String(totalScans) + "                     ║");
  Serial.println("║ Uptime: " + String((millis() - bootTime) / 1000) + "s                        ║");
  Serial.println("║ Status: 🎯 Ready to Scan                ║");
  Serial.println("╚══════════════════════════════════════════╝");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📡 SERIAL COMMUNICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

void sendRFIDData(String rfidCard) {
  // Create JSON payload for serial transmission
  DynamicJsonDocument doc(512);
  
  doc["type"] = "RFID_SCAN";
  doc["rfidCard"] = rfidCard;
  doc["deviceId"] = DEVICE_ID;
  doc["location"] = DEVICE_LOCATION;
  doc["timestamp"] = millis();
  doc["deviceUptime"] = (millis() - bootTime) / 1000;
  doc["totalScans"] = totalScans;
  doc["version"] = DEVICE_VERSION;
  
  // Send as JSON string with special markers
  Serial.println("SMARTTRACK_DATA_START");
  serializeJson(doc, Serial);
  Serial.println();
  Serial.println("SMARTTRACK_DATA_END");
  
  // Also send human-readable format
  Serial.println("\n🎯 RFID SCAN DETECTED:");
  Serial.println("┌─────────────────────────────────────┐");
  Serial.println("│ Card ID: " + rfidCard + "              │");
  Serial.println("│ Device: " + String(DEVICE_ID) + "       │");
  Serial.println("│ Location: " + String(DEVICE_LOCATION) + "           │");
  Serial.println("│ Scan #: " + String(totalScans) + "                       │");
  Serial.println("│ Time: " + String(millis()/1000) + "s since boot             │");
  Serial.println("└─────────────────────────────────────┘");
}

void sendHeartbeat() {
  // Send device status heartbeat
  DynamicJsonDocument doc(512);
  
  doc["type"] = "DEVICE_HEARTBEAT";
  doc["deviceId"] = DEVICE_ID;
  doc["deviceType"] = "RFID_READER";
  doc["location"] = DEVICE_LOCATION;
  doc["version"] = DEVICE_VERSION;
  doc["timestamp"] = millis();
  doc["uptime"] = (millis() - bootTime) / 1000;
  doc["totalScans"] = totalScans;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["status"] = "online";
  
  Serial.println("SMARTTRACK_HEARTBEAT_START");
  serializeJson(doc, Serial);
  Serial.println();
  Serial.println("SMARTTRACK_HEARTBEAT_END");
}

void handleSerialCommands() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "STATUS") {
      displaySystemStatus();
    } else if (command == "STATS") {
      Serial.println("📊 Device Statistics:");
      Serial.println("Total Scans: " + String(totalScans));
      Serial.println("Uptime: " + String((millis() - bootTime) / 1000) + " seconds");
      Serial.println("Free Memory: " + String(ESP.getFreeHeap()) + " bytes");
      Serial.println("Device ID: " + String(DEVICE_ID));
    } else if (command == "RESET") {
      Serial.println("🔄 Resetting scan counter...");
      totalScans = 0;
      bootTime = millis();
      Serial.println("✅ Reset complete");
    } else if (command == "TEST") {
      Serial.println("🧪 Running test scan...");
      sendRFIDData("TEST123456");
      setLEDs("success");
      playSuccessTone();
    } else if (command.startsWith("CONFIG")) {
      Serial.println("⚙️ Device Configuration:");
      Serial.println("Device ID: " + String(DEVICE_ID));
      Serial.println("Location: " + String(DEVICE_LOCATION));
      Serial.println("Version: " + String(DEVICE_VERSION));
    } else if (command != "") {
      Serial.println("❓ Unknown command: " + command);
      Serial.println("💡 Available commands: STATUS, STATS, RESET, TEST, CONFIG");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  bootTime = millis();
  
  Serial.println("\n🚀 SmartTrack RFID Serial System Starting...");
  Serial.println("📍 Device: " + String(DEVICE_ID));
  Serial.println("📍 Location: " + String(DEVICE_LOCATION)); 
  Serial.println("📍 Version: " + String(DEVICE_VERSION));
  Serial.println("📡 Mode: Direct Serial Communication");
  
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
    setLEDs("error");
    playErrorTone();
    while(1) {
      delay(1000);
    }
  } else {
    Serial.println("✅ RFID Reader initialized (Version: 0x" + String(version, HEX) + ")");
    setLEDs("success");
  }
  
  // Display initial status
  delay(1000);
  displaySystemStatus();
  
  Serial.println("🎯 SmartTrack RFID Serial System Ready!");
  Serial.println("📋 Present RFID card to reader...");
  Serial.println("💡 Send commands via Serial: STATUS, STATS, RESET, TEST, CONFIG");
  Serial.println("═════════════════════════════════════════════");
  
  // Send initial heartbeat
  sendHeartbeat();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

void loop() {
  unsigned long currentTime = millis();
  
  // Handle serial commands from PC
  handleSerialCommands();
  
  // Send heartbeat periodically
  if (currentTime - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
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
  
  // Visual feedback during scan
  setLEDs("scanning");
  
  // Send RFID data via Serial
  totalScans++;
  sendRFIDData(rfidCard);
  
  // Success feedback
  setLEDs("success");
  playSuccessTone();
  
  lastScanTime = currentTime;
  
  // Halt PICC and stop encryption
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  
  delay(100); // Small delay to prevent multiple reads
}
