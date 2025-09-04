/**
 * Simple WebSocket Test Server for NodeMCU Testing
 */

import { WebSocketServer } from "ws";

const port = 8080;

console.log(`🔧 Starting Simple WebSocket Test Server on port ${port}...`);

const wss = new WebSocketServer({ port });

wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "";
  const url = req.url || "";

  console.log(`🔌 New WebSocket connection from ${clientIP}`);
  console.log(`   User-Agent: ${userAgent}`);
  console.log(`   URL: ${url}`);

  // Check if it's an RFID device
  const isRFIDDevice =
    userAgent.includes("ESP8266") ||
    userAgent.includes("ESP32") ||
    userAgent.includes("NodeMCU") ||
    url.includes("rfid");

  if (isRFIDDevice) {
    console.log(`📱 RFID Device detected!`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "welcome",
        message: "Connected to SmartTrack Test Server",
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    console.log(`💻 Regular client connected`);

    ws.send(
      JSON.stringify({
        type: "welcome",
        message: "Connected to Test Server",
        timestamp: new Date().toISOString(),
      })
    );
  }

  // Handle messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received message:`, message);

      // Handle device registration
      if (message.type === "device_register") {
        console.log(`📝 Device registration: ${message.deviceId}`);

        ws.send(
          JSON.stringify({
            type: "registration_success",
            message: "Device registered successfully",
            deviceId: message.deviceId,
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Handle RFID card detection
      if (message.type === "rfid_card_detected") {
        console.log(`🏷️ RFID card detected: ${message.cardId}`);

        // Send test response
        ws.send(
          JSON.stringify({
            type: "card_response",
            cardId: message.cardId,
            status: "success",
            studentName: "Test Student",
            className: "Test Class",
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Handle heartbeat
      if (message.type === "rfid_heartbeat") {
        console.log(`💓 Heartbeat from ${message.deviceId}`);
      }
    } catch (error) {
      console.error(`❌ Message parse error:`, error);
    }
  });

  // Handle disconnection
  ws.on("close", () => {
    console.log(`🔌 Client disconnected from ${clientIP}`);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`❌ WebSocket error from ${clientIP}:`, error);
  });
});

console.log(`✅ Simple WebSocket Test Server running on port ${port}`);
console.log(`📡 NodeMCU should connect to: ws://192.168.8.110:${port}/rfid`);
console.log(`🔍 Watching for RFID device connections...`);
