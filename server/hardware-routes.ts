// Hardware API Routes for Attendify
import express from "express";
import { dbStorage } from "./storage";

const router = express.Router();

// Face recognition attendance
router.post("/attendance/face-scan", async (req, res) => {
  try {
    const { deviceId, classId, imageData, timestamp, location, confidence } =
      req.body;

    console.log(`📸 Face scan from ${deviceId} at ${location}`);

    // Process face recognition (integrate with Python service)
    const pythonResponse = await fetch(
      `${process.env.PYTHON_SERVICE_URL || "http://localhost:8080"}/recognize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, class_id: classId }),
      }
    );

    const faceResult = await pythonResponse.json();

    if (faceResult.recognized && faceResult.student_id) {
      // Create attendance record
      const attendanceRecord = await dbStorage.createAttendanceRecord({
        studentId: faceResult.student_id,
        classId: classId,
        attendanceDate: new Date(timestamp),
        method: "face_recognition",
        status: "present",
        hardwareId: deviceId,
        confidence: faceResult.confidence?.toString() || null,
      });

      res.json({
        success: true,
        message: "Attendance recorded successfully",
        student: faceResult.student_name,
        confidence: faceResult.confidence,
        attendanceId: attendanceRecord.id,
      });

      console.log(
        `✅ Attendance recorded: ${faceResult.student_name} (${faceResult.confidence})`
      );
    } else {
      res.json({
        success: false,
        message: "Face not recognized",
        reason: faceResult.error || "Unknown person",
      });

      console.log(`❌ Face not recognized from ${deviceId}`);
    }
  } catch (error) {
    console.error("Face scan error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// RFID card attendance
router.post("/attendance/rfid-scan", async (req, res) => {
  try {
    const { deviceId, rfidCard, classId, timestamp, location } = req.body;

    console.log(`🏷️ RFID scan: ${rfidCard} from ${deviceId}`);

    // Find student by RFID card
    const student = await dbStorage.getStudentByRfidCard(rfidCard);

    if (student) {
      // Create attendance record
      const attendanceRecord = await dbStorage.createAttendanceRecord({
        studentId: student.id,
        classId: classId,
        attendanceDate: new Date(timestamp),
        method: "rfid",
        status: "present",
        hardwareId: deviceId,
        confidence: null,
      });

      res.json({
        success: true,
        message: "Attendance recorded successfully",
        studentId: student.studentId,
        studentName: student.userId,
        attendanceId: attendanceRecord.id,
      });

      console.log(`✅ RFID Attendance: ${student.studentId}`);
    } else {
      res.json({
        success: false,
        message: "RFID card not registered",
        rfidCard: rfidCard,
      });

      console.log(`❌ Unknown RFID card: ${rfidCard}`);
    }
  } catch (error) {
    console.error("RFID scan error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Hardware heartbeat
router.post("/hardware/heartbeat", async (req, res) => {
  try {
    const {
      deviceId,
      status,
      batteryLevel,
      signalStrength,
      freeMemory,
      timestamp,
    } = req.body;

    console.log(`💓 Heartbeat from ${deviceId}: ${status}`);

    res.json({
      success: true,
      message: "Heartbeat received",
      serverTime: new Date().toISOString(),
      deviceId: deviceId,
    });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get device configuration
router.get("/hardware/:deviceId/config", async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Return default configuration for now
    res.json({
      success: true,
      device: {
        id: deviceId,
        serverUrl: process.env.SERVER_URL || "http://localhost:5000",
        heartbeatInterval: 30000, // 30 seconds
        captureInterval: 5000, // 5 seconds
        confidence_threshold: 0.7,
      },
    });
  } catch (error) {
    console.error("Get config error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
