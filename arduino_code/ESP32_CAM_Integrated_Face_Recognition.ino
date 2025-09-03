/*
 * ESP32-CAM Face Recognition System - Integrated Production Version
 * 
 * This version combines:
 * - Face recognition capabilities with Python backend integration
 * - Live camera streaming for web interface
 * - Debug triggers and comprehensive logging
 * - Motion detection with proximity mode
 * - Real-time status updates
 * 
 * Hardware: AI-Thinker ESP32-CAM
 * Backend: Python Flask face recognition service
 * Frontend: React live monitoring interface
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <base64.h>
#include <EEPROM.h>
#include <time.h>

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

// Server endpoints - Production URLs
const char* serverURL = "http://192.168.8.110:5000";
const char* heartbeatEndpoint = "/api/hardware/status-updates";
const char* faceRecognitionEndpoint = "/api/hardware/attendance/face-scan";

// Device configuration
const char* deviceId = "ESP32_CAM_001";
const char* defaultClassId = "0588c3c7-666f-45f6-97c5-f5bc1c9a7ca3";
const char* deviceLocation = "Room A101";
const char* firmwareVersion = "INTEGRATED_v1.0";

// Timing configuration
unsigned long lastHeartbeat = 0;
unsigned long lastMotionCheck = 0;
unsigned long lastCapture = 0;
unsigned long proximityTriggerTime = 0;

const unsigned long heartbeatInterval = 30000;      // 30 seconds
const unsigned long motionCheckInterval = 1000;     // 1 second
const unsigned long captureInterval = 3000;         // 3 seconds between captures
const unsigned long proximityTimeoutInterval = 15000; // 15 seconds

// State variables
bool motionDetected = false;
bool proximityMode = false;
int consecutiveCaptures = 0;
const int maxConsecutiveCaptures = 5;
uint32_t lastFrameChecksum = 0;
unsigned long debugCounter = 0;

// Recognition status
String lastRecognizedStudent = "";
float lastConfidence = 0.0;
String lastRecognitionStatus = "standby";

// Camera configuration
camera_config_t config;
WebServer server(80);

// NTP settings
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;  // GMT+5:30 for Sri Lanka
const int daylightOffset_sec = 0;

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
void handleStatus();
String getCurrentTimestamp();

void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32-CAM Integrated Face Recognition System Starting ===");
  
  // Initialize pins
  pinMode(FLASH_LED, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(CAPTURE_BUTTON, INPUT_PULLUP);
  pinMode(PIR_SENSOR_PIN, INPUT);
  
  // Initial LED state
  digitalWrite(FLASH_LED, LOW);
  digitalWrite(STATUS_LED, LOW);
  
  // Initialize EEPROM
  EEPROM.begin(512);
  
  Serial.println("📷 Initializing camera...");
  if (!initCamera()) {
    Serial.println("❌ Camera initialization failed!");
    blinkStatusLED(10);
    ESP.restart();
  }
  Serial.println("✅ Camera initialized successfully");
  
  Serial.println("📶 Connecting to WiFi...");
  connectToWiFi();
  
  // Setup web server endpoints
  server.on("/", handleRoot);
  server.on("/stream", handleStream);
  server.on("/capture", handleCapture);
  server.on("/debug-trigger", handleDebugTrigger);
  server.on("/status", handleStatus);
  
  // CORS headers
  server.on("/", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "text/plain", "OK");
  });
  
  server.begin();
  
  // Initialize NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  Serial.println("🌐 Web server started");
  Serial.printf("📺 Stream URL: http://%s/stream\n", WiFi.localIP().toString().c_str());
  Serial.printf("🔧 Debug trigger: http://%s/debug-trigger\n", WiFi.localIP().toString().c_str());
  Serial.println("🎮 CONTROLS:");
  Serial.println("   - Press BOOT button for manual face recognition");
  Serial.println("   - Visit /debug-trigger to trigger via web");
  Serial.println("   - Motion detection active");
  Serial.println("===================================================");
  
  sendStatusUpdate("initialized", "System ready for face recognition");
}

void loop() {
  debugCounter++;
  
  // Debug info every 10 seconds
  if (debugCounter % 100 == 0) {
    Serial.printf("💾 Free heap: %d bytes | Status: %s | Proximity: %s\n", 
                  ESP.getFreeHeap(), 
                  lastRecognitionStatus.c_str(),
                  proximityMode ? "ON" : "OFF");
  }
  
  // Manual capture button (BOOT button)
  if (digitalRead(CAPTURE_BUTTON) == LOW) {
    delay(50); // Debounce
    if (digitalRead(CAPTURE_BUTTON) == LOW) {
      Serial.println("🔴 Manual capture triggered via BOOT button");
      captureAndRecognize(true);
      delay(1000); // Prevent multiple captures
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
      sendStatusUpdate("standby", "Proximity timeout");
      lastRecognitionStatus = "standby";
    } else if (millis() - lastCapture > captureInterval && consecutiveCaptures < maxConsecutiveCaptures) {
      // Capture and try face recognition
      captureAndRecognize(false);
      lastCapture = millis();
      consecutiveCaptures++;
    }
  }
  
  // Send heartbeat
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("🔄 WiFi disconnected, reconnecting...");
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
  
  // Frame size and quality settings
  if (psramFound()) {
    config.frame_size = FRAMESIZE_SVGA; // 800x600 for better quality
    config.jpeg_quality = 12;
    config.fb_count = 2;
    Serial.println("✅ PSRAM found, using SVGA frame size");
  } else {
    config.frame_size = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 15;
    config.fb_count = 1;
    Serial.println("⚠️ PSRAM not found, using VGA frame size");
  }
  
  // Initialize camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed with error 0x%x\n", err);
    return false;
  }
  
  // Adjust camera settings for face recognition
  sensor_t * s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_brightness(s, 0);     // -2 to 2
    s->set_contrast(s, 0);       // -2 to 2  
    s->set_saturation(s, 0);     // -2 to 2
    s->set_special_effect(s, 0); // 0 to 6
    s->set_whitebal(s, 1);       // 0 = disable, 1 = enable
    s->set_awb_gain(s, 1);       // 0 = disable, 1 = enable
    s->set_wb_mode(s, 0);        // 0 to 4
    s->set_exposure_ctrl(s, 1);  // 0 = disable, 1 = enable
    s->set_aec2(s, 0);           // 0 = disable, 1 = enable
    s->set_ae_level(s, 0);       // -2 to 2
    s->set_aec_value(s, 300);    // 0 to 1200
    s->set_gain_ctrl(s, 1);      // 0 = disable, 1 = enable
    s->set_agc_gain(s, 0);       // 0 to 30
    s->set_gainceiling(s, (gainceiling_t)0);
    s->set_bpc(s, 0);            // 0 = disable, 1 = enable
    s->set_wpc(s, 1);            // 0 = disable, 1 = enable
    s->set_raw_gma(s, 1);        // 0 = disable, 1 = enable
    s->set_lenc(s, 1);           // 0 = disable, 1 = enable
    s->set_hmirror(s, 0);        // 0 = disable, 1 = enable
    s->set_vflip(s, 0);          // 0 = disable, 1 = enable
    s->set_dcw(s, 1);            // 0 = disable, 1 = enable
    s->set_colorbar(s, 0);       // 0 = disable, 1 = enable
  }
  
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
    Serial.printf("📊 RSSI: %d dBm\n", WiFi.RSSI());
    digitalWrite(STATUS_LED, HIGH);
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed");
    digitalWrite(STATUS_LED, LOW);
  }
}

void captureAndRecognize(bool forceCapture) {
  Serial.println("🚀 === STARTING FACE RECOGNITION ===");
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skipping capture");
    return;
  }
  
  // Update status
  lastRecognitionStatus = "capturing";
  if (forceCapture) {
    sendStatusUpdate("capturing", "Manual capture initiated");
  } else {
    sendStatusUpdate("capturing", "Motion detected - scanning for face");
  }
  
  Serial.printf("💾 Free heap before capture: %d bytes\n", ESP.getFreeHeap());
  
  // Turn on flash LED for better image quality
  digitalWrite(FLASH_LED, HIGH);
  delay(100); // Brief delay for flash
  
  // Capture image
  Serial.println("📷 Capturing image...");
  camera_fb_t * fb = esp_camera_fb_get();
  
  // Turn off flash LED
  digitalWrite(FLASH_LED, LOW);
  
  if (!fb) {
    Serial.println("❌ Camera capture failed");
    sendStatusUpdate("error", "Camera capture failed");
    blinkStatusLED(2);
    lastRecognitionStatus = "error";
    return;
  }
  
  // Check if image size is reasonable
  Serial.printf("📏 Image captured: %d bytes\n", fb->len);
  if (fb->len > 250000) {
    Serial.printf("⚠️ Image too large (%d bytes), but proceeding...\n", fb->len);
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
  Serial.println("✅ === FACE RECOGNITION COMPLETE ===");
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
  
  Serial.println("🚀 SENDING HTTP POST REQUEST...");
  lastRecognitionStatus = "processing";
  sendStatusUpdate("processing", "Processing face recognition...");
  
  int httpResponseCode = http.POST(jsonString);
  Serial.printf("📨 HTTP Response Code: %d\n", httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("📄 Response: %s\n", response.c_str());
    
    if (httpResponseCode == 200) {
      // Parse response
      DynamicJsonDocument responseDoc(1024);
      deserializeJson(responseDoc, response);
      
      if (responseDoc["success"] == true && responseDoc.containsKey("student")) {
        // Face recognized successfully
        lastRecognizedStudent = responseDoc["student"].as<String>();
        lastConfidence = responseDoc["confidence"].as<float>();
        lastRecognitionStatus = "face_recognized";
        
        Serial.printf("✅ Face recognized: %s (%.1f%% confidence)\n", 
                      lastRecognizedStudent.c_str(), lastConfidence * 100);
        
        sendStatusUpdate("face_recognized", 
                        "Face recognized: " + lastRecognizedStudent);
        
        // Exit proximity mode on successful recognition
        proximityMode = false;
        consecutiveCaptures = 0;
        
        // Visual indication of success
        for (int i = 0; i < 5; i++) {
          digitalWrite(STATUS_LED, HIGH);
          delay(100);
          digitalWrite(STATUS_LED, LOW);
          delay(100);
        }
        
      } else {
        // Face not recognized
        lastRecognitionStatus = "face_not_recognized";
        Serial.println("🔍 Face not recognized");
        sendStatusUpdate("face_not_recognized", "Face not in database");
        
        // Continue trying in proximity mode
        blinkStatusLED(2);
      }
    } else {
      // HTTP error
      lastRecognitionStatus = "error";
      Serial.printf("❌ HTTP Error: %d\n", httpResponseCode);
      sendStatusUpdate("error", "Server error: " + String(httpResponseCode));
    }
  } else {
    // Connection error
    lastRecognitionStatus = "error";
    Serial.printf("💥 HTTP Error: %d\n", httpResponseCode);
    Serial.println("🔌 Connection failed - check server availability");
    sendStatusUpdate("error", "Connection failed to server");
  }
  
  http.end();
  Serial.println("🌐 === HTTP REQUEST COMPLETE ===");
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  http.begin(String(serverURL) + heartbeatEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  // Create comprehensive heartbeat payload
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  doc["status"] = "online";
  doc["timestamp"] = getCurrentTimestamp();
  doc["batteryLevel"] = 100;
  doc["signalStrength"] = WiFi.RSSI();
  doc["freeMemory"] = ESP.getFreeHeap();
  doc["firmwareVersion"] = firmwareVersion;
  doc["macAddress"] = WiFi.macAddress();
  doc["localIP"] = WiFi.localIP().toString();
  doc["uptimeHours"] = millis() / 3600000.0;
  doc["lastRecognitionStatus"] = lastRecognitionStatus;
  doc["proximityMode"] = proximityMode;
  doc["motionDetected"] = motionDetected;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("💓 Heartbeat sent (RSSI: %d dBm, Free: %d bytes)\n", 
                WiFi.RSSI(), ESP.getFreeHeap());
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("💓 Heartbeat OK: %d\n", httpResponseCode);
  } else {
    Serial.printf("💔 Heartbeat failed: %d\n", httpResponseCode);
  }
  
  http.end();
}

void sendStatusUpdate(String status, String message) {
  Serial.printf("📊 Status: %s - %s\n", status.c_str(), message.c_str());
  
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  http.begin(String(serverURL) + "/api/hardware/status-update");
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  doc["location"] = deviceLocation;
  doc["status"] = status;
  doc["message"] = message;
  doc["timestamp"] = getCurrentTimestamp();
  doc["lastRecognizedStudent"] = lastRecognizedStudent;
  doc["lastConfidence"] = lastConfidence;
  doc["proximityMode"] = proximityMode;
  doc["motionDetected"] = motionDetected;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  http.end();
  
  // Reset motion flag after reporting
  motionDetected = false;
}

void checkForMotion() {
  // Check PIR sensor first (if connected)
  bool pirDetected = digitalRead(PIR_SENSOR_PIN);
  
  if (pirDetected && !motionDetected) {
    Serial.println("🚶 PIR sensor detected motion!");
    motionDetected = true;
    enterProximityMode();
    return;
  }
  
  // Fallback to image-based motion detection
  if (!proximityMode) {
    // Simple frame difference detection
    camera_fb_t * fb = esp_camera_fb_get();
    if (fb) {
      // Calculate simple checksum for motion detection
      uint32_t checksum = 0;
      for (int i = 0; i < fb->len; i += 100) { // Sample every 100 bytes
        checksum += fb->buf[i];
      }
      
      // Check for significant change
      if (lastFrameChecksum != 0) {
        uint32_t diff = abs((int32_t)(checksum - lastFrameChecksum));
        if (diff > 1000) { // Threshold for motion
          Serial.printf("📹 Image-based motion detected (diff: %d)\n", diff);
          motionDetected = true;
          enterProximityMode();
        }
      }
      
      lastFrameChecksum = checksum;
      esp_camera_fb_return(fb);
    }
  }
}

void enterProximityMode() {
  if (!proximityMode) {
    proximityMode = true;
    proximityTriggerTime = millis();
    consecutiveCaptures = 0;
    lastRecognitionStatus = "motion_detected";
    
    Serial.println("👁️ Entering proximity mode - motion detected!");
    sendStatusUpdate("motion_detected", "Person approaching camera");
    
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
  String html = "<html><head><title>ESP32-CAM Integrated Face Recognition</title>";
  html += "<style>body{font-family:Arial;margin:20px;background:#f5f5f5}";
  html += ".card{background:white;padding:20px;border-radius:8px;margin:10px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}";
  html += ".status{padding:10px;border-radius:4px;margin:10px 0}";
  html += ".online{background:#d4edda;color:#155724}";
  html += ".offline{background:#f8d7da;color:#721c24}";
  html += "button{background:#007bff;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;margin:5px}";
  html += "button:hover{background:#0056b3}</style></head><body>";
  
  html += "<h1>🤖 ESP32-CAM Integrated Face Recognition</h1>";
  
  html += "<div class='card'>";
  html += "<h2>📊 Status</h2>";
  html += "<div class='status " + String(WiFi.status() == WL_CONNECTED ? "online" : "offline") + "'>";
  html += "WiFi: " + String(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
  html += "</div>";
  html += "<p><strong>IP:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>Memory:</strong> " + String(ESP.getFreeHeap()) + " bytes</p>";
  html += "<p><strong>Firmware:</strong> " + String(firmwareVersion) + "</p>";
  html += "<p><strong>Device ID:</strong> " + String(deviceId) + "</p>";
  html += "<p><strong>Status:</strong> " + lastRecognitionStatus + "</p>";
  html += "<p><strong>Proximity Mode:</strong> " + String(proximityMode ? "Active" : "Standby") + "</p>";
  html += "</div>";
  
  html += "<div class='card'>";
  html += "<h2>🎮 Controls</h2>";
  html += "<button onclick=\"location.href='/debug-trigger'\">🔴 Trigger Face Recognition</button>";
  html += "<button onclick=\"location.href='/stream'\">📹 View Camera Stream</button>";
  html += "<button onclick=\"location.href='/capture'\">📷 Capture Photo</button>";
  html += "<button onclick=\"location.href='/status'\">📊 Device Status</button>";
  html += "</div>";
  
  html += "<div class='card'>";
  html += "<h2>🔗 Integration</h2>";
  html += "<p><strong>Server URL:</strong> " + String(serverURL) + "</p>";
  html += "<p><strong>Stream URL:</strong> http://" + WiFi.localIP().toString() + "/stream</p>";
  html += "<p><strong>Debug Trigger:</strong> http://" + WiFi.localIP().toString() + "/debug-trigger</p>";
  html += "</div>";
  
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleStream() {
  // Set CORS headers
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  
  WiFiClient client = server.client();
  
  // Send HTTP response headers for MJPEG stream
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  server.sendContent(response);
  
  Serial.println("📺 Client connected to stream");
  
  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("❌ Camera capture failed during stream");
      break;
    }
    
    // Send frame boundary
    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    
    // Send frame data
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    
    esp_camera_fb_return(fb);
    
    delay(100); // Control frame rate (10 FPS)
  }
  
  Serial.println("📺 Client disconnected from stream");
}

void handleCapture() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "application/json", "{\"error\":\"Camera capture failed\"}");
    return;
  }
  
  String response = "{";
  response += "\"success\":true,";
  response += "\"message\":\"Photo captured successfully\",";
  response += "\"size\":" + String(fb->len) + ",";
  response += "\"timestamp\":\"" + getCurrentTimestamp() + "\"";
  response += "}";
  
  esp_camera_fb_return(fb);
  
  server.send(200, "application/json", response);
  Serial.println("📷 Photo captured via web request");
}

void handleDebugTrigger() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  Serial.println("🔧 DEBUG TRIGGER ACTIVATED VIA WEB");
  
  // Force capture and recognition
  captureAndRecognize(true);
  
  String response = "{";
  response += "\"success\":true,";
  response += "\"message\":\"Face recognition triggered successfully\",";
  response += "\"deviceId\":\"" + String(deviceId) + "\",";
  response += "\"timestamp\":\"" + getCurrentTimestamp() + "\"";
  response += "}";
  
  server.send(200, "application/json", response);
  Serial.println("🔧 Debug trigger response sent");
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  String status = "{";
  status += "\"deviceId\":\"" + String(deviceId) + "\",";
  status += "\"status\":\"";
  status += (WiFi.status() == WL_CONNECTED ? "online" : "offline");
  status += "\",";
  status += "\"lastRecognition\":\"" + lastRecognitionStatus + "\",";
  status += "\"lastStudent\":\"" + lastRecognizedStudent + "\",";
  status += "\"confidence\":" + String(lastConfidence, 2) + ",";
  status += "\"proximityMode\":";
  status += (proximityMode ? "true" : "false");
  status += ",";
  status += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  status += "\"uptime\":" + String(millis()) + ",";
  status += "\"freeMemory\":" + String(ESP.getFreeHeap()) + ",";
  status += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  status += "\"firmwareVersion\":\"" + String(firmwareVersion) + "\"";
  status += "}";
  
  server.send(200, "application/json", status);
}

String getCurrentTimestamp() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return String(millis()); // Fallback to millis if NTP not available
  }
  
  char timeString[50];
  strftime(timeString, sizeof(timeString), "%Y-%m-%dT%H:%M:%S", &timeinfo);
  return String(timeString);
}
