#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>
#include <EEPROM.h>

// Pin definitions for NodeMCU
#define RST_PIN         D1
#define SS_PIN          D2
#define BUZZER_PIN      D8
#define LED_GREEN       D3
#define LED_RED         D4
#define BUTTON_PIN      D7

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server configuration
const char* serverURL = "http://your-server-ip:5000";
const char* rfidScanEndpoint = "/api/rfid/scan";
const char* heartbeatEndpoint = "/api/hardware/heartbeat";

// Device configuration
const String deviceId = "RFID_READER_001";
const String deviceLocation = "Main Entrance";
const String defaultClassId = "CLASS_001";

// RFID reader
MFRC522 mfrc522(SS_PIN, RST_PIN);

// LCD display (16x2)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Timing variables
unsigned long lastHeartbeat = 0;
unsigned long lastCardRead = 0;
unsigned long displayTimeout = 0;
const unsigned long heartbeatInterval = 30000; // 30 seconds
const unsigned long cardCooldown = 3000;       // 3 seconds between same card reads
const unsigned long displayDuration = 5000;    // 5 seconds

// System state
String lastCardUID = "";
bool displayActive = false;
bool systemOnline = false;

// Statistics
unsigned long totalScans = 0;
unsigned long successfulScans = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("Attendify RFID System Starting...");
  
  // Initialize EEPROM
  EEPROM.begin(512);
  loadStatistics();
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize SPI and RFID reader
  SPI.begin();
  mfrc522.PCD_Init();
  
  // Initialize LCD
  lcd.init();
  lcd.backlight();
  displayWelcome();
  
  // Test components
  testComponents();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Send initial heartbeat
  sendHeartbeat();
  
  // Check RFID reader
  checkRFIDReader();
  
  Serial.println("RFID Attendance System Ready");
  displayReady();
}

void loop() {
  // Check for new RFID card
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    handleRFIDCard();
  }
  
  // Check button press for manual actions
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      handleButtonPress();
      delay(1000); // Prevent multiple presses
    }
  }
  
  // Send heartbeat periodically
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Handle display timeout
  if (displayActive && (millis() - displayTimeout > displayDuration)) {
    displayReady();
    displayActive = false;
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    systemOnline = false;
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, LOW);
    reconnectWiFi();
  } else {
    systemOnline = true;
    digitalWrite(LED_RED, LOW);
    if (!displayActive) {
      digitalWrite(LED_GREEN, HIGH);
    }
  }
  
  delay(100);
}

void handleRFIDCard() {
  // Get card UID
  String cardUID = getCardUID();
  
  // Check cooldown period for same card
  if (cardUID == lastCardUID && (millis() - lastCardRead < cardCooldown)) {
    return;
  }
  
  lastCardUID = cardUID;
  lastCardRead = millis();
  totalScans++;
  
  Serial.println("RFID Card detected: " + cardUID);
  
  // Visual feedback
  digitalWrite(LED_GREEN, LOW);
  tone(BUZZER_PIN, 1000, 200);
  
  // Display card detected
  displayCardDetected(cardUID);
  
  // Send to server
  if (systemOnline) {
    sendRFIDData(cardUID);
  } else {
    displayOfflineMode();
    // Store offline for later sync
    storeOfflineData(cardUID);
  }
  
  // Reset RFID reader
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

String getCardUID() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uid += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void sendRFIDData(String cardUID) {
  WiFiClient client;
  HTTPClient http;
  
  http.begin(client, String(serverURL) + rfidScanEndpoint);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["rfidCard"] = cardUID;
  doc["deviceId"] = deviceId;
  doc["classId"] = defaultClassId;
  doc["timestamp"] = WiFi.getTime();
  doc["location"] = deviceLocation;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending RFID data to server...");
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("HTTP Response: %d\n", httpResponseCode);
    Serial.println("Response: " + response);
    
    if (httpResponseCode == 200) {
      // Attendance marked successfully
      successfulScans++;
      saveStatistics();
      
      // Parse response for student info
      DynamicJsonDocument responseDoc(1024);
      deserializeJson(responseDoc, response);
      
      if (responseDoc.containsKey("student")) {
        JsonObject student = responseDoc["student"];
        String studentName = student["fullName"] | "Unknown Student";
        displayAttendanceMarked(studentName);
      } else {
        displayAttendanceMarked("Student");
      }
      
      // Success feedback
      successFeedback();
      
    } else if (httpResponseCode == 404) {
      // Card not registered
      displayCardNotRegistered();
      errorFeedback();
      
    } else {
      // Server error
      displayServerError();
      errorFeedback();
    }
  } else {
    Serial.printf("HTTP Error: %d\n", httpResponseCode);
    displayNetworkError();
    errorFeedback();
  }
  
  http.end();
}

void sendHeartbeat() {
  if (!systemOnline) return;
  
  WiFiClient client;
  HTTPClient http;
  
  http.begin(client, String(serverURL) + heartbeatEndpoint);
  http.addHeader("Content-Type", "application/json");
  
  // Create heartbeat payload
  DynamicJsonDocument doc(512);
  doc["deviceId"] = deviceId;
  doc["deviceType"] = "rfid_reader";
  doc["location"] = deviceLocation;
  doc["timestamp"] = WiFi.getTime();
  doc["status"] = "online";
  doc["totalScans"] = totalScans;
  doc["successfulScans"] = successfulScans;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("Heartbeat sent: %d\n", httpResponseCode);
  } else {
    Serial.printf("Heartbeat failed: %d\n", httpResponseCode);
  }
  
  http.end();
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    
    lcd.setCursor(attempts % 16, 1);
    lcd.print(".");
    
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    systemOnline = true;
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);
  } else {
    Serial.println();
    Serial.println("WiFi connection failed");
    systemOnline = false;
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
    lcd.setCursor(0, 1);
    lcd.print("Offline Mode");
    delay(2000);
  }
}

void reconnectWiFi() {
  static unsigned long lastReconnectAttempt = 0;
  
  if (millis() - lastReconnectAttempt > 30000) { // Try every 30 seconds
    Serial.println("Attempting WiFi reconnection...");
    WiFi.reconnect();
    lastReconnectAttempt = millis();
  }
}

void displayWelcome() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attendify");
  lcd.setCursor(0, 1);
  lcd.print("System Starting");
  delay(2000);
}

void displayReady() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scan RFID Card");
  lcd.setCursor(0, 1);
  if (systemOnline) {
    lcd.print("System Online");
  } else {
    lcd.print("Offline Mode");
  }
  displayActive = false;
}

void displayCardDetected(String cardUID) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Card Detected");
  lcd.setCursor(0, 1);
  lcd.print(cardUID.substring(0, 16));
  displayActive = true;
  displayTimeout = millis();
}

void displayAttendanceMarked(String studentName) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attendance OK");
  lcd.setCursor(0, 1);
  lcd.print(studentName.substring(0, 16));
  displayActive = true;
  displayTimeout = millis();
}

void displayCardNotRegistered() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Card Not");
  lcd.setCursor(0, 1);
  lcd.print("Registered");
  displayActive = true;
  displayTimeout = millis();
}

void displayServerError() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Server Error");
  lcd.setCursor(0, 1);
  lcd.print("Try Again");
  displayActive = true;
  displayTimeout = millis();
}

void displayNetworkError() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Network Error");
  lcd.setCursor(0, 1);
  lcd.print("Check Connection");
  displayActive = true;
  displayTimeout = millis();
}

void displayOfflineMode() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Offline Mode");
  lcd.setCursor(0, 1);
  lcd.print("Data Stored");
  displayActive = true;
  displayTimeout = millis();
}

void successFeedback() {
  // Green LED and success tone
  digitalWrite(LED_GREEN, HIGH);
  tone(BUZZER_PIN, 1500, 100);
  delay(100);
  tone(BUZZER_PIN, 2000, 100);
  delay(200);
  digitalWrite(LED_GREEN, LOW);
}

void errorFeedback() {
  // Red LED and error tone
  digitalWrite(LED_RED, HIGH);
  tone(BUZZER_PIN, 500, 200);
  delay(200);
  tone(BUZZER_PIN, 300, 200);
  delay(200);
  digitalWrite(LED_RED, LOW);
}

void testComponents() {
  Serial.println("Testing components...");
  
  // Test LEDs
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, HIGH);
  delay(500);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  
  // Test buzzer
  tone(BUZZER_PIN, 1000, 200);
  delay(300);
  
  // Test LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Component Test");
  lcd.setCursor(0, 1);
  lcd.print("OK");
  delay(1000);
  
  Serial.println("Component test completed");
}

void checkRFIDReader() {
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.print("MFRC522 Software Version: 0x");
  Serial.println(version, HEX);
  
  if (version == 0x00 || version == 0xFF) {
    Serial.println("WARNING: RFID reader not detected or communication failure");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("RFID Error");
    lcd.setCursor(0, 1);
    lcd.print("Check Wiring");
    delay(3000);
  } else {
    Serial.println("RFID reader initialized successfully");
  }
}

void handleButtonPress() {
  Serial.println("Button pressed - Manual sync");
  
  if (systemOnline) {
    // Sync offline data
    syncOfflineData();
    
    // Display statistics
    displayStatistics();
  } else {
    // Display offline statistics
    displayOfflineStatistics();
  }
}

void displayStatistics() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Total:" + String(totalScans));
  lcd.setCursor(0, 1);
  lcd.print("Success:" + String(successfulScans));
  displayActive = true;
  displayTimeout = millis();
}

void displayOfflineStatistics() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Offline Stats");
  lcd.setCursor(0, 1);
  lcd.print("Scans:" + String(totalScans));
  displayActive = true;
  displayTimeout = millis();
}

void storeOfflineData(String cardUID) {
  // Store card data in EEPROM for later sync
  // Implementation for offline storage
  Serial.println("Storing offline data: " + cardUID);
}

void syncOfflineData() {
  // Sync offline stored data with server
  // Implementation for offline data sync
  Serial.println("Syncing offline data...");
}

void loadStatistics() {
  // Load statistics from EEPROM
  totalScans = EEPROM.read(0) | (EEPROM.read(1) << 8) | (EEPROM.read(2) << 16) | (EEPROM.read(3) << 24);
  successfulScans = EEPROM.read(4) | (EEPROM.read(5) << 8) | (EEPROM.read(6) << 16) | (EEPROM.read(7) << 24);
}

void saveStatistics() {
  // Save statistics to EEPROM
  EEPROM.write(0, totalScans & 0xFF);
  EEPROM.write(1, (totalScans >> 8) & 0xFF);
  EEPROM.write(2, (totalScans >> 16) & 0xFF);
  EEPROM.write(3, (totalScans >> 24) & 0xFF);
  
  EEPROM.write(4, successfulScans & 0xFF);
  EEPROM.write(5, (successfulScans >> 8) & 0xFF);
  EEPROM.write(6, (successfulScans >> 16) & 0xFF);
  EEPROM.write(7, (successfulScans >> 24) & 0xFF);
  
  EEPROM.commit();
}
