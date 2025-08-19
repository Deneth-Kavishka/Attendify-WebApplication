#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <base64.h>
#include <EEPROM.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server endpoints
const char* serverURL = "http://your-server-ip:8000";
const char* faceRecognitionEndpoint = "/api/face/recognize";
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
const unsigned long captureInterval = 5000;    // 5 seconds

// Status LED
#define STATUS_LED 33
#define FLASH_LED 4

// Button for manual capture
#define CAPTURE_BUTTON 0

void setup() {
  Serial.begin(115200);
  Serial.println("Smart Attendance ESP32-CAM Starting...");
  
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
  
  // Send initial heartbeat
  sendHeartbeat();
  
  Serial.println("ESP32-CAM Face Recognition System Ready");
  Serial.println("Press BOOT button to capture image manually");
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
  // Camera configuration for AI-Thinker ESP32-CAM
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sscb_sda = 26;
  config.pin_sscb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Frame size and quality settings
  if (psramFound()) {
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }
  
  // Initialize camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return false;
  }
  
  // Adjust camera settings for face recognition
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
  
  // Capture image
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    blinkStatusLED(2);
    return;
  }
  
  // Flash LED during capture
  digitalWrite(FLASH_LED, HIGH);
  delay(100);
  digitalWrite(FLASH_LED, LOW);
  
  Serial.printf("Image captured: %d bytes\n", fb->len);
  
  // Convert to base64
  String imageBase64 = base64::encode(fb->buf, fb->len);
  String imageData = "data:image/jpeg;base64," + imageBase64;
  
  // Release camera buffer
  esp_camera_fb_return(fb);
  
  // Send to face recognition service
  sendImageForRecognition(imageData);
}

void sendImageForRecognition(String imageData) {
  HTTPClient http;
  http.begin(String(serverURL) + faceRecognitionEndpoint);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(imageData.length() + 500);
  doc["image"] = imageData;
  doc["device_id"] = deviceId;
  doc["class_id"] = defaultClassId;
  doc["timestamp"] = WiFi.getTime();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending image for face recognition...");
  
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
      
      if (responseDoc.containsKey("student_id")) {
        String studentId = responseDoc["student_id"];
        float confidence = responseDoc["confidence"];
        Serial.printf("Student ID: %s, Confidence: %.2f\n", studentId.c_str(), confidence);
      }
    } else if (httpResponseCode == 404) {
      Serial.println("Face not recognized");
    } else {
      Serial.println("Face recognition failed");
      blinkStatusLED(2); // Error indication
    }
  } else {
    Serial.printf("HTTP Error: %d\n", httpResponseCode);
    blinkStatusLED(3); // Network error indication
  }
  
  http.end();
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  http.begin(String(serverURL) + heartbeatEndpoint);
  http.addHeader("Content-Type", "application/json");
  
  // Create heartbeat payload
  DynamicJsonDocument doc(512);
  doc["device_id"] = deviceId;
  doc["device_type"] = "esp32_cam";
  doc["location"] = deviceLocation;
  doc["timestamp"] = WiFi.getTime();
  doc["status"] = "online";
  doc["free_heap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("Heartbeat sent successfully: %d\n", httpResponseCode);
  } else {
    Serial.printf("Heartbeat failed: %d\n", httpResponseCode);
  }
  
  http.end();
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
