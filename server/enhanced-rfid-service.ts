/**
 * Enhanced RFID Service for SmartTrack
 * Comprehensive RFID attendance system with real-time communication
 *
 * Features:
 * - Complete student profile retrieval after RFID scan
 * - Real-time Firebase sync
 * - PostgreSQL attendance logging
 * - WebSocket communication with devices
 * - Student details including attendance history, fees, results
 *
 * Author: SmartTrack Team
 * Version: 2.0.0
 */

import WebSocket, { WebSocketServer } from "ws";
import { EventEmitter } from "events";
import { db } from "./database";
import firebaseAdmin from "./firebase-admin";
import { PostgreSQLStorage } from "./postgres-storage";
import {
  students,
  attendanceRecords,
  classes,
  enrollments,
} from "../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface RFIDDevice {
  id: string;
  socket: WebSocket;
  type: string;
  location: string;
  status: "online" | "offline" | "scanning";
  lastHeartbeat: Date;
  totalScans: number;
  successfulScans: number;
}

interface StudentProfile {
  // Basic Info
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  rfidCard: string;

  // Academic Info
  department: string;
  batch: string;
  semester: string;
  enrollmentYear: number;
  gpa: number;

  // Contact Info
  mobileNumber: string;
  guardianContact: string;
  emergencyContact: string;

  // Attendance Statistics
  attendanceStats: {
    totalLectures: number;
    attendedLectures: number;
    attendancePercentage: number;
    lastAttendance: Date | null;
  };

  // Fee Status
  feeStatus: {
    totalFees: number;
    paidAmount: number;
    pendingAmount: number;
    lastPayment: Date | null;
    status: "paid" | "pending" | "overdue";
  };

  // Academic Results
  results: {
    currentSemesterGPA: number;
    overallGPA: number;
    completedCredits: number;
    totalCredits: number;
    academicStatus: "good" | "probation" | "warning";
  };

  // Current Enrollments
  currentClasses: Array<{
    classId: string;
    subjectName: string;
    lecturerName: string;
    schedule: string;
    attendance: number;
  }>;
}

interface AttendanceResult {
  success: boolean;
  message: string;
  student: StudentProfile | null;
  attendanceId?: string;
  classInfo?: {
    classId: string;
    subjectName: string;
    lecturerName: string;
    isActive: boolean;
  };
}

class EnhancedRFIDService extends EventEmitter {
  private devices: Map<string, RFIDDevice> = new Map();
  private dbStorage: PostgreSQLStorage;
  private wss?: WebSocketServer;

  constructor() {
    super();
    this.dbStorage = new PostgreSQLStorage();
    this.startHeartbeatMonitor();
  }

  /**
   * Initialize the enhanced RFID service
   */
  async initialize(wss: WebSocketServer): Promise<void> {
    this.wss = wss;

    wss.on("connection", (ws: WebSocket, req) => {
      console.log("🔌 RFID Device connection attempt");

      // Check if this is an RFID device
      const userAgent = req.headers["user-agent"] || "";
      const isRFIDDevice =
        userAgent.includes("ESP32") ||
        userAgent.includes("Arduino") ||
        req.url?.includes("/rfid");

      if (isRFIDDevice) {
        this.handleDeviceConnection(ws, req);
      }
    });

    console.log("✅ Enhanced RFID Service initialized");
  }

  /**
   * Handle RFID device connection
   */
  private handleDeviceConnection(ws: WebSocket, req: any): void {
    const deviceId = this.generateDeviceId();

    const device: RFIDDevice = {
      id: deviceId,
      socket: ws,
      type: "rfid_reader",
      location: "Main Entrance",
      status: "online",
      lastHeartbeat: new Date(),
      totalScans: 0,
      successfulScans: 0,
    };

    this.devices.set(deviceId, device);

    // Send welcome message to device
    this.sendToDevice(ws, {
      type: "device_registered",
      deviceId: deviceId,
      message: "Device registered successfully",
      timestamp: new Date().toISOString(),
    });

    // Handle device messages
    ws.on("message", async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleDeviceMessage(deviceId, message);
      } catch (error) {
        // Handle plain text RFID data
        await this.handlePlainRFIDData(deviceId, data.toString());
      }
    });

    ws.on("close", () => {
      this.handleDeviceDisconnection(deviceId);
    });

    ws.on("error", (error) => {
      console.error(`❌ Device ${deviceId} error:`, error);
    });

    console.log(`✅ RFID Device ${deviceId} connected`);
  }

  /**
   * Handle messages from RFID devices
   */
  private async handleDeviceMessage(
    deviceId: string,
    message: any
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    device.lastHeartbeat = new Date();

    switch (message.type) {
      case "rfid_scan":
        await this.processRFIDScan(deviceId, message.cardId, message.classId);
        break;

      case "heartbeat":
        await this.handleHeartbeat(deviceId, message);
        break;

      case "status_update":
        await this.handleStatusUpdate(deviceId, message);
        break;

      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle plain RFID data (from simple Arduino serial)
   */
  private async handlePlainRFIDData(
    deviceId: string,
    data: string
  ): Promise<void> {
    const cleanData = data.trim();

    // Extract RFID card ID from different formats
    let cardId = "";

    if (cleanData.startsWith("RFID:")) {
      cardId = cleanData.substring(5).trim();
    } else if (cleanData.match(/^[A-Fa-f0-9]+$/)) {
      cardId = cleanData.toUpperCase();
    }

    if (cardId) {
      console.log(`📱 RFID Card detected: ${cardId} from device ${deviceId}`);

      // Format card ID to match database format
      if (!cardId.startsWith("RFID")) {
        cardId = `RFID${cardId}`;
      }

      await this.processRFIDScan(deviceId, cardId);
    }
  }

  /**
   * Process RFID card scan and retrieve complete student information
   */
  private async processRFIDScan(
    deviceId: string,
    cardId: string,
    classId?: string
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    device.totalScans++;

    try {
      console.log(`🔍 Processing RFID scan: ${cardId}`);

      // Get complete student profile
      const studentProfile = await this.getCompleteStudentProfile(cardId);

      if (!studentProfile) {
        await this.handleUnknownCard(deviceId, cardId);
        return;
      }

      // Determine active class for attendance
      const activeClass = await this.getActiveClass(classId);

      // Record attendance
      const attendanceResult = await this.recordAttendance(
        studentProfile,
        deviceId,
        activeClass
      );

      // Update device stats
      if (attendanceResult.success) {
        device.successfulScans++;
      }

      // Send response to device
      await this.sendAttendanceResponse(deviceId, attendanceResult);

      // Broadcast to clients (web interface)
      await this.broadcastAttendanceUpdate(attendanceResult);

      // Sync with Firebase
      await this.syncToFirebase(attendanceResult);

      console.log(`✅ Attendance processed for ${studentProfile.fullName}`);
    } catch (error) {
      console.error("❌ Error processing RFID scan:", error);
      await this.handleScanError(deviceId, cardId, error);
    }
  }

  /**
   * Get complete student profile with all details
   */
  private async getCompleteStudentProfile(
    cardId: string
  ): Promise<StudentProfile | null> {
    try {
      // Get student basic info
      const student = await this.dbStorage.getStudentByRfidCard(cardId);
      if (!student) return null;

      // Get attendance statistics
      const attendanceStats = await this.getAttendanceStatistics(student.id);

      // Get fee status (mock data for now - implement based on your fee system)
      const feeStatus = await this.getFeeStatus(student.id);

      // Get academic results
      const results = await this.getAcademicResults(student.id);

      // Get current class enrollments
      const currentClasses = await this.getCurrentClasses(student.id);

      const profile: StudentProfile = {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName || student.userId, // fallback to userId if fullName not available
        email: student.email,
        rfidCard: cardId,
        department: student.department || "Unknown",
        batch: student.batch || "Unknown",
        semester: student.semester?.toString() || "1",
        enrollmentYear: student.enrollmentYear,
        gpa: parseFloat(student.gpa?.toString() || "0"),
        mobileNumber: student.mobileNumber || "",
        guardianContact: student.guardianContact || "",
        emergencyContact: student.emergencyContact || "",
        attendanceStats,
        feeStatus,
        results,
        currentClasses,
      };

      return profile;
    } catch (error) {
      console.error("❌ Error getting student profile:", error);
      return null;
    }
  }

  /**
   * Get attendance statistics for student
   */
  private async getAttendanceStatistics(
    studentId: string
  ): Promise<StudentProfile["attendanceStats"]> {
    try {
      const attendanceRecordsResult = await db
        .select({
          total: sql<number>`count(*)`,
          present: sql<number>`count(*) filter (where status = 'present')`,
        })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.studentId, studentId));

      const lastAttendanceResult = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, studentId),
            eq(attendanceRecords.status, "present")
          )
        )
        .orderBy(desc(attendanceRecords.attendanceDate))
        .limit(1);

      const stats = attendanceRecordsResult[0];
      const totalLectures = Number(stats?.total || 0);
      const attendedLectures = Number(stats?.present || 0);

      return {
        totalLectures,
        attendedLectures,
        attendancePercentage:
          totalLectures > 0 ? (attendedLectures / totalLectures) * 100 : 0,
        lastAttendance: lastAttendanceResult[0]?.attendanceDate || null,
      };
    } catch (error) {
      console.error("❌ Error getting attendance stats:", error);
      return {
        totalLectures: 0,
        attendedLectures: 0,
        attendancePercentage: 0,
        lastAttendance: null,
      };
    }
  }

  /**
   * Get fee status for student (implement based on your fee system)
   */
  private async getFeeStatus(
    studentId: string
  ): Promise<StudentProfile["feeStatus"]> {
    // This is a mock implementation - replace with your actual fee system
    return {
      totalFees: 50000,
      paidAmount: 30000,
      pendingAmount: 20000,
      lastPayment: new Date(),
      status: "pending",
    };
  }

  /**
   * Get academic results for student
   */
  private async getAcademicResults(
    studentId: string
  ): Promise<StudentProfile["results"]> {
    try {
      const student = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      const gpa = parseFloat(student[0]?.gpa?.toString() || "0");

      return {
        currentSemesterGPA: gpa,
        overallGPA: gpa,
        completedCredits: 60, // Mock data
        totalCredits: 120,
        academicStatus:
          gpa >= 3.0 ? "good" : gpa >= 2.0 ? "warning" : "probation",
      };
    } catch (error) {
      console.error("❌ Error getting academic results:", error);
      return {
        currentSemesterGPA: 0,
        overallGPA: 0,
        completedCredits: 0,
        totalCredits: 120,
        academicStatus: "warning",
      };
    }
  }

  /**
   * Get current class enrollments for student
   */
  private async getCurrentClasses(
    studentId: string
  ): Promise<StudentProfile["currentClasses"]> {
    try {
      // This would join with enrollments and classes tables
      // For now, return mock data - implement based on your schema
      return [
        {
          classId: "CS101",
          subjectName: "Computer Science Fundamentals",
          lecturerName: "Dr. Smith",
          schedule: "Mon 9:00 AM",
          attendance: 85,
        },
      ];
    } catch (error) {
      console.error("❌ Error getting current classes:", error);
      return [];
    }
  }

  /**
   * Get active class for attendance marking
   */
  private async getActiveClass(classId?: string): Promise<any> {
    if (!classId) {
      // Auto-detect active class based on current time
      return {
        classId: "DEFAULT_CLASS",
        subjectName: "General Attendance",
        lecturerName: "System",
        isActive: true,
      };
    }

    // Get class from database
    try {
      const classInfo = await db
        .select()
        .from(classes)
        .where(eq(classes.id, classId))
        .limit(1);

      return classInfo[0] || null;
    } catch (error) {
      console.error("❌ Error getting class info:", error);
      return null;
    }
  }

  /**
   * Record attendance in database
   */
  private async recordAttendance(
    student: StudentProfile,
    deviceId: string,
    classInfo: any
  ): Promise<AttendanceResult> {
    try {
      const attendanceRecord = await this.dbStorage.createAttendanceRecord({
        studentId: student.id,
        classId: classInfo?.classId || "DEFAULT_CLASS",
        attendanceDate: new Date(),
        method: "rfid",
        status: "present",
        hardwareId: deviceId,
        confidence: null,
      });

      return {
        success: true,
        message: `Attendance recorded for ${student.fullName}`,
        student,
        attendanceId: attendanceRecord.id,
        classInfo,
      };
    } catch (error) {
      console.error("❌ Error recording attendance:", error);
      return {
        success: false,
        message: "Failed to record attendance",
        student,
      };
    }
  }

  /**
   * Send attendance response to RFID device
   */
  private async sendAttendanceResponse(
    deviceId: string,
    result: AttendanceResult
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    const response = {
      type: "attendance_response",
      success: result.success,
      message: result.message,
      student: result.student
        ? {
            name: result.student.fullName,
            studentId: result.student.studentId,
            department: result.student.department,
            attendancePercentage:
              result.student.attendanceStats.attendancePercentage,
          }
        : null,
      timestamp: new Date().toISOString(),
    };

    this.sendToDevice(device.socket, response);
  }

  /**
   * Broadcast attendance update to web clients
   */
  private async broadcastAttendanceUpdate(
    result: AttendanceResult
  ): Promise<void> {
    if (!this.wss) return;

    const updateData = {
      type: "attendance_update",
      success: result.success,
      student: result.student,
      timestamp: new Date().toISOString(),
    };

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(updateData));
      }
    });
  }

  /**
   * Sync attendance data to Firebase
   */
  private async syncToFirebase(result: AttendanceResult): Promise<void> {
    try {
      if (!result.student || !result.success) return;

      // Sync to Firebase Realtime Database
      const attendanceRef = `attendance/${
        result.classInfo?.classId || "default"
      }/${result.student.id}`;

      await firebaseAdmin.realtimeDb.updateAttendance(attendanceRef, {
        studentId: result.student.studentId,
        fullName: result.student.fullName,
        status: "present",
        timestamp: new Date().toISOString(),
        method: "rfid",
        attendancePercentage:
          result.student.attendanceStats.attendancePercentage,
      });

      console.log(`🔥 Synced to Firebase: ${result.student.fullName}`);
    } catch (error) {
      console.error("❌ Error syncing to Firebase:", error);
    }
  }

  /**
   * Handle unknown RFID card
   */
  private async handleUnknownCard(
    deviceId: string,
    cardId: string
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    const response = {
      type: "unknown_card",
      message: "RFID card not registered",
      cardId,
      timestamp: new Date().toISOString(),
    };

    this.sendToDevice(device.socket, response);

    console.log(`❌ Unknown RFID card: ${cardId}`);
  }

  /**
   * Handle scan error
   */
  private async handleScanError(
    deviceId: string,
    cardId: string,
    error: any
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    const response = {
      type: "scan_error",
      message: "Error processing RFID scan",
      cardId,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    this.sendToDevice(device.socket, response);
  }

  /**
   * Handle device heartbeat
   */
  private async handleHeartbeat(deviceId: string, message: any): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    device.lastHeartbeat = new Date();
    device.status = "online";

    // Update device statistics
    if (message.totalScans) device.totalScans = message.totalScans;
    if (message.successfulScans)
      device.successfulScans = message.successfulScans;

    // Send heartbeat response
    this.sendToDevice(device.socket, {
      type: "heartbeat_ack",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle device status update
   */
  private async handleStatusUpdate(
    deviceId: string,
    message: any
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) return;

    device.status = message.status || device.status;
    console.log(`📊 Device ${deviceId} status: ${device.status}`);
  }

  /**
   * Handle device disconnection
   */
  private handleDeviceDisconnection(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = "offline";
      console.log(`🔌 Device ${deviceId} disconnected`);
    }
  }

  /**
   * Send message to specific device
   */
  private sendToDevice(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitor(): void {
    setInterval(() => {
      const now = Date.now();

      this.devices.forEach((device, deviceId) => {
        const timeSinceLastHeartbeat = now - device.lastHeartbeat.getTime();

        if (timeSinceLastHeartbeat > 60000) {
          // 1 minute timeout
          device.status = "offline";
          console.log(`❌ Device ${deviceId} marked as offline`);
        }
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    return `RFID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all connected devices
   */
  getDevices(): RFIDDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): RFIDDevice | undefined {
    return this.devices.get(deviceId);
  }
}

// Export singleton instance
export const enhancedRFIDService = new EnhancedRFIDService();
export default enhancedRFIDService;
