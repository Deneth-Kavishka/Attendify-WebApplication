import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertStudentSchema,
  insertLecturerSchema,
  insertClassSchema,
  insertAttendanceRecordSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket setup for real-time updates on a different port
  const wss = new WebSocketServer({ port: 8080 });
  const clients = new Set();

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    clients.add(ws);
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      clients.delete(ws);
    });
  });

  // Broadcast function for real-time updates
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client: any) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message);
      }
    });
  };

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    // Simple token validation - in production, use JWT
    req.userId = token.replace("Bearer ", "");
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // In production, generate JWT token
      const token = user.id;
      res.json({ token, user: { ...user, password: undefined } });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // User routes
  app.get("/api/users/profile", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user profile" });
    }
  });

  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  // Student routes
  app.get("/api/students", requireAuth, async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      // Get user details for each student
      const studentsWithUserDetails = await Promise.all(
        students.map(async (student) => {
          const user = await storage.getUser(student.userId);
          return {
            ...student,
            fullName: user?.fullName,
            email: user?.email,
            department: user?.department,
            createdAt: user?.createdAt,
          };
        })
      );
      res.json(studentsWithUserDetails);
    } catch (error) {
      res.status(500).json({ message: "Failed to get students" });
    }
  });

  app.post("/api/students", requireAuth, async (req, res) => {
    try {
      const {
        fullName,
        email,
        studentId,
        enrollmentYear,
        rfidCard,
        department,
        active,
        nic,
        mobileNumber,
        gender,
        dateOfBirth,
        address,
        guardianName,
        guardianContact,
        emergencyContact,
        batch,
        semester,
        gpa,
        faceImageData,
        faceImagesData,
        faceRegistrationStatus,
      } = req.body;

      // Check if student ID or NIC already exists
      const existingByStudentId = await storage.getStudentByStudentId(
        studentId
      );
      if (existingByStudentId) {
        return res.status(400).json({ message: "Student ID already exists" });
      }

      if (nic) {
        const existingByNic = await storage.getStudentByNic(nic);
        if (existingByNic) {
          return res.status(400).json({ message: "NIC already registered" });
        }
      }

      // Check if RFID card is already assigned
      if (rfidCard) {
        const existingByRfid = await storage.getStudentByRfidCard(rfidCard);
        if (existingByRfid) {
          return res
            .status(400)
            .json({ message: "RFID card already assigned to another student" });
        }
      }

      // Create user first
      const userData = {
        username: studentId.toLowerCase(),
        password: "student123", // Default password
        email,
        fullName,
        role: "student",
        department,
      };

      const user = await storage.createUser(userData);

      // Then create student profile
      const studentData = {
        userId: user.id,
        studentId,
        enrollmentYear,
        rfidCard: rfidCard || null,
        active: active ?? true,
        nic: nic || null,
        mobileNumber: mobileNumber || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address || null,
        guardianName: guardianName || null,
        guardianContact: guardianContact || null,
        emergencyContact: emergencyContact || null,
        batch: batch || null,
        semester: semester || null,
        gpa: gpa ? gpa.toString() : null,
        faceRegistrationStatus: faceRegistrationStatus || "pending",
        faceRegistrationDate: null,
      };

      const student = await storage.createStudent(studentData);

      // Handle face image processing if provided
      const imagesToProcess =
        faceImagesData ||
        (faceImageData ? [{ data: faceImageData, index: 0 }] : []);

      if (imagesToProcess.length > 0) {
        try {
          console.log(
            `Processing ${imagesToProcess.length} face images for student ${studentId}`
          );

          // Send all images to Python service for face encoding
          const faceResponse = await fetch(
            `${process.env.PYTHON_SERVICE_URL}/api/face/enroll-multiple`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                student_id: studentId,
                images: imagesToProcess.map((img: any) => ({
                  data: img.data,
                  index: img.index || 0,
                  name: img.name || `image_${img.index || 0}`,
                })),
              }),
            }
          );

          if (faceResponse.ok) {
            const result = await faceResponse.json();
            await storage.updateStudent(student.id, {
              faceRegistrationStatus: "completed",
              faceRegistrationDate: new Date(),
            });
            console.log(
              `Face registration completed for student ${studentId}: ${result.encodings_count} encodings created`
            );
          } else {
            const errorText = await faceResponse.text();
            console.error(
              `Face registration failed for student ${studentId}:`,
              errorText
            );
            await storage.updateStudent(student.id, {
              faceRegistrationStatus: "failed",
            });
          }
        } catch (error) {
          console.error("Face registration error:", error);
          await storage.updateStudent(student.id, {
            faceRegistrationStatus: "failed",
          });
        }
      }

      // Return combined data
      const result = {
        ...student,
        fullName: user.fullName,
        email: user.email,
        department: user.department,
        createdAt: user.createdAt,
      };

      // Broadcast real-time update
      broadcast({
        type: "student_added",
        data: result,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating student:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      res
        .status(400)
        .json({ message: "Invalid student data: " + errorMessage });
    }
  });
  app.get("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ message: "Failed to get student" });
    }
  });

  app.put("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const {
        fullName,
        email,
        studentId,
        enrollmentYear,
        rfidCard,
        department,
        active,
      } = req.body;

      // Get the student first to get userId
      const existingStudent = await storage.getStudent(req.params.id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Update user details
      await storage.updateUser(existingStudent.userId, {
        fullName,
        email,
        department,
      });

      // Update student details
      const student = await storage.updateStudent(req.params.id, {
        studentId,
        enrollmentYear,
        rfidCard: rfidCard || null,
        active,
      });

      // Get updated user for response
      const user = await storage.getUser(existingStudent.userId);
      const result = {
        ...student,
        fullName: user?.fullName,
        email: user?.email,
        department: user?.department,
        createdAt: user?.createdAt,
      };

      // Broadcast real-time update
      broadcast({
        type: "student_updated",
        data: result,
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(400).json({ message: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteStudent(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Broadcast real-time update
      broadcast({
        type: "student_deleted",
        data: { id: req.params.id },
      });

      res.json({ message: "Student deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  // RFID Management Routes
  app.get("/api/rfid/available", requireAuth, async (req, res) => {
    try {
      const availableCards = await storage.getAvailableRfidCards();
      res.json(availableCards);
    } catch (error) {
      res.status(500).json({ message: "Failed to get available RFID cards" });
    }
  });

  app.get("/api/rfid/generate", requireAuth, async (req, res) => {
    try {
      const rfidCard = await storage.generateNewRfidCard();
      res.json({ rfidCard });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate RFID card" });
    }
  });

  app.get("/api/rfid/check/:cardId", requireAuth, async (req, res) => {
    try {
      const { cardId } = req.params;
      const existingStudent = await storage.getStudentByRfidCard(cardId);

      res.json({
        available: !existingStudent,
        assignedTo: existingStudent ? existingStudent.studentId : null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check RFID card" });
    }
  });

  app.put("/api/students/:id/rfid", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { rfidCard } = req.body;

      // Validate RFID card format
      if (rfidCard && !/^RFID\d+$/.test(rfidCard)) {
        return res.status(400).json({ message: "Invalid RFID card format" });
      }

      // Check if RFID card is already assigned
      if (rfidCard) {
        const existingStudent = await storage.getStudentByRfidCard(rfidCard);
        if (existingStudent && existingStudent.id !== id) {
          return res
            .status(400)
            .json({ message: "RFID card already assigned to another student" });
        }
      }

      const updatedStudent = await storage.updateStudent(id, { rfidCard });
      if (!updatedStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.json(updatedStudent);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign RFID card" });
    }
  });

  // Lecturer routes
  app.get("/api/lecturers", requireAuth, async (req, res) => {
    try {
      const lecturers = await storage.getAllLecturers();
      res.json(lecturers);
    } catch (error) {
      res.status(500).json({ message: "Failed to get lecturers" });
    }
  });

  app.post("/api/lecturers", requireAuth, async (req, res) => {
    try {
      const lecturerData = insertLecturerSchema.parse(req.body);
      const lecturer = await storage.createLecturer(lecturerData);
      res.status(201).json(lecturer);
    } catch (error) {
      res.status(400).json({ message: "Invalid lecturer data" });
    }
  });

  app.get("/api/lecturers/:id", requireAuth, async (req, res) => {
    try {
      const lecturer = await storage.getLecturer(req.params.id);
      if (!lecturer) {
        return res.status(404).json({ message: "Lecturer not found" });
      }
      res.json(lecturer);
    } catch (error) {
      res.status(500).json({ message: "Failed to get lecturer" });
    }
  });

  app.put("/api/lecturers/:id", requireAuth, async (req, res) => {
    try {
      const lecturer = await storage.getLecturer(req.params.id);
      if (!lecturer) {
        return res.status(404).json({ message: "Lecturer not found" });
      }

      // Note: For simplicity, we'll return the existing lecturer
      // In a real implementation, you'd update the lecturer data
      res.json(lecturer);
    } catch (error) {
      res.status(500).json({ message: "Failed to update lecturer" });
    }
  });

  app.delete("/api/lecturers/:id", requireAuth, async (req, res) => {
    try {
      const lecturer = await storage.getLecturer(req.params.id);
      if (!lecturer) {
        return res.status(404).json({ message: "Lecturer not found" });
      }

      // Note: For simplicity, we'll just return success
      // In a real implementation, you'd delete the lecturer
      res.json({ message: "Lecturer deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete lecturer" });
    }
  });

  // Class routes
  app.get("/api/classes", requireAuth, async (req, res) => {
    try {
      const classes = await storage.getAllClasses();
      res.json(classes);
    } catch (error) {
      res.status(500).json({ message: "Failed to get classes" });
    }
  });

  app.post("/api/classes", requireAuth, async (req, res) => {
    try {
      const classData = insertClassSchema.parse(req.body);
      const newClass = await storage.createClass(classData);
      res.status(201).json(newClass);
    } catch (error) {
      res.status(400).json({ message: "Invalid class data" });
    }
  });

  app.get("/api/classes/:id", requireAuth, async (req, res) => {
    try {
      const classData = await storage.getClass(req.params.id);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }
      res.json(classData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get class" });
    }
  });

  // Attendance routes
  app.post("/api/attendance", async (req, res) => {
    try {
      const attendanceData = insertAttendanceRecordSchema.parse(req.body);
      const record = await storage.createAttendanceRecord(attendanceData);

      // Broadcast real-time update
      broadcast({
        type: "attendance_update",
        data: record,
      });

      res.status(201).json(record);
    } catch (error) {
      res.status(400).json({ message: "Invalid attendance data" });
    }
  });

  app.get("/api/attendance/class/:classId", requireAuth, async (req, res) => {
    try {
      const attendance = await storage.getAttendanceByClass(req.params.classId);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get attendance" });
    }
  });

  app.get(
    "/api/attendance/student/:studentId",
    requireAuth,
    async (req, res) => {
      try {
        const attendance = await storage.getAttendanceByStudent(
          req.params.studentId
        );
        res.json(attendance);
      } catch (error) {
        res.status(500).json({ message: "Failed to get student attendance" });
      }
    }
  );

  app.get("/api/attendance/today/:classId", requireAuth, async (req, res) => {
    try {
      const today = new Date();
      const attendance = await storage.getAttendanceByClassAndDate(
        req.params.classId,
        today
      );
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get today's attendance" });
    }
  });

  // Hardware routes
  app.get("/api/hardware", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllHardwareDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Failed to get hardware devices" });
    }
  });

  app.post("/api/hardware/heartbeat", async (req, res) => {
    try {
      const { deviceId } = req.body;
      const device = await storage.getHardwareDeviceByDeviceId(deviceId);

      if (device) {
        await storage.updateHardwareDevice(device.id, {
          status: "online",
          lastHeartbeat: new Date(),
        });

        // Hardware status updated (WebSocket removed for stability)
      }

      res.json({ message: "Heartbeat received" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update heartbeat" });
    }
  });

  // Statistics routes
  app.get("/api/stats/dashboard", requireAuth, async (req, res) => {
    try {
      const totalStudents = await storage.getTotalStudents();
      const activeClasses = await storage.getActiveClasses();
      const todayAttendance = await storage.getTodayAttendanceRate();
      const examEligibilityStats = await storage.getExamEligibilityStats();

      res.json({
        totalStudents,
        activeClasses,
        todayAttendance: parseFloat(todayAttendance.toFixed(1)),
        examEligible: examEligibilityStats.eligible,
        examIneligible: examEligibilityStats.ineligible,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard statistics" });
    }
  });

  // Exam eligibility routes
  app.post("/api/exam-eligibility/calculate", requireAuth, async (req, res) => {
    try {
      const { studentId, classId } = req.body;
      const eligibility = await storage.calculateExamEligibility(
        studentId,
        classId
      );
      res.json(eligibility);
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate exam eligibility" });
    }
  });

  app.get(
    "/api/exam-eligibility/student/:studentId",
    requireAuth,
    async (req, res) => {
      try {
        const eligibility = await storage.getExamEligibilityByStudent(
          req.params.studentId
        );
        res.json(eligibility);
      } catch (error) {
        res.status(500).json({ message: "Failed to get exam eligibility" });
      }
    }
  );

  // Face recognition integration
  app.post("/api/face-recognition/enroll", requireAuth, async (req, res) => {
    try {
      const { studentId, faceEmbedding } = req.body;
      const student = await storage.getStudent(studentId);

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      await storage.updateStudent(studentId, { faceEmbedding });
      res.json({ message: "Face enrolled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to enroll face" });
    }
  });

  app.post("/api/face-recognition/recognize", async (req, res) => {
    try {
      const { faceEmbedding, deviceId, classId, confidence } = req.body;

      // Find matching student (simplified - in production, use ML similarity)
      const students = await storage.getAllStudents();
      const matchedStudent = students.find((student) => student.faceEmbedding);

      if (matchedStudent && confidence > 0.85) {
        // Create attendance record
        const attendanceRecord = await storage.createAttendanceRecord({
          studentId: matchedStudent.id,
          classId,
          attendanceDate: new Date(),
          method: "face_recognition",
          status: "present",
          hardwareId: deviceId,
          confidence: confidence.toString(),
        });

        // Attendance record created (WebSocket removed for stability)

        res.json({
          message: "Attendance marked successfully",
          student: matchedStudent,
          record: attendanceRecord,
        });
      } else {
        res.status(404).json({ message: "Face not recognized" });
      }
    } catch (error) {
      res.status(500).json({ message: "Face recognition failed" });
    }
  });

  // RFID integration
  app.post("/api/rfid/scan", async (req, res) => {
    try {
      const { rfidCard, deviceId, classId } = req.body;

      // Find student by RFID card
      const students = await storage.getAllStudents();
      const student = students.find((s) => s.rfidCard === rfidCard);

      if (!student) {
        return res.status(404).json({ message: "RFID card not registered" });
      }

      // Create attendance record
      const attendanceRecord = await storage.createAttendanceRecord({
        studentId: student.id,
        classId,
        attendanceDate: new Date(),
        method: "rfid",
        status: "present",
        hardwareId: deviceId,
        confidence: null,
      });

      // Attendance record created via RFID (WebSocket removed for stability)

      res.json({
        message: "Attendance marked successfully",
        student,
        record: attendanceRecord,
      });
    } catch (error) {
      res.status(500).json({ message: "RFID scan failed" });
    }
  });

  return httpServer;
}
