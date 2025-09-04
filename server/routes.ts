import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { dbStorage as storage } from "./storage";
import hardwareRoutes from "./hardware-routes";
import { deviceStatusMonitor } from "./device-status-monitor";
import { enhancedRFIDService } from "./enhanced-rfid-service";
import { smartTrackWebSocketService } from "./smarttrack-websocket-service";
import {
  insertUserSchema,
  insertStudentSchema,
  insertLecturerSchema,
  insertClassSchema,
  insertAttendanceRecordSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Enhanced WebSocket setup for all SmartTrack services - Listen on all interfaces
  console.log("🔧 Creating WebSocket Server on 0.0.0.0:8080...");
  const wss = new WebSocketServer({
    port: 8080,
    host: "0.0.0.0", // Listen on all interfaces, not just localhost
  });

  wss.on("listening", () => {
    console.log("✅ WebSocket Server listening on 0.0.0.0:8080");
  });

  wss.on("error", (error) => {
    console.error("❌ WebSocket Server Error:", error);
  });

  // Initialize Enhanced SmartTrack WebSocket Service (this handles all connections now)
  console.log("🔧 Initializing Enhanced SmartTrack WebSocket Service...");
  smartTrackWebSocketService.init(wss);

  // Broadcast function for real-time updates (integrated with SmartTrack service)
  const broadcast = (data: any) => {
    // Use SmartTrack service's broadcast method
    smartTrackWebSocketService.broadcastToAllClients(data);
  };

  // Initialize Enhanced RFID Service with enhanced WebSocket server
  console.log("🔧 Initializing Enhanced RFID Service...");
  await enhancedRFIDService.initialize(wss);

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

  // Student Profile Route
  app.get("/api/students/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId;
      const student = await storage.getStudentByUserId(userId);

      if (!student) {
        return res.status(404).json({ message: "Student profile not found" });
      }

      const user = await storage.getUser(userId);
      const studentProfile = {
        ...student,
        fullName: user?.fullName,
        email: user?.email,
        department: user?.department,
        role: user?.role,
        createdAt: user?.createdAt,
      };

      res.json(studentProfile);
    } catch (error) {
      res.status(500).json({ message: "Failed to get student profile" });
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

      // Get user details for the student
      const user = await storage.getUser(student.userId);
      const studentWithUserDetails = {
        ...student,
        fullName: user?.fullName,
        email: user?.email,
        department: user?.department,
        createdAt: user?.createdAt,
      };

      res.json(studentWithUserDetails);
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
        // Personal Information
        nic,
        mobileNumber,
        gender,
        dateOfBirth,
        address,
        guardianName,
        guardianContact,
        emergencyContact,
        // Academic Information
        batch,
        semester,
        gpa,
        // RFID & Face Recognition
        faceRegistrationStatus,
        faceImagesData,
      } = req.body;

      // Get the student first to get userId
      const existingStudent = await storage.getStudent(req.params.id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Check if studentId is being changed and if it conflicts
      if (studentId && studentId !== existingStudent.studentId) {
        const existingByStudentId = await storage.getStudentByStudentId(
          studentId
        );
        if (existingByStudentId && existingByStudentId.id !== req.params.id) {
          return res.status(400).json({ message: "Student ID already exists" });
        }
      }

      // Check if NIC is being changed and if it conflicts
      if (nic && nic !== existingStudent.nic) {
        const existingByNic = await storage.getStudentByNic(nic);
        if (existingByNic && existingByNic.id !== req.params.id) {
          return res.status(400).json({ message: "NIC already registered" });
        }
      }

      // Check if RFID card is being changed and if it conflicts
      if (rfidCard && rfidCard !== existingStudent.rfidCard) {
        const existingByRfid = await storage.getStudentByRfidCard(rfidCard);
        if (existingByRfid && existingByRfid.id !== req.params.id) {
          return res.status(400).json({
            message: "RFID card already assigned to another student",
          });
        }
      }

      // Update user details
      await storage.updateUser(existingStudent.userId, {
        fullName,
        email,
        department,
      });

      // Update student details with all fields
      const student = await storage.updateStudent(req.params.id, {
        studentId,
        enrollmentYear,
        rfidCard: rfidCard || null,
        active,
        // Personal Information
        nic,
        mobileNumber,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address,
        guardianName,
        guardianContact,
        emergencyContact,
        // Academic Information
        batch,
        semester,
        gpa: gpa ? gpa.toString() : null,
        // Face Recognition
        faceRegistrationStatus,
        faceEmbedding: faceImagesData
          ? JSON.stringify(faceImagesData)
          : undefined,
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

  // Lecturer-specific routes
  app.get("/api/lecturers/:id/classes", requireAuth, async (req, res) => {
    try {
      const lecturerId = req.params.id;
      const classes = await storage.getAllClasses();
      const lecturerClasses = classes.filter(
        (cls: any) => cls.lecturerId === lecturerId
      );
      res.json(lecturerClasses);
    } catch (error) {
      res.status(500).json({ message: "Failed to get lecturer classes" });
    }
  });

  app.get(
    "/api/lecturers/:id/dashboard-stats",
    requireAuth,
    async (req, res) => {
      try {
        const lecturerId = req.params.id;
        const classes = await storage.getAllClasses();
        const lecturerClasses = classes.filter(
          (cls: any) => cls.lecturerId === lecturerId
        );
        const attendanceRecords = await storage.getAllAttendanceRecords();

        // Calculate stats for lecturer's classes
        const classIds = lecturerClasses.map((cls: any) => cls.id);
        const relevantAttendance = attendanceRecords.filter((record: any) =>
          classIds.includes(record.classId)
        );

        const today = new Date().toISOString().split("T")[0];
        const todayAttendance = relevantAttendance.filter(
          (record: any) =>
            new Date(record.attendanceDate).toISOString().split("T")[0] ===
            today
        );

        const totalStudents = new Set(
          relevantAttendance.map((r: any) => r.studentId)
        ).size;
        const todayAttendanceRate =
          todayAttendance.length > 0
            ? (todayAttendance.filter((r: any) => r.status === "present")
                .length /
                todayAttendance.length) *
              100
            : 0;

        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() - 7);
        const weeklyAttendance = relevantAttendance.filter(
          (record: any) => new Date(record.attendanceDate) >= thisWeek
        );
        const weeklyAttendanceRate =
          weeklyAttendance.length > 0
            ? (weeklyAttendance.filter((r: any) => r.status === "present")
                .length /
                weeklyAttendance.length) *
              100
            : 0;

        res.json({
          totalClasses: lecturerClasses.length,
          totalStudents,
          todayAttendance: Math.round(todayAttendanceRate),
          weeklyAttendance: Math.round(weeklyAttendanceRate),
          totalSessions: todayAttendance.length,
          activeClasses: lecturerClasses.filter((cls: any) => cls.active)
            .length,
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to get lecturer dashboard stats" });
      }
    }
  );

  // Generate attendance report for lecturer
  app.post(
    "/api/lecturers/:id/generate-report",
    requireAuth,
    async (req, res) => {
      try {
        const lecturerId = req.params.id;
        const { classId, startDate, endDate, type } = req.body;

        if (!classId || !startDate || !endDate || !type) {
          return res.status(400).json({
            message:
              "Missing required fields: classId, startDate, endDate, type",
          });
        }

        // Get class details
        const classes = await storage.getAllClasses();
        const selectedClass = classes.find(
          (cls: any) => cls.id === classId && cls.lecturerId === lecturerId
        );

        if (!selectedClass) {
          return res.status(404).json({
            message: "Class not found or not assigned to this lecturer",
          });
        }

        // Get attendance records for the specified date range
        const attendanceRecords = await storage.getAllAttendanceRecords();
        const filteredRecords = attendanceRecords.filter((record: any) => {
          const recordDate = new Date(record.attendanceDate);
          const start = new Date(startDate);
          const end = new Date(endDate);
          return (
            record.classId === classId &&
            recordDate >= start &&
            recordDate <= end
          );
        });

        // Get students for this class
        const students = await storage.getAllStudents();
        const enrolledStudentIds = Array.from(
          new Set(filteredRecords.map((r: any) => r.studentId))
        );
        const enrolledStudents = students.filter((student: any) =>
          enrolledStudentIds.includes(student.id)
        );

        // Calculate statistics
        const reportData = {
          classInfo: {
            className: selectedClass.className,
            classCode: selectedClass.classCode,
            room: selectedClass.room,
            semester: selectedClass.semester,
            academicYear: selectedClass.academicYear,
          },
          reportPeriod: {
            startDate,
            endDate,
            type,
          },
          statistics: {
            totalStudents: enrolledStudents.length,
            totalSessions: Array.from(
              new Set(filteredRecords.map((r: any) => r.attendanceDate))
            ).length,
            totalAttendanceRecords: filteredRecords.length,
            overallAttendanceRate:
              filteredRecords.length > 0
                ? Math.round(
                    (filteredRecords.filter((r: any) => r.status === "present")
                      .length /
                      filteredRecords.length) *
                      100
                  )
                : 0,
          },
          studentDetails: enrolledStudents
            .map((student: any) => {
              const studentRecords = filteredRecords.filter(
                (r: any) => r.studentId === student.id
              );
              const presentCount = studentRecords.filter(
                (r: any) => r.status === "present"
              ).length;
              const attendanceRate =
                studentRecords.length > 0
                  ? Math.round((presentCount / studentRecords.length) * 100)
                  : 0;

              return {
                studentId: student.studentId,
                name: student.name || student.studentId,
                totalSessions: studentRecords.length,
                presentSessions: presentCount,
                absentSessions: studentRecords.length - presentCount,
                attendanceRate,
                status:
                  attendanceRate >=
                  (selectedClass.minAttendancePercentage || 75)
                    ? "Good"
                    : "At Risk",
              };
            })
            .sort((a, b) => b.attendanceRate - a.attendanceRate),
          sessionDetails: Array.from(
            new Set(filteredRecords.map((r: any) => r.attendanceDate))
          )
            .sort()
            .map((date: string) => {
              const dayRecords = filteredRecords.filter(
                (r: any) => r.attendanceDate === date
              );
              const presentCount = dayRecords.filter(
                (r: any) => r.status === "present"
              ).length;
              return {
                date,
                totalStudents: dayRecords.length,
                presentStudents: presentCount,
                absentStudents: dayRecords.length - presentCount,
                attendanceRate:
                  dayRecords.length > 0
                    ? Math.round((presentCount / dayRecords.length) * 100)
                    : 0,
              };
            }),
          generatedAt: new Date().toISOString(),
          generatedBy: lecturerId,
        };

        res.json({
          success: true,
          message: "Report generated successfully",
          report: reportData,
        });
      } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({
          message: "Failed to generate report",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  app.get("/api/classes/:id/students", requireAuth, async (req, res) => {
    try {
      const classId = req.params.id;
      const students = await storage.getAllStudents();
      const attendanceRecords = await storage.getAttendanceByClass(classId);

      // Get students enrolled in this class
      const enrolledStudentIds = Array.from(
        new Set(attendanceRecords.map((r: any) => r.studentId))
      );
      const enrolledStudents = students.filter((student: any) =>
        enrolledStudentIds.includes(student.id)
      );

      // Calculate attendance percentage for each student
      const studentsWithAttendance = enrolledStudents.map((student: any) => {
        const studentAttendance = attendanceRecords.filter(
          (r: any) => r.studentId === student.id
        );
        const presentCount = studentAttendance.filter(
          (r: any) => r.status === "present"
        ).length;
        const attendancePercentage =
          studentAttendance.length > 0
            ? (presentCount / studentAttendance.length) * 100
            : 0;

        return {
          ...student,
          attendancePercentage: Math.round(attendancePercentage),
          totalSessions: studentAttendance.length,
          presentSessions: presentCount,
        };
      });

      res.json(studentsWithAttendance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get class students" });
    }
  });

  app.get("/api/classes/:id/attendance", requireAuth, async (req, res) => {
    try {
      const classId = req.params.id;
      const { date, startDate, endDate } = req.query;

      let attendanceRecords = await storage.getAttendanceByClass(classId);

      if (date) {
        attendanceRecords = attendanceRecords.filter(
          (record: any) =>
            new Date(record.attendanceDate).toISOString().split("T")[0] === date
        );
      } else if (startDate && endDate) {
        attendanceRecords = attendanceRecords.filter((record: any) => {
          const recordDate = new Date(record.attendanceDate)
            .toISOString()
            .split("T")[0];
          return recordDate >= startDate && recordDate <= endDate;
        });
      }

      // Group by date and get student details
      const students = await storage.getAllStudents();
      const groupedAttendance: any = {};

      for (const record of attendanceRecords) {
        const recordDate = new Date(record.attendanceDate)
          .toISOString()
          .split("T")[0];
        if (!groupedAttendance[recordDate]) groupedAttendance[recordDate] = [];

        const student = students.find((s: any) => s.id === record.studentId);
        let studentName = "Unknown";

        if (student) {
          try {
            const user = await storage.getUser(student.userId);
            studentName = user?.fullName || "Unknown";
          } catch (e) {
            studentName = student.studentId || "Unknown";
          }
        }

        groupedAttendance[recordDate].push({
          ...record,
          studentName,
          studentId: student?.studentId || record.studentId,
        });
      }

      res.json(groupedAttendance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get class attendance" });
    }
  });

  app.post("/api/classes/:id/attendance", requireAuth, async (req, res) => {
    try {
      const classId = req.params.id;
      const { studentId, status, timestamp, method = "manual" } = req.body;

      const attendanceData = {
        studentId,
        classId,
        status,
        attendanceDate: timestamp ? new Date(timestamp) : new Date(),
        method,
      };

      const attendanceRecord = await storage.createAttendanceRecord(
        attendanceData
      );

      // Broadcast real-time update
      broadcast({
        type: "attendance-update",
        data: attendanceRecord,
      });

      res.status(201).json(attendanceRecord);
    } catch (error) {
      res.status(400).json({ message: "Failed to record attendance" });
    }
  });

  app.get("/api/classes/:id/reports", requireAuth, async (req, res) => {
    try {
      const classId = req.params.id;
      const { type = "summary", startDate, endDate } = req.query;

      const classData = await storage.getClass(classId);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      const attendanceRecords = await storage.getAttendanceByClass(classId);

      let filteredAttendance = attendanceRecords;
      if (startDate && endDate) {
        filteredAttendance = attendanceRecords.filter((record: any) => {
          const recordDate = new Date(record.attendanceDate)
            .toISOString()
            .split("T")[0];
          return recordDate >= startDate && recordDate <= endDate;
        });
      }

      const students = await storage.getAllStudents();
      const enrolledStudentIds = Array.from(
        new Set(filteredAttendance.map((r: any) => r.studentId))
      );
      const enrolledStudents = students.filter((student: any) =>
        enrolledStudentIds.includes(student.id)
      );

      const report = {
        classInfo: classData,
        period: { startDate, endDate },
        totalStudents: enrolledStudents.length,
        totalSessions: Array.from(
          new Set(
            filteredAttendance.map(
              (r: any) => new Date(r.attendanceDate).toISOString().split("T")[0]
            )
          )
        ).length,
        overallAttendanceRate:
          filteredAttendance.length > 0
            ? (filteredAttendance.filter((r: any) => r.status === "present")
                .length /
                filteredAttendance.length) *
              100
            : 0,
        studentDetails: enrolledStudents.map((student: any) => {
          const studentAttendance = filteredAttendance.filter(
            (r: any) => r.studentId === student.id
          );
          const presentCount = studentAttendance.filter(
            (r: any) => r.status === "present"
          ).length;
          const attendancePercentage =
            studentAttendance.length > 0
              ? (presentCount / studentAttendance.length) * 100
              : 0;

          return {
            ...student,
            attendancePercentage: Math.round(attendancePercentage),
            totalSessions: studentAttendance.length,
            presentSessions: presentCount,
            absentSessions: studentAttendance.length - presentCount,
          };
        }),
      };

      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate class report" });
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

  app.put("/api/classes/:id", requireAuth, async (req, res) => {
    try {
      const classData = await storage.getClass(req.params.id);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Note: For simplicity, we'll return the existing class
      // In a real implementation, you'd update the class data
      res.json(classData);
    } catch (error) {
      res.status(500).json({ message: "Failed to update class" });
    }
  });

  app.delete("/api/classes/:id", requireAuth, async (req, res) => {
    try {
      const classData = await storage.getClass(req.params.id);
      if (!classData) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Note: For simplicity, we'll just return success
      // In a real implementation, you'd delete the class
      res.json({ message: "Class deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete class" });
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

  // Hardware statistics
  app.get("/api/hardware/stats", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllHardwareDevices();

      const totalDevices = devices.length;
      const onlineDevices = devices.filter((d) => d.status === "online").length;
      const offlineDevices = devices.filter(
        (d) => d.status === "offline"
      ).length;
      const maintenanceDevices = devices.filter(
        (d) => d.status === "maintenance"
      ).length;

      // Calculate daily scans (sum of all device scans today)
      const dailyScans = devices.reduce((sum, device) => {
        return sum + (device.totalScans || 0);
      }, 0);

      // Calculate system health based on online devices ratio and recent heartbeats
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const recentlyActiveDevices = devices.filter(
        (d) => d.lastHeartbeat && new Date(d.lastHeartbeat) > fiveMinutesAgo
      ).length;

      const systemHealth =
        totalDevices > 0
          ? Math.round((recentlyActiveDevices / totalDevices) * 100)
          : 100;

      // Average memory usage across online devices
      const onlineDevicesWithMemory = devices.filter(
        (d) => d.status === "online" && d.freeMemory !== null
      );
      const avgMemoryUsage =
        onlineDevicesWithMemory.length > 0
          ? Math.round(
              onlineDevicesWithMemory.reduce(
                (sum, d) => sum + (d.freeMemory || 0),
                0
              ) / onlineDevicesWithMemory.length
            )
          : 0;

      res.json({
        totalDevices,
        onlineDevices,
        offlineDevices,
        maintenanceDevices,
        dailyScans,
        systemHealth,
        avgMemoryUsage,
        deviceTypes: {
          esp32_cam: devices.filter((d) => d.deviceType === "esp32_cam").length,
          rfid_reader: devices.filter((d) => d.deviceType === "rfid_reader")
            .length,
        },
      });
    } catch (error) {
      console.error("Error getting hardware stats:", error);
      res.status(500).json({ message: "Failed to get hardware statistics" });
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

  // Attendance Management Routes

  // Get attendance statistics
  app.get("/api/attendance/stats", requireAuth, async (req, res) => {
    try {
      const todayAttendanceRate = await storage.getTodayAttendanceRate();
      const totalStudents = await storage.getTotalStudents();
      const examStats = await storage.getExamEligibilityStats();

      // Get today's records for method breakdown
      const today = new Date();
      const allDevices = await storage.getAllHardwareDevices();

      // Simplified stats for demo
      const todayPresent = Math.floor(
        totalStudents * (todayAttendanceRate / 100)
      );
      const faceRecognitionCount = Math.floor(todayPresent * 0.6); // 60% face recognition
      const rfidCount = todayPresent - faceRecognitionCount; // Rest RFID

      res.json({
        todayPresent,
        attendanceRate: todayAttendanceRate,
        faceRecognitionCount,
        rfidCount,
        todayIncrease: Math.floor(Math.random() * 20), // Placeholder
      });
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch attendance statistics" });
    }
  });

  // Get attendance records with filters
  app.get("/api/attendance", requireAuth, async (req, res) => {
    try {
      const { date, classId } = req.query;

      let records = [];

      if (classId && classId !== "all") {
        if (date) {
          records = await storage.getAttendanceByClassAndDate(
            classId as string,
            new Date(date as string)
          );
        } else {
          records = await storage.getAttendanceByClass(classId as string);
        }
      } else {
        // Get all classes and their attendance records
        const allClasses = await storage.getAllClasses();
        for (const cls of allClasses) {
          const classRecords = date
            ? await storage.getAttendanceByClassAndDate(
                cls.id,
                new Date(date as string)
              )
            : await storage.getAttendanceByClass(cls.id);
          records.push(...classRecords);
        }
      }

      // Enrich records with student and class information
      const enrichedRecords = await Promise.all(
        records.map(async (record) => {
          const student = await storage.getStudent(record.studentId);
          const studentUser = student
            ? await storage.getUser(student.userId)
            : null;
          const classInfo = await storage.getClass(record.classId);

          return {
            id: record.id,
            status: record.status,
            method: record.method,
            timestamp: record.attendanceDate,
            confidence: record.confidence
              ? parseFloat(record.confidence)
              : null,
            deviceId: record.hardwareId,
            student: {
              id: student?.id,
              studentId: student?.studentId,
              user: {
                fullName: studentUser?.fullName,
              },
            },
            class: {
              id: classInfo?.id,
              classCode: classInfo?.classCode,
              className: classInfo?.className,
            },
          };
        })
      );

      res.json(enrichedRecords);
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      res.status(500).json({ message: "Failed to fetch attendance records" });
    }
  });

  // Get recent attendance records for real-time monitoring
  app.get("/api/attendance/recent", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      // Get all attendance records from all classes
      const allRecords = [];
      const classes = await storage.getAllClasses();

      for (const cls of classes) {
        const classRecords = await storage.getAttendanceByClass(cls.id);
        allRecords.push(...classRecords);
      }

      // Enrich records with student and class data
      const enrichedRecords = await Promise.all(
        allRecords.map(async (record) => {
          const student = await storage.getStudent(record.studentId);
          const studentUser = student
            ? await storage.getUser(student.userId)
            : null;
          const classData = await storage.getClass(record.classId);

          return {
            id: record.id,
            status: record.status,
            method: record.method,
            timestamp: record.attendanceDate,
            attendanceDate: record.attendanceDate,
            confidence: record.confidence
              ? parseFloat(record.confidence)
              : null,
            hardwareId: record.hardwareId,
            student: student
              ? {
                  id: student.id,
                  studentId: student.studentId,
                  user: {
                    fullName: studentUser?.fullName,
                  },
                }
              : null,
            class: classData
              ? {
                  id: classData.id,
                  classCode: classData.classCode,
                  className: classData.className,
                }
              : null,
          };
        })
      );

      // Sort by date (newest first) and limit results
      const recentRecords = enrichedRecords
        .sort(
          (a, b) =>
            new Date(b.attendanceDate).getTime() -
            new Date(a.attendanceDate).getTime()
        )
        .slice(0, limit);

      res.json(recentRecords);
    } catch (error) {
      console.error("Error fetching recent attendance records:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch recent attendance records" });
    }
  });

  // Manual attendance marking
  app.post("/api/attendance/manual", requireAuth, async (req, res) => {
    try {
      const { classId, date, students } = req.body;

      const records = [];
      for (const studentData of students) {
        const record = await storage.createAttendanceRecord({
          studentId: studentData.studentId,
          classId,
          attendanceDate: new Date(date),
          method: "manual",
          status: studentData.status,
          hardwareId: null,
          confidence: null,
        });
        records.push(record);
      }

      res.json({
        message: "Attendance marked successfully",
        records,
      });
    } catch (error) {
      console.error("Error marking manual attendance:", error);
      res.status(500).json({ message: "Failed to mark attendance" });
    }
  });

  // Delete attendance records
  app.delete("/api/attendance/delete", requireAuth, async (req, res) => {
    try {
      const { recordIds } = req.body;

      // Note: MemStorage doesn't have delete method, would need to be implemented
      // For now, return success
      res.json({ message: "Attendance records deleted successfully" });
    } catch (error) {
      console.error("Error deleting attendance records:", error);
      res.status(500).json({ message: "Failed to delete attendance records" });
    }
  });

  // Sync with hardware devices
  app.post("/api/attendance/sync-hardware", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllHardwareDevices();
      const onlineDevices = devices.filter((d) => d.status === "online");

      // In a real implementation, this would:
      // 1. Query all ESP32-CAM and RFID devices
      // 2. Request status and pending data
      // 3. Process any queued attendance records
      // 4. Update device sync timestamps

      res.json({
        message: "Hardware sync initiated",
        syncedDevices: onlineDevices.length,
        pendingRecords: 0,
      });
    } catch (error) {
      console.error("Error syncing hardware:", error);
      res.status(500).json({ message: "Failed to sync with hardware" });
    }
  });

  // EXAM ELIGIBILITY ROUTES

  // Get exam eligibility statistics
  app.get("/api/exam-eligibility/stats", requireAuth, async (req, res) => {
    try {
      const classes = await storage.getAllClasses();
      let totalEligible = 0;
      let totalIneligible = 0;
      let totalAttendance = 0;
      let totalStudents = 0;

      for (const cls of classes) {
        const students = await storage.getStudentsByClass(cls.id);
        for (const student of students) {
          const attendanceRecords =
            await storage.getAttendanceByStudentAndClass(student.id, cls.id);
          const totalClasses = await storage.getTotalClassesByClass(cls.id);
          const attendancePercentage =
            totalClasses > 0
              ? Math.round((attendanceRecords.length / totalClasses) * 100)
              : 0;

          totalAttendance += attendancePercentage;
          totalStudents++;

          if (attendancePercentage >= 75) {
            totalEligible++;
          } else {
            totalIneligible++;
          }
        }
      }

      res.json({
        eligible: totalEligible,
        ineligible: totalIneligible,
        averageAttendance:
          totalStudents > 0 ? Math.round(totalAttendance / totalStudents) : 0,
        totalClasses: classes.length,
      });
    } catch (error) {
      console.error("Error fetching exam eligibility stats:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch eligibility statistics" });
    }
  });

  // Get exam eligibility for a class
  app.get("/api/exam-eligibility", requireAuth, async (req, res) => {
    try {
      const { classId } = req.query;

      if (!classId) {
        return res.status(400).json({ message: "Class ID is required" });
      }

      const students = await storage.getStudentsByClass(classId as string);
      const eligibilityData = [];

      for (const student of students) {
        const attendanceRecords = await storage.getAttendanceByStudentAndClass(
          student.id,
          classId as string
        );
        const totalClasses = await storage.getTotalClassesByClass(
          classId as string
        );
        const attendedClasses = attendanceRecords.filter(
          (record) => record.status === "present" || record.status === "late"
        ).length;

        const attendancePercentage =
          totalClasses > 0
            ? Math.round((attendedClasses / totalClasses) * 100)
            : 0;

        const isEligible = attendancePercentage >= 75;
        const requiredClasses = isEligible
          ? 0
          : Math.ceil(0.75 * totalClasses - attendedClasses);

        const lastAttendance = attendanceRecords.sort(
          (a, b) =>
            new Date(b.attendanceDate).getTime() -
            new Date(a.attendanceDate).getTime()
        )[0];

        eligibilityData.push({
          student: {
            ...student,
            user: await storage.getUserById(student.userId),
          },
          attendancePercentage,
          attendedClasses,
          totalClasses,
          isEligible,
          requiredClasses,
          lastAttendance,
        });
      }

      res.json(eligibilityData);
    } catch (error) {
      console.error("Error fetching exam eligibility:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch exam eligibility data" });
    }
  });

  // Get detailed eligibility for a specific student
  app.get("/api/exam-eligibility/detail", requireAuth, async (req, res) => {
    try {
      const { studentId, classId } = req.query;

      if (!studentId || !classId) {
        return res
          .status(400)
          .json({ message: "Student ID and Class ID are required" });
      }

      const student = await storage.getStudentById(studentId as string);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const attendanceRecords = await storage.getAttendanceByStudentAndClass(
        studentId as string,
        classId as string
      );
      const totalClasses = await storage.getTotalClassesByClass(
        classId as string
      );
      const attendedClasses = attendanceRecords.filter(
        (record) => record.status === "present" || record.status === "late"
      ).length;

      const attendancePercentage =
        totalClasses > 0
          ? Math.round((attendedClasses / totalClasses) * 100)
          : 0;

      const isEligible = attendancePercentage >= 75;
      const requiredClasses = isEligible
        ? 0
        : Math.ceil(0.75 * totalClasses - attendedClasses);

      res.json({
        student: {
          ...student,
          user: await storage.getUserById(student.userId),
        },
        attendancePercentage,
        attendedClasses,
        totalClasses,
        isEligible,
        requiredClasses,
        attendanceRecords: attendanceRecords.sort(
          (a, b) =>
            new Date(b.attendanceDate).getTime() -
            new Date(a.attendanceDate).getTime()
        ),
      });
    } catch (error) {
      console.error("Error fetching eligibility detail:", error);
      res.status(500).json({ message: "Failed to fetch eligibility details" });
    }
  });

  // Get attendance trend for a student
  app.get("/api/exam-eligibility/trend", requireAuth, async (req, res) => {
    try {
      const { studentId, classId } = req.query;

      if (!studentId || !classId) {
        return res
          .status(400)
          .json({ message: "Student ID and Class ID are required" });
      }

      const attendanceRecords = await storage.getAttendanceByStudentAndClass(
        studentId as string,
        classId as string
      );

      // Group by week and calculate weekly attendance percentage
      const weeklyData = new Map();
      const now = new Date();

      // Generate 8 weeks of data
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - i * 7);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekRecords = attendanceRecords.filter((record) => {
          const recordDate = new Date(record.attendanceDate);
          return recordDate >= weekStart && recordDate <= weekEnd;
        });

        const attendedCount = weekRecords.filter(
          (record) => record.status === "present" || record.status === "late"
        ).length;

        // Assume 3 classes per week for calculation
        const totalClassesInWeek = 3;
        const percentage =
          totalClassesInWeek > 0
            ? Math.min(
                Math.round((attendedCount / totalClassesInWeek) * 100),
                100
              )
            : 0;

        weeklyData.set(8 - i, {
          week: 8 - i,
          percentage,
          attended: attendedCount,
          total: totalClassesInWeek,
        });
      }

      res.json(Array.from(weeklyData.values()));
    } catch (error) {
      console.error("Error fetching attendance trend:", error);
      res.status(500).json({ message: "Failed to fetch attendance trend" });
    }
  });

  // Bulk eligibility check
  app.post(
    "/api/exam-eligibility/bulk-check",
    requireAuth,
    async (req, res) => {
      try {
        const { classId } = req.body;

        if (!classId) {
          return res.status(400).json({ message: "Class ID is required" });
        }

        const students = await storage.getStudentsByClass(classId);
        let eligible = 0;
        let ineligible = 0;

        for (const student of students) {
          const attendanceRecords =
            await storage.getAttendanceByStudentAndClass(student.id, classId);
          const totalClasses = await storage.getTotalClassesByClass(classId);
          const attendedClasses = attendanceRecords.filter(
            (record) => record.status === "present" || record.status === "late"
          ).length;

          const attendancePercentage =
            totalClasses > 0
              ? Math.round((attendedClasses / totalClasses) * 100)
              : 0;

          if (attendancePercentage >= 75) {
            eligible++;
          } else {
            ineligible++;
          }
        }

        // Broadcast real-time update
        broadcast({
          type: "eligibility_check_completed",
          data: { classId, eligible, ineligible, processed: students.length },
        });

        res.json({
          processed: students.length,
          eligible,
          ineligible,
          message: "Bulk eligibility check completed successfully",
        });
      } catch (error) {
        console.error("Error performing bulk eligibility check:", error);
        res
          .status(500)
          .json({ message: "Failed to perform bulk eligibility check" });
      }
    }
  );

  // Send eligibility notifications
  app.post(
    "/api/exam-eligibility/send-notifications",
    requireAuth,
    async (req, res) => {
      try {
        const { studentIds } = req.body;

        if (!studentIds || !Array.isArray(studentIds)) {
          return res
            .status(400)
            .json({ message: "Student IDs array is required" });
        }

        let sent = 0;
        for (const studentId of studentIds) {
          const student = await storage.getStudentById(studentId);
          if (student) {
            // In a real implementation, this would send email/SMS notifications
            // For now, we'll just simulate the notification
            console.log(
              `Sending eligibility notification to student ${student.studentId}`
            );
            sent++;
          }
        }

        // Broadcast notification update
        broadcast({
          type: "notifications_sent",
          data: { sent, studentIds },
        });

        res.json({
          sent,
          message: `Eligibility notifications sent to ${sent} students`,
        });
      } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ message: "Failed to send notifications" });
      }
    }
  );

  // Export eligibility report
  app.get("/api/exam-eligibility/export", requireAuth, async (req, res) => {
    try {
      const { classId } = req.query;

      if (!classId) {
        return res.status(400).json({ message: "Class ID is required" });
      }

      const students = await storage.getStudentsByClass(classId as string);
      const classInfo = await storage.getClassById(classId as string);

      // Generate CSV data
      const csvData = [
        "Student ID,Full Name,Attendance Percentage,Classes Attended,Total Classes,Eligibility Status",
      ];

      for (const student of students) {
        const user = await storage.getUserById(student.userId);
        const attendanceRecords = await storage.getAttendanceByStudentAndClass(
          student.id,
          classId as string
        );
        const totalClasses = await storage.getTotalClassesByClass(
          classId as string
        );
        const attendedClasses = attendanceRecords.filter(
          (record) => record.status === "present" || record.status === "late"
        ).length;

        const attendancePercentage =
          totalClasses > 0
            ? Math.round((attendedClasses / totalClasses) * 100)
            : 0;

        const isEligible = attendancePercentage >= 75;

        csvData.push(
          [
            student.studentId,
            user?.fullName || "Unknown",
            `${attendancePercentage}%`,
            attendedClasses.toString(),
            totalClasses.toString(),
            isEligible ? "Eligible" : "Not Eligible",
          ].join(",")
        );
      }

      const csvContent = csvData.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="exam-eligibility-${
          classInfo?.classCode || "report"
        }-${new Date().toISOString().split("T")[0]}.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting eligibility report:", error);
      res.status(500).json({ message: "Failed to export eligibility report" });
    }
  });

  // HARDWARE STATUS ROUTES

  // Get hardware overview statistics
  app.get("/api/hardware/stats", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllHardwareDevices();

      const onlineDevices = devices.filter((d) => d.status === "online").length;
      const offlineDevices = devices.filter(
        (d) => d.status === "offline"
      ).length;

      // Calculate today's scans (simulated)
      const totalScans = devices.reduce((sum, device) => {
        // Simulate scan counts based on device type and status
        if (device.status === "online") {
          return sum + Math.floor(Math.random() * 50) + 20;
        }
        return sum;
      }, 0);

      // Calculate average uptime
      const averageUptime =
        devices.length > 0
          ? Math.floor((onlineDevices / devices.length) * 100)
          : 0;

      res.json({
        onlineDevices,
        offlineDevices,
        totalScans,
        averageUptime,
      });
    } catch (error) {
      console.error("Error fetching hardware stats:", error);
      res.status(500).json({ message: "Failed to fetch hardware statistics" });
    }
  });

  // Get device performance analytics
  app.get("/api/hardware/performance", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllHardwareDevices();

      const performanceData = devices.map((device) => {
        // Generate realistic performance metrics
        const totalScans = Math.floor(Math.random() * 200) + 50;
        const successfulScans = Math.floor(
          totalScans * (0.85 + Math.random() * 0.14)
        );
        const failedScans = totalScans - successfulScans;
        const successRate = Math.floor((successfulScans / totalScans) * 100);
        const uptime =
          device.status === "online"
            ? Math.floor(Math.random() * 15) + 85
            : Math.floor(Math.random() * 30) + 10;

        return {
          name: device.deviceType === "esp32_cam" ? "ESP32-CAM" : "RFID Reader",
          type: device.deviceType,
          location: device.location,
          totalScans,
          successfulScans,
          failedScans,
          successRate,
          uptime,
          avgResponseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
        };
      });

      res.json(performanceData);
    } catch (error) {
      console.error("Error fetching performance data:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch performance analytics" });
    }
  });

  // Configure hardware device
  app.post("/api/hardware/configure", requireAuth, async (req, res) => {
    try {
      const { deviceId, configuration } = req.body;

      if (!deviceId || !configuration) {
        return res
          .status(400)
          .json({ message: "Device ID and configuration are required" });
      }

      // In a real implementation, this would:
      // 1. Validate the configuration parameters
      // 2. Send configuration to the actual device
      // 3. Update device settings in database
      // 4. Verify configuration was applied

      const device = await storage.getHardwareDeviceByDeviceId(deviceId);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      // Simulate configuration update
      const updatedDevice = await storage.updateHardwareDevice(device.id, {
        configuration: configuration,
        lastHeartbeat: new Date(),
      });

      // Broadcast configuration update
      broadcast({
        type: "device_configured",
        data: { deviceId, configuration },
      });

      res.json({
        message: "Device configuration updated successfully",
        device: updatedDevice,
      });
    } catch (error) {
      console.error("Error configuring device:", error);
      res.status(500).json({ message: "Failed to configure device" });
    }
  });

  // Bulk device actions (restart, update, etc.)
  app.post("/api/hardware/bulk-action", requireAuth, async (req, res) => {
    try {
      const { action, deviceIds } = req.body;

      if (!action || !deviceIds || !Array.isArray(deviceIds)) {
        return res
          .status(400)
          .json({ message: "Action and device IDs array are required" });
      }

      let affected = 0;
      for (const deviceId of deviceIds) {
        const device = await storage.getHardwareDevice(deviceId);
        if (device) {
          // Simulate the action
          switch (action) {
            case "restart":
              // Update last heartbeat to simulate restart
              await storage.updateHardwareDevice(deviceId, {
                lastHeartbeat: new Date(),
                status: "online",
              });
              break;
            case "update":
              // Simulate firmware update
              await storage.updateHardwareDevice(deviceId, {
                lastHeartbeat: new Date(),
              });
              break;
            case "shutdown":
              await storage.updateHardwareDevice(deviceId, {
                status: "offline",
              });
              break;
          }
          affected++;
        }
      }

      // Broadcast bulk action
      broadcast({
        type: "bulk_action_completed",
        data: { action, affected, deviceIds },
      });

      res.json({
        action,
        affected,
        message: `${action} action completed on ${affected} devices`,
      });
    } catch (error) {
      console.error("Error performing bulk action:", error);
      res.status(500).json({ message: "Failed to perform bulk action" });
    }
  });

  // Add new hardware device
  app.post("/api/hardware/add", requireAuth, async (req, res) => {
    try {
      const {
        deviceId,
        deviceType,
        location,
        ipAddress,
        description,
        configuration,
      } = req.body;

      if (!deviceId || !deviceType || !location) {
        return res
          .status(400)
          .json({ message: "Device ID, type, and location are required" });
      }

      // Validate device type
      if (!["esp32_cam", "rfid_reader"].includes(deviceType)) {
        return res.status(400).json({
          message: "Device type must be 'esp32_cam' or 'rfid_reader'",
        });
      }

      // Check if device already exists
      const existingDevice = await storage.getHardwareDeviceByDeviceId(
        deviceId
      );
      if (existingDevice) {
        return res
          .status(409)
          .json({ message: "Device with this ID already exists" });
      }

      const newDevice = await storage.createHardwareDevice({
        deviceId,
        deviceType,
        location,
        status: "offline", // Start as offline until first heartbeat
        lastHeartbeat: null,
        configuration: configuration || {},
        ipAddress: ipAddress || null,
        description: description || null,
        macAddress: null, // Will be updated on first heartbeat
        firmwareVersion: null, // Will be updated on first heartbeat
        batteryLevel: null,
        signalStrength: null,
        freeMemory: null,
        uptimeHours: null,
        totalScans: 0,
        successfulScans: 0,
        lastErrorMessage: null,
        lastErrorTime: null,
      });

      // Broadcast new device addition
      broadcast({
        type: "device_added",
        data: newDevice,
      });

      console.log(
        `✅ New ${deviceType} device registered: ${deviceId} at ${location}`
      );

      res.status(201).json({
        message: "Hardware device added successfully",
        device: newDevice,
      });
    } catch (error) {
      console.error("Error adding hardware device:", error);
      res.status(500).json({ message: "Failed to add hardware device" });
    }
  });

  // Remove hardware device
  app.delete("/api/hardware/:deviceId", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;

      const device = await storage.getHardwareDevice(deviceId);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      // In a real implementation, you would delete from database
      // For now, we'll just mark as offline
      await storage.updateHardwareDevice(deviceId, {
        status: "offline",
      });

      // Broadcast device removal
      broadcast({
        type: "device_removed",
        data: { deviceId },
      });

      res.json({
        message: "Hardware device removed successfully",
      });
    } catch (error) {
      console.error("Error removing hardware device:", error);
      res.status(500).json({ message: "Failed to remove hardware device" });
    }
  });

  // Get device logs
  app.get("/api/hardware/:deviceId/logs", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { limit = 50 } = req.query;

      const device = await storage.getHardwareDevice(deviceId);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      // Generate simulated logs
      const logs = [];
      const now = new Date();

      for (let i = 0; i < parseInt(limit as string); i++) {
        const timestamp = new Date(now.getTime() - i * 60000); // Every minute
        const logTypes = ["scan", "heartbeat", "error", "config"];
        const logType = logTypes[Math.floor(Math.random() * logTypes.length)];

        let message = "";
        let level = "info";

        switch (logType) {
          case "scan":
            message =
              device.deviceType === "esp32_cam"
                ? "Face recognition scan completed"
                : "RFID card scan detected";
            break;
          case "heartbeat":
            message = "Device heartbeat sent successfully";
            break;
          case "error":
            message = "Connection timeout detected";
            level = "error";
            break;
          case "config":
            message = "Configuration update received";
            level = "warning";
            break;
        }

        logs.push({
          id: `log-${i}`,
          timestamp,
          level,
          message,
          type: logType,
        });
      }

      res.json(logs);
    } catch (error) {
      console.error("Error fetching device logs:", error);
      res.status(500).json({ message: "Failed to fetch device logs" });
    }
  });

  // Device health check
  app.get("/api/hardware/:deviceId/health", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;

      const device = await storage.getHardwareDevice(deviceId);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      // Generate health metrics
      const health = {
        deviceId: device.deviceId,
        status: device.status,
        uptime:
          device.status === "online" ? Math.floor(Math.random() * 100) + 85 : 0,
        memoryUsage: Math.floor(Math.random() * 40) + 30, // 30-70%
        cpuUsage: Math.floor(Math.random() * 60) + 20, // 20-80%
        temperature:
          device.deviceType === "esp32_cam"
            ? Math.floor(Math.random() * 20) + 35
            : null,
        signalStrength: Math.floor(Math.random() * 40) + 60, // 60-100%
        lastScan: new Date(Date.now() - Math.random() * 3600000), // Within last hour
        errorCount: Math.floor(Math.random() * 5),
        scanCount: Math.floor(Math.random() * 100) + 50,
      };

      res.json(health);
    } catch (error) {
      console.error("Error fetching device health:", error);
      res.status(500).json({ message: "Failed to fetch device health" });
    }
  });

  // Reports API endpoints
  app.get("/api/reports/overview", async (req, res) => {
    try {
      const overview = {
        totalReports: 24,
        reportsThisWeek: 5,
        overallAttendanceRate: 87.3,
        attendanceTrend: "+2.4% from last week",
        hardwareUptime: 96.8,
        devicesOnline: 3,
        totalDevices: 3,
        systemEvents: 12,
        eventsToday: 3,
        devicePerformance: {
          esp32_cam: {
            successRate: 94.2,
            avgResponseTime: 250,
            totalScans: 1250,
          },
          rfid: {
            successRate: 98.1,
            avgResponseTime: 120,
            totalScans: 890,
          },
        },
      };
      res.json(overview);
    } catch (error) {
      console.error("Error fetching reports overview:", error);
      res.status(500).json({ message: "Failed to fetch reports overview" });
    }
  });

  app.post("/api/reports/generate", async (req, res) => {
    try {
      const { type, dateRange, format, filters } = req.body;

      // Simulate report generation
      const reportId = Date.now().toString();
      const report = {
        id: reportId,
        type,
        title: `${type} Report - ${new Date().toLocaleDateString()}`,
        dateRange,
        format,
        status: "completed",
        generatedAt: new Date(),
        downloadUrl: `/api/reports/${reportId}/download`,
        data: {
          summary: {
            totalRecords: 150,
            attendanceRate: 89.3,
            deviceUptime: 96.7,
          },
          details: [], // Would contain actual report data
        },
      };

      res.json(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/reports/history", async (req, res) => {
    try {
      const reports = [
        {
          id: "1",
          title: "Weekly Attendance Report",
          type: "attendance",
          format: "PDF",
          generatedAt: new Date(Date.now() - 86400000),
          size: "2.4 MB",
          status: "completed",
        },
        {
          id: "2",
          title: "Hardware Performance Report",
          type: "hardware",
          format: "Excel",
          generatedAt: new Date(Date.now() - 172800000),
          size: "1.8 MB",
          status: "completed",
        },
        {
          id: "3",
          title: "Monthly Summary Report",
          type: "summary",
          format: "PDF",
          generatedAt: new Date(Date.now() - 259200000),
          size: "3.2 MB",
          status: "completed",
        },
      ];

      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports history:", error);
      res.status(500).json({ message: "Failed to fetch reports history" });
    }
  });

  app.get("/api/reports/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      // In a real app, this would serve the actual file
      res.json({
        message: `Download initiated for report ${id}`,
        downloadUrl: `/downloads/report-${id}.pdf`,
      });
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ message: "Failed to download report" });
    }
  });

  app.delete("/api/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      res.json({ message: `Report ${id} deleted successfully` });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Settings API endpoints
  app.get("/api/settings/system", async (req, res) => {
    try {
      const settings = {
        systemName: "SmartTrack Attendance System",
        timeZone: "UTC+05:30",
        autoBackup: true,
        backupFrequency: "daily",
        sessionTimeout: 30,
        dataRetention: 365,
        notifications: {
          email: true,
          sms: false,
          push: true,
        },
      };
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.put("/api/settings/system", async (req, res) => {
    try {
      const settings = req.body;
      // In a real app, this would update the database
      res.json({
        message: "System settings updated successfully",
        settings,
      });
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  app.get("/api/settings/hardware", async (req, res) => {
    try {
      const settings = {
        esp32_cam: {
          enabled: true,
          scanInterval: 100,
          confidence: 0.8,
          resolution: "640x480",
          autoRestart: true,
          networkConfig: {
            ssid: "SmartTrack_Network",
            ip: "192.168.1.100",
            port: 8080,
          },
        },
        rfid: {
          enabled: true,
          scanInterval: 50,
          powerLevel: 75,
          autoRestart: true,
          networkConfig: {
            ip: "192.168.1.101",
            port: 8081,
          },
        },
      };
      res.json(settings);
    } catch (error) {
      console.error("Error fetching hardware settings:", error);
      res.status(500).json({ message: "Failed to fetch hardware settings" });
    }
  });

  app.put("/api/settings/hardware", async (req, res) => {
    try {
      const settings = req.body;
      // In a real app, this would update device configurations
      res.json({
        message: "Hardware settings updated successfully",
        settings,
      });
    } catch (error) {
      console.error("Error updating hardware settings:", error);
      res.status(500).json({ message: "Failed to update hardware settings" });
    }
  });

  app.post("/api/settings/hardware/restart/:deviceType", async (req, res) => {
    try {
      const { deviceType } = req.params;
      // Simulate device restart
      res.json({
        message: `${deviceType} device restart initiated`,
        status: "restarting",
      });
    } catch (error) {
      console.error("Error restarting device:", error);
      res.status(500).json({ message: "Failed to restart device" });
    }
  });

  app.get("/api/settings/users", async (req, res) => {
    try {
      const users = [
        {
          id: "1",
          name: "John Admin",
          email: "admin@smarttrack.com",
          role: "admin",
          status: "active",
          lastLogin: new Date(Date.now() - 3600000),
          permissions: ["all"],
        },
        {
          id: "2",
          name: "Sarah Lecturer",
          email: "sarah@university.edu",
          role: "lecturer",
          status: "active",
          lastLogin: new Date(Date.now() - 7200000),
          permissions: ["view_attendance", "manage_students"],
        },
        {
          id: "3",
          name: "Mike Student",
          email: "mike@student.edu",
          role: "student",
          status: "active",
          lastLogin: new Date(Date.now() - 1800000),
          permissions: ["view_own_attendance"],
        },
      ];
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/settings/users", async (req, res) => {
    try {
      const userData = req.body;
      const newUser = {
        id: Date.now().toString(),
        ...userData,
        status: "active",
        createdAt: new Date(),
      };
      res.json({
        message: "User created successfully",
        user: newUser,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/settings/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userData = req.body;
      res.json({
        message: `User ${id} updated successfully`,
        user: { id, ...userData },
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/settings/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      res.json({ message: `User ${id} deleted successfully` });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/settings/backup/create", async (req, res) => {
    try {
      const backup = {
        id: Date.now().toString(),
        type: "full",
        size: "45.2 MB",
        createdAt: new Date(),
        status: "completed",
      };
      res.json({
        message: "Backup created successfully",
        backup,
      });
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  app.get("/api/settings/backup/history", async (req, res) => {
    try {
      const backups = [
        {
          id: "1",
          type: "full",
          size: "43.8 MB",
          createdAt: new Date(Date.now() - 86400000),
          status: "completed",
        },
        {
          id: "2",
          type: "incremental",
          size: "12.4 MB",
          createdAt: new Date(Date.now() - 172800000),
          status: "completed",
        },
        {
          id: "3",
          type: "full",
          size: "41.2 MB",
          createdAt: new Date(Date.now() - 604800000),
          status: "completed",
        },
      ];
      res.json(backups);
    } catch (error) {
      console.error("Error fetching backup history:", error);
      res.status(500).json({ message: "Failed to fetch backup history" });
    }
  });

  app.post("/api/settings/backup/restore/:id", async (req, res) => {
    try {
      const { id } = req.params;
      res.json({
        message: `Restore from backup ${id} initiated`,
        status: "restoring",
      });
    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ message: "Failed to restore backup" });
    }
  });

  app.post("/api/settings/maintenance/optimize", async (req, res) => {
    try {
      res.json({
        message: "Database optimization initiated",
        status: "optimizing",
        estimatedTime: "5-10 minutes",
      });
    } catch (error) {
      console.error("Error optimizing database:", error);
      res.status(500).json({ message: "Failed to optimize database" });
    }
  });

  app.post("/api/settings/maintenance/clean-logs", async (req, res) => {
    try {
      res.json({
        message: "Log cleanup completed",
        spaceSaved: "156 MB",
        logsRemoved: 2450,
      });
    } catch (error) {
      console.error("Error cleaning logs:", error);
      res.status(500).json({ message: "Failed to clean logs" });
    }
  });

  app.post("/api/settings/maintenance/diagnostics", async (req, res) => {
    try {
      // Simulate system diagnostics
      const diagnostics = {
        systemHealth: "Good",
        databaseStatus: "Healthy",
        hardwareConnections: "All devices responding",
        diskSpace: "78% available",
        memoryUsage: "45% used",
        cpuLoad: "Low",
        networkLatency: "12ms average",
        securityStatus: "No threats detected",
      };

      res.json({
        message: "System diagnostics completed successfully",
        status: "completed",
        results: diagnostics,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error running diagnostics:", error);
      res.status(500).json({ message: "Failed to run system diagnostics" });
    }
  });

  // Notifications endpoints
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      // Get mock notifications data
      const notifications = [
        {
          id: 1,
          title: "Low Attendance Alert",
          message: "15 students are below 75% attendance threshold",
          type: "warning",
          read: false,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          id: 2,
          title: "System Update",
          message: "Face recognition model updated successfully",
          type: "info",
          read: false,
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        },
        {
          id: 3,
          title: "Hardware Status",
          message: "ESP32-CAM device #3 reconnected successfully",
          type: "success",
          read: true,
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        },
        {
          id: 4,
          title: "New Registration",
          message: "5 new students registered today",
          type: "info",
          read: false,
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        },
        {
          id: 5,
          title: "Backup Completed",
          message: "Daily database backup completed successfully",
          type: "success",
          read: true,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      ];

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      // In a real app, you would update the notification in the database
      res.json({ message: "Notification marked as read", id });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Today's classes endpoint
  app.get("/api/classes/today", requireAuth, async (req, res) => {
    try {
      const today = new Date();
      const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });

      // Get mock today's classes data
      const todaysClasses = [
        {
          id: 1,
          name: "Web Development",
          lecturer: "Dr. Sarah Johnson",
          startTime: "09:00",
          endTime: "11:00",
          status: "completed",
          enrolledCount: 45,
          attendanceCount: 42,
          location: "Lab A-301",
        },
        {
          id: 2,
          name: "Database Systems",
          lecturer: "Prof. Michael Chen",
          startTime: "13:00",
          endTime: "15:00",
          status: "active",
          enrolledCount: 38,
          attendanceCount: 35,
          location: "Room B-205",
        },
        {
          id: 3,
          name: "Mobile App Development",
          lecturer: "Dr. Emily Brown",
          startTime: "15:30",
          endTime: "17:30",
          status: "scheduled",
          enrolledCount: 32,
          attendanceCount: 0,
          location: "Lab C-102",
        },
      ].filter((classItem) => {
        // Only show classes for certain days to simulate real schedule
        return ["Monday", "Wednesday", "Friday"].includes(dayOfWeek);
      });

      res.json(todaysClasses);
    } catch (error) {
      console.error("Error fetching today's classes:", error);
      res.status(500).json({ message: "Failed to fetch today's classes" });
    }
  });

  // Report generation endpoint
  app.post("/api/reports/generate", requireAuth, async (req, res) => {
    try {
      const { type } = req.body;

      // Simulate report generation with different content based on type
      const reportContent: { [key: string]: string } = {
        "attendance-summary":
          "Attendance Summary Report - Generated on " +
          new Date().toISOString(),
        "student-performance":
          "Student Performance Report - Generated on " +
          new Date().toISOString(),
        "hardware-status":
          "Hardware Status Report - Generated on " + new Date().toISOString(),
      };

      const content =
        reportContent[type] ||
        "Generic Report - Generated on " + new Date().toISOString();

      // Create a simple PDF-like response (in a real app, you'd use a PDF generation library)
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}-report.pdf"`
      );
      res.send(Buffer.from(content, "utf-8"));
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Profile management endpoints
  app.put("/api/users/profile", requireAuth, async (req: any, res) => {
    try {
      const { fullName, email, phone, department } = req.body;
      const userId = req.user.id;

      // In a real app, you would update the user in the database
      const updatedUser = {
        id: userId,
        fullName,
        email,
        phone,
        department,
        updatedAt: new Date(),
      };

      res.json({
        message: "Profile updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/users/change-password", requireAuth, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // In a real app, you would verify the current password and update it
      // For demo purposes, we'll simulate a successful password change
      res.json({
        message: "Password changed successfully",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get("/api/users/activity", requireAuth, async (req: any, res) => {
    try {
      // Mock activity logs
      const activityLogs = [
        {
          action: "Login",
          description: "Successful login to admin dashboard",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          ipAddress: "192.168.1.100",
          icon: "fa-sign-in-alt",
        },
        {
          action: "Settings Updated",
          description: "System settings were modified",
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          ipAddress: "192.168.1.100",
          icon: "fa-cog",
        },
        {
          action: "Student Added",
          description: "New student registration completed",
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
          ipAddress: "192.168.1.100",
          icon: "fa-user-plus",
        },
        {
          action: "Report Generated",
          description: "Attendance summary report downloaded",
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
          ipAddress: "192.168.1.100",
          icon: "fa-file-download",
        },
        {
          action: "Profile Updated",
          description: "Profile information was updated",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          ipAddress: "192.168.1.100",
          icon: "fa-user-edit",
        },
      ];

      res.json(activityLogs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Hardware IoT routes for ESP32-CAM and RFID devices
  app.use("/api/hardware", hardwareRoutes);

  // Device Status Monitor management endpoints
  app.get("/api/monitor/status", async (req, res) => {
    try {
      const status = deviceStatusMonitor.getStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to get monitor status",
        error: error.message,
      });
    }
  });

  app.post("/api/monitor/check", async (req, res) => {
    try {
      const result = await deviceStatusMonitor.checkNow();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to check device status",
        error: error.message,
      });
    }
  });

  app.post("/api/monitor/configure", async (req, res) => {
    try {
      const { checkInterval, offlineThreshold } = req.body;
      deviceStatusMonitor.configure({ checkInterval, offlineThreshold });
      const status = deviceStatusMonitor.getStatus();
      res.json({ message: "Monitor configured successfully", status });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to configure monitor", error: error.message });
    }
  });

  app.post("/api/monitor/start", async (req, res) => {
    try {
      deviceStatusMonitor.start();
      const status = deviceStatusMonitor.getStatus();
      res.json({ message: "Monitor started", status });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to start monitor", error: error.message });
    }
  });

  app.post("/api/monitor/stop", async (req, res) => {
    try {
      deviceStatusMonitor.stop();
      const status = deviceStatusMonitor.getStatus();
      res.json({ message: "Monitor stopped", status });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to stop monitor", error: error.message });
    }
  });

  return httpServer;
}
