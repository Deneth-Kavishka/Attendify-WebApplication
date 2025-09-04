/**
 * SmartTrack WebSocket Services Integration
 * Centralizes all WebSocket connections for the application
 *
 * Services:
 * 1. Main WebSocket Server (port 8080) - RFID events, real-time updates
 * 2. Python Face Recognition (port 8000) - Socket.IO for ESP32-CAM
 * 3. Hardware Device Communication - Direct device connections
 */

import { io } from "socket.io-client";

class SmartTrackWebSocketManager {
  constructor() {
    this.connections = {
      main: null, // Main WebSocket server (port 8080)
      faceRecognition: null, // Socket.IO to Python backend (port 8000)
      rfidDevices: new Map(), // Direct RFID device connections
    };

    this.subscriptions = new Map();
    this.reconnectAttempts = {
      main: 0,
      faceRecognition: 0,
    };

    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  /**
   * Initialize all WebSocket connections
   */
  async initialize() {
    console.log("🔌 Initializing SmartTrack WebSocket connections...");

    try {
      await Promise.all([
        this.connectMainWebSocket(),
        this.connectFaceRecognitionSocket(),
      ]);

      console.log("✅ All WebSocket connections established");
      return true;
    } catch (error) {
      console.error("❌ WebSocket initialization failed:", error);
      return false;
    }
  }

  /**
   * Connect to main WebSocket server (RFID service, real-time updates)
   */
  async connectMainWebSocket() {
    try {
      const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:8080";
      this.connections.main = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        this.connections.main.onopen = () => {
          console.log("🔗 Main WebSocket connected (port 8080)");
          this.reconnectAttempts.main = 0;

          // Subscribe to all RFID events
          this.send("main", {
            type: "subscribe_rfid",
            component: "websocket_manager",
          });

          resolve();
        };

        this.connections.main.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMainMessage(data);
          } catch (error) {
            console.error("Main WebSocket message parse error:", error);
          }
        };

        this.connections.main.onclose = () => {
          console.log("🔌 Main WebSocket disconnected");
          this.handleMainReconnect();
        };

        this.connections.main.onerror = (error) => {
          console.error("❌ Main WebSocket error:", error);
          reject(error);
        };

        // Timeout after 10 seconds
        setTimeout(
          () => reject(new Error("Main WebSocket connection timeout")),
          10000
        );
      });
    } catch (error) {
      console.error("Main WebSocket connection failed:", error);
      throw error;
    }
  }

  /**
   * Connect to Python Face Recognition service (Socket.IO)
   */
  async connectFaceRecognitionSocket() {
    try {
      const socketUrl =
        process.env.REACT_APP_FACE_RECOGNITION_URL || "http://localhost:8000";
      this.connections.faceRecognition = io(socketUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });

      return new Promise((resolve, reject) => {
        this.connections.faceRecognition.on("connect", () => {
          console.log("🔗 Face Recognition Socket.IO connected (port 8000)");
          this.reconnectAttempts.faceRecognition = 0;
          resolve();
        });

        this.connections.faceRecognition.on("connected", (data) => {
          console.log("📡 Face Recognition service ready:", data.message);
        });

        this.connections.faceRecognition.on("face_recognized", (data) => {
          this.handleFaceRecognitionMessage(data);
        });

        this.connections.faceRecognition.on("stats_update", (data) => {
          this.broadcast("face_recognition_stats", data);
        });

        this.connections.faceRecognition.on("disconnect", () => {
          console.log("🔌 Face Recognition Socket.IO disconnected");
        });

        this.connections.faceRecognition.on("connect_error", (error) => {
          console.error("❌ Face Recognition Socket.IO error:", error);
          reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(
          () =>
            reject(new Error("Face Recognition Socket.IO connection timeout")),
          10000
        );
      });
    } catch (error) {
      console.error("Face Recognition Socket.IO connection failed:", error);
      throw error;
    }
  }

  /**
   * Handle messages from main WebSocket server
   */
  handleMainMessage(data) {
    switch (data.type) {
      case "welcome":
        console.log("🔗 Main server welcome:", data.message);
        break;

      case "rfid_subscription_confirmed":
        console.log("✅ RFID subscription confirmed");
        break;

      case "rfid_card_detected":
        console.log("🏷️ Card detected:", data.cardId);
        this.broadcast("rfid_card_detected", data);
        break;

      case "rfid_status":
        console.log("📡 RFID status:", data.status);
        this.broadcast("rfid_status", data);
        break;

      case "device_register":
        console.log("📝 Device registered:", data.deviceId);
        this.broadcast("device_register", data);
        break;

      case "rfid_heartbeat":
        this.broadcast("rfid_heartbeat", data);
        break;

      default:
        console.log("📡 Main WebSocket message:", data);
        this.broadcast("main_message", data);
    }
  }

  /**
   * Handle messages from Face Recognition service
   */
  handleFaceRecognitionMessage(data) {
    console.log("👤 Face recognized:", data);
    this.broadcast("face_recognized", data);
  }

  /**
   * Handle main WebSocket reconnection
   */
  handleMainReconnect() {
    if (this.reconnectAttempts.main < this.maxReconnectAttempts) {
      this.reconnectAttempts.main++;
      console.log(
        `🔄 Main WebSocket reconnection attempt ${this.reconnectAttempts.main}`
      );

      setTimeout(() => {
        this.connectMainWebSocket().catch((error) => {
          console.error("Main WebSocket reconnection failed:", error);
        });
      }, this.reconnectDelay * this.reconnectAttempts.main);
    } else {
      console.error("❌ Main WebSocket max reconnection attempts reached");
    }
  }

  /**
   * Send message to specific connection
   */
  send(connection, data) {
    try {
      if (
        connection === "main" &&
        this.connections.main &&
        this.connections.main.readyState === WebSocket.OPEN
      ) {
        this.connections.main.send(JSON.stringify(data));
      } else if (
        connection === "faceRecognition" &&
        this.connections.faceRecognition &&
        this.connections.faceRecognition.connected
      ) {
        this.connections.faceRecognition.emit(data.type, data);
      } else {
        console.warn(`Cannot send to ${connection} - not connected`);
      }
    } catch (error) {
      console.error(`Error sending to ${connection}:`, error);
    }
  }

  /**
   * Subscribe to specific events
   */
  subscribe(eventType, callback) {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType).add(callback);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType, callback) {
    if (this.subscriptions.has(eventType)) {
      this.subscriptions.get(eventType).delete(callback);
    }
  }

  /**
   * Broadcast event to all subscribers
   */
  broadcast(eventType, data) {
    if (this.subscriptions.has(eventType)) {
      this.subscriptions.get(eventType).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} callback:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      main: {
        connected:
          this.connections.main &&
          this.connections.main.readyState === WebSocket.OPEN,
        reconnectAttempts: this.reconnectAttempts.main,
      },
      faceRecognition: {
        connected:
          this.connections.faceRecognition &&
          this.connections.faceRecognition.connected,
        reconnectAttempts: this.reconnectAttempts.faceRecognition,
      },
      rfidDevices: this.connections.rfidDevices.size,
    };
  }

  /**
   * Cleanup all connections
   */
  disconnect() {
    console.log("🔌 Disconnecting all WebSocket connections...");

    if (this.connections.main) {
      this.connections.main.close();
      this.connections.main = null;
    }

    if (this.connections.faceRecognition) {
      this.connections.faceRecognition.disconnect();
      this.connections.faceRecognition = null;
    }

    this.connections.rfidDevices.clear();
    this.subscriptions.clear();
  }

  /**
   * Send RFID command to device
   */
  sendRFIDCommand(command, deviceId = null) {
    this.send("main", {
      type: "rfid_command",
      command: command,
      deviceId: deviceId,
      timestamp: Date.now(),
    });
  }

  /**
   * Request face recognition stats
   */
  requestFaceRecognitionStats() {
    if (
      this.connections.faceRecognition &&
      this.connections.faceRecognition.connected
    ) {
      this.connections.faceRecognition.emit("get_stats");
    }
  }
}

// Create singleton instance
const smartTrackWS = new SmartTrackWebSocketManager();

// Export for use in components
export default smartTrackWS;

// Named exports for specific functionality
export const useSmartTrackWebSocket = () => {
  return {
    manager: smartTrackWS,
    subscribe: smartTrackWS.subscribe.bind(smartTrackWS),
    unsubscribe: smartTrackWS.unsubscribe.bind(smartTrackWS),
    send: smartTrackWS.send.bind(smartTrackWS),
    getStatus: smartTrackWS.getStatus.bind(smartTrackWS),
    sendRFIDCommand: smartTrackWS.sendRFIDCommand.bind(smartTrackWS),
    requestFaceRecognitionStats:
      smartTrackWS.requestFaceRecognitionStats.bind(smartTrackWS),
  };
};

// Auto-initialize when imported
if (typeof window !== "undefined") {
  // Initialize on page load
  document.addEventListener("DOMContentLoaded", () => {
    smartTrackWS.initialize();
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    smartTrackWS.disconnect();
  });
}
