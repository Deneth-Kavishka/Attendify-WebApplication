/*
 * ESP32-CAM SIMPLIFIED DEBUG VERSION
 * Minimal setup for troubleshooting WiFi connectivity
 * 
 * Use this version to diagnose connection issues
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

// Pin definitions
#define FLASH_LED 4       
#define STATUS_LED 33    
#define CAPTURE_BUTTON 0  

// Network configuration - UPDATE THESE!
const char* ssid = "Dialog 4G 588";
const char* password = "83EF36AA";
const char* serverURL = "http://192.168.8.110:5000";

// Device configuration
const char* deviceId = "ESP32_CAM_001";
const char* deviceLocation = "Room A101";

// Simple timing
unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 5000; // 5 seconds

// Camera configuration
camera_config_t config;
WebServer server(80);

// Simple function declarations
bool initCamera();
void connectToWiFi();
void sendSimpleHeartbeat();
void handleRoot();
void handleStream();
void blinkLED(int count);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=== ESP32-CAM SIMPLIFIED DEBUG ===");
  Serial.println("Checking each step individually...");
  
  // Initialize pins
  pinMode(FLASH_LED, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  pinMode(CAPTURE_BUTTON, INPUT_PULLUP);
  
  digitalWrite(FLASH_LED, LOW);
  digitalWrite(STATUS_LED, LOW);
  
  // Step 1: Camera
  Serial.println();
  Serial.println("STEP 1: Camera Initialization");
  Serial.println("-------------------------------");
  
  if (initCamera()) {
    Serial.println("✅ Camera: OK");
    blinkLED(2); // 2 blinks = camera OK
  } else {
    Serial.println("❌ Camera: FAILED");
    while (1) {
      blinkLED(1);
      delay(1000);
    }
  }
  
  // Step 2: WiFi
  Serial.println();
  Serial.println("STEP 2: WiFi Connection");
  Serial.println("------------------------");
  connectToWiFi();
  
  // Step 3: Web Server
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("STEP 3: Web Server");
    Serial.println("-------------------");
    
    server.on("/", handleRoot);
    server.on("/stream", handleStream);
    server.begin();
    
    Serial.println("✅ Web Server: Started");
    Serial.printf("📺 Stream URL: http://%s/stream\n", WiFi.localIP().toString().c_str());
    Serial.printf("🌐 Web Interface: http://%s/\n", WiFi.localIP().toString().c_str());
    
    blinkLED(5); // 5 blinks = all systems OK
  }
  
  Serial.println();
  Serial.println("=== SETUP COMPLETE ===");
  Serial.println("Starting main loop...");
}

void loop() {
  // Check WiFi status
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected! Attempting reconnection...");
    connectToWiFi();
  }
  
  // Simple heartbeat every 5 seconds
  if (millis() - lastHeartbeat > heartbeatInterval) {
    sendSimpleHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Handle web requests
  server.handleClient();
  
  // Manual trigger via button
  if (digitalRead(CAPTURE_BUTTON) == LOW) {
    delay(50);
    if (digitalRead(CAPTURE_BUTTON) == LOW) {
      Serial.println("🔴 BUTTON PRESSED - System is responsive!");
      blinkLED(3);
      delay(1000);
    }
  }
  
  delay(100);
}

bool initCamera() {
  // Simple camera configuration
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
  
  // Conservative settings
  config.frame_size = FRAMESIZE_VGA; // 640x480
  config.jpeg_quality = 15;          // Lower quality = smaller size
  config.fb_count = 1;               // Single buffer
  
  Serial.printf("📷 Attempting camera init...\n");
  Serial.printf("📊 Free heap before: %d bytes\n", ESP.getFreeHeap());
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed: 0x%x (%s)\n", err, esp_err_to_name(err));
    return false;
  }
  
  Serial.printf("📊 Free heap after: %d bytes\n", ESP.getFreeHeap());
  
  // Test capture
  Serial.println("📷 Testing camera capture...");
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Test capture failed");
    return false;
  }
  
  Serial.printf("✅ Test capture OK: %d bytes\n", fb->len);
  esp_camera_fb_return(fb);
  
  return true;
}

void connectToWiFi() {
  Serial.printf("📶 Connecting to WiFi: %s\n", ssid);
  Serial.printf("🔑 Password length: %d characters\n", strlen(password));
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) { // 60 seconds max
    delay(1000);
    attempts++;
    
    // Show progress
    if (attempts % 5 == 0) {
      Serial.printf("📶 Attempt %d/60 - Status: %d\n", attempts, WiFi.status());
    }
    
    // Blink LED to show activity
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi Connected Successfully!");
    Serial.printf("📍 IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("📊 RSSI: %d dBm\n", WiFi.RSSI());
    Serial.printf("🌐 Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("🔗 Subnet: %s\n", WiFi.subnetMask().toString().c_str());
    Serial.printf("📡 MAC: %s\n", WiFi.macAddress().c_str());
    
    digitalWrite(STATUS_LED, HIGH); // Solid on = connected
  } else {
    Serial.println();
    Serial.printf("❌ WiFi Connection Failed! Status: %d\n", WiFi.status());
    Serial.println("   Status codes:");
    Serial.println("   0 = WL_IDLE_STATUS");
    Serial.println("   1 = WL_NO_SSID_AVAIL");
    Serial.println("   2 = WL_SCAN_COMPLETED");
    Serial.println("   3 = WL_CONNECTED");
    Serial.println("   4 = WL_CONNECT_FAILED");
    Serial.println("   5 = WL_CONNECTION_LOST");
    Serial.println("   6 = WL_DISCONNECTED");
    
    digitalWrite(STATUS_LED, LOW); // Off = not connected
  }
}

void sendSimpleHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📶 No WiFi - skipping heartbeat");
    return;
  }
  
  HTTPClient http;
  http.begin(String(serverURL) + "/api/hardware/status-updates");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000); // 5 second timeout
  
  // Simple heartbeat JSON
  String payload = "{";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"status\":\"online\",";
  payload += "\"timestamp\":\"" + String(millis()) + "\",";
  payload += "\"ipAddress\":\"" + WiFi.localIP().toString() + "\",";
  payload += "\"signalStrength\":" + String(WiFi.RSSI()) + ",";
  payload += "\"freeMemory\":" + String(ESP.getFreeHeap()) + ",";
  payload += "\"uptime\":" + String(millis() / 1000);
  payload += "}";
  
  Serial.printf("💓 Sending heartbeat to: %s\n", serverURL);
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    Serial.printf("✅ Heartbeat OK: HTTP %d\n", httpResponseCode);
  } else {
    Serial.printf("❌ Heartbeat Failed: HTTP %d (%s)\n", 
                  httpResponseCode, http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>ESP32-CAM Debug</title>";
  html += "<style>body{font-family:Arial;padding:20px;background:#f0f0f0}";
  html += ".card{background:white;padding:20px;margin:10px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}";
  html += ".green{color:#28a745} .red{color:#dc3545} .blue{color:#007bff}";
  html += "button{background:#007bff;color:white;border:none;padding:10px 15px;border-radius:4px;margin:5px}</style></head>";
  
  html += "<body><h1 class='blue'>🔧 ESP32-CAM Simple Debug</h1>";
  
  html += "<div class='card'>";
  html += "<h2>📊 System Status</h2>";
  html += "<p><strong>Device ID:</strong> " + String(deviceId) + "</p>";
  html += "<p><strong>WiFi Status:</strong> ";
  if (WiFi.status() == WL_CONNECTED) {
    html += "<span class='green'>✅ Connected</span></p>";
    html += "<p><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</p>";
    html += "<p><strong>Signal Strength:</strong> " + String(WiFi.RSSI()) + " dBm</p>";
  } else {
    html += "<span class='red'>❌ Disconnected</span></p>";
  }
  html += "<p><strong>Free Memory:</strong> " + String(ESP.getFreeHeap()) + " bytes</p>";
  html += "<p><strong>Uptime:</strong> " + String(millis() / 1000) + " seconds</p>";
  html += "</div>";
  
  html += "<div class='card'>";
  html += "<h2>🎮 Controls</h2>";
  html += "<button onclick=\"location.href='/stream'\">📹 View Camera Stream</button>";
  html += "<button onclick=\"location.reload()\">🔄 Refresh Status</button>";
  html += "</div>";
  
  html += "<div class='card'>";
  html += "<h2>🔗 URLs for Integration</h2>";
  html += "<p><strong>Stream URL:</strong> http://" + WiFi.localIP().toString() + "/stream</p>";
  html += "<p><strong>Web Interface:</strong> http://" + WiFi.localIP().toString() + "/</p>";
  html += "</div>";
  
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleStream() {
  Serial.println("📺 Stream requested");
  
  // Set CORS headers for cross-origin access
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  WiFiClient client = server.client();
  
  // Send MJPEG headers
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  server.sendContent(response);
  
  Serial.println("📺 Streaming started...");
  
  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("❌ Camera capture failed during stream");
      break;
    }
    
    // Send frame
    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    
    esp_camera_fb_return(fb);
    delay(100); // ~10 FPS
  }
  
  Serial.println("📺 Streaming ended");
}

void blinkLED(int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(200);
    digitalWrite(STATUS_LED, LOW);
    delay(200);
  }
}
