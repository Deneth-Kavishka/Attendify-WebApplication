#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <base64.h>
#include <EEPROM.h>
#include <time.h>

// WiFi credentials
const char* ssid = "Dialog 4G 303";
const char* password = "Ba5315e7";

// NTP settings
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;  // GMT+5:30 for Sri Lanka
const int daylightOffset_sec = 0;

// Server endpoints
const char* serverURL = "http://192.168.8.110:5000";
const char* faceRecognitionEndpoint = "/api/hardware/attendance/face-scan";
const char* heartbeatEndpoint = "/api/hardware/heartbeat";

// Device configuration
const String deviceId = "ESP32_CAM_001";
const String deviceLocation = "Room A101";
const String defaultClassId = "CLASS_001"; // Can be configured via web interface

// Camera configuration
camera_config_t config;

// Timing variables
unsigned long lastHeartbeat = 0;
unsigned long lastCapture = 0;
const unsigned long heartbeatInterval = 30000; // 30 seconds
const unsigned long captureInterval = 10000;   // Increased to 10 seconds to reduce load

// Pin definitions for ESP32-CAM AI-Thinker module
#define STATUS_LED 33     // GPIO33 - Status LED
#define FLASH_LED 4       // GPIO4 - Flash LED (built-in)
#define CAPTURE_BUTTON 0  // GPIO0 - Manual capture button (BOOT button)

// Camera pin definitions for ESP32-CAM AI-Thinker
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);
  Serial.println("Attendify ESP32-CAM Starting...");
  
  // Print initial memory info
  Serial.printf("Total heap: %d bytes\n", ESP.getHeapSize());
  Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("PSRAM found: %s\n", psramFound() ? "Yes" : "No");
  
  // Initialize EEPROM
  EEPROM.begin(512);
  
  // Initialize pins
  pinMode(STATUS_LED, OUTPUT);
  pinMode(FLASH_LED, OUTPUT);
  pinMode(CAPTURE_BUTTON, INPUT_PULLUP);
  
  // Blink status LED during startup
  blinkStatusLED(3);
  
  // Initialize camera
  if (initCamera()) {
    Serial.println("Camera initialized successfully");
    digitalWrite(STATUS_LED, HIGH);
  } else {
    Serial.println("Camera initialization failed");
    blinkStatusLED(10); // Error indication
    ESP.restart();
  }
  
  // Connect to WiFi
  connectToWiFi();
  
  // Initialize NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("NTP time configured");
  
  // Send initial heartbeat
  sendHeartbeat();
  
  Serial.println("ESP32-CAM Face Recognition System Ready");
  Serial.println("Press BOOT button to capture image manually");
  Serial.printf("Capture interval: %d seconds\n", captureInterval/1000);
}

void loop() {
  // Check for manual capture button
  if (digitalRead(CAPTURE_BUTTON) == LOW) {
    delay(50); // Debounce
    if (digitalRead(CAPTURE_BUTTON) == LOW) {
      Serial.println("Manual capture triggered");
      captureAndRecognize();
      delay(1000); // Prevent multiple captures
    }
  }
  
  // Automatic capture every 5 seconds
  if (millis() - lastCapture > captureInterval) {
    captureAndRecognize();
    lastCapture = millis();
  }
  
  // Send heartbeat every 30 seconds
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }
  
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
    config.frame_size = FRAMESIZE_SVGA; // Reduced from UXGA to prevent DMA overflow
    config.jpeg_quality = 12;           // Increased quality number (lower quality) to reduce size
    config.fb_count = 2;
    Serial.println("PSRAM found, using SVGA frame size");
  } else {
    config.frame_size = FRAMESIZE_VGA;  // Even smaller for no PSRAM
    config.jpeg_quality = 15;
    config.fb_count = 1;
    Serial.println("PSRAM not found, using VGA frame size");
  }
  
  // Initialize camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
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
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  
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
    Serial.println("WiFi connected successfully");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(STATUS_LED, HIGH);
  } else {
    Serial.println();
    Serial.println("WiFi connection failed");
    digitalWrite(STATUS_LED, LOW);
  }
}

void captureAndRecognize() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping capture");
    return;
  }
  
  Serial.printf("Free heap before capture: %d bytes\n", ESP.getFreeHeap());
  
  // Capture image
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    blinkStatusLED(2);
    return;
  }
  
  // Check if image size is reasonable
  if (fb->len > 200000) { // If image is larger than 200KB
    Serial.printf("Image too large (%d bytes), skipping\n", fb->len);
    esp_camera_fb_return(fb);
    return;
  }
  
  // Flash LED during capture
  digitalWrite(FLASH_LED, HIGH);
  delay(100);
  digitalWrite(FLASH_LED, LOW);
  
  Serial.printf("Image captured: %d bytes\n", fb->len);
  
  // Convert to base64
  String imageBase64 = base64::encode(fb->buf, fb->len);
  
  // Check memory after encoding
  Serial.printf("Free heap after encoding: %d bytes\n", ESP.getFreeHeap());
  
  String imageData = "data:image/jpeg;base64," + imageBase64;
  
  // Release camera buffer immediately after encoding
  esp_camera_fb_return(fb);
  
  // Send to face recognition service
  sendImageForRecognition(imageData);
  
  // Clear the base64 string to free memory
  imageBase64 = "";
  imageData = "";
}

void sendImageForRecognition(String imageData) {
  HTTPClient http;
  http.begin(String(serverURL) + faceRecognitionEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000); // 15 second timeout
  
  // Create JSON payload matching our server API
  DynamicJsonDocument doc(imageData.length() + 500);
  doc["deviceId"] = deviceId;
  doc["classId"] = defaultClassId;
  doc["imageData"] = imageData;
  doc["timestamp"] = getCurrentTimestamp();
  doc["location"] = deviceLocation;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending image for face recognition...");
  Serial.printf("Payload size: %d bytes\n", jsonString.length());
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("HTTP Response: %d\n", httpResponseCode);
    Serial.println("Response: " + response);
    
    if (httpResponseCode == 200) {
      // Face recognized successfully
      Serial.println("Face recognized - Attendance marked");
      blinkStatusLED(1); // Success indication
      
      // Parse response to get student info
      DynamicJsonDocument responseDoc(1024);
      deserializeJson(responseDoc, response);
      
      if (responseDoc.containsKey("student")) {
        String studentName = responseDoc["student"];
        float confidence = responseDoc["confidence"];
        Serial.printf("Student: %s, Confidence: %.2f\n", studentName.c_str(), confidence);
      }
    } else if (httpResponseCode == 404) {
      Serial.println("Face not recognized");
    } else {
      Serial.println("Face recognition failed");
      blinkStatusLED(2); // Error indication
    }
  } else {
    Serial.printf("HTTP Error: %d\n", httpResponseCode);
    Serial.println("Connection failed - check server availability");
    blinkStatusLED(3); // Network error indication
  }
  
  http.end();
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping heartbeat");
    return;
  }
  
  HTTPClient http;
  http.begin(String(serverURL) + heartbeatEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout
  
  // Create heartbeat payload matching our server API
  DynamicJsonDocument doc(512);
  doc["deviceId"] = deviceId;
  doc["status"] = "online";
  doc["timestamp"] = getCurrentTimestamp();
  doc["batteryLevel"] = 100; // Not applicable for ESP32-CAM
  doc["signalStrength"] = WiFi.RSSI();
  doc["freeMemory"] = ESP.getFreeHeap();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("Sending heartbeat... (Free heap: %d)\n", ESP.getFreeHeap());
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("Heartbeat sent successfully: %d\n", httpResponseCode);
  } else {
    Serial.printf("Heartbeat failed: %d (Check server connection)\n", httpResponseCode);
  }
  
  http.end();
}

// Function to get current timestamp
String getCurrentTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time, using millis()");
    return String(millis()); // Fallback to millis() if NTP fails
  }
  
  char timeString[64];
  strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeString);
}

void blinkStatusLED(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(200);
    digitalWrite(STATUS_LED, LOW);
    delay(200);
  }
}

// Web server for configuration (optional)
void startConfigServer() {
  // This function can be expanded to provide a web interface
  // for configuring WiFi credentials, server URL, and class ID
  Serial.println("Configuration server functionality can be added here");
}

// Deep sleep mode for power saving (optional)
void enterDeepSleep(int seconds) {
  Serial.printf("Entering deep sleep for %d seconds\n", seconds);
  esp_sleep_enable_timer_wakeup(seconds * 1000000);
  esp_deep_sleep_start();
}

// Error recovery
void handleError(String error) {
  Serial.println("Error: " + error);
  blinkStatusLED(5);
  
  // Log error to EEPROM for debugging
  // Implementation can be added here
  
  // Restart if critical error
  if (error.indexOf("CRITICAL") >= 0) {
    delay(5000);
    ESP.restart();
  }
}