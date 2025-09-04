/**
 * Enhanced WebSocket Service for SmartTrack
 * Handles all WebSocket connections including RFID devices, face recognition, and client apps
 */

import WebSocket, { WebSocketServer } from "ws";
import { EventEmitter } from "events";
import { IncomingMessage } from "http";

interface SmartTrackDevice {
  id: string;
  socket: WebSocket;
  type: "RFID_READER" | "ESP32_CAM" | "CLIENT";
  version?: string;
  capabilities?: string[];
  ipAddress?: string;
  registeredAt: Date;
  lastSeen: Date;
  status: "connected" | "disconnected" | "error";
  metadata?: Record<string, any>;
}

interface SmartTrackClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  component?: string;
  connectedAt: Date;
  lastSeen: Date;
}

class SmartTrackWebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private devices: Map<string, SmartTrackDevice> = new Map();
  private clients: Map<string, SmartTrackClient> = new Map();
  private broadcast: ((data: any) => void) | null = null;

  // Statistics
  private stats = {
    totalConnections: 0,
    activeDevices: 0,
    activeClients: 0,
    messagesProcessed: 0,
    startTime: new Date(),
  };

  constructor() {
    super();
    this.startHeartbeatMonitor();
  }

  /**
   * Initialize WebSocket server
   */
  init(server: any): void {
    this.wss = new WebSocketServer({
      server,
      path: "/",
      perMessageDeflate: false,
    });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    console.log("🔌 SmartTrack WebSocket Service initialized");
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const userAgent = req.headers["user-agent"] || "";
    const clientIP = req.socket.remoteAddress;

    console.log(
      `🔌 New WebSocket connection: ${connectionId} from ${clientIP}`
    );
    console.log(`   User-Agent: ${userAgent}`);

    this.stats.totalConnections++;

    // Determine connection type
    const isRFIDDevice =
      userAgent.includes("ESP8266") ||
      userAgent.includes("ESP32") ||
      userAgent.includes("Arduino") ||
      userAgent.includes("NodeMCU") ||
      req.url?.includes("rfid");

    const isESP32CAM =
      userAgent.includes("ESP32") &&
      (userAgent.includes("CAM") || req.url?.includes("camera"));

    if (isRFIDDevice) {
      this.handleDeviceConnection(ws, connectionId, "RFID_READER", req);
    } else if (isESP32CAM) {
      this.handleDeviceConnection(ws, connectionId, "ESP32_CAM", req);
    } else {
      this.handleClientConnection(ws, connectionId, req);
    }
  }

  /**
   * Handle device connections (RFID readers, ESP32-CAM)
   */
  private handleDeviceConnection(
    ws: WebSocket,
    connectionId: string,
    type: "RFID_READER" | "ESP32_CAM",
    req: IncomingMessage
  ): void {
    const device: SmartTrackDevice = {
      id: connectionId,
      socket: ws,
      type: type,
      version: undefined,
      capabilities: [],
      ipAddress: req.socket.remoteAddress,
      registeredAt: new Date(),
      lastSeen: new Date(),
      status: "connected",
      metadata: {},
    };

    this.devices.set(connectionId, device);
    this.stats.activeDevices++;

    console.log(`📱 ${type} device connected: ${connectionId}`);

    // Send welcome message
    this.sendToDevice(ws, {
      type: "welcome",
      message: `Connected to SmartTrack WebSocket Service`,
      deviceId: connectionId,
      timestamp: new Date().toISOString(),
    });

    // Set up event handlers
    ws.on("message", (data) => this.handleDeviceMessage(connectionId, data));
    ws.on("close", () => this.handleDeviceDisconnection(connectionId));
    ws.on("error", (error) => this.handleDeviceError(connectionId, error));

    // Emit device connection event
    this.emit("device_connected", device);
  }

  /**
   * Handle client connections (web browsers, mobile apps)
   */
  private handleClientConnection(
    ws: WebSocket,
    connectionId: string,
    req: IncomingMessage
  ): void {
    const client: SmartTrackClient = {
      id: connectionId,
      socket: ws,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastSeen: new Date(),
    };

    this.clients.set(connectionId, client);
    this.stats.activeClients++;

    console.log(`💻 Client connected: ${connectionId}`);

    // Send welcome message
    this.sendToClient(ws, {
      type: "welcome",
      message: "Connected to SmartTrack WebSocket Service",
      clientId: connectionId,
      availableSubscriptions: ["rfid", "face_recognition", "device_status"],
      timestamp: new Date().toISOString(),
    });

    // Set up event handlers
    ws.on("message", (data) => this.handleClientMessage(connectionId, data));
    ws.on("close", () => this.handleClientDisconnection(connectionId));
    ws.on("error", (error) => this.handleClientError(connectionId, error));

    // Emit client connection event
    this.emit("client_connected", client);
  }

  /**
   * Handle messages from devices
   */
  private handleDeviceMessage(
    connectionId: string,
    data: WebSocket.Data
  ): void {
    const device = this.devices.get(connectionId);
    if (!device) return;

    device.lastSeen = new Date();
    this.stats.messagesProcessed++;

    try {
      const message = JSON.parse(data.toString());
      console.log(`📡 Device message (${connectionId}):`, message.type);

      switch (message.type) {
        case "device_register":
          this.handleDeviceRegistration(connectionId, message);
          break;

        case "rfid_card_detected":
          this.handleRFIDCardDetection(connectionId, message);
          break;

        case "rfid_status":
          this.handleRFIDStatusUpdate(connectionId, message);
          break;

        case "rfid_heartbeat":
          this.handleHeartbeat(connectionId, message);
          break;

        case "face_detected":
          this.handleFaceDetection(connectionId, message);
          break;

        case "device_status":
          this.handleDeviceStatusUpdate(connectionId, message);
          break;

        default:
          console.log(`❓ Unknown device message type: ${message.type}`);
      }

      // Emit raw device message for other services
      this.emit("device_message", { deviceId: connectionId, message });
    } catch (error) {
      console.error(`❌ Device message parse error (${connectionId}):`, error);
    }
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(
    connectionId: string,
    data: WebSocket.Data
  ): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    client.lastSeen = new Date();

    try {
      const message = JSON.parse(data.toString());
      console.log(`💻 Client message (${connectionId}):`, message.type);

      switch (message.type) {
        case "subscribe_rfid":
          this.handleRFIDSubscription(connectionId, message);
          break;

        case "subscribe_face_recognition":
          this.handleFaceRecognitionSubscription(connectionId, message);
          break;

        case "subscribe_device_status":
          this.handleDeviceStatusSubscription(connectionId, message);
          break;

        case "rfid_command":
          this.handleRFIDCommand(connectionId, message);
          break;

        case "device_command":
          this.handleDeviceCommand(connectionId, message);
          break;

        default:
          console.log(`❓ Unknown client message type: ${message.type}`);
      }

      // Emit raw client message for other services
      this.emit("client_message", { clientId: connectionId, message });
    } catch (error) {
      console.error(`❌ Client message parse error (${connectionId}):`, error);
    }
  }

  /**
   * Handle device registration
   */
  private handleDeviceRegistration(connectionId: string, message: any): void {
    const device = this.devices.get(connectionId);
    if (!device) return;

    // Update device information
    device.id = message.deviceId || connectionId;
    device.version = message.version;
    device.capabilities = message.capabilities?.split(",") || [];
    device.metadata = {
      ip: message.ip,
      mac: message.mac,
      rssi: message.rssi,
      firmwareVersion: message.version,
    };

    console.log(`📝 Device registered: ${device.id} (${device.type})`);

    // Send registration confirmation
    this.sendToDevice(device.socket, {
      type: "registration_success",
      message: "Device registered successfully",
      deviceId: device.id,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to clients
    this.broadcastToClients({
      type: "device_registered",
      device: this.getDeviceInfo(device),
    });

    this.emit("device_registered", device);
  }

  /**
   * Handle RFID card detection
   */
  private handleRFIDCardDetection(connectionId: string, message: any): void {
    const device = this.devices.get(connectionId);
    if (!device) return;

    console.log(`🏷️ RFID card detected: ${message.cardId} from ${device.id}`);

    const cardEvent = {
      type: "rfid_card_detected",
      cardId: message.cardId,
      deviceId: device.id,
      timestamp: new Date().toISOString(),
      readCount: message.readCount,
      cardType: message.cardType || "RFID",
      rssi: message.rssi,
    };

    // Broadcast to subscribed clients
    this.broadcastToSubscribers("rfid", cardEvent);

    // Emit for other services (like attendance processing)
    this.emit("card_detected", cardEvent);

    // Send response back to device (temporary default response)
    this.sendCardResponse(
      connectionId,
      message.cardId,
      "not_found",
      "Card not registered in system"
    );
  }

  /**
   * Send card verification response back to RFID device
   */
  private sendCardResponse(
    deviceId: string,
    cardId: string,
    status: "success" | "unauthorized" | "not_found",
    studentName?: string,
    className?: string
  ): void {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== "RFID_READER") return;

    console.log(`📤 Sending card response: ${status} for card ${cardId}`);

    this.sendToDevice(device.socket, {
      type: "card_response",
      cardId: cardId,
      status: status,
      studentName: studentName || "",
      className: className || "",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle RFID subscription
   */
  private handleRFIDSubscription(connectionId: string, message: any): void {
    const client = this.clients.get(connectionId);
    if (!client) return;

    client.subscriptions.add("rfid");
    client.component = message.component;

    console.log(`📺 Client subscribed to RFID events: ${connectionId}`);

    // Send subscription confirmation
    this.sendToClient(client.socket, {
      type: "rfid_subscription_confirmed",
      message: "Successfully subscribed to RFID events",
      devices: this.getRFIDDevices(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle RFID commands from clients
   */
  private handleRFIDCommand(connectionId: string, message: any): void {
    const { command, deviceId } = message;

    console.log(`📤 RFID command: ${command} to ${deviceId || "all devices"}`);

    // Send command to specific device or all RFID devices
    if (deviceId) {
      const device = Array.from(this.devices.values()).find(
        (d) => d.id === deviceId && d.type === "RFID_READER"
      );
      if (device) {
        this.sendToDevice(device.socket, {
          type: "command",
          command: command,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Send to all RFID devices
      this.devices.forEach((device) => {
        if (device.type === "RFID_READER") {
          this.sendToDevice(device.socket, {
            type: "command",
            command: command,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }
  }

  /**
   * Handle device disconnection
   */
  private handleDeviceDisconnection(connectionId: string): void {
    const device = this.devices.get(connectionId);
    if (device) {
      console.log(`🔌 Device disconnected: ${device.id} (${device.type})`);
      device.status = "disconnected";

      // Broadcast disconnection to clients
      this.broadcastToClients({
        type: "device_disconnected",
        device: this.getDeviceInfo(device),
      });

      this.devices.delete(connectionId);
      this.stats.activeDevices--;
      this.emit("device_disconnected", device);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(connectionId: string): void {
    const client = this.clients.get(connectionId);
    if (client) {
      console.log(`💻 Client disconnected: ${connectionId}`);
      this.clients.delete(connectionId);
      this.stats.activeClients--;
      this.emit("client_disconnected", client);
    }
  }

  /**
   * Send message to device
   */
  private sendToDevice(socket: WebSocket, data: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  /**
   * Send message to client
   */
  private sendToClient(socket: WebSocket, data: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast message to all subscribed clients
   */
  private broadcastToSubscribers(subscription: string, data: any): void {
    this.clients.forEach((client) => {
      if (client.subscriptions.has(subscription)) {
        this.sendToClient(client.socket, data);
      }
    });
  }

  /**
   * Broadcast message to all clients
   */
  private broadcastToClients(data: any): void {
    this.clients.forEach((client) => {
      this.sendToClient(client.socket, data);
    });
  }

  /**
   * Get RFID devices list
   */
  private getRFIDDevices(): any[] {
    return Array.from(this.devices.values())
      .filter((device) => device.type === "RFID_READER")
      .map((device) => this.getDeviceInfo(device));
  }

  /**
   * Get device info for broadcasting
   */
  private getDeviceInfo(device: SmartTrackDevice): any {
    return {
      id: device.id,
      type: device.type,
      version: device.version,
      capabilities: device.capabilities,
      status: device.status,
      registeredAt: device.registeredAt,
      lastSeen: device.lastSeen,
      metadata: device.metadata,
    };
  }

  /**
   * Public method to get service statistics
   */
  public getStats(): any {
    return {
      ...this.stats,
      activeDevices: this.devices.size,
      activeClients: this.clients.size,
      uptime: Date.now() - this.stats.startTime.getTime(),
    };
  }

  /**
   * Public method to get connected devices
   */
  public getDevices(): SmartTrackDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Public method to get connected clients
   */
  public getClients(): SmartTrackClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Set broadcast function for integration with other services
   */
  public setBroadcastFunction(broadcastFn: (data: any) => void): void {
    this.broadcast = broadcastFn;
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitor(): void {
    setInterval(() => {
      const now = new Date();
      const timeout = 60000; // 1 minute timeout

      // Check devices
      this.devices.forEach((device, connectionId) => {
        if (now.getTime() - device.lastSeen.getTime() > timeout) {
          console.log(`⚠️ Device timeout: ${device.id}`);
          this.handleDeviceDisconnection(connectionId);
        }
      });

      // Check clients
      this.clients.forEach((client, connectionId) => {
        if (now.getTime() - client.lastSeen.getTime() > timeout) {
          console.log(`⚠️ Client timeout: ${connectionId}`);
          this.handleClientDisconnection(connectionId);
        }
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleHeartbeat(connectionId: string, message: any): void {
    const device = this.devices.get(connectionId);
    if (device) {
      device.lastSeen = new Date();
      console.log(`💓 Heartbeat from ${device.id}`);
    }
  }

  private handleRFIDStatusUpdate(connectionId: string, message: any): void {
    this.broadcastToSubscribers("rfid", {
      type: "rfid_status",
      ...message,
      deviceId: connectionId,
    });
  }

  private handleFaceDetection(connectionId: string, message: any): void {
    this.broadcastToSubscribers("face_recognition", {
      type: "face_detected",
      ...message,
      deviceId: connectionId,
    });
  }

  private handleDeviceStatusUpdate(connectionId: string, message: any): void {
    this.broadcastToSubscribers("device_status", {
      type: "device_status_update",
      ...message,
      deviceId: connectionId,
    });
  }

  private handleFaceRecognitionSubscription(
    connectionId: string,
    message: any
  ): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.subscriptions.add("face_recognition");
      this.sendToClient(client.socket, {
        type: "face_recognition_subscription_confirmed",
        message: "Successfully subscribed to face recognition events",
      });
    }
  }

  private handleDeviceStatusSubscription(
    connectionId: string,
    message: any
  ): void {
    const client = this.clients.get(connectionId);
    if (client) {
      client.subscriptions.add("device_status");
      this.sendToClient(client.socket, {
        type: "device_status_subscription_confirmed",
        message: "Successfully subscribed to device status updates",
      });
    }
  }

  private handleDeviceCommand(connectionId: string, message: any): void {
    const { command, deviceId, deviceType } = message;

    console.log(
      `📤 Device command: ${command} to ${deviceId || "all " + deviceType}`
    );

    this.devices.forEach((device) => {
      if (
        (!deviceId || device.id === deviceId) &&
        (!deviceType || device.type === deviceType)
      ) {
        this.sendToDevice(device.socket, {
          type: "command",
          command: command,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private handleDeviceError(connectionId: string, error: Error): void {
    console.error(`❌ Device error (${connectionId}):`, error);
    this.handleDeviceDisconnection(connectionId);
  }

  private handleClientError(connectionId: string, error: Error): void {
    console.error(`❌ Client error (${connectionId}):`, error);
    this.handleClientDisconnection(connectionId);
  }

  /**
   * Public method to send card verification response to RFID device
   */
  public sendCardVerificationResponse(
    deviceId: string,
    cardId: string,
    isAuthorized: boolean,
    studentName?: string,
    className?: string
  ): void {
    const status = isAuthorized ? "success" : "unauthorized";
    this.sendCardResponse(deviceId, cardId, status, studentName, className);
  }

  /**
   * Public method to send card registration response to RFID device
   */
  public sendCardRegistrationResponse(
    deviceId: string,
    cardId: string,
    isRegistered: boolean,
    studentName?: string
  ): void {
    const status = isRegistered ? "success" : "not_found";
    this.sendCardResponse(deviceId, cardId, status, studentName);
  }
}

export default SmartTrackWebSocketService;
