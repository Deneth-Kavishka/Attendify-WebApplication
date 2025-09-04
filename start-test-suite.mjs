#!/usr/bin/env node

/**
 * SmartTrack WebSocket Testing & Startup Script
 * Starts all services and runs integration tests
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SmartTrackTestSuite {
  constructor() {
    this.processes = {};
    this.testResults = {};
  }

  async start() {
    console.log("🚀 SmartTrack WebSocket Test Suite Starting...");
    console.log("=".repeat(60));

    try {
      // Step 1: Check prerequisites
      await this.checkPrerequisites();

      // Step 2: Start backend services
      await this.startBackendServices();

      // Step 3: Wait for services to initialize
      await this.waitForServices();

      // Step 4: Run integration tests
      await this.runIntegrationTests();

      // Step 5: Show results and next steps
      this.showResults();
    } catch (error) {
      console.error("❌ Test suite failed:", error);
      await this.cleanup();
    }
  }

  async checkPrerequisites() {
    console.log("🔍 Checking prerequisites...");

    const requiredFiles = [
      "package.json",
      "server/index.ts",
      "server/smarttrack-websocket-service.ts",
      "python_backend/app.py",
      "test-websocket-integration.js",
    ];

    for (const file of requiredFiles) {
      const filePath = join(__dirname, file);
      if (!existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    console.log("✅ All required files found");
  }

  async startBackendServices() {
    console.log("🔧 Starting backend services...");

    // Start Node.js backend
    console.log("📡 Starting Node.js WebSocket server...");
    this.processes.nodeServer = spawn("npm", ["run", "dev:server"], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    this.processes.nodeServer.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`[Node Server] ${output.trim()}`);
    });

    this.processes.nodeServer.stderr.on("data", (data) => {
      const output = data.toString();
      if (!output.includes("warn")) {
        console.log(`[Node Server Error] ${output.trim()}`);
      }
    });

    // Start Python Face Recognition service
    console.log("🐍 Starting Python Face Recognition service...");
    this.processes.pythonServer = spawn("python", ["python_backend/app.py"], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    this.processes.pythonServer.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`[Python Server] ${output.trim()}`);
    });

    this.processes.pythonServer.stderr.on("data", (data) => {
      const output = data.toString();
      if (!output.includes("warn")) {
        console.log(`[Python Server Error] ${output.trim()}`);
      }
    });

    console.log("⏳ Services starting...");
  }

  async waitForServices() {
    console.log("⏱️ Waiting for services to initialize...");

    const maxWait = 30000; // 30 seconds
    const checkInterval = 2000; // 2 seconds
    let waited = 0;

    while (waited < maxWait) {
      try {
        // Check if Node.js server is ready
        const nodeReady = await this.checkPort(8080);
        const pythonReady = await this.checkPort(8000);

        if (nodeReady && pythonReady) {
          console.log("✅ All services are ready!");
          return;
        }

        console.log(
          `⏳ Services initializing... (${waited / 1000}s/${maxWait / 1000}s)`
        );
        await this.sleep(checkInterval);
        waited += checkInterval;
      } catch (error) {
        console.log(`⏳ Still waiting... (${waited / 1000}s)`);
        await this.sleep(checkInterval);
        waited += checkInterval;
      }
    }

    throw new Error("Services failed to start within timeout period");
  }

  async checkPort(port) {
    return new Promise((resolve) => {
      const net = require("net");
      const socket = new net.Socket();

      socket.setTimeout(1000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        resolve(false);
      });

      socket.connect(port, "localhost");
    });
  }

  async runIntegrationTests() {
    console.log("🧪 Running WebSocket integration tests...");

    try {
      // Import and run the integration test
      const WebSocketIntegrationTest = (
        await import("./test-websocket-integration.js")
      ).default;
      const tester = new WebSocketIntegrationTest();
      await tester.runAllTests();

      this.testResults = tester.results;
      console.log("✅ Integration tests completed");
    } catch (error) {
      console.error("❌ Integration tests failed:", error);
      this.testResults = { error: error.message };
    }
  }

  showResults() {
    console.log("\n🏁 SmartTrack WebSocket Test Suite Results:");
    console.log("=".repeat(60));

    if (this.testResults.error) {
      console.log("❌ Tests failed to run:", this.testResults.error);
      return;
    }

    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(
      (r) => r.status === "success"
    ).length;

    console.log(`📊 Test Summary: ${passedTests}/${totalTests} passed`);

    console.log("\n📋 Next Steps:");
    if (passedTests === totalTests) {
      console.log("✅ All WebSocket services are working correctly!");
      console.log("");
      console.log("🔌 You can now:");
      console.log("   1. Upload the NodeMCU code to your ESP8266 device");
      console.log("   2. Open the frontend client to test RFID registration");
      console.log("   3. Monitor WebSocket connections in the admin dashboard");
      console.log("");
      console.log("📡 WebSocket Endpoints Available:");
      console.log("   • Main WebSocket: ws://localhost:8080");
      console.log("   • RFID Protocol: ws://localhost:8080/rfid");
      console.log("   • Face Recognition: http://localhost:8000 (Socket.IO)");
    } else {
      console.log("⚠️  Some services need attention:");
      Object.entries(this.testResults).forEach(([test, result]) => {
        if (result.status === "failed") {
          console.log(`   ❌ ${test}: ${result.details}`);
        }
      });
    }

    console.log("\n🛑 To stop services, press Ctrl+C");
  }

  async cleanup() {
    console.log("🧹 Cleaning up processes...");

    Object.values(this.processes).forEach((process) => {
      if (process && !process.killed) {
        process.kill();
      }
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  process.exit(0);
});

// Start the test suite
if (require.main === module) {
  const testSuite = new SmartTrackTestSuite();
  testSuite.start();
}

export default SmartTrackTestSuite;
