/*
 * RFID Reader for SmartTrack Attendance System
 * Compatible with Arduino Uno/Nano/ESP32 + RC522 RFID Module
 * 
 * Wiring for RC522 RFID Module:
 * RC522     Arduino Uno/Nano    ESP32
 * ----      ----------------    -----
 * SDA       D10                 GPIO5
 * SCK       D13                 GPIO18
 * MOSI      D11                 GPIO23
 * MISO      D12                 GPIO19
 * IRQ       Not connected       Not connected
 * GND       GND                 GND
 * RST       D9                  GPIO4
 * 3.3V      3.3V                3.3V
 */

#include <SPI.h>
#include <MFRC522.h>

// Pin definitions for different boards
#ifdef ESP32
  #define RST_PIN   4
  #define SS_PIN    5
  #define LED_PIN   2    // Built-in LED for ESP32
  #define BUZZER_PIN 25  // Optional buzzer
#else
  #define RST_PIN   9
  #define SS_PIN    10
  #define LED_PIN   13   // Built-in LED for Arduino
  #define BUZZER_PIN 8   // Optional buzzer
#endif

MFRC522 mfrc522(SS_PIN, RST_PIN);

// System state
bool scanningActive = false;
unsigned long lastCardRead = 0;
const unsigned long CARD_READ_DELAY = 2000; // Prevent duplicate reads within 2 seconds

void setup() {
  Serial.begin(9600);
  while (!Serial); // Wait for serial connection
  
  SPI.begin();
  mfrc522.PCD_Init();
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Startup sequence
  digitalWrite(LED_PIN, HIGH);
  tone(BUZZER_PIN, 1000, 200);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("SmartTrack RFID Reader v1.0");
  Serial.println("System ready. Send 'START_SCAN' to begin scanning.");
  
  // Test RFID module
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("ERROR: RFID module not found!");
    while (1) {
      digitalWrite(LED_PIN, HIGH);
      delay(200);
      digitalWrite(LED_PIN, LOW);
      delay(200);
    }
  }
  
  Serial.print("RFID module version: 0x");
  Serial.println(version, HEX);
}

void loop() {
  // Check for serial commands
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    command.toUpperCase();
    
    if (command == "START_SCAN") {
      scanningActive = true;
      digitalWrite(LED_PIN, HIGH);
      Serial.println("STATUS: Scanning started");
    }
    else if (command == "STOP_SCAN") {
      scanningActive = false;
      digitalWrite(LED_PIN, LOW);
      Serial.println("STATUS: Scanning stopped");
    }
    else if (command == "PING") {
      Serial.println("PONG");
    }
    else if (command == "VERSION") {
      Serial.println("SmartTrack RFID Reader v1.0");
    }
  }
  
  // Scan for RFID cards when active
  if (scanningActive) {
    scanForCard();
  }
  
  delay(50); // Small delay to prevent overwhelming the serial
}

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
  
  // Send card data to computer
  Serial.print("RFID:");
  Serial.println(cardID);
  
  // Visual/audio feedback
  cardReadFeedback();
  
  // Halt PICC and stop encryption
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

void cardReadFeedback() {
  // LED feedback
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(100);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
  }
  
  // Buzzer feedback (if connected)
  tone(BUZZER_PIN, 2000, 100);
  delay(150);
  tone(BUZZER_PIN, 2500, 100);
}

// Optional: Function to display card details for debugging
void dumpCardInfo() {
  Serial.print("Card type: ");
  MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);
  Serial.println(mfrc522.PICC_GetTypeName(piccType));
  
  Serial.print("Card UID: ");
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
  }
  Serial.println();
}
