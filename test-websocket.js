// WebSocket Test Client for SmartTrack Backend
// This tests if the WebSocket server on port 8080 is working with RFID device protocol

import WebSocket from "ws";

console.log("🔌 Testing RFID WebSocket connection to 192.168.8.110:8080/rfid");

const ws = new WebSocket("ws://192.168.8.110:8080/rfid", {
  headers: {
    "User-Agent": "ESP8266-NodeMCU-RFID-Device/2.2.0",
  },
});

ws.on("open", function open() {
  console.log("✅ WebSocket connected successfully!");

  // Send test device registration
  const testMessage = {
    type: "device_register",
    deviceId: "TEST_DEVICE_001",
    deviceType: "RFID_READER",
    version: "test_v2.2.0",
    capabilities: "rfid_read,led_feedback,buzzer_alert",
    timestamp: Date.now(),
    ip: "192.168.8.100",
    mac: "AA:BB:CC:DD:EE:FF",
    rssi: -45,
  };

  console.log("📤 Sending test registration:", testMessage);
  ws.send(JSON.stringify(testMessage));

  // Wait a bit then send test card detection
  setTimeout(() => {
    const cardMessage = {
      type: "rfid_card_detected",
      deviceId: "TEST_DEVICE_001",
      cardId: "1234ABCD",
      cardType: "RFID",
      timestamp: Date.now(),
      readCount: 1,
      rssi: -45,
    };

    console.log("📤 Sending test card detection:", cardMessage);
    ws.send(JSON.stringify(cardMessage));
  }, 2000);
});

ws.on("message", function message(data) {
  console.log("📨 Received:", data.toString());
});

ws.on("error", function error(err) {
  console.error("❌ WebSocket error:", err.message);
});

ws.on("close", function close() {
  console.log("🔌 WebSocket connection closed");
});

// Close after 15 seconds
setTimeout(() => {
  console.log("⏰ Closing test connection...");
  ws.close();
  process.exit(0);
}, 15000);
