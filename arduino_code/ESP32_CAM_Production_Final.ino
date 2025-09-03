#include "esp_camera.h"
#include "esp_timer.h"
#include "esp_log.h"
#include "esp_system.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <base64.h>
#include <time.h>
#include <EEPROM.h>

// ===================== FIRMWARE INFORMATION =====================
#define FIRMWARE_VERSION "3.0.0"
#define DEVICE_MODEL "ESP32-CAM-AI-THINKER"
#define BUILD_DATE __DATE__ " " __TIME__

// ===================== CONFIGURATION SECTION =====================
// 🔧 UPDATE THESE SETTINGS FOR YOUR SETUP

// WiFi Configuration - CHANGE THESE!
const char* WIFI_SSID = "Dialog 4G 588";           // Your WiFi network name
const char* WIFI_PASSWORD = "83EF36AA";            // Your WiFi password
const char* WIFI_FALLBACK_SSID = "Backup_WiFi";    // Backup network (optional)
const char* WIFI_FALLBACK_PASSWORD = "backup_pass"; // Backup password (optional)

// Server Configuration - UPDATE WITH YOUR COMPUTER'S IP
const char* NODE_SERVER_HOST = "192.168.8.110";    // Your computer's IP address
const int NODE_SERVER_PORT = 5000;                 // Node.js backend port
const char* PYTHON_SERVER_HOST = "192.168.8.110";  // Your computer's IP address  
const int PYTHON_SERVER_PORT = 8000;               // Python backend port

// Device Configuration
const String DEVICE_ID = "ESP32_CAM_PROD_001";     // Unique device identifier
const String DEVICE_NAME = "Main Entrance Camera"; // Human-readable name
const String DEVICE_LOCATION = "Building A - Room 101"; // Physical location
const String CLASS_ID = "CS101";                   // Default class for attendance

// ===================== PIN DEFINITIONS =====================
// Based on your ESP32-CAM pin layout
#define FLASH_LED_PIN     4    // GPIO4  - Built-in flash LED
#define STATUS_LED_PIN    2    // GPIO2  - Status indicator LED
#define BOOT_BUTTON_PIN   0    // GPIO0  - Built-in boot button (manual trigger)
#define PIR_SENSOR_PIN    13   // GPIO13 - PIR motion sensor input
#define TRIGGER_BUTTON_PIN 14  // GPIO14 - External trigger button (optional)
#define PROXIMITY_SENSOR_PIN 15 // GPIO15 - Proximity sensor (optional)
#define EXTERNAL_LED_PIN  12   // GPIO12 - External status LED (optional)
#define DEBUG_TX_PIN      16   // GPIO16 - Serial TX for debugging (optional)

// Camera pin definitions for ESP32-CAM AI-Thinker
#define CAMERA_MODEL_AI_THINKER
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26  // SDA
#define SIOC_GPIO_NUM     27  // SCL
#define Y9_GPIO_NUM       35  // Data 7
#define Y8_GPIO_NUM       34  // Data 6
#define Y7_GPIO_NUM       39  // Data 5
#define Y6_GPIO_NUM       36  // Data 4
#define Y5_GPIO_NUM       21  // Data 3
#define Y4_GPIO_NUM       19  // Data 2
#define Y3_GPIO_NUM       18  // Data 1
#define Y2_GPIO_NUM        5  // Data 0
#define VSYNC_GPIO_NUM    25  // VSYNC
#define HREF_GPIO_NUM     23  // HREF
#define PCLK_GPIO_NUM     22  // PCLK

// ===================== TIMING CONFIGURATION =====================
const unsigned long HEARTBEAT_INTERVAL = 30000;    // 30 seconds
const unsigned long STATUS_UPDATE_INTERVAL = 60000; // 1 minute
const unsigned long MOTION_CHECK_INTERVAL = 500;   // 500ms
const unsigned long CAPTURE_COOLDOWN = 3000;       // 3 seconds between captures
const unsigned long WIFI_RECONNECT_INTERVAL = 30000; // 30 seconds
const unsigned long SERVER_TIMEOUT = 15000;        // 15 seconds HTTP timeout
const unsigned long PROXIMITY_TIMEOUT = 10000;     // 10 seconds proximity mode
const unsigned long WATCHDOG_TIMEOUT = 60000;      // 1 minute watchdog

// ===================== QUALITY SETTINGS =====================
const framesize_t CAMERA_FRAMESIZE = FRAMESIZE_VGA; // 640x480 for good balance
const int CAMERA_QUALITY = 12;                      // JPEG quality (0-63, lower = better)
const int CAMERA_BRIGHTNESS = 0;                    // -2 to 2
const int CAMERA_CONTRAST = 0;                      // -2 to 2
const int CAMERA_SATURATION = 0;                    // -2 to 2

// ===================== GLOBAL VARIABLES =====================
// System state
bool cameraInitialized = false;
bool wifiConnected = false;
bool systemReady = false;
bool motionDetected = false;
bool proximityMode = false;
bool debugMode = true;

// Timing variables
unsigned long lastHeartbeat = 0;
unsigned long lastStatusUpdate = 0;
unsigned long lastMotionCheck = 0;
unsigned long lastCapture = 0;
unsigned long lastWiFiCheck = 0;
unsigned long bootTime = 0;
unsigned long proximityStartTime = 0;

// Statistics
int totalCaptures = 0;
int successfulRecognitions = 0;
int failedRecognitions = 0;
int networkErrors = 0;
int systemRestarts = 0;
float batteryVoltage = 0.0;

// Network objects
WebServer webServer(80);
WebSocketsClient webSocket;
WiFiClient wifiClient;

// Motion detection
uint32_t lastFrameChecksum = 0;
int motionSensitivity = 1000;  // Adjustable motion sensitivity
int consecutiveMotions = 0;

// Camera configuration
camera_config_t cameraConfig;

// ===================== FUNCTION DECLARATIONS =====================
// System functions
void initializeSystem();
void initializePins();
bool initializeCamera();
void connectToWiFi();
void initializeWebServer();
void initializeWebSocket();

// Camera functions
bool captureAndProcess(bool forceCapture = false);
String captureImageAsBase64();
bool sendImageForRecognition(String imageData);
void optimizeCameraSettings();

// Motion detection
void checkMotionDetection();
bool detectFrameMotion();
void enterProximityMode();
void exitProximityMode();

// Network functions
void sendHeartbeat();
void sendStatusUpdate();
void checkNetworkHealth();
void reconnectWiFi();
void reconnectWebSocket();

// Status and logging
void updateSystemStatus(String status, String message = "");
void logSystemInfo();
void blinkStatusLED(int times, int delayMs = 200);
void setStatusLED(bool state);
String getSystemStatusJSON();
String getStatisticsJSON();

// Web server handlers
void handleRoot();
void handleStream();
void handleCapture();
void handleStatus();
void handleStatistics();
void handleRestart();
void handleDebug();

// WebSocket handlers
void onWebSocketEvent(WStype_t type, uint8_t * payload, size_t length);

// Utility functions
String getCurrentTimestamp();
String getChipInfo();
String getMemoryInfo();
float readBatteryVoltage();
void saveConfigToEEPROM();
void loadConfigFromEEPROM();

// Error handling
void handleSystemError(String error);
void performSystemRestart();
void enableWatchdog();
void feedWatchdog();

// ===================== SETUP FUNCTION =====================
void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  delay(1000);
  
  // Print startup banner
  Serial.println("\n\n" + String("=").repeat(60));
  Serial.println("🚀 ESP32-CAM Face Recognition System");
  Serial.println("📱 Production Final Version " + String(FIRMWARE_VERSION));
  Serial.println("📅 Built: " + String(BUILD_DATE));
  Serial.println("🔧 Device: " + DEVICE_ID);
  Serial.println(String("=").repeat(60));
  
  // Record boot time
  bootTime = millis();
  
  // Initialize system components
  initializeSystem();
  
  Serial.println("✅ System initialization complete!");
  Serial.println("🌐 Device ready for operation");
  Serial.println(String("=").repeat(60));
}

// ===================== MAIN LOOP =====================
void loop() {
  // Feed watchdog
  feedWatchdog();
  
  // Handle web server requests
  webServer.handleClient();
  
  // Handle WebSocket events
  webSocket.loop();
  
  // Check WiFi connection
  if (millis() - lastWiFiCheck > WIFI_RECONNECT_INTERVAL) {
    checkNetworkHealth();
    lastWiFiCheck = millis();
  }
  
  // Send heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Send status update
  if (millis() - lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
    sendStatusUpdate();
    lastStatusUpdate = millis();
  }
  
  // Check for motion
  if (millis() - lastMotionCheck > MOTION_CHECK_INTERVAL) {
    checkMotionDetection();
    lastMotionCheck = millis();
  }
  
  // Handle proximity mode timeout
  if (proximityMode && (millis() - proximityStartTime > PROXIMITY_TIMEOUT)) {
    exitProximityMode();
  }
  
  // Process face recognition if triggered
  if ((motionDetected || proximityMode) && 
      (millis() - lastCapture > CAPTURE_COOLDOWN)) {
    captureAndProcess();
  }
  
  // Check manual trigger button
  if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
      Serial.println("🔘 Manual trigger activated");
      captureAndProcess(true);
      while (digitalRead(BOOT_BUTTON_PIN) == LOW) delay(10);
    }
  }
  
  // Small delay to prevent watchdog issues
  delay(10);
}

// ===================== SYSTEM INITIALIZATION =====================
void initializeSystem() {
  Serial.println("🔧 Initializing system components...");
  
  // Initialize EEPROM for configuration storage
  EEPROM.begin(512);
  loadConfigFromEEPROM();
  
  // Initialize pins
  initializePins();
  
  // Show initialization progress
  blinkStatusLED(1, 100);
  Serial.println("📌 Pins initialized");
  
  // Initialize camera
  if (initializeCamera()) {
    Serial.println("📷 Camera initialized successfully");
    blinkStatusLED(2, 100);
  } else {
    Serial.println("❌ Camera initialization failed!");
    handleSystemError("Camera init failed");
    return;
  }
  
  // Connect to WiFi
  connectToWiFi();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("📶 WiFi connected successfully");
    wifiConnected = true;
    blinkStatusLED(3, 100);
    
    // Initialize web services
    initializeWebServer();
    initializeWebSocket();
    
    // Sync time with NTP
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    
    Serial.println("🌐 Network services initialized");
    blinkStatusLED(4, 100);
  } else {
    Serial.println("❌ WiFi connection failed!");
    wifiConnected = false;
  }
  
  // Enable watchdog
  enableWatchdog();
  
  // Final system check
  systemReady = cameraInitialized && wifiConnected;
  
  if (systemReady) {
    setStatusLED(true);
    Serial.println("✅ All systems operational");
    updateSystemStatus("ready", "System fully initialized and operational");
  } else {
    blinkStatusLED(10, 100);
    Serial.println("⚠️ System partially operational");
    updateSystemStatus("partial", "Some components failed to initialize");
  }
  
  // Log system information
  logSystemInfo();
}

void initializePins() {
  // Configure GPIO pins
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(PIR_SENSOR_PIN, INPUT);
  pinMode(TRIGGER_BUTTON_PIN, INPUT_PULLUP);
  pinMode(PROXIMITY_SENSOR_PIN, INPUT);
  pinMode(EXTERNAL_LED_PIN, OUTPUT);
  
  // Initialize pin states
  setStatusLED(false);
  digitalWrite(FLASH_LED_PIN, LOW);
  digitalWrite(EXTERNAL_LED_PIN, LOW);
  
  Serial.println("📌 GPIO pins configured");
}

bool initializeCamera() {
  Serial.println("📷 Initializing camera...");
  
  // Camera configuration
  cameraConfig.ledc_channel = LEDC_CHANNEL_0;
  cameraConfig.ledc_timer = LEDC_TIMER_0;
  cameraConfig.pin_d0 = Y2_GPIO_NUM;
  cameraConfig.pin_d1 = Y3_GPIO_NUM;
  cameraConfig.pin_d2 = Y4_GPIO_NUM;
  cameraConfig.pin_d3 = Y5_GPIO_NUM;
  cameraConfig.pin_d4 = Y6_GPIO_NUM;
  cameraConfig.pin_d5 = Y7_GPIO_NUM;
  cameraConfig.pin_d6 = Y8_GPIO_NUM;
  cameraConfig.pin_d7 = Y9_GPIO_NUM;
  cameraConfig.pin_xclk = XCLK_GPIO_NUM;
  cameraConfig.pin_pclk = PCLK_GPIO_NUM;
  cameraConfig.pin_vsync = VSYNC_GPIO_NUM;
  cameraConfig.pin_href = HREF_GPIO_NUM;
  cameraConfig.pin_sccb_sda = SIOD_GPIO_NUM;
  cameraConfig.pin_sccb_scl = SIOC_GPIO_NUM;
  cameraConfig.pin_pwdn = PWDN_GPIO_NUM;
  cameraConfig.pin_reset = RESET_GPIO_NUM;
  cameraConfig.xclk_freq_hz = 20000000;
  cameraConfig.frame_size = CAMERA_FRAMESIZE;
  cameraConfig.pixel_format = PIXFORMAT_JPEG;
  cameraConfig.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  cameraConfig.fb_location = CAMERA_FB_IN_PSRAM;
  cameraConfig.jpeg_quality = CAMERA_QUALITY;
  cameraConfig.fb_count = 1;
  
  // Adjust settings based on PSRAM availability
  if (psramFound()) {
    cameraConfig.jpeg_quality = 10;
    cameraConfig.fb_count = 2;
    cameraConfig.grab_mode = CAMERA_GRAB_LATEST;
    Serial.println("📦 PSRAM detected - using enhanced settings");
  } else {
    cameraConfig.frame_size = FRAMESIZE_SVGA;
    cameraConfig.jpeg_quality = 12;
    cameraConfig.fb_count = 1;
    Serial.println("⚠️ No PSRAM - using conservative settings");
  }
  
  // Initialize camera
  esp_err_t err = esp_camera_init(&cameraConfig);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed with error 0x%x\n", err);
    return false;
  }
  
  // Optimize camera settings
  optimizeCameraSettings();
  
  // Test camera capture
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture test failed");
    return false;
  }
  esp_camera_fb_return(fb);
  
  cameraInitialized = true;
  Serial.println("✅ Camera initialized and tested successfully");
  return true;
}

void optimizeCameraSettings() {
  sensor_t * s = esp_camera_sensor_get();
  if (s) {
    // Optimize settings for face recognition
    s->set_brightness(s, CAMERA_BRIGHTNESS);    // -2 to 2
    s->set_contrast(s, CAMERA_CONTRAST);        // -2 to 2
    s->set_saturation(s, CAMERA_SATURATION);    // -2 to 2
    s->set_special_effect(s, 0);                // 0 to 6 (0-No Effect, 1-Negative, 2-Grayscale, 3-Red Tint, 4-Green Tint, 5-Blue Tint, 6-Sepia)
    s->set_whitebal(s, 1);                      // 0 = disable , 1 = enable
    s->set_awb_gain(s, 1);                      // 0 = disable , 1 = enable
    s->set_wb_mode(s, 0);                       // 0 to 4 - if awb_gain enabled (0 - Auto, 1 - Sunny, 2 - Cloudy, 3 - Office, 4 - Home)
    s->set_exposure_ctrl(s, 1);                 // 0 = disable , 1 = enable
    s->set_aec2(s, 0);                          // 0 = disable , 1 = enable
    s->set_ae_level(s, 0);                      // -2 to 2
    s->set_aec_value(s, 300);                   // 0 to 1200
    s->set_gain_ctrl(s, 1);                     // 0 = disable , 1 = enable
    s->set_agc_gain(s, 0);                      // 0 to 30
    s->set_gainceiling(s, (gainceiling_t)0);    // 0 to 6
    s->set_bpc(s, 0);                           // 0 = disable , 1 = enable
    s->set_wpc(s, 1);                           // 0 = disable , 1 = enable
    s->set_raw_gma(s, 1);                       // 0 = disable , 1 = enable
    s->set_lenc(s, 1);                          // 0 = disable , 1 = enable
    s->set_hmirror(s, 0);                       // 0 = disable , 1 = enable
    s->set_vflip(s, 0);                         // 0 = disable , 1 = enable
    s->set_dcw(s, 1);                           // 0 = disable , 1 = enable
    s->set_colorbar(s, 0);                      // 0 = disable , 1 = enable
    
    Serial.println("📷 Camera settings optimized for face recognition");
  }
}

void connectToWiFi() {
  Serial.println("📶 Connecting to WiFi...");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    blinkStatusLED(1, 50);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi connected successfully!");
    Serial.printf("📡 IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("📶 Signal Strength: %d dBm\n", WiFi.RSSI());
    Serial.printf("🔐 MAC Address: %s\n", WiFi.macAddress().c_str());
    
    wifiConnected = true;
  } else {
    Serial.println();
    Serial.println("❌ WiFi connection failed!");
    Serial.println("🔄 Trying fallback network...");
    
    // Try fallback network
    WiFi.begin(WIFI_FALLBACK_SSID, WIFI_FALLBACK_PASSWORD);
    attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
      delay(1000);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println();
      Serial.println("✅ Connected to fallback network!");
      wifiConnected = true;
    } else {
      Serial.println();
      Serial.println("❌ All WiFi connections failed!");
      wifiConnected = false;
    }
  }
}

// ===================== WEB SERVER SETUP =====================
void initializeWebServer() {
  Serial.println("🌐 Starting web server...");
  
  // Route handlers
  webServer.on("/", handleRoot);
  webServer.on("/stream", handleStream);
  webServer.on("/capture", handleCapture);
  webServer.on("/status", handleStatus);
  webServer.on("/statistics", handleStatistics);
  webServer.on("/restart", handleRestart);
  webServer.on("/debug", handleDebug);
  
  // Start server
  webServer.begin();
  
  Serial.printf("🌐 Web server started on http://%s/\n", WiFi.localIP().toString().c_str());
  Serial.printf("📺 Stream available at http://%s/stream\n", WiFi.localIP().toString().c_str());
}

void initializeWebSocket() {
  Serial.println("🔗 Initializing WebSocket connection...");
  
  // Configure WebSocket
  webSocket.begin(NODE_SERVER_HOST, NODE_SERVER_PORT, "/");
  webSocket.onEvent(onWebSocketEvent);
  webSocket.setReconnectInterval(5000);
  
  Serial.printf("🔗 WebSocket connecting to ws://%s:%d/\n", NODE_SERVER_HOST, NODE_SERVER_PORT);
}

// ===================== CORE FUNCTIONALITY =====================
bool captureAndProcess(bool forceCapture) {
  if (!cameraInitialized) {
    Serial.println("❌ Camera not initialized");
    return false;
  }
  
  if (!forceCapture && (millis() - lastCapture < CAPTURE_COOLDOWN)) {
    return false; // Too soon since last capture
  }
  
  Serial.println("📸 Capturing image for face recognition...");
  
  // Capture image
  String imageData = captureImageAsBase64();
  if (imageData.length() == 0) {
    Serial.println("❌ Failed to capture image");
    return false;
  }
  
  lastCapture = millis();
  totalCaptures++;
  
  // Flash LED to indicate capture
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(100);
  digitalWrite(FLASH_LED_PIN, LOW);
  
  // Send for recognition
  bool success = sendImageForRecognition(imageData);
  
  if (success) {
    successfulRecognitions++;
    blinkStatusLED(2, 100);
  } else {
    failedRecognitions++;
    blinkStatusLED(5, 100);
  }
  
  // Reset motion detection
  motionDetected = false;
  
  return success;
}

String captureImageAsBase64() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture failed");
    return "";
  }
  
  if (fb->width == 0) {
    Serial.println("❌ Captured image has zero width");
    esp_camera_fb_return(fb);
    return "";
  }
  
  // Encode to base64
  String imageFile = base64::encode(fb->buf, fb->len);
  
  // Clean up
  esp_camera_fb_return(fb);
  
  Serial.printf("📸 Image captured: %d bytes, encoded to %d characters\n", 
                fb->len, imageFile.length());
  
  return imageFile;
}

bool sendImageForRecognition(String imageData) {
  if (!wifiConnected) {
    Serial.println("❌ No WiFi connection for recognition");
    networkErrors++;
    return false;
  }
  
  HTTPClient http;
  WiFiClient client;
  
  // Configure HTTP client
  String url = "http://" + String(PYTHON_SERVER_HOST) + ":" + String(PYTHON_SERVER_PORT) + "/api/face/recognize";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(SERVER_TIMEOUT);
  
  // Prepare JSON payload
  DynamicJsonDocument doc(8192);
  doc["deviceId"] = DEVICE_ID;
  doc["deviceLocation"] = DEVICE_LOCATION;
  doc["classId"] = CLASS_ID;
  doc["image"] = imageData;
  doc["timestamp"] = getCurrentTimestamp();
  doc["firmware_version"] = FIRMWARE_VERSION;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.printf("🚀 Sending recognition request to %s\n", url.c_str());
  Serial.printf("📦 Payload size: %d bytes\n", jsonString.length());
  
  // Send request
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("📡 HTTP Response Code: %d\n", httpResponseCode);
    
    if (httpResponseCode == 200) {
      // Parse response
      DynamicJsonDocument responseDoc(4096);
      deserializeJson(responseDoc, response);
      
      if (responseDoc["success"]) {
        String studentName = responseDoc["student_name"];
        float confidence = responseDoc["confidence"];
        
        Serial.printf("🎉 Recognition SUCCESS: %s (%.1f%% confidence)\n", 
                     studentName.c_str(), confidence * 100);
        
        // Send WebSocket notification
        DynamicJsonDocument wsDoc(1024);
        wsDoc["type"] = "recognition_success";
        wsDoc["device_id"] = DEVICE_ID;
        wsDoc["student_name"] = studentName;
        wsDoc["confidence"] = confidence;
        wsDoc["timestamp"] = getCurrentTimestamp();
        
        String wsMessage;
        serializeJson(wsDoc, wsMessage);
        webSocket.sendTXT(wsMessage);
        
        http.end();
        return true;
      } else {
        String error = responseDoc["error"];
        Serial.printf("❌ Recognition failed: %s\n", error.c_str());
      }
    } else {
      Serial.printf("❌ HTTP Error: %d\n", httpResponseCode);
      Serial.printf("Response: %s\n", response.c_str());
    }
  } else {
    Serial.printf("❌ HTTP Request failed: %s\n", http.errorToString(httpResponseCode).c_str());
    networkErrors++;
  }
  
  http.end();
  return false;
}

// ===================== MOTION DETECTION =====================
void checkMotionDetection() {
  // Check PIR sensor
  bool pirDetected = digitalRead(PIR_SENSOR_PIN) == HIGH;
  
  // Check proximity sensor
  bool proximityDetected = digitalRead(PROXIMITY_SENSOR_PIN) == HIGH;
  
  // Check frame-based motion detection
  bool frameMotionDetected = detectFrameMotion();
  
  // Combine detection methods
  if (pirDetected || proximityDetected || frameMotionDetected) {
    if (!motionDetected) {
      Serial.println("🚶 Motion detected!");
      motionDetected = true;
      enterProximityMode();
    }
    consecutiveMotions++;
  } else {
    if (consecutiveMotions > 0) {
      consecutiveMotions--;
    }
    
    if (consecutiveMotions == 0 && motionDetected) {
      motionDetected = false;
      Serial.println("✋ Motion stopped");
    }
  }
}

bool detectFrameMotion() {
  if (!cameraInitialized) return false;
  
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) return false;
  
  // Calculate simple checksum of frame
  uint32_t checksum = 0;
  for (size_t i = 0; i < fb->len; i += 100) { // Sample every 100th byte
    checksum += fb->buf[i];
  }
  
  esp_camera_fb_return(fb);
  
  // Compare with last frame
  if (lastFrameChecksum != 0) {
    uint32_t difference = abs((long)(checksum - lastFrameChecksum));
    if (difference > motionSensitivity) {
      lastFrameChecksum = checksum;
      return true;
    }
  }
  
  lastFrameChecksum = checksum;
  return false;
}

void enterProximityMode() {
  if (!proximityMode) {
    proximityMode = true;
    proximityStartTime = millis();
    Serial.println("🎯 Entering proximity mode");
    
    // Notify via WebSocket
    DynamicJsonDocument doc(512);
    doc["type"] = "proximity_mode_entered";
    doc["device_id"] = DEVICE_ID;
    doc["timestamp"] = getCurrentTimestamp();
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
  }
}

void exitProximityMode() {
  if (proximityMode) {
    proximityMode = false;
    Serial.println("🚪 Exiting proximity mode");
    
    // Notify via WebSocket
    DynamicJsonDocument doc(512);
    doc["type"] = "proximity_mode_exited";
    doc["device_id"] = DEVICE_ID;
    doc["timestamp"] = getCurrentTimestamp();
    
    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
  }
}

// ===================== NETWORK COMMUNICATION =====================
void sendHeartbeat() {
  if (!wifiConnected) return;
  
  HTTPClient http;
  WiFiClient client;
  
  String url = "http://" + String(NODE_SERVER_HOST) + ":" + String(NODE_SERVER_PORT) + "/api/hardware/heartbeat";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = DEVICE_ID;
  doc["deviceName"] = DEVICE_NAME;
  doc["location"] = DEVICE_LOCATION;
  doc["timestamp"] = getCurrentTimestamp();
  doc["uptime"] = millis() - bootTime;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["wifiRSSI"] = WiFi.RSSI();
  doc["firmware"] = FIRMWARE_VERSION;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode == 200) {
    if (debugMode) Serial.println("💓 Heartbeat sent successfully");
  } else {
    Serial.printf("❌ Heartbeat failed: %d\n", httpResponseCode);
    networkErrors++;
  }
  
  http.end();
}

void sendStatusUpdate() {
  if (!wifiConnected) return;
  
  String statusJson = getSystemStatusJSON();
  
  HTTPClient http;
  WiFiClient client;
  
  String url = "http://" + String(NODE_SERVER_HOST) + ":" + String(NODE_SERVER_PORT) + "/api/hardware/status-update";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  int httpResponseCode = http.POST(statusJson);
  
  if (httpResponseCode == 200) {
    if (debugMode) Serial.println("📊 Status update sent successfully");
  } else {
    Serial.printf("❌ Status update failed: %d\n", httpResponseCode);
    networkErrors++;
  }
  
  http.end();
}

void checkNetworkHealth() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📶 WiFi disconnected, attempting reconnection...");
    wifiConnected = false;
    reconnectWiFi();
  }
  
  // Check WebSocket connection
  if (!webSocket.isConnected()) {
    Serial.println("🔗 WebSocket disconnected, attempting reconnection...");
    reconnectWebSocket();
  }
}

void reconnectWiFi() {
  setStatusLED(false);
  WiFi.disconnect();
  delay(1000);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    blinkStatusLED(1, 100);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi reconnected successfully");
    wifiConnected = true;
    setStatusLED(true);
  } else {
    Serial.println("❌ WiFi reconnection failed");
    wifiConnected = false;
    networkErrors++;
  }
}

void reconnectWebSocket() {
  webSocket.disconnect();
  delay(1000);
  webSocket.begin(NODE_SERVER_HOST, NODE_SERVER_PORT, "/");
}

// ===================== WEB SERVER HANDLERS =====================
void handleRoot() {
  String html = R"(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Face Recognition</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .btn { padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .btn:hover { background: #0056b3; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0; }
        .stat-box { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ESP32-CAM Face Recognition System</h1>
        <div class="status success">
            <strong>Device:</strong> )" + DEVICE_ID + R"(<br>
            <strong>Location:</strong> )" + DEVICE_LOCATION + R"(<br>
            <strong>Version:</strong> )" + String(FIRMWARE_VERSION) + R"(<br>
            <strong>Status:</strong> )" + (systemReady ? "✅ Operational" : "⚠️ Partial") + R"(
        </div>
        
        <div class="stats">
            <div class="stat-box">
                <h3>)" + String(totalCaptures) + R"(</h3>
                <p>Total Captures</p>
            </div>
            <div class="stat-box">
                <h3>)" + String(successfulRecognitions) + R"(</h3>
                <p>Successful Recognitions</p>
            </div>
            <div class="stat-box">
                <h3>)" + String(WiFi.RSSI()) + R"( dBm</h3>
                <p>WiFi Signal</p>
            </div>
            <div class="stat-box">
                <h3>)" + String((millis() - bootTime) / 1000) + R"(s</h3>
                <p>Uptime</p>
            </div>
        </div>
        
        <h3>🎛️ Controls</h3>
        <button class="btn" onclick="window.open('/stream', '_blank')">📺 View Stream</button>
        <button class="btn" onclick="window.open('/capture', '_blank')">📸 Capture Test</button>
        <button class="btn" onclick="window.open('/status', '_blank')">📊 Status JSON</button>
        <button class="btn" onclick="if(confirm('Restart device?')) window.open('/restart', '_self')">🔄 Restart</button>
        
        <h3>📖 Quick Links</h3>
        <ul>
            <li><a href="/stream">📺 Live Camera Stream</a></li>
            <li><a href="/status">📊 System Status (JSON)</a></li>
            <li><a href="/statistics">📈 Statistics (JSON)</a></li>
            <li><a href="/capture">📸 Test Capture</a></li>
        </ul>
        
        <h3>🔗 Integration</h3>
        <p><strong>Python Backend:</strong> http://)" + String(PYTHON_SERVER_HOST) + ":" + String(PYTHON_SERVER_PORT) + R"(</p>
        <p><strong>Node.js Backend:</strong> http://)" + String(NODE_SERVER_HOST) + ":" + String(NODE_SERVER_PORT) + R"(</p>
        <p><strong>WebSocket:</strong> ws://)" + String(NODE_SERVER_HOST) + ":" + String(NODE_SERVER_PORT) + R"(/</p>
    </div>
</body>
</html>
)";
  
  webServer.send(200, "text/html", html);
}

void handleStream() {
  WiFiClient client = webServer.client();
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  webServer.sendContent(response);
  
  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("❌ Camera capture failed");
      break;
    }
    
    if (fb->width > 400) {
      String frame = "--frame\r\n";
      frame += "Content-Type: image/jpeg\r\n\r\n";
      webServer.sendContent(frame);
      
      client.write(fb->buf, fb->len);
      webServer.sendContent("\r\n");
      esp_camera_fb_return(fb);
      
      if (!client.connected()) break;
    }
    
    esp_camera_fb_return(fb);
    delay(30); // ~30 FPS
  }
}

void handleCapture() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    webServer.send(500, "text/plain", "Camera capture failed");
    return;
  }
  
  webServer.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  webServer.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void handleStatus() {
  String json = getSystemStatusJSON();
  webServer.send(200, "application/json", json);
}

void handleStatistics() {
  String json = getStatisticsJSON();
  webServer.send(200, "application/json", json);
}

void handleRestart() {
  webServer.send(200, "text/html", 
    "<html><body><h1>🔄 Restarting ESP32-CAM...</h1>"
    "<p>Device will restart in 3 seconds.</p>"
    "<script>setTimeout(function(){ window.location.href='/'; }, 5000);</script>"
    "</body></html>");
  
  delay(1000);
  performSystemRestart();
}

void handleDebug() {
  debugMode = !debugMode;
  webServer.send(200, "text/plain", "Debug mode: " + String(debugMode ? "ON" : "OFF"));
}

// ===================== WEBSOCKET HANDLERS =====================
void onWebSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("🔗 WebSocket Disconnected");
      break;
      
    case WStype_CONNECTED:
      Serial.printf("🔗 WebSocket Connected to: %s\n", payload);
      
      // Send initial status
      DynamicJsonDocument doc(1024);
      doc["type"] = "device_connected";
      doc["device_id"] = DEVICE_ID;
      doc["device_name"] = DEVICE_NAME;
      doc["location"] = DEVICE_LOCATION;
      doc["firmware"] = FIRMWARE_VERSION;
      doc["timestamp"] = getCurrentTimestamp();
      
      String message;
      serializeJson(doc, message);
      webSocket.sendTXT(message);
      break;
      
    case WStype_TEXT:
      Serial.printf("🔗 WebSocket Message: %s\n", payload);
      
      // Parse incoming message
      DynamicJsonDocument incomingDoc(1024);
      deserializeJson(incomingDoc, payload);
      
      String command = incomingDoc["command"];
      if (command == "capture") {
        captureAndProcess(true);
      } else if (command == "restart") {
        performSystemRestart();
      } else if (command == "status") {
        String statusJson = getSystemStatusJSON();
        webSocket.sendTXT(statusJson);
      }
      break;
      
    case WStype_ERROR:
      Serial.printf("❌ WebSocket Error: %s\n", payload);
      break;
      
    default:
      break;
  }
}

// ===================== UTILITY FUNCTIONS =====================
String getCurrentTimestamp() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return String(millis()); // Fallback to millis if NTP not available
  }
  
  char timeString[64];
  strftime(timeString, sizeof(timeString), "%Y-%m-%dT%H:%M:%S", &timeinfo);
  return String(timeString);
}

String getChipInfo() {
  esp_chip_info_t chip_info;
  esp_chip_info(&chip_info);
  
  String info = "ESP32 ";
  info += (chip_info.cores == 1) ? "Single" : "Dual";
  info += " Core, ";
  info += String(ESP.getCpuFreqMHz()) + "MHz, ";
  info += String(ESP.getHeapSize() / 1024) + "KB RAM";
  
  return info;
}

String getMemoryInfo() {
  return "Free: " + String(ESP.getFreeHeap()) + "B, " +
         "PSRAM: " + String(psramFound() ? "Yes" : "No") + ", " +
         "Flash: " + String(ESP.getFlashChipSize() / 1024) + "KB";
}

float readBatteryVoltage() {
  // Read battery voltage if connected to ADC pin
  // This is a placeholder - implement based on your hardware
  return 3.3; // Default 3.3V
}

String getSystemStatusJSON() {
  DynamicJsonDocument doc(2048);
  
  doc["device_info"]["id"] = DEVICE_ID;
  doc["device_info"]["name"] = DEVICE_NAME;
  doc["device_info"]["location"] = DEVICE_LOCATION;
  doc["device_info"]["firmware"] = FIRMWARE_VERSION;
  doc["device_info"]["model"] = DEVICE_MODEL;
  doc["device_info"]["build_date"] = BUILD_DATE;
  
  doc["system_status"]["ready"] = systemReady;
  doc["system_status"]["camera"] = cameraInitialized;
  doc["system_status"]["wifi"] = wifiConnected;
  doc["system_status"]["uptime"] = millis() - bootTime;
  doc["system_status"]["free_heap"] = ESP.getFreeHeap();
  doc["system_status"]["cpu_freq"] = ESP.getCpuFreqMHz();
  
  doc["network"]["wifi_ssid"] = WiFi.SSID();
  doc["network"]["ip_address"] = WiFi.localIP().toString();
  doc["network"]["mac_address"] = WiFi.macAddress();
  doc["network"]["rssi"] = WiFi.RSSI();
  doc["network"]["websocket_connected"] = webSocket.isConnected();
  
  doc["recognition"]["motion_detected"] = motionDetected;
  doc["recognition"]["proximity_mode"] = proximityMode;
  doc["recognition"]["total_captures"] = totalCaptures;
  doc["recognition"]["successful"] = successfulRecognitions;
  doc["recognition"]["failed"] = failedRecognitions;
  
  doc["errors"]["network_errors"] = networkErrors;
  doc["errors"]["system_restarts"] = systemRestarts;
  
  doc["timestamp"] = getCurrentTimestamp();
  
  String output;
  serializeJson(doc, output);
  return output;
}

String getStatisticsJSON() {
  DynamicJsonDocument doc(1024);
  
  doc["uptime_seconds"] = (millis() - bootTime) / 1000;
  doc["total_captures"] = totalCaptures;
  doc["successful_recognitions"] = successfulRecognitions;
  doc["failed_recognitions"] = failedRecognitions;
  doc["recognition_rate"] = (totalCaptures > 0) ? 
    (float)successfulRecognitions / totalCaptures * 100 : 0;
  doc["network_errors"] = networkErrors;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["cpu_frequency"] = ESP.getCpuFreqMHz();
  doc["flash_size"] = ESP.getFlashChipSize();
  doc["psram_available"] = psramFound();
  doc["timestamp"] = getCurrentTimestamp();
  
  String output;
  serializeJson(doc, output);
  return output;
}

void updateSystemStatus(String status, String message) {
  Serial.printf("📊 System Status: %s - %s\n", status.c_str(), message.c_str());
  
  // Send status via WebSocket if connected
  if (webSocket.isConnected()) {
    DynamicJsonDocument doc(512);
    doc["type"] = "status_update";
    doc["device_id"] = DEVICE_ID;
    doc["status"] = status;
    doc["message"] = message;
    doc["timestamp"] = getCurrentTimestamp();
    
    String jsonString;
    serializeJson(doc, jsonString);
    webSocket.sendTXT(jsonString);
  }
}

void logSystemInfo() {
  Serial.println("\n" + String("=").repeat(50));
  Serial.println("📊 SYSTEM INFORMATION");
  Serial.println(String("=").repeat(50));
  Serial.printf("🆔 Device ID: %s\n", DEVICE_ID.c_str());
  Serial.printf("📍 Location: %s\n", DEVICE_LOCATION.c_str());
  Serial.printf("🔧 Firmware: %s\n", FIRMWARE_VERSION);
  Serial.printf("🏗️ Built: %s\n", BUILD_DATE);
  Serial.printf("💾 %s\n", getChipInfo().c_str());
  Serial.printf("🧠 %s\n", getMemoryInfo().c_str());
  Serial.printf("📶 WiFi: %s (%d dBm)\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  Serial.printf("🌐 Web: http://%s/\n", WiFi.localIP().toString().c_str());
  Serial.printf("📺 Stream: http://%s/stream\n", WiFi.localIP().toString().c_str());
  Serial.printf("🔗 Backend: http://%s:%d/\n", PYTHON_SERVER_HOST, PYTHON_SERVER_PORT);
  Serial.println(String("=").repeat(50));
}

void blinkStatusLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    digitalWrite(EXTERNAL_LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    digitalWrite(EXTERNAL_LED_PIN, LOW);
    delay(delayMs);
  }
}

void setStatusLED(bool state) {
  digitalWrite(STATUS_LED_PIN, state ? HIGH : LOW);
  digitalWrite(EXTERNAL_LED_PIN, state ? HIGH : LOW);
}

// ===================== ERROR HANDLING =====================
void handleSystemError(String error) {
  Serial.printf("❌ SYSTEM ERROR: %s\n", error.c_str());
  
  // Blink error pattern
  for (int i = 0; i < 10; i++) {
    blinkStatusLED(1, 100);
    delay(100);
  }
  
  // Try to recover
  if (error.indexOf("Camera") != -1) {
    Serial.println("🔄 Attempting camera recovery...");
    esp_camera_deinit();
    delay(1000);
    if (initializeCamera()) {
      Serial.println("✅ Camera recovery successful");
      return;
    }
  }
  
  if (error.indexOf("WiFi") != -1) {
    Serial.println("🔄 Attempting WiFi recovery...");
    reconnectWiFi();
    return;
  }
  
  // If recovery fails, restart system
  Serial.println("🔄 System recovery failed, restarting...");
  delay(5000);
  performSystemRestart();
}

void performSystemRestart() {
  Serial.println("🔄 Performing system restart...");
  
  // Save statistics to EEPROM
  saveConfigToEEPROM();
  
  // Cleanup
  webSocket.disconnect();
  webServer.stop();
  WiFi.disconnect();
  
  // Increment restart counter
  systemRestarts++;
  
  delay(2000);
  ESP.restart();
}

void enableWatchdog() {
  // Enable hardware watchdog timer
  esp_task_wdt_init(WATCHDOG_TIMEOUT / 1000, true);
  esp_task_wdt_add(NULL);
  Serial.printf("🐕 Watchdog enabled (%d seconds)\n", WATCHDOG_TIMEOUT / 1000);
}

void feedWatchdog() {
  esp_task_wdt_reset();
}

// ===================== CONFIGURATION PERSISTENCE =====================
void saveConfigToEEPROM() {
  EEPROM.write(0, totalCaptures & 0xFF);
  EEPROM.write(1, (totalCaptures >> 8) & 0xFF);
  EEPROM.write(2, successfulRecognitions & 0xFF);
  EEPROM.write(3, (successfulRecognitions >> 8) & 0xFF);
  EEPROM.write(4, systemRestarts & 0xFF);
  EEPROM.commit();
}

void loadConfigFromEEPROM() {
  totalCaptures = EEPROM.read(0) | (EEPROM.read(1) << 8);
  successfulRecognitions = EEPROM.read(2) | (EEPROM.read(3) << 8);
  systemRestarts = EEPROM.read(4);
  
  Serial.printf("📂 Loaded from EEPROM: %d captures, %d recognitions, %d restarts\n", 
                totalCaptures, successfulRecognitions, systemRestarts);
}

// ===================== END OF CODE =====================
