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
    console.log(`🔍 Image data length: ${imageData?.length || 0} bytes`);
    console.log(`📋 Class ID: ${classId}, Timestamp: ${timestamp}`);

    // Update device scan statistics
    const device = await dbStorage.getHardwareDeviceByDeviceId(deviceId);
    if (device) {
      await dbStorage.updateHardwareDevice(device.id, {
        totalScans: (device.totalScans || 0) + 1,
        lastHeartbeat: new Date(), // Update last activity
      });
    }

    // Process face recognition (integrate with Python service)
    console.log(
      `🐍 Calling Python service at http://localhost:8000/api/face/recognize`
    );

    const pythonResponse = await fetch(
      `${
        process.env.PYTHON_SERVICE_URL || "http://localhost:8000"
      }/api/face/recognize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceId,
          classId: classId,
          imageData: imageData,
          timestamp: timestamp,
          location: location,
        }),
      }
    );

    console.log(`🐍 Python service response status: ${pythonResponse.status}`);

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.log(`❌ Python service error: ${errorText}`);
      throw new Error(
        `Python service error: ${pythonResponse.status} - ${errorText}`
      );
    }

    const faceResult = await pythonResponse.json();
    console.log(`🐍 Python service result:`, faceResult);

    if (pythonResponse.ok && faceResult.success && faceResult.recognized) {
      // Create attendance record
      const attendanceRecord = await dbStorage.createAttendanceRecord({
        studentId: faceResult.student?.id || "DEBUG_STUDENT_001",
        classId: classId,
        attendanceDate: new Date(timestamp),
        method: "face_recognition",
        status: "present",
        hardwareId: deviceId,
        confidence: faceResult.confidence?.toString() || null,
      });

      // Update successful scan count
      if (device) {
        await dbStorage.updateHardwareDevice(device.id, {
          successfulScans: (device.successfulScans || 0) + 1,
        });
      }

      res.json({
        success: true,
        message: "Attendance recorded successfully",
        student: faceResult.student?.name || "Debug Test Student",
        confidence: faceResult.confidence,
        attendanceId: attendanceRecord.id,
      });

      console.log(
        `✅ Attendance recorded: ${
          faceResult.student?.name || "Debug Student"
        } (${faceResult.confidence})`
      );
    } else {
      // Log failed recognition but don't update successful scans
      if (device) {
        await dbStorage.updateHardwareDevice(device.id, {
          lastErrorMessage: faceResult.error || "Face not recognized",
          lastErrorTime: new Date(),
        });
      }

      res.json({
        success: false,
        message: "Face not recognized",
        reason: faceResult.error || "Unknown person",
      });

      console.log(`❌ Face not recognized from ${deviceId}`);
    }
  } catch (error) {
    console.error("Face scan error:", error);

    // Log error to device if possible
    const device = await dbStorage.getHardwareDeviceByDeviceId(
      req.body.deviceId
    );
    if (device) {
      await dbStorage.updateHardwareDevice(device.id, {
        lastErrorMessage:
          error instanceof Error ? error.message : "Face scan system error",
        lastErrorTime: new Date(),
      });
    }

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
router.post("/heartbeat", async (req, res) => {
  try {
    const {
      deviceId,
      status,
      batteryLevel,
      signalStrength,
      freeMemory,
      timestamp,
      firmwareVersion,
      macAddress,
      localIP,
      uptimeHours,
      totalScans,
      successfulScans,
      errorMessage,
    } = req.body;

    console.log(
      `💓 Heartbeat from ${deviceId}: ${status} (${signalStrength}dBm, ${freeMemory} bytes free)`
    );

    const device = await dbStorage.getHardwareDeviceByDeviceId(deviceId);

    if (device) {
      // Update device with all heartbeat data
      const updateData: Partial<any> = {
        status: status || "online",
        lastHeartbeat: new Date(timestamp || Date.now()),
        batteryLevel: batteryLevel ? parseInt(batteryLevel) : null,
        signalStrength: signalStrength ? parseInt(signalStrength) : null,
        freeMemory: freeMemory ? parseInt(freeMemory) : null,
        ipAddress:
          localIP ||
          req.ip ||
          req.connection.remoteAddress ||
          req.socket.remoteAddress ||
          (req.connection as any)?.socket?.remoteAddress,
      };

      // Update optional fields if provided
      if (firmwareVersion) updateData.firmwareVersion = firmwareVersion;
      if (macAddress) updateData.macAddress = macAddress;
      if (uptimeHours !== undefined)
        updateData.uptimeHours = parseFloat(uptimeHours);
      if (totalScans !== undefined)
        updateData.totalScans = parseInt(totalScans);
      if (successfulScans !== undefined)
        updateData.successfulScans = parseInt(successfulScans);
      if (errorMessage) {
        updateData.lastErrorMessage = errorMessage;
        updateData.lastErrorTime = new Date();
      }

      await dbStorage.updateHardwareDevice(device.id, updateData);

      res.json({
        success: true,
        message: "Heartbeat received",
        serverTime: new Date().toISOString(),
        deviceId: deviceId,
      });
    } else {
      // Device not registered - inform ESP32 to register first
      console.log(`❌ Unregistered device heartbeat: ${deviceId}`);
      res.status(404).json({
        success: false,
        message: "Device not registered",
        action: "register_device",
        deviceId: deviceId,
      });
    }
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Status update for live monitoring
router.post("/status-update", async (req, res) => {
  try {
    const {
      deviceId,
      location,
      status,
      message,
      timestamp,
      lastRecognizedStudent,
      lastConfidence,
      proximityMode,
      motionDetected,
    } = req.body;

    console.log(`📊 Status update from ${deviceId}: ${status} - ${message}`);

    // Update device status in database
    const device = await dbStorage.getHardwareDeviceByDeviceId(deviceId);
    if (device) {
      const updateData: any = {
        lastHeartbeat: new Date(),
        status: status === "error" ? "offline" : "online",
      };

      // Store additional status information
      if (status === "face_recognized" && lastRecognizedStudent) {
        updateData.lastSuccessfulScan = new Date();
        updateData.successfulScans = (device.successfulScans || 0) + 1;
      }

      if (status === "motion_detected" || proximityMode) {
        updateData.lastActivity = new Date();
      }

      await dbStorage.updateHardwareDevice(device.id, updateData);

      // Here you could broadcast to WebSocket clients for real-time updates
      // broadcastStatusUpdate(deviceId, status, message, lastRecognizedStudent, lastConfidence);
    }

    res.json({
      success: true,
      message: "Status update received",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get recent status updates for live monitoring
router.get("/status-updates", async (req, res) => {
  try {
    // In a real implementation, you would store status updates in a separate table
    // For now, we'll return mock data or recent device activity
    const devices = await dbStorage.getAllHardwareDevices();

    const statusUpdates = devices.map((device) => ({
      deviceId: device.deviceId,
      status: device.status === "online" ? "standby" : "offline",
      message:
        device.status === "online"
          ? "Device ready for face recognition"
          : "Device offline",
      timestamp: device.lastHeartbeat || new Date(),
      lastRecognizedStudent: null,
      lastConfidence: null,
      proximityMode: false,
      motionDetected: false,
    }));

    res.json(statusUpdates);
  } catch (error) {
    console.error("Status updates error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get device configuration
router.get("/:deviceId/config", async (req, res) => {
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

// Camera stream endpoint - proxy to ESP32-CAM
router.get("/camera/:deviceId/stream", async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get device details to find IP address
    const device = await dbStorage.getHardwareDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    // Check if device is online and has IP address
    if (device.status === "online" && device.ipAddress) {
      const esp32StreamUrl = `http://${device.ipAddress}/stream`;

      res.json({
        success: true,
        streamUrl: esp32StreamUrl,
        deviceId: deviceId,
        status: device.status,
        message: `Camera stream available at ${esp32StreamUrl}`,
      });
    } else {
      // Device is offline or no IP address - return mock stream for demo
      res.json({
        success: true,
        streamUrl: `/api/hardware/camera/${deviceId}/mock-stream`,
        deviceId: deviceId,
        status: device.status || "offline",
        message:
          device.status === "offline"
            ? "Device offline - showing demo stream"
            : "Device IP unknown - showing demo stream",
        isDemoStream: true,
      });
    }
  } catch (error) {
    console.error("Camera stream error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Mock camera stream for demo/testing purposes
router.get("/camera/:deviceId/mock-stream", (req, res) => {
  res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=frame");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send a simple mock stream with status messages
  const sendFrame = () => {
    const timestamp = new Date().toLocaleTimeString();
    const canvas = `
      <svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1f2937"/>
        <text x="50%" y="40%" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="24">
          ESP32-CAM Demo Stream
        </text>
        <text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="16">
          Device: ${req.params.deviceId}
        </text>
        <text x="50%" y="60%" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="16">
          ${timestamp}
        </text>
        <text x="50%" y="70%" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="14">
          Waiting for real ESP32-CAM connection...
        </text>
      </svg>
    `;

    const svgBuffer = Buffer.from(canvas);
    const boundary = "\r\n--frame\r\n";
    const header =
      "Content-Type: image/svg+xml\r\nContent-Length: " +
      svgBuffer.length +
      "\r\n\r\n";

    res.write(boundary);
    res.write(header);
    res.write(svgBuffer);
  };

  // Send initial frame
  sendFrame();

  // Send new frame every 2 seconds
  const interval = setInterval(sendFrame, 2000);

  // Clean up when client disconnects
  req.on("close", () => {
    clearInterval(interval);
  });
});

// Get camera snapshot
router.get("/camera/:deviceId/snapshot", async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await dbStorage.getHardwareDeviceByDeviceId(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    // For now, return a placeholder response
    // In production, this would capture a frame from ESP32-CAM
    res.json({
      success: true,
      deviceId: deviceId,
      snapshot:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // 1x1 transparent PNG
      timestamp: new Date().toISOString(),
      message:
        device.status === "online"
          ? "Snapshot captured successfully"
          : "Camera is offline - showing placeholder",
    });
  } catch (error) {
    console.error("Camera snapshot error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
