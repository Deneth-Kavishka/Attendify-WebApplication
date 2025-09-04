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
  enrollments,
  attendance,
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
  attendanceId?: number;
}

interface Student {
  student_id: string;
  name: string;
  email: string;
  rfid_card_id: string;
  status: string;
  enrollment_year: number;
}

interface Class {
  class_id: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  day_of_week: string;
  lecturer_name: string;
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
        break;

      case "rfid_command":
        this.handleRFIDCommand(ws, message);
        break;

      case "get_rfid_status":
        this.sendRFIDStatus(ws);
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: new Date() }));
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
        studentId: student?.student_id || null,
        studentName: student?.name || "Unknown Student",
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
      for (const [socketId, device] of this.devices) {
        if (device.id === deviceId) {
          targetDevice = device;
          targetSocketId = socketId;
          break;
        }
      }
    } else {
      // Use first available device
      const firstEntry = Array.from(this.devices.entries())[0];
      if (firstEntry) {
        [targetSocketId, targetDevice] = firstEntry;
      }
    }

    if (!targetDevice) {
      ws.send(
        JSON.stringify({
          type: "rfid_error",
          message: "No RFID device available",
          command: command,
          timestamp: new Date(),
        })
      );
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
    ws.send(
      JSON.stringify({
        type: "command_sent",
        command: command,
        deviceId: targetDevice.id,
        timestamp: new Date(),
      })
    );
  }

  /**
   * Send RFID status to client
   */
  private sendRFIDStatus(ws: WebSocket): void {
    const devices = this.getDevicesStatus();
    ws.send(
      JSON.stringify({
        type: "rfid_status_response",
        devices: devices,
        totalDevices: devices.length,
        scanning: this.scanning,
        timestamp: new Date(),
      })
    );
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
  private async lookupStudentByCard(cardId: string): Promise<Student | null> {
    try {
      const stmt = Database.prepare(`
        SELECT student_id, name, email, rfid_card_id,
               status, enrollment_year
        FROM students 
        WHERE rfid_card_id = ? AND status = 'active'
      `);

      const student = stmt.get(cardId) as Student | undefined;
      return student || null;
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
    student: Student
  ): Promise<void> {
    try {
      // Find active class for current time
      const activeClass = await this.findActiveClass();

      if (!activeClass) {
        console.log("ℹ️  No active class found for attendance");
        cardData.status = "no_active_class";
        return;
      }

      cardData.classId = activeClass.class_id;
      cardData.className = activeClass.subject_name;

      // Check if student is enrolled in this class
      const enrollment = await this.checkStudentEnrollment(
        student.student_id,
        activeClass.class_id
      );

      if (!enrollment) {
        console.log(`⚠️  Student ${student.name} not enrolled in active class`);
        cardData.status = "not_enrolled";
        return;
      }

      // Record attendance
      const attendanceRecord = await this.recordAttendance(
        student.student_id,
        activeClass.class_id,
        cardData.timestamp,
        "present",
        "rfid_card"
      );

      if (attendanceRecord) {
        console.log(
          `✅ Attendance recorded for ${student.name} in ${activeClass.subject_name}`
        );
        cardData.status = "attendance_recorded";
        cardData.attendanceId = attendanceRecord.attendance_id;
      } else {
        console.log(`ℹ️  Attendance already recorded for ${student.name}`);
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
  private async findActiveClass(): Promise<Class | null> {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const currentDay = now
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();

      const stmt = database.prepare(`
        SELECT c.class_id, c.subject_name, c.start_time, c.end_time,
               c.day_of_week, l.name as lecturer_name
        FROM classes c
        JOIN lecturers l ON c.lecturer_id = l.lecturer_id
        WHERE c.day_of_week = ? 
          AND c.start_time <= ? 
          AND c.end_time >= ?
          AND c.status = 'active'
        ORDER BY c.start_time ASC
        LIMIT 1
      `);

      const activeClass = stmt.get(currentDay, currentTime, currentTime) as
        | Class
        | undefined;
      return activeClass || null;
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
      const stmt = database.prepare(`
        SELECT enrollment_id, student_id, class_id, status
        FROM enrollments 
        WHERE student_id = ? AND class_id = ? AND status = 'active'
      `);

      const enrollment = stmt.get(studentId, classId);
      return enrollment;
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
      const existingStmt = database.prepare(`
        SELECT attendance_id FROM attendance 
        WHERE student_id = ? AND class_id = ? AND attendance_date = ?
      `);

      const existing = existingStmt.get(studentId, classId, attendanceDate);

      if (existing) {
        console.log("ℹ️  Attendance already recorded for today");
        return null;
      }

      // Insert new attendance record
      const insertStmt = database.prepare(`
        INSERT INTO attendance (
          student_id, class_id, attendance_date, status, 
          check_in_time, method, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        studentId,
        classId,
        attendanceDate,
        status,
        timestamp.toISOString(),
        method,
        new Date().toISOString()
      );

      return {
        attendance_id: result.lastInsertRowid,
        student_id: studentId,
        class_id: classId,
        status: status,
        method: method,
      };
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

      for (const [socketId, lastHeartbeat] of this.lastHeartbeat) {
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
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get connected devices status
   */
  getDevicesStatus(): any[] {
    const devices: any[] = [];
    for (const [socketId, device] of this.devices) {
      devices.push({
        id: device.id,
        type: device.type,
        version: device.version,
        status: device.status,
        registeredAt: device.registeredAt,
        lastSeen: device.lastSeen,
        connected: true,
      });
    }
    return devices;
  }

  /**
   * Send ping to all devices
   */
  pingAllDevices(): void {
    for (const [socketId, device] of this.devices) {
      this.sendToDevice(device.socket, {
        type: "ping",
        timestamp: new Date(),
      });
    }
  }
}

// Create singleton instance
const rfidService = new RFIDService();

export { rfidService };
