/*
 * ESP32-CAM Face Recognition System - Debug Version
 * Enhanced with comprehensive debugging for face recognition connectivity
 * 
 * This debug version adds extra logging to identify why face recognition
 * requests aren't reaching the server.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <base64.h>

// Camera model - AI Thinker ESP32-CAM
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// Pin definitions for ESP32-CAM
#define FLASH_LED 4       // GPIO4 - Built-in flash LED
#define STATUS_LED 33     // GPIO33 - Status indicator LED (external)
#define CAPTURE_BUTTON 0  // GPIO0 - Manual capture button (BOOT button)
#define PIR_SENSOR_PIN 13 // GPIO13 - PIR Motion Sensor (optional)

// Network configuration
const char* ssid = "Dialog 4G 588";
const char* password = "83EF36AA";
const char* serverURL = "http://192.168.8.110:5000";
const char* heartbeatEndpoint = "/api/hardware/status-updates";
const char* faceRecognitionEndpoint = "/api/hardware/attendance/face-scan";

// Device configuration
const char* deviceId = "ESP32_CAM_001";
const char* defaultClassId = "0588c3c7-666f-45f6-97c5-f5bc1c9a7ca3";
const char* deviceLocation = "Room A101";
const char* firmwareVersion = "DEBUG_v1.0";

// Timing configuration
unsigned long lastHeartbeat = 0;
unsigned long lastMotionCheck = 0;
unsigned long lastCapture = 0;
unsigned long proximityTriggerTime = 0;

const unsigned long heartbeatInterval = 2000; // 2 seconds (faster for debugging)
const unsigned long motionCheckInterval = 3000; // 3 seconds
const unsigned long captureInterval = 4000; // 4 seconds between captures
const unsigned long proximityTimeoutInterval = 30000; // 30 seconds

// State variables
bool motionDetected = false;
bool proximityMode = false;
int consecutiveCaptures = 0;
const int maxConsecutiveCaptures = 5;
uint32_t lastFrameChecksum = 0;
unsigned long debugCounter = 0; // For tracking debug messages

// Recognition status
String lastRecognizedStudent = "";
float lastConfidence = 0.0;
String lastRecognitionStatus = "";

// Camera configuration
camera_config_t config;
WebServer server(80);

// Function declarations
void initCamera();
void connectToWiFi();
void captureAndRecognize(bool forceCapture = false);
void sendImageForRecognition(String imageData);
void sendHeartbeat();
void sendStatusUpdate(String status, String message);
void checkForMotion();
void enterProximityMode();
void blinkStatusLED(int count);
void handleRoot();
void handleStream();
void handleCapture();
void handleDebugTrigger();
String getCurrentTimestamp();

void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32-CAM Face Recognition DEBUG System Starting ===");
  
  // Initialize pins
  pinMode(FLASH_LED, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(CAPTURE_BUTTON, INPUT_PULLUP);
  pinMode(PIR_SENSOR_PIN, INPUT);
  
  // Initial LED state
  digitalWrite(FLASH_LED, LOW);
  digitalWrite(STATUS_LED, LOW);
  
  Serial.println("📷 Initializing camera...");
  if (!initCamera()) {
    Serial.println("❌ Camera initialization failed!");
    while (1) {
      blinkStatusLED(1);
      delay(1000);
    }
  }
  Serial.println("✅ Camera initialized successfully");
  
  Serial.println("📶 Connecting to WiFi...");
  connectToWiFi();
  
  // Setup web server endpoints
  server.on("/", handleRoot);
  server.on("/stream", handleStream);
  server.on("/capture", handleCapture);
  server.on("/debug-trigger", handleDebugTrigger); // New debug endpoint
  server.begin();
  
  Serial.println("🌐 Web server started");
  Serial.println("🔧 DEBUG COMMANDS:");
  Serial.println("   - Press BOOT button for manual face recognition");
  Serial.println("   - Visit /debug-trigger to trigger face recognition via web");
  Serial.println("   - Motion detection active (PIR sensor or image-based)");
  Serial.println("===================================================");
  
  sendStatusUpdate("initialized", "DEBUG: System ready for face recognition testing");
}

void loop() {
  debugCounter++;
  
  // Debug heartbeat every 10 seconds
  if (debugCounter % 100 == 0) {
    Serial.printf("🔄 Debug Loop #%lu - Free heap: %d bytes\n", debugCounter, ESP.getFreeHeap());
  }
  
  // Manual capture button (BOOT button)
  if (digitalRead(CAPTURE_BUTTON) == LOW) {
    delay(50); // Debounce
    if (digitalRead(CAPTURE_BUTTON) == LOW) {
      Serial.println("🔴 MANUAL CAPTURE TRIGGERED - Button pressed!");
      captureAndRecognize(true); // Force capture
      delay(2000); // Prevent multiple captures
    }
  }
  
  // Motion detection check
  if (millis() - lastMotionCheck > motionCheckInterval) {
    checkForMotion();
    lastMotionCheck = millis();
  }
  
  // Proximity-based face recognition
  if (proximityMode) {
    if (millis() - proximityTriggerTime > proximityTimeoutInterval) {
      // Timeout - exit proximity mode
      proximityMode = false;
      consecutiveCaptures = 0;
      Serial.println("⏰ Proximity mode timeout - returning to standby");
      sendStatusUpdate("standby", "DEBUG: Proximity timeout");
    } else if (millis() - lastCapture > captureInterval && consecutiveCaptures < maxConsecutiveCaptures) {
      // Capture and try face recognition
      Serial.printf("📸 Auto-capture #%d in proximity mode\n", consecutiveCaptures + 1);
      captureAndRecognize(false);
      lastCapture = millis();
      consecutiveCaptures++;
    }
  }
  
  // Send heartbeat every 2 seconds (faster for debugging)
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📶 WiFi disconnected, reconnecting...");
    connectToWiFi();
  }
  
  // Handle incoming web requests
  server.handleClient();
  
  delay(100);
}

bool initCamera() {
  // Camera configuration for ESP32-CAM AI-Thinker module
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Reduce image quality for faster processing and smaller memory usage
  config.frame_size = FRAMESIZE_VGA; // 640x480
  config.jpeg_quality = 12;
  config.fb_count = 1;
  
  // Camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return false;
  }
  
  // Set additional camera settings
  sensor_t * s = esp_camera_sensor_get();
  s->set_brightness(s, 0);     // -2 to 2
  s->set_contrast(s, 0);       // -2 to 2
  s->set_saturation(s, 0);     // -2 to 2
  s->set_special_effect(s, 0); // 0 to 6 (0-No Effect, 1-Negative, 2-Grayscale, 3-Red Tint, 4-Green Tint, 5-Blue Tint, 6-Sepia)
  s->set_whitebal(s, 1);       // 0 = disable , 1 = enable
  s->set_awb_gain(s, 1);       // 0 = disable , 1 = enable
  s->set_wb_mode(s, 0);        // 0 to 4 - if awb_gain enabled (0 - Auto, 1 - Sunny, 2 - Cloudy, 3 - Office, 4 - Home)
  s->set_exposure_ctrl(s, 1);  // 0 = disable , 1 = enable
  s->set_aec2(s, 0);           // 0 = disable , 1 = enable
  s->set_ae_level(s, 0);       // -2 to 2
  s->set_aec_value(s, 300);    // 0 to 1200
  s->set_gain_ctrl(s, 1);      // 0 = disable , 1 = enable
  s->set_agc_gain(s, 0);       // 0 to 30
  s->set_gainceiling(s, (gainceiling_t)0);  // 0 to 6
  s->set_bpc(s, 0);            // 0 = disable , 1 = enable
  s->set_wpc(s, 1);            // 0 = disable , 1 = enable
  s->set_raw_gma(s, 1);        // 0 = disable , 1 = enable
  s->set_lenc(s, 1);           // 0 = disable , 1 = enable
  s->set_hmirror(s, 0);        // 0 = disable , 1 = enable
  s->set_vflip(s, 0);          // 0 = disable , 1 = enable
  s->set_dcw(s, 1);            // 0 = disable , 1 = enable
  s->set_colorbar(s, 0);       // 0 = disable , 1 = enable
  
  return true;
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    // Blink LED during connection
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi connected successfully");
    Serial.print("📍 IP address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(STATUS_LED, HIGH);
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed");
    digitalWrite(STATUS_LED, LOW);
  }
}

void captureAndRecognize(bool forceCapture) {
  Serial.println("🚀 === STARTING FACE RECOGNITION CAPTURE ===");
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skipping capture");
    return;
  }
  
  // Send status update when starting capture
  if (forceCapture) {
    Serial.println("🔴 MANUAL CAPTURE: User-triggered face recognition");
    sendStatusUpdate("capturing", "DEBUG: Manual capture initiated");
  } else {
    Serial.println("🟡 AUTO CAPTURE: Motion-triggered face recognition");
    sendStatusUpdate("capturing", "DEBUG: Motion detected - scanning for face");
  }
  
  Serial.printf("💾 Free heap before capture: %d bytes\n", ESP.getFreeHeap());
  
  // Turn on flash LED for better image quality
  digitalWrite(FLASH_LED, HIGH);
  Serial.println("💡 Flash LED ON");
  delay(100); // Brief delay for flash
  
  // Capture image
  Serial.println("📷 Capturing image...");
  camera_fb_t * fb = esp_camera_fb_get();
  
  // Turn off flash LED
  digitalWrite(FLASH_LED, LOW);
  Serial.println("💡 Flash LED OFF");
  
  if (!fb) {
    Serial.println("❌ Camera capture failed");
    sendStatusUpdate("error", "DEBUG: Camera capture failed");
    blinkStatusLED(2);
    return;
  }
  
  // Check if image size is reasonable
  Serial.printf("📏 Image captured: %d bytes\n", fb->len);
  if (fb->len > 250000) { // If image is larger than 250KB
    Serial.printf("⚠️ Image too large (%d bytes), skipping\n", fb->len);
    esp_camera_fb_return(fb);
    return;
  }
  
  // Convert to base64
  Serial.println("🔄 Converting image to base64...");
  String imageBase64 = base64::encode(fb->buf, fb->len);
  
  // Check memory after encoding
  Serial.printf("💾 Free heap after encoding: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("📊 Base64 string length: %d characters\n", imageBase64.length());
  
  String imageData = "data:image/jpeg;base64," + imageBase64;
  
  // Release camera buffer immediately after encoding
  esp_camera_fb_return(fb);
  Serial.println("🗑️ Camera buffer released");
  
  // Send to face recognition service
  Serial.println("🌐 === SENDING TO FACE RECOGNITION SERVICE ===");
  sendImageForRecognition(imageData);
  
  // Clear the base64 string to free memory
  imageBase64 = "";
  imageData = "";
  Serial.println("🧹 Memory cleaned up");
  Serial.println("✅ === FACE RECOGNITION CAPTURE COMPLETE ===");
}

void sendImageForRecognition(String imageData) {
  Serial.println("🌐 === FACE RECOGNITION HTTP REQUEST ===");
  
  HTTPClient http;
  String fullURL = String(serverURL) + faceRecognitionEndpoint;
  Serial.printf("🎯 Target URL: %s\n", fullURL.c_str());
  
  http.begin(fullURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000); // 15 second timeout
  Serial.println("📋 Headers set: Content-Type: application/json");
  Serial.println("⏰ Timeout set: 15 seconds");
  
  // Create JSON payload matching our server API
  Serial.println("📝 Creating JSON payload...");
  DynamicJsonDocument doc(imageData.length() + 500);
  doc["deviceId"] = deviceId;
  doc["classId"] = defaultClassId;
  doc["imageData"] = imageData;
  doc["timestamp"] = getCurrentTimestamp();
  doc["location"] = deviceLocation;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("📊 Payload size: %d bytes\n", jsonString.length());
  Serial.printf("🏷️ Device ID: %s\n", deviceId);
  Serial.printf("🎓 Class ID: %s\n", defaultClassId);
  Serial.printf("📍 Location: %s\n", deviceLocation);
  
  Serial.println("🚀 SENDING HTTP POST REQUEST...");
  int httpResponseCode = http.POST(jsonString);
  Serial.printf("📨 HTTP Response Code: %d\n", httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("✅ HTTP Request successful (Code: %d)\n", httpResponseCode);
    Serial.printf("📄 Response: %s\n", response.c_str());
    
    if (httpResponseCode == 200) {
      // Face recognized successfully
      Serial.println("🎉 Face recognized - Attendance marked");
      
      // Parse response to get student info
      DynamicJsonDocument responseDoc(1024);
      deserializeJson(responseDoc, response);
      
      if (responseDoc.containsKey("student")) {
        lastRecognizedStudent = responseDoc["student"].as<String>();
        lastConfidence = responseDoc["confidence"];
        lastRecognitionStatus = "recognized";
        
        Serial.printf("👤 Student: %s, Confidence: %.2f\n", lastRecognizedStudent.c_str(), lastConfidence);
        
        // Send recognition success status
        sendStatusUpdate("face_recognized", "DEBUG: Attendance marked for " + lastRecognizedStudent);
        
        // Success LED pattern
        Serial.println("💚 SUCCESS LED PATTERN");
        for (int i = 0; i < 5; i++) {
          digitalWrite(STATUS_LED, HIGH);
          delay(100);
          digitalWrite(STATUS_LED, LOW);
          delay(100);
        }
        
        // Exit proximity mode on successful recognition
        proximityMode = false;
        consecutiveCaptures = 0;
      }
    } else if (httpResponseCode == 404) {
      Serial.println("🔍 Face not recognized - Unknown person");
      lastRecognitionStatus = "not_recognized";
      lastRecognizedStudent = "";
      lastConfidence = 0.0;
      
      sendStatusUpdate("face_not_recognized", "DEBUG: Unknown person detected");
      blinkStatusLED(2); // Error indication
    } else {
      Serial.printf("⚠️ Unexpected response code: %d\n", httpResponseCode);
      lastRecognitionStatus = "failed";
      sendStatusUpdate("recognition_failed", "DEBUG: Face recognition system error");
      blinkStatusLED(2); // Error indication
    }
  } else {
    Serial.printf("❌ HTTP ERROR: %d\n", httpResponseCode);
    Serial.printf("🔍 Error details: %s\n", http.errorToString(httpResponseCode).c_str());
    Serial.println("🌐 Connection failed - check server availability");
    
    // Detailed error analysis
    if (httpResponseCode == -1) {
      Serial.println("💡 HTTP_ERROR_CONNECTION_REFUSED - Server not responding");
    } else if (httpResponseCode == -2) {
      Serial.println("💡 HTTP_ERROR_SEND_HEADER_FAILED - Failed to send headers");
    } else if (httpResponseCode == -3) {
      Serial.println("💡 HTTP_ERROR_SEND_PAYLOAD_FAILED - Failed to send payload");
    } else if (httpResponseCode == -4) {
      Serial.println("💡 HTTP_ERROR_NOT_CONNECTED - Not connected to server");
    } else if (httpResponseCode == -5) {
      Serial.println("💡 HTTP_ERROR_CONNECTION_LOST - Connection lost during request");
    } else if (httpResponseCode == -6) {
      Serial.println("💡 HTTP_ERROR_NO_STREAM - No stream available");
    } else if (httpResponseCode == -7) {
      Serial.println("💡 HTTP_ERROR_NO_HTTP_SERVER - No HTTP server");
    } else if (httpResponseCode == -8) {
      Serial.println("💡 HTTP_ERROR_TOO_LESS_RAM - Insufficient RAM");
    } else if (httpResponseCode == -9) {
      Serial.println("💡 HTTP_ERROR_ENCODING - Encoding error");
    } else if (httpResponseCode == -10) {
      Serial.println("💡 HTTP_ERROR_STREAM_WRITE - Stream write error");
    } else if (httpResponseCode == -11) {
      Serial.println("💡 HTTP_ERROR_READ_TIMEOUT - Read timeout");
    }
    
    blinkStatusLED(3); // Network error indication
  }
  
  http.end();
  Serial.println("🌐 === HTTP REQUEST COMPLETE ===");
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📶 WiFi not connected, skipping heartbeat");
    return;
  }
  
  HTTPClient http;
  http.begin(String(serverURL) + heartbeatEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout
  
  // Create comprehensive heartbeat payload
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  doc["status"] = "online";
  doc["timestamp"] = getCurrentTimestamp();
  doc["batteryLevel"] = 100; // Not applicable for ESP32-CAM (always powered)
  doc["signalStrength"] = WiFi.RSSI();
  doc["freeMemory"] = ESP.getFreeHeap();
  doc["firmwareVersion"] = firmwareVersion;
  doc["macAddress"] = WiFi.macAddress();
  doc["localIP"] = WiFi.localIP().toString(); // Add local IP address
  doc["uptimeHours"] = millis() / 3600000.0; // Convert milliseconds to hours
  doc["totalScans"] = 0; // Will be implemented with scan counter
  doc["successfulScans"] = 0; // Will be implemented with success counter
  doc["debugMode"] = true; // Flag to indicate debug version
  
  // Add device-specific information
  doc["deviceInfo"]["chipModel"] = ESP.getChipModel();
  doc["deviceInfo"]["chipRevision"] = ESP.getChipRevision();
  doc["deviceInfo"]["flashSize"] = ESP.getFlashChipSize();
  doc["deviceInfo"]["sdkVersion"] = ESP.getSdkVersion();
  doc["deviceInfo"]["psramSize"] = ESP.getPsramSize();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("💓 Sending heartbeat... (Free heap: %d, RSSI: %d dBm)\n", 
                ESP.getFreeHeap(), WiFi.RSSI());
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("✅ Heartbeat sent successfully (HTTP %d)\n", httpResponseCode);
    
    // Parse response for server instructions
    DynamicJsonDocument responseDoc(512);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"] == false && responseDoc["action"] == "register_device") {
      Serial.println("⚠️ Server says device not registered. Please register device first!");
    }
  } else {
    Serial.printf("❌ Heartbeat failed (HTTP %d): %s\n", 
                  httpResponseCode, http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
}

void sendStatusUpdate(String status, String message) {
  Serial.printf("📊 Status Update: %s - %s\n", status.c_str(), message.c_str());
}

// Motion detection using image comparison
void checkForMotion() {
  // Check PIR sensor first (if connected)
  bool pirDetected = digitalRead(PIR_SENSOR_PIN);
  
  if (pirDetected && !motionDetected) {
    Serial.println("🚶 PIR Motion detected!");
    motionDetected = true;
    enterProximityMode();
    return;
  }
  
  // Fallback to basic image-based motion detection
  if (!proximityMode) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (fb) {
      // Simple checksum-based motion detection
      uint32_t currentChecksum = 0;
      for (int i = 0; i < fb->len; i += 100) { // Sample every 100th byte
        currentChecksum += fb->buf[i];
      }
      
      if (lastFrameChecksum != 0) {
        uint32_t diff = abs((int32_t)(currentChecksum - lastFrameChecksum));
        if (diff > 1000) { // Threshold for motion detection
          Serial.printf("📹 Image motion detected! Checksum diff: %d\n", diff);
          motionDetected = true;
          enterProximityMode();
        }
      }
      
      lastFrameChecksum = currentChecksum;
      esp_camera_fb_return(fb);
    }
  }
}

// Enter proximity mode when motion is detected
void enterProximityMode() {
  if (!proximityMode) {
    proximityMode = true;
    proximityTriggerTime = millis();
    consecutiveCaptures = 0;
    Serial.println("🎯 Entering proximity mode - motion detected!");
    sendStatusUpdate("motion_detected", "DEBUG: Person approaching camera");
    
    // Visual indication
    for (int i = 0; i < 3; i++) {
      digitalWrite(STATUS_LED, HIGH);
      delay(100);
      digitalWrite(STATUS_LED, LOW);
      delay(100);
    }
  }
}

void blinkStatusLED(int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(200);
    digitalWrite(STATUS_LED, LOW);
    delay(200);
  }
}

void handleRoot() {
  String html = "<html><head><title>ESP32-CAM DEBUG Face Recognition</title></head><body>";
  html += "<h1>🔧 ESP32-CAM Face Recognition DEBUG</h1>";
  html += "<h2>Status: " + String(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected") + "</h2>";
  html += "<p>IP: " + WiFi.localIP().toString() + "</p>";
  html += "<p>Free Memory: " + String(ESP.getFreeHeap()) + " bytes</p>";
  html += "<p>Firmware: " + String(firmwareVersion) + "</p>";
  html += "<h3>🎮 Debug Controls:</h3>";
  html += "<p><a href='/debug-trigger' style='background:red;color:white;padding:10px;text-decoration:none;'>🔴 TRIGGER FACE RECOGNITION</a></p>";
  html += "<p><a href='/stream' style='background:blue;color:white;padding:10px;text-decoration:none;'>📹 VIEW CAMERA STREAM</a></p>";
  html += "<p><a href='/capture' style='background:green;color:white;padding:10px;text-decoration:none;'>📷 CAPTURE SNAPSHOT</a></p>";
  html += "<h3>📊 Last Recognition:</h3>";
  html += "<p>Status: " + lastRecognitionStatus + "</p>";
  html += "<p>Student: " + lastRecognizedStudent + "</p>";
  html += "<p>Confidence: " + String(lastConfidence) + "</p>";
  html += "<h3>🔧 Instructions:</h3>";
  html += "<ul>";
  html += "<li>Press the BOOT button on ESP32-CAM to trigger face recognition</li>";
  html += "<li>Click 'TRIGGER FACE RECOGNITION' above to test via web</li>";
  html += "<li>Wave in front of camera to trigger motion detection</li>";
  html += "<li>Monitor serial output for detailed debug information</li>";
  html += "</ul>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleStream() {
  WiFiClient client = server.client();
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  server.sendContent(response);
  
  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      break;
    }
    
    String head = "--frame\r\n";
    head += "Content-Type: image/jpeg\r\n";
    head += "Content-Length: " + String(fb->len) + "\r\n\r\n";
    
    server.sendContent(head);
    client.write(fb->buf, fb->len);
    server.sendContent("\r\n");
    
    esp_camera_fb_return(fb);
    delay(50);
  }
}

void handleCapture() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "Camera capture failed");
    return;
  }
  
  server.sendHeader("Content-Disposition", "attachment; filename=capture.jpg");
  server.send_P(200, "image/jpeg", (char*)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void handleDebugTrigger() {
  Serial.println("🌐 WEB DEBUG TRIGGER ACTIVATED!");
  captureAndRecognize(true);
  
  String html = "<html><head><title>Debug Trigger</title></head><body>";
  html += "<h1>🔴 Face Recognition Triggered!</h1>";
  html += "<p>Check the serial monitor for detailed debug information.</p>";
  html += "<p><a href='/'>← Back to Main</a></p>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

String getCurrentTimestamp() {
  return String(millis());
}
