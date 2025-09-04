/**
 * WebSocket Integration Test for SmartTrack
 * Tests all WebSocket connections and protocols
 */

import WebSocket from "ws";
import { io } from "socket.io-client";

class WebSocketIntegrationTest {
  constructor() {
    this.results = {
      mainWebSocket: { status: "pending", details: null },
      rfidProtocol: { status: "pending", details: null },
      faceRecognition: { status: "pending", details: null },
      clientSubscription: { status: "pending", details: null },
    };
  }

  async runAllTests() {
    console.log("🧪 Starting SmartTrack WebSocket Integration Tests...");
    console.log("=" * 60);

    try {
      await Promise.all([
        this.testMainWebSocketConnection(),
        this.testRFIDProtocol(),
        this.testFaceRecognitionSocket(),
        this.testClientSubscription(),
      ]);

      this.printResults();
    } catch (error) {
      console.error("❌ Test suite failed:", error);
    }
  }

  /**
   * Test 1: Main WebSocket Connection (port 8080)
   */
  async testMainWebSocketConnection() {
    return new Promise((resolve) => {
      console.log("🔌 Testing main WebSocket connection (port 8080)...");

      const ws = new WebSocket("ws://localhost:8080");
      const timeout = setTimeout(() => {
        this.results.mainWebSocket = {
          status: "failed",
          details: "Connection timeout",
        };
        ws.close();
        resolve();
      }, 10000);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.results.mainWebSocket = {
          status: "success",
          details: "Connected successfully",
        };
        console.log("✅ Main WebSocket connection successful");
        ws.close();
        resolve();
      });

      ws.on("error", (error) => {
        clearTimeout(timeout);
        this.results.mainWebSocket = {
          status: "failed",
          details: error.message,
        };
        console.log("❌ Main WebSocket connection failed:", error.message);
        resolve();
      });
    });
  }

  /**
   * Test 2: RFID Protocol Test
   */
  async testRFIDProtocol() {
    return new Promise((resolve) => {
      console.log("🏷️ Testing RFID protocol...");

      const ws = new WebSocket("ws://localhost:8080/rfid", {
        headers: {
          "User-Agent": "ESP8266-NodeMCU-RFID-Device/2.2.0-TEST",
        },
      });

      const timeout = setTimeout(() => {
        this.results.rfidProtocol = {
          status: "failed",
          details: "Protocol test timeout",
        };
        ws.close();
        resolve();
      }, 15000);

      let welcomeReceived = false;
      let registrationConfirmed = false;

      ws.on("open", () => {
        console.log("🔗 RFID WebSocket connected, testing protocol...");

        // Send device registration
        ws.send(
          JSON.stringify({
            type: "device_register",
            deviceId: "TEST_RFID_001",
            deviceType: "RFID_READER",
            version: "test_v2.2.0",
            capabilities: "rfid_read,led_feedback,buzzer_alert",
            timestamp: Date.now(),
            ip: "192.168.8.100",
            mac: "AA:BB:CC:DD:EE:FF",
            rssi: -45,
          })
        );
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 RFID Protocol - Received: ${message.type}`);

          if (message.type === "welcome") {
            welcomeReceived = true;
            console.log("✅ Welcome message received");
          }

          if (message.type === "registration_success") {
            registrationConfirmed = true;
            console.log("✅ Registration confirmed");

            // Test card detection
            setTimeout(() => {
              ws.send(
                JSON.stringify({
                  type: "rfid_card_detected",
                  deviceId: "TEST_RFID_001",
                  cardId: "1234ABCD",
                  cardType: "RFID",
                  timestamp: Date.now(),
                  readCount: 1,
                  rssi: -45,
                })
              );
            }, 1000);
          }

          // Check if all tests passed
          if (welcomeReceived && registrationConfirmed) {
            clearTimeout(timeout);
            this.results.rfidProtocol = {
              status: "success",
              details: "All RFID protocol tests passed",
            };
            console.log("✅ RFID protocol test successful");
            ws.close();
            resolve();
          }
        } catch (error) {
          console.error("❌ RFID protocol message parse error:", error);
        }
      });

      ws.on("error", (error) => {
        clearTimeout(timeout);
        this.results.rfidProtocol = {
          status: "failed",
          details: error.message,
        };
        console.log("❌ RFID protocol test failed:", error.message);
        resolve();
      });
    });
  }

  /**
   * Test 3: Face Recognition Socket.IO Test
   */
  async testFaceRecognitionSocket() {
    return new Promise((resolve) => {
      console.log("👤 Testing Face Recognition Socket.IO (port 8000)...");

      const socket = io("http://localhost:8000", {
        timeout: 10000,
      });

      const timeout = setTimeout(() => {
        this.results.faceRecognition = {
          status: "failed",
          details: "Face Recognition service timeout",
        };
        socket.disconnect();
        resolve();
      }, 15000);

      socket.on("connect", () => {
        console.log("✅ Face Recognition Socket.IO connected");

        // Request stats
        socket.emit("get_stats");
      });

      socket.on("connected", (data) => {
        console.log("✅ Face Recognition service ready:", data.message);
      });

      socket.on("stats_update", (data) => {
        clearTimeout(timeout);
        this.results.faceRecognition = {
          status: "success",
          details: `Service active with ${
            data.enrolled_students || 0
          } students`,
        };
        console.log("✅ Face Recognition stats received");
        socket.disconnect();
        resolve();
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        this.results.faceRecognition = {
          status: "failed",
          details: error.message,
        };
        console.log("❌ Face Recognition connection failed:", error.message);
        resolve();
      });
    });
  }

  /**
   * Test 4: Client Subscription Test
   */
  async testClientSubscription() {
    return new Promise((resolve) => {
      console.log("📱 Testing client subscription features...");

      const ws = new WebSocket("ws://localhost:8080");
      const timeout = setTimeout(() => {
        this.results.clientSubscription = {
          status: "failed",
          details: "Client subscription timeout",
        };
        ws.close();
        resolve();
      }, 15000);

      let welcomeReceived = false;
      let subscriptionConfirmed = false;

      ws.on("open", () => {
        console.log("🔗 Client WebSocket connected, testing subscriptions...");

        // Subscribe to RFID events
        ws.send(
          JSON.stringify({
            type: "subscribe_rfid",
            component: "integration_test",
          })
        );
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 Client - Received: ${message.type}`);

          if (message.type === "welcome") {
            welcomeReceived = true;
            console.log("✅ Client welcome message received");
          }

          if (message.type === "rfid_subscription_confirmed") {
            subscriptionConfirmed = true;
            console.log("✅ RFID subscription confirmed");
          }

          // Check if all tests passed
          if (welcomeReceived && subscriptionConfirmed) {
            clearTimeout(timeout);
            this.results.clientSubscription = {
              status: "success",
              details: "Client subscription features working",
            };
            console.log("✅ Client subscription test successful");
            ws.close();
            resolve();
          }
        } catch (error) {
          console.error("❌ Client message parse error:", error);
        }
      });

      ws.on("error", (error) => {
        clearTimeout(timeout);
        this.results.clientSubscription = {
          status: "failed",
          details: error.message,
        };
        console.log("❌ Client subscription test failed:", error.message);
        resolve();
      });
    });
  }

  /**
   * Print test results
   */
  printResults() {
    console.log("\n🧪 WebSocket Integration Test Results:");
    console.log("=" * 60);

    Object.entries(this.results).forEach(([testName, result]) => {
      const status =
        result.status === "success"
          ? "✅"
          : result.status === "failed"
          ? "❌"
          : "⏳";
      console.log(`${status} ${testName}: ${result.status.toUpperCase()}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    });

    const totalTests = Object.keys(this.results).length;
    const passedTests = Object.values(this.results).filter(
      (r) => r.status === "success"
    ).length;
    const failedTests = Object.values(this.results).filter(
      (r) => r.status === "failed"
    ).length;

    console.log("\n📊 Summary:");
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(
      `   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`
    );

    if (passedTests === totalTests) {
      console.log("\n🎉 All WebSocket services are working correctly!");
    } else {
      console.log("\n⚠️  Some WebSocket services need attention.");
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new WebSocketIntegrationTest();
  tester.runAllTests();
}

export default WebSocketIntegrationTest;
