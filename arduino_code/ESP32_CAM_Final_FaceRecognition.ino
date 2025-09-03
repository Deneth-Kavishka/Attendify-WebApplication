/*
 * ESP32-CAM FINAL FACE RECOGNITION SYSTEM
 * =======================================
 * 
 * Pin Configuration for AI-Thinker ESP32-CAM:
 * - 3V3, IO16, IO0, GND, VCC, UOR, UOT, GND/R, IO4, IO2, IO14, IO15, IO13, IO12, GND, 5V
 * 
 * Features:
 * - Camera streaming via MJPEG
 * - Motion detection for proximity sensing
 * - Face recognition via Python backend
 * - Real-time attendance updates
 * - WebSocket communication
 * - Status LED indicators
 * 
 * LED Status Indicators:
 * - 1 blink: Camera initialization
 * - 2 blinks: WiFi connecting
 * - 3 blinks: All systems ready
 * - Solid ON: Normal operation
 * - Fast blinking: Face recognition in progress
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <base64.h>

// Camera model - AI Thinker ESP32-CAM
#define CAMERA_MODEL_AI_THINKER

// Pin definitions based on your ESP32-CAM board
#define PWDN_GPIO_NUM     32  // Power down
#define RESET_GPIO_NUM    -1  // Reset (not connected)
#define XCLK_GPIO_NUM      0  // IO0
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

// Available pins for your configuration
#define FLASH_LED         4   // IO4 - Built-in flash LED
#define STATUS_LED        2   // IO2 - Status indicator
#define MOTION_SENSOR    13   // IO13 - Motion detection (optional)
#define CAPTURE_BUTTON   14   // IO14 - Manual capture trigger
#define PROXIMITY_SENSOR 15   // IO15 - Proximity sensor (optional)
#define EXTERNAL_LED     12   // IO12 - External status LED
#define SERIAL_TX        16   // IO16 - Serial communication (UOT)

// Network Configuration - UPDATE THESE VALUES!
const char* ssid = "Dialog 4G 588";           // Your WiFi network name
const char* password = "83EF36AA";            // Your WiFi password
const char* serverURL = "http://192.168.8.110:5000";     // Node.js server
const char* pythonURL = "http://192.168.8.110:8000";     // Python backend

// Device Configuration
const char* deviceId = "ESP32_CAM_001";
const char* deviceLocation = "Room A101";
const char* deviceType = "esp32_cam";

// Timing Configuration
unsigned long lastHeartbeat = 0;
unsigned long lastMotionCheck = 0;
unsigned long lastFaceRecognition = 0;
const unsigned long heartbeatInterval = 10000;      // 10 seconds
const unsigned long motionCheckInterval = 500;      // 0.5 seconds
const unsigned long faceRecognitionCooldown = 5000; // 5 seconds between recognitions

// System State
bool motionDetected = false;
bool proximityMode = true;
bool recognitionInProgress = false;
String lastRecognizedStudent = "";
float lastConfidence = 0.0;
int totalRecognitions = 0;
int successfulRecognitions = 0;

// Web Server and WebSocket
WebServer server(80);
WebSocketsServer webSocket(81);

// Camera configuration
camera_config_t config;

// Function Prototypes
bool initializeCamera();
void connectToWiFi();
void setupWebServer();
void handleRoot();
void handleStream();
void handleCapture();
void handleStatus();
void handleWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);
void sendHeartbeat();
void checkMotion();
void performFaceRecognition();
bool sendImageForRecognition(camera_fb_t* fb);
void updateAttendance(String studentId, float confidence);
void blinkStatusLED(int times, int delayMs = 200);
void setStatusLED(bool state);
String encodeBase64(uint8_t* data, size_t length);

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("🎥 ESP32-CAM FACE RECOGNITION SYSTEM");
  Serial.println("========================================");
  Serial.printf("📱 Device ID: %s\n", deviceId);
  Serial.printf("📍 Location: %s\n", deviceLocation);
  Serial.println();
  
  // Initialize GPIO pins
  pinMode(FLASH_LED, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(EXTERNAL_LED, OUTPUT);
  pinMode(CAPTURE_BUTTON, INPUT_PULLUP);
  pinMode(MOTION_SENSOR, INPUT);
  pinMode(PROXIMITY_SENSOR, INPUT);
  
  // Turn off all LEDs initially
  digitalWrite(FLASH_LED, LOW);
  digitalWrite(STATUS_LED, LOW);
  digitalWrite(EXTERNAL_LED, LOW);
  
  Serial.println("🔧 Initializing hardware components...");
  
  // Step 1: Initialize Camera
  Serial.println();
  Serial.println("📷 STEP 1: Camera Initialization");
  Serial.println("----------------------------------");
  blinkStatusLED(1, 300); // 1 blink for camera init
  
  if (initializeCamera()) {
    Serial.println("✅ Camera: Initialized successfully");
    Serial.printf("📊 Free heap after camera init: %d bytes\n", ESP.getFreeHeap());
  } else {
    Serial.println("❌ Camera: Initialization failed!");
    Serial.println("🔄 System will restart in 5 seconds...");
    delay(5000);
    ESP.restart();
  }
  
  // Step 2: Connect to WiFi
  Serial.println();
  Serial.println("📶 STEP 2: WiFi Connection");
  Serial.println("---------------------------");
  blinkStatusLED(2, 300); // 2 blinks for WiFi
  connectToWiFi();
  
  // Step 3: Setup Web Services
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("🌐 STEP 3: Web Services Setup");
    Serial.println("------------------------------");
    setupWebServer();
    
    Serial.println("✅ All systems initialized successfully!");
    Serial.println();
    Serial.println("📡 ACCESS POINTS:");
    Serial.printf("🎥 Camera Stream: http://%s/stream\n", WiFi.localIP().toString().c_str());
    Serial.printf("🌐 Web Interface: http://%s/\n", WiFi.localIP().toString().c_str());
    Serial.printf("📊 Device Status: http://%s/status\n", WiFi.localIP().toString().c_str());
    Serial.printf("🔗 WebSocket: ws://%s:81\n", WiFi.localIP().toString().c_str());
    Serial.println();
    
    blinkStatusLED(3, 200); // 3 blinks for all systems ready
    setStatusLED(true); // Solid on for normal operation
    
    // Send initial heartbeat
    sendHeartbeat();
  }
  
  Serial.println("🚀 ESP32-CAM is ready for face recognition!");
  Serial.println("========================================");
}

void loop() {
  // Handle web server requests
  server.handleClient();
  
  // Handle WebSocket connections
  webSocket.loop();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected! Attempting reconnection...");
    setStatusLED(false);
    connectToWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      setStatusLED(true);
    }
  }
  
  // Send periodic heartbeat
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check for motion/proximity if enabled
  if (proximityMode && millis() - lastMotionCheck > motionCheckInterval) {
    checkMotion();
    lastMotionCheck = millis();
  }
  
  // Handle manual capture button
  if (digitalRead(CAPTURE_BUTTON) == LOW) {
    delay(50); // Debounce
    if (digitalRead(CAPTURE_BUTTON) == LOW) {
      Serial.println("🔴 Manual capture triggered!");
      performFaceRecognition();
      delay(1000); // Prevent multiple triggers
    }
  }
  
  // Perform face recognition if motion detected and cooldown passed
  if (motionDetected && !recognitionInProgress && 
      millis() - lastFaceRecognition > faceRecognitionCooldown) {
    performFaceRecognition();
  }
  
  delay(100); // Small delay to prevent watchdog issues
}

bool initializeCamera() {
  // Camera pin configuration
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
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  
  // Frame size and quality settings
  config.frame_size = FRAMESIZE_VGA;  // 640x480 for good balance
  config.jpeg_quality = 12;           // Lower = better quality, higher = smaller size
  config.fb_count = 2;                // Double buffering for smooth streaming
  
  // Initialize camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed with error 0x%x: %s\n", err, esp_err_to_name(err));
    return false;
  }
  
  // Test camera capture
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture test failed");
    return false;
  }
  
  Serial.printf("✅ Camera test capture: %d bytes, %dx%d\n", 
                fb->len, fb->width, fb->height);
  esp_camera_fb_return(fb);
  
  return true;
}

void connectToWiFi() {
  Serial.printf("📶 Connecting to WiFi: %s\n", ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    attempts++;
    Serial.print(".");
    
    // Blink LED while connecting
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    
    if (attempts % 10 == 0) {
      Serial.printf("\n📶 Connection attempt %d/30...\n", attempts);
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi Connected!");
    Serial.printf("📍 IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("📊 Signal Strength: %d dBm\n", WiFi.RSSI());
    Serial.printf("🌐 Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
  } else {
    Serial.println();
    Serial.printf("❌ WiFi connection failed! Status: %d\n", WiFi.status());
    Serial.println("🔄 Will retry in main loop...");
  }
}

void setupWebServer() {
  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/stream", handleStream);
  server.on("/capture", handleCapture);
  server.on("/status", handleStatus);
  
  // Enable CORS for all routes
  server.onNotFound([]() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(404, "text/plain", "Not Found");
  });
  
  server.begin();
  Serial.println("✅ Web Server: Started on port 80");
  
  // Setup WebSocket server
  webSocket.begin();
  webSocket.onEvent(handleWebSocketEvent);
  Serial.println("✅ WebSocket Server: Started on port 81");
}

void handleRoot() {
  String html = R"(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32-CAM Face Recognition</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-card { background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 10px 0; }
        .green { color: #28a745; } .red { color: #dc3545; } .blue { color: #007bff; }
        button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; margin: 5px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .stream-container { text-align: center; margin: 20px 0; }
        img { max-width: 100%; border-radius: 8px; border: 2px solid #007bff; }
        .live-indicator { display: inline-block; width: 10px; height: 10px; background: #28a745; border-radius: 50%; animation: blink 1s infinite; }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="blue">🎥 ESP32-CAM Face Recognition</h1>
            <p><span class="live-indicator"></span> Live System Active</p>
        </div>
        
        <div class="status-card">
            <h3>📊 System Status</h3>
            <p><strong>Device ID:</strong> )" + String(deviceId) + R"(</p>
            <p><strong>Location:</strong> )" + String(deviceLocation) + R"(</p>
            <p><strong>IP Address:</strong> )" + WiFi.localIP().toString() + R"(</p>
            <p><strong>Signal Strength:</strong> )" + String(WiFi.RSSI()) + R"( dBm</p>
            <p><strong>Free Memory:</strong> )" + String(ESP.getFreeHeap()) + R"( bytes</p>
            <p><strong>Uptime:</strong> )" + String(millis() / 1000) + R"( seconds</p>
        </div>
        
        <div class="status-card">
            <h3>🎯 Recognition Stats</h3>
            <p><strong>Total Attempts:</strong> )" + String(totalRecognitions) + R"(</p>
            <p><strong>Successful:</strong> )" + String(successfulRecognitions) + R"(</p>
            <p><strong>Last Recognized:</strong> )" + (lastRecognizedStudent.length() > 0 ? lastRecognizedStudent : "None") + R"(</p>
            <p><strong>Proximity Mode:</strong> )" + (proximityMode ? "Enabled" : "Disabled") + R"(</p>
        </div>
        
        <div class="stream-container">
            <h3>📹 Live Camera Stream</h3>
            <img src="/stream" alt="ESP32-CAM Stream" id="cameraStream">
            <br><br>
            <button onclick="location.href='/capture'">📸 Capture Photo</button>
            <button onclick="triggerRecognition()">🔍 Test Recognition</button>
            <button onclick="location.reload()">🔄 Refresh</button>
        </div>
    </div>
    
    <script>
        function triggerRecognition() {
            fetch('/capture')
                .then(response => response.json())
                .then(data => {
                    alert('Recognition test triggered! Check serial monitor for results.');
                })
                .catch(error => {
                    alert('Error: ' + error);
                });
        }
        
        // Auto-refresh stream on error
        document.getElementById('cameraStream').onerror = function() {
            setTimeout(() => {
                this.src = '/stream?' + new Date().getTime();
            }, 1000);
        };
    </script>
</body>
</html>
  )";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "text/html", html);
}

void handleStream() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  WiFiClient client = server.client();
  
  // Send MJPEG headers
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  server.sendContent(response);
  
  Serial.println("📺 Camera stream started");
  
  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("❌ Camera capture failed during stream");
      break;
    }
    
    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    
    esp_camera_fb_return(fb);
    
    if (!client.connected()) break;
    delay(100); // ~10 FPS
  }
  
  Serial.println("📺 Camera stream ended");
}

void handleCapture() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  Serial.println("📸 Manual capture requested via web interface");
  performFaceRecognition();
  
  server.send(200, "application/json", "{\"success\": true, \"message\": \"Face recognition triggered\"}");
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  String json = "{";
  json += "\"deviceId\":\"" + String(deviceId) + "\",";
  json += "\"deviceType\":\"" + String(deviceType) + "\",";
  json += "\"location\":\"" + String(deviceLocation) + "\",";
  json += "\"status\":\"online\",";
  json += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"signalStrength\":" + String(WiFi.RSSI()) + ",";
  json += "\"freeMemory\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"totalRecognitions\":" + String(totalRecognitions) + ",";
  json += "\"successfulRecognitions\":" + String(successfulRecognitions) + ",";
  json += "\"lastRecognizedStudent\":\"" + lastRecognizedStudent + "\",";
  json += "\"lastConfidence\":" + String(lastConfidence) + ",";
  json += "\"proximityMode\":" + (proximityMode ? "true" : "false") + ",";
  json += "\"motionDetected\":" + (motionDetected ? "true" : "false");
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("🔌 WebSocket client #%u disconnected\n", num);
      break;
      
    case WStype_CONNECTED:
      Serial.printf("🔌 WebSocket client #%u connected from %s\n", num, webSocket.remoteIP(num).toString().c_str());
      // Send welcome message
      webSocket.sendTXT(num, "{\"type\":\"connected\",\"message\":\"ESP32-CAM WebSocket connected\"}");
      break;
      
    case WStype_TEXT:
      Serial.printf("📨 WebSocket message from #%u: %s\n", num, payload);
      // Handle commands from client
      if (strcmp((char*)payload, "trigger_recognition") == 0) {
        performFaceRecognition();
      }
      break;
      
    default:
      break;
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(String(serverURL) + "/api/hardware/status-updates");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  String payload = "{";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"deviceType\":\"" + String(deviceType) + "\",";
  payload += "\"location\":\"" + String(deviceLocation) + "\",";
  payload += "\"status\":\"online\",";
  payload += "\"timestamp\":\"" + String(millis()) + "\",";
  payload += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  payload += "\"signalStrength\":" + String(WiFi.RSSI()) + ",";
  payload += "\"freeMemory\":" + String(ESP.getFreeHeap()) + ",";
  payload += "\"uptime\":" + String(millis() / 1000) + ",";
  payload += "\"totalRecognitions\":" + String(totalRecognitions) + ",";
  payload += "\"successfulRecognitions\":" + String(successfulRecognitions) + ",";
  payload += "\"lastRecognizedStudent\":\"" + lastRecognizedStudent + "\",";
  payload += "\"lastConfidence\":" + String(lastConfidence) + ",";
  payload += "\"proximityMode\":" + (proximityMode ? "true" : "false") + ",";
  payload += "\"motionDetected\":" + (motionDetected ? "true" : "false");
  payload += "}";
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    Serial.printf("💓 Heartbeat sent: HTTP %d\n", httpResponseCode);
  } else {
    Serial.printf("❌ Heartbeat failed: HTTP %d\n", httpResponseCode);
  }
  
  http.end();
}

void checkMotion() {
  // Read motion sensor (if connected to IO13)
  bool currentMotion = digitalRead(MOTION_SENSOR);
  
  // Read proximity sensor (if connected to IO15)
  bool proximityDetected = digitalRead(PROXIMITY_SENSOR);
  
  // Update motion state
  if (currentMotion || proximityDetected) {
    if (!motionDetected) {
      motionDetected = true;
      Serial.println("👁️ Motion/Proximity detected! Preparing for face recognition...");
      
      // Notify via WebSocket
      String wsMessage = "{\"type\":\"motion_detected\",\"timestamp\":\"" + String(millis()) + "\"}";
      webSocket.broadcastTXT(wsMessage);
      
      // Blink external LED to indicate motion
      for (int i = 0; i < 3; i++) {
        digitalWrite(EXTERNAL_LED, HIGH);
        delay(100);
        digitalWrite(EXTERNAL_LED, LOW);
        delay(100);
      }
    }
  } else {
    if (motionDetected) {
      Serial.println("👁️ Motion ended");
      motionDetected = false;
    }
  }
}

void performFaceRecognition() {
  if (recognitionInProgress) {
    Serial.println("🔄 Face recognition already in progress, skipping...");
    return;
  }
  
  recognitionInProgress = true;
  lastFaceRecognition = millis();
  totalRecognitions++;
  
  Serial.println();
  Serial.println("🔍 Starting face recognition...");
  
  // Visual indication - fast blinking LED
  for (int i = 0; i < 5; i++) {
    digitalWrite(STATUS_LED, HIGH);
    digitalWrite(EXTERNAL_LED, HIGH);
    delay(100);
    digitalWrite(STATUS_LED, LOW);
    digitalWrite(EXTERNAL_LED, LOW);
    delay(100);
  }
  
  // Turn on flash for better image quality
  digitalWrite(FLASH_LED, HIGH);
  delay(100);
  
  // Capture image
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture failed for face recognition");
    recognitionInProgress = false;
    digitalWrite(FLASH_LED, LOW);
    return;
  }
  
  Serial.printf("📸 Image captured: %d bytes, %dx%d\n", fb->len, fb->width, fb->height);
  
  // Turn off flash
  digitalWrite(FLASH_LED, LOW);
  
  // Send to Python backend for recognition
  bool success = sendImageForRecognition(fb);
  
  // Return frame buffer
  esp_camera_fb_return(fb);
  
  if (success) {
    Serial.println("✅ Face recognition completed successfully");
  } else {
    Serial.println("❌ Face recognition failed");
  }
  
  recognitionInProgress = false;
  setStatusLED(true); // Return to solid status
}

bool sendImageForRecognition(camera_fb_t* fb) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ No WiFi connection for face recognition");
    return false;
  }
  
  HTTPClient http;
  http.begin(String(pythonURL) + "/api/face/recognize");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000); // 10 second timeout for face recognition
  
  // Encode image to base64
  String base64Image = "data:image/jpeg;base64," + encodeBase64(fb->buf, fb->len);
  
  // Create JSON payload
  String payload = "{";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"timestamp\":\"" + String(millis()) + "\",";
  payload += "\"image\":\"" + base64Image + "\"";
  payload += "}";
  
  Serial.printf("📤 Sending image to Python backend: %s\n", pythonURL);
  Serial.printf("📊 Payload size: %d bytes\n", payload.length());
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("📥 Response HTTP %d: %s\n", httpResponseCode, response.c_str());
    
    if (httpResponseCode == 200) {
      // Parse JSON response
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, response);
      
      if (doc["success"].as<bool>()) {
        String studentId = doc["student_id"].as<String>();
        float confidence = doc["confidence"].as<float>();
        String studentName = doc["student_name"].as<String>();
        
        lastRecognizedStudent = studentName.length() > 0 ? studentName : studentId;
        lastConfidence = confidence;
        successfulRecognitions++;
        
        Serial.printf("🎉 RECOGNITION SUCCESS!\n");
        Serial.printf("👤 Student: %s (ID: %s)\n", studentName.c_str(), studentId.c_str());
        Serial.printf("📊 Confidence: %.2f%%\n", confidence * 100);
        
        // Update attendance
        updateAttendance(studentId, confidence);
        
        // Notify via WebSocket
        String wsMessage = "{";
        wsMessage += "\"type\":\"face_recognized\",";
        wsMessage += "\"studentId\":\"" + studentId + "\",";
        wsMessage += "\"studentName\":\"" + studentName + "\",";
        wsMessage += "\"confidence\":" + String(confidence) + ",";
        wsMessage += "\"timestamp\":\"" + String(millis()) + "\"";
        wsMessage += "}";
        webSocket.broadcastTXT(wsMessage);
        
        // Success indication - green LED
        for (int i = 0; i < 5; i++) {
          digitalWrite(EXTERNAL_LED, HIGH);
          delay(200);
          digitalWrite(EXTERNAL_LED, LOW);
          delay(200);
        }
        
        http.end();
        return true;
      } else {
        Serial.printf("❌ Recognition failed: %s\n", doc["message"].as<String>().c_str());
      }
    }
  } else {
    Serial.printf("❌ HTTP request failed: %d (%s)\n", httpResponseCode, http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
  return false;
}

void updateAttendance(String studentId, float confidence) {
  HTTPClient http;
  http.begin(String(serverURL) + "/api/attendance");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  String payload = "{";
  payload += "\"studentId\":\"" + studentId + "\",";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"method\":\"face_recognition\",";
  payload += "\"confidence\":" + String(confidence) + ",";
  payload += "\"timestamp\":\"" + String(millis()) + "\",";
  payload += "\"location\":\"" + String(deviceLocation) + "\"";
  payload += "}";
  
  Serial.printf("📝 Updating attendance for student: %s\n", studentId.c_str());
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    Serial.printf("✅ Attendance updated: HTTP %d\n", httpResponseCode);
  } else {
    Serial.printf("❌ Attendance update failed: HTTP %d\n", httpResponseCode);
  }
  
  http.end();
}

void blinkStatusLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED, LOW);
    delay(delayMs);
  }
}

void setStatusLED(bool state) {
  digitalWrite(STATUS_LED, state ? HIGH : LOW);
}

String encodeBase64(uint8_t* data, size_t length) {
  const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String encoded = "";
  
  int i = 0;
  unsigned char char_array_3[3];
  unsigned char char_array_4[4];
  
  while (i < length) {
    char_array_3[0] = data[i++];
    char_array_3[1] = (i < length) ? data[i++] : 0;
    char_array_3[2] = (i < length) ? data[i++] : 0;
    
    char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
    char_array_4[1] = ((char_array_3[0] & 0x03) << 4) + ((char_array_3[1] & 0xf0) >> 4);
    char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) + ((char_array_3[2] & 0xc0) >> 6);
    char_array_4[3] = char_array_3[2] & 0x3f;
    
    for (int j = 0; j < 4; j++) {
      if (i - 3 + j < length || j < 2) {
        encoded += base64_chars[char_array_4[j]];
      } else {
        encoded += '=';
      }
    }
  }
  
  return encoded;
}
