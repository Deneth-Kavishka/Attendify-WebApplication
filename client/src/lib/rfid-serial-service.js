import { io } from "socket.io-client";

/**
 * RFID Serial Communication Service
 * Connects to the SmartTrack RFID WebSocket server for serial communication
 */
class RFIDSerialService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isScanning = false;
    this.scanCallback = null;
    this.errorCallback = null;
    this.statusCallback = null;
    this.scanTimeout = null;
    this.SCAN_TIMEOUT = 30000; // 30 seconds timeout
  }

  // Connect to RFID WebSocket server
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io("http://localhost:5001", {
          transports: ["websocket", "polling"],
          timeout: 5000,
        });

        this.socket.on("connect", () => {
          console.log("🔗 Connected to RFID Serial Service");
          this.isConnected = true;
          this.setupEventHandlers();
          resolve(true);
        });

        this.socket.on("disconnect", () => {
          console.log("🔌 Disconnected from RFID Serial Service");
          this.isConnected = false;
          if (this.statusCallback) {
            this.statusCallback("disconnected");
          }
        });

        this.socket.on("connect_error", (error) => {
          console.error("❌ RFID service connection failed:", error);
          this.isConnected = false;
          reject(new Error("Failed to connect to RFID service"));
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("Connection timeout"));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Setup event handlers for RFID scanning
  setupEventHandlers() {
    if (!this.socket) return;

    // Handle successful RFID scans
    this.socket.on("rfid_scan_result", (data) => {
      console.log("🎯 RFID scan result:", data);

      if (this.isScanning && this.scanCallback) {
        this.clearScanTimeout();
        this.isScanning = false;
        this.scanCallback({
          success: true,
          cardId: data.rfidCard,
          studentName: data.studentName,
          studentId: data.studentId,
          department: data.department,
          isRegistered: data.isRegistered || false,
        });
      }
    });

    // Handle unknown/unregistered cards during registration
    this.socket.on("unknown_card", (data) => {
      console.log("🆔 Unknown card detected for registration:", data);

      if (this.isScanning && this.scanCallback) {
        this.clearScanTimeout();
        this.isScanning = false;
        this.scanCallback({
          success: true,
          cardId: data.rfidCard,
          isRegistered: false,
          timestamp: data.timestamp,
          deviceId: data.deviceId,
        });
      }
    });

    // Handle general RFID attendance events (for info)
    this.socket.on("rfid_attendance", (data) => {
      console.log("📋 RFID attendance event:", data);

      if (this.isScanning && this.scanCallback) {
        this.clearScanTimeout();
        this.isScanning = false;
        this.scanCallback({
          success: true,
          cardId: data.rfidCard,
          studentName: data.studentName,
          studentId: data.studentId,
          department: data.department,
          isRegistered: true,
        });
      }
    });
  }

  // Start RFID scanning for registration
  startScan(options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("Not connected to RFID service"));
        return;
      }

      if (this.isScanning) {
        reject(new Error("Scan already in progress"));
        return;
      }

      this.isScanning = true;
      this.scanCallback = resolve;
      this.errorCallback = reject;

      // Notify server to start registration scan mode
      this.socket.emit("start_registration_scan", {
        mode: "registration",
        timeout: this.SCAN_TIMEOUT,
        ...options,
      });

      // Set scan timeout
      this.scanTimeout = setTimeout(() => {
        this.stopScan();
        reject(new Error("Scan timeout - no card detected within 30 seconds"));
      }, this.SCAN_TIMEOUT);

      console.log(
        "🔍 RFID registration scan started - present card to scanner"
      );
    });
  }

  // Stop RFID scanning
  stopScan() {
    if (this.socket && this.isScanning) {
      this.socket.emit("stop_registration_scan");
    }

    this.clearScanTimeout();
    this.isScanning = false;
    this.scanCallback = null;
    this.errorCallback = null;

    console.log("🛑 RFID scanning stopped");
  }

  // Clear scan timeout
  clearScanTimeout() {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
  }

  // Check if a card is already registered
  async checkCardAvailability(cardId) {
    try {
      const response = await fetch(
        `http://localhost:5001/api/rfid/check/${cardId}`
      );
      const result = await response.json();

      return {
        available: result.available || false,
        assignedTo: result.assignedTo || null,
        studentId: result.studentId || null,
      };
    } catch (error) {
      console.error("Error checking card availability:", error);
      throw new Error("Failed to check card availability");
    }
  }

  // Test connection to RFID service
  async testConnection() {
    try {
      const response = await fetch("http://localhost:5001/api/health");
      const result = await response.json();
      return result.status === "healthy";
    } catch (error) {
      return false;
    }
  }

  // Get RFID service status
  getStatus() {
    return {
      connected: this.isConnected,
      scanning: this.isScanning,
      serviceUrl: "http://localhost:5001",
    };
  }

  // Disconnect from service
  disconnect() {
    if (this.socket) {
      this.stopScan();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  // Set status callback for connection updates
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }
}

// Export the class and create singleton instance
export { RFIDSerialService };

// Create singleton instance
const rfidSerialService = new RFIDSerialService();

export default rfidSerialService;
