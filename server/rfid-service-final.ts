/**
 * RFID Service Handler for SmartTrack Backend
 * Manages RFID device connections and real-time card detection
 *
 * Features:
 * - WebSocket connection management for RFID devices
 * - Real-time card detection processing
 * - Student lookup and attendance recording
 * - Device status monitoring
 * - Integration with existing attendance system
 *
 * Version: 1.0.0
 */

import WebSocket, { WebSocketServer } from "ws";
import { EventEmitter } from "events";
import { IncomingMessage } from "http";
import { db } from "./database";
import {
  students,
  classes,
  lecturers,
  classEnrollments,
  attendanceRecords,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface RFIDDevice {
  id: string | null;
  socket: WebSocket;
  type: string;
  version: string;
  capabilities?: string;
  registeredAt: Date;
  lastSeen: Date;
  status: string;
  ipAddress?: string;
}

interface CardData {
  cardId: string;
  cardType: string;
  deviceId: string;
  timestamp: Date;
  studentId: string | null;
  studentName: string;
  classId: string | null;
  className: string | null;
  status: string;
  attendanceId?: string;
}

class RFIDService extends EventEmitter {
  private devices: Map<string, RFIDDevice>;
  private lastHeartbeat: Map<string, number>;
  private clients: Set<WebSocket>;
  private wss?: WebSocketServer;
  private broadcast?: (data: any) => void;
  private scanning: boolean;

  constructor() {
    super();
    this.devices = new Map();
    this.lastHeartbeat = new Map();
    this.clients = new Set();
    this.scanning = false;

    // Start heartbeat monitoring
    this.startHeartbeatMonitor();
  }

  /**
   * Initialize RFID service with WebSocket server
   */
  init(wss: WebSocketServer, broadcast: (data: any) => void): void {
    this.wss = wss;
    this.broadcast = broadcast;

    // Enhanced WebSocket connection handling for RFID
    wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      console.log("🔌 WebSocket client connected:", req.url);

      // Check if this is an RFID device connection
      const userAgent = req.headers["user-agent"] || "";
      const isRFIDDevice =
        userAgent.includes("ESP32") ||
        userAgent.includes("Arduino") ||
        req.url?.includes("rfid");

      if (isRFIDDevice) {
        this.handleDeviceConnection(ws, req);
      } else {
        // Regular client connection for monitoring
        this.clients.add(ws);

        ws.on("message", (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleClientMessage(ws, message);
          } catch (error) {
            console.error("📡 Message parse error:", error);
          }
        });

        ws.on("close", () => {
          this.clients.delete(ws);
        });
      }
    });

    console.log("📡 RFID Service initialized with WebSocket");
  }

  /**
   * Handle RFID device WebSocket connection
   */
  private handleDeviceConnection(ws: WebSocket, req: IncomingMessage): void {
    console.log("🤖 RFID Device connected");

    const deviceInfo: RFIDDevice = {
      id: null, // Will be set during registration
      socket: ws,
      type: "rfid_reader",
      version: "1.0.0",
      registeredAt: new Date(),
      lastSeen: new Date(),
      status: "connected",
      ipAddress: req.socket.remoteAddress,
    };

    const socketId = this.generateSocketId();
    this.devices.set(socketId, deviceInfo);
    this.lastHeartbeat.set(socketId, Date.now());

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleDeviceMessage(ws, socketId, message);
      } catch (error) {
        // Handle plain text messages (like from Arduino Serial)
        this.handlePlainTextMessage(ws, socketId, data.toString());
      }
    });

    ws.on("close", () => {
      this.handleDeviceDisconnection(socketId);
    });

    ws.on("error", (error: Error) => {
      console.error("❌ RFID Device WebSocket error:", error);
    });

    // Send welcome message
    this.sendToDevice(ws, {
      type: "welcome",
      message: "RFID device connected successfully",
      timestamp: new Date(),
    });
  }

  /**
   * Handle messages from RFID devices
   */
  private handleDeviceMessage(
    ws: WebSocket,
    socketId: string,
    message: any
  ): void {
    const device = this.devices.get(socketId);
    if (!device) return;

    device.lastSeen = new Date();
    this.lastHeartbeat.set(socketId, Date.now());

    switch (message.type) {
      case "device_register":
        this.handleDeviceRegistration(ws, socketId, message);
        break;

      case "rfid_card_detected":
        this.handleCardDetection(ws, socketId, message);
        break;

      case "rfid_status":
        this.handleStatusUpdate(ws, socketId, message);
        break;

      case "rfid_heartbeat":
        this.handleHeartbeat(ws, socketId, message);
        break;

      case "pong":
        console.log(`🏓 Pong received from device: ${device.id}`);
        break;

      default:
        console.log("❓ Unknown message type from device:", message.type);
    }
  }

  /**
   * Handle plain text messages from Arduino (legacy support)
   */
  private handlePlainTextMessage(
    ws: WebSocket,
    socketId: string,
    message: string
  ): void {
    const device = this.devices.get(socketId);
    if (!device) return;

    const text = message.trim();
    console.log(`📨 Plain text from device: ${text}`);

    // Handle RFID card detection format: "RFID:XXXXXXXXXX"
    if (text.startsWith("RFID:")) {
      const cardId = text.substring(5);
      this.handleCardDetection(ws, socketId, {
        type: "rfid_card_detected",
        cardId: cardId,
        cardType: "Unknown",
        timestamp: Date.now(),
      });
    }
    // Handle status updates
    else if (text.includes("scanning") || text.includes("status")) {
      this.handleStatusUpdate(ws, socketId, {
        type: "rfid_status",
        status: text.toLowerCase().includes("scanning") ? "scanning" : "idle",
        message: text,
      });
    }
  }

  /**
   * Handle client messages (from frontend)
   */
  private handleClientMessage(
    ws: WebSocket & { rfidSubscribed?: boolean },
    message: any
  ): void {
    switch (message.type) {
      case "subscribe_rfid":
        ws.rfidSubscribed = true;
        console.log("📺 Client subscribed to RFID events");
        this.sendToClient(ws, {
          type: "rfid_subscription_confirmed",
          devices: this.getDevicesStatus(),
          timestamp: new Date(),
        });
        break;

      case "rfid_command":
        this.handleRFIDCommand(ws, message);
        break;

      case "get_rfid_status":
        this.sendRFIDStatus(ws);
        break;

      case "ping":
        this.sendToClient(ws, { type: "pong", timestamp: new Date() });
        break;
    }
  }

  /**
   * Handle RFID device registration
   */
  private handleDeviceRegistration(
    ws: WebSocket,
    socketId: string,
    data: any
  ): void {
    const device = this.devices.get(socketId);
    if (!device) return;

    // Update device info
    device.id = data.deviceId;
    device.type = data.deviceType || "rfid_reader";
    device.version = data.version || "1.0.0";
    device.capabilities = data.capabilities;

    // Send registration confirmation
    this.sendToDevice(ws, {
      type: "registration_success",
      message: "Device registered successfully",
      deviceId: data.deviceId,
      timestamp: new Date(),
    });

    // Broadcast device status
    this.broadcastToClients("rfid_status", {
      deviceId: data.deviceId,
      status: "connected",
      scanning: false,
      timestamp: new Date(),
    });

    console.log(`📱 RFID Device registered: ${data.deviceId}`);
  }

  /**
   * Handle RFID card detection
   */
  private async handleCardDetection(
    ws: WebSocket,
    socketId: string,
    data: any
  ): Promise<void> {
    try {
      const device = this.devices.get(socketId);
      if (!device) return;

      console.log(
        `🔍 Card detected: ${data.cardId} from device: ${device.id || socketId}`
      );

      // Look up student by card ID
      const student = await this.lookupStudentByCard(data.cardId);

      const cardData: CardData = {
        cardId: data.cardId,
        cardType: data.cardType || "Unknown",
        deviceId: device.id || socketId,
        timestamp: new Date(),
        studentId: student?.id || null,
        studentName: student
          ? `${student.firstName} ${student.lastName}`
          : "Unknown Student",
        classId: null,
        className: null,
        status: "present",
      };

      // Process attendance if student found
      if (student) {
        await this.processAttendance(cardData, student);
      } else {
        console.log(`⚠️  Unknown card: ${data.cardId}`);
        cardData.status = "unknown_card";
      }

      // Broadcast card detection
      this.broadcastToClients("rfid_card_detected", cardData);

      // Also broadcast via main WebSocket for attendance feed
      if (this.broadcast) {
        this.broadcast({
          type: "rfid_card_detected",
          data: cardData,
        });
      }

      // Send acknowledgment to device
      this.sendToDevice(ws, {
        type: "card_processed",
        cardId: data.cardId,
        status: "processed",
        studentFound: !!student,
        timestamp: new Date(),
      });

      // Emit event for other services
      this.emit("cardDetected", cardData);
    } catch (error) {
      console.error("❌ Error processing card detection:", error);

      this.sendToDevice(ws, {
        type: "card_error",
        cardId: data.cardId,
        error: "Processing failed",
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle RFID commands from frontend
   */
  private handleRFIDCommand(ws: WebSocket, data: any): void {
    const { command, deviceId } = data;

    // Find target device
    let targetDevice: RFIDDevice | null = null;
    let targetSocketId: string | null = null;

    if (deviceId) {
      // Find specific device
      this.devices.forEach((device, socketId) => {
        if (device.id === deviceId) {
          targetDevice = device;
          targetSocketId = socketId;
        }
      });
    } else {
      // Use first available device
      const firstEntry = Array.from(this.devices.entries())[0];
      if (firstEntry) {
        [targetSocketId, targetDevice] = firstEntry;
      }
    }

    if (!targetDevice) {
      this.sendToClient(ws, {
        type: "rfid_error",
        message: "No RFID device available",
        command: command,
        timestamp: new Date(),
      });
      return;
    }

    // Send command to device
    this.sendToDevice(targetDevice.socket, {
      type: "rfid_command",
      command: command,
      timestamp: new Date(),
    });

    console.log(
      `📡 RFID Command sent: ${command} to device: ${
        targetDevice.id || targetSocketId
      }`
    );

    // Acknowledge command
    this.sendToClient(ws, {
      type: "command_sent",
      command: command,
      deviceId: targetDevice.id,
      timestamp: new Date(),
    });
  }

  /**
   * Send RFID status to client
   */
  private sendRFIDStatus(ws: WebSocket): void {
    const devices = this.getDevicesStatus();
    this.sendToClient(ws, {
      type: "rfid_status_response",
      devices: devices,
      totalDevices: devices.length,
      scanning: this.scanning,
      timestamp: new Date(),
    });
  }

  /**
   * Handle device status updates
   */
  private handleStatusUpdate(ws: WebSocket, socketId: string, data: any): void {
    const device = this.devices.get(socketId);
    if (!device) return;

    device.status = data.status || "connected";
    device.lastSeen = new Date();
    this.lastHeartbeat.set(socketId, Date.now());

    this.broadcastToClients("rfid_status", {
      deviceId: device.id,
      status: data.status,
      scanning: data.scanning || false,
      message: data.message,
      timestamp: new Date(),
    });
  }

  /**
   * Handle device heartbeat
   */
  private handleHeartbeat(ws: WebSocket, socketId: string, data: any): void {
    const device = this.devices.get(socketId);
    if (!device) return;

    device.lastSeen = new Date();
    this.lastHeartbeat.set(socketId, Date.now());

    this.sendToDevice(ws, {
      type: "heartbeat_ack",
      timestamp: new Date(),
    });

    this.broadcastToClients("rfid_heartbeat", {
      deviceId: device.id,
      status: data.status || "connected",
      timestamp: new Date(),
    });
  }

  /**
   * Handle device disconnection
   */
  private handleDeviceDisconnection(socketId: string): void {
    const device = this.devices.get(socketId);
    if (device) {
      console.log(`📱 RFID Device disconnected: ${device.id}`);

      this.broadcastToClients("rfid_status", {
        deviceId: device.id,
        status: "disconnected",
        scanning: false,
        timestamp: new Date(),
      });

      this.devices.delete(socketId);
      this.lastHeartbeat.delete(socketId);
    }
  }

  /**
   * Send message to specific device
   */
  private sendToDevice(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast to all subscribed clients
   */
  private broadcastToClients(event: string, data: any): void {
    const message = JSON.stringify({
      type: event,
      ...data,
      timestamp: data.timestamp || new Date(),
    });

    this.clients.forEach((client: WebSocket & { rfidSubscribed?: boolean }) => {
      if (client.readyState === WebSocket.OPEN && client.rfidSubscribed) {
        client.send(message);
      }
    });
  }

  /**
   * Generate unique socket ID
   */
  private generateSocketId(): string {
    return "rfid_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
  }

  /**
   * Look up student by RFID card ID
   */
  private async lookupStudentByCard(cardId: string): Promise<any> {
    try {
      const result = await db
        .select()
        .from(students)
        .where(eq(students.rfidCard, cardId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error("❌ Error looking up student by card:", error);
      return null;
    }
  }

  /**
   * Process attendance for detected card
   */
  private async processAttendance(
    cardData: CardData,
    student: any
  ): Promise<void> {
    try {
      // Find active class for current time
      const activeClass = await this.findActiveClass();

      if (!activeClass) {
        console.log("ℹ️  No active class found for attendance");
        cardData.status = "no_active_class";
        return;
      }

      cardData.classId = activeClass.id;
      cardData.className = activeClass.subjectName;

      // Check if student is enrolled in this class
      const enrollment = await this.checkStudentEnrollment(
        student.id,
        activeClass.id
      );

      if (!enrollment) {
        console.log(
          `⚠️  Student ${student.firstName} ${student.lastName} not enrolled in active class`
        );
        cardData.status = "not_enrolled";
        return;
      }

      // Record attendance
      const attendanceRecord = await this.recordAttendance(
        student.id,
        activeClass.id,
        cardData.timestamp,
        "present",
        "rfid_card"
      );

      if (attendanceRecord) {
        console.log(
          `✅ Attendance recorded for ${student.firstName} ${student.lastName} in ${activeClass.subjectName}`
        );
        cardData.status = "attendance_recorded";
        cardData.attendanceId = attendanceRecord.id;
      } else {
        console.log(
          `ℹ️  Attendance already recorded for ${student.firstName} ${student.lastName}`
        );
        cardData.status = "already_recorded";
      }
    } catch (error) {
      console.error("❌ Error processing attendance:", error);
      cardData.status = "processing_error";
    }
  }

  /**
   * Find currently active class
   */
  private async findActiveClass(): Promise<any> {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDay = now
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();

      const result = await db
        .select()
        .from(classes)
        .innerJoin(lecturers, eq(classes.lecturerId, lecturers.id))
        .where(
          and(
            eq(classes.dayOfWeek, currentDay)
            // Additional time checks would need proper time comparison logic
          )
        )
        .limit(1);

      return result[0]?.classes || null;
    } catch (error) {
      console.error("❌ Error finding active class:", error);
      return null;
    }
  }

  /**
   * Check if student is enrolled in class
   */
  private async checkStudentEnrollment(
    studentId: string,
    classId: string
  ): Promise<any> {
    try {
      const result = await db
        .select()
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.studentId, studentId),
            eq(classEnrollments.classId, classId)
          )
        )
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error("❌ Error checking enrollment:", error);
      return null;
    }
  }

  /**
   * Record attendance in database
   */
  private async recordAttendance(
    studentId: string,
    classId: string,
    timestamp: Date,
    status: string,
    method: string
  ): Promise<any> {
    try {
      const attendanceDate = timestamp.toISOString().split("T")[0]; // YYYY-MM-DD

      // Check if attendance already recorded for today
      const existing = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, studentId),
            eq(attendanceRecords.classId, classId)
            // Additional date comparison would be needed
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log("ℹ️  Attendance already recorded for today");
        return null;
      }

      // Insert new attendance record
      const result = await db
        .insert(attendanceRecords)
        .values({
          studentId: studentId,
          classId: classId,
          status: status as any,
          checkInTime: timestamp,
          // Additional fields as needed
        })
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error("❌ Error recording attendance:", error);
      return null;
    }
  }

  /**
   * Start heartbeat monitoring for devices
   */
  private startHeartbeatMonitor(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds timeout

      this.lastHeartbeat.forEach((lastHeartbeat, socketId) => {
        if (now - lastHeartbeat > timeout) {
          const device = this.devices.get(socketId);
          if (device) {
            console.log(`💔 Device heartbeat timeout: ${device.id}`);

            this.broadcastToClients("rfid_status", {
              deviceId: device.id,
              status: "timeout",
              scanning: false,
              timestamp: new Date(),
            });

            device.socket.close();
          }
        }
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get connected devices status
   */
  getDevicesStatus(): any[] {
    const devices: any[] = [];
    this.devices.forEach((device, socketId) => {
      devices.push({
        id: device.id,
        type: device.type,
        version: device.version,
        status: device.status,
        registeredAt: device.registeredAt,
        lastSeen: device.lastSeen,
        connected: true,
      });
    });
    return devices;
  }

  /**
   * Send ping to all devices
   */
  pingAllDevices(): void {
    this.devices.forEach((device, socketId) => {
      this.sendToDevice(device.socket, {
        type: "ping",
        timestamp: new Date(),
      });
    });
  }
}

// Create singleton instance
const rfidService = new RFIDService();

export { rfidService };
