import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertStudentSchema, insertLecturerSchema, insertClassSchema, insertAttendanceRecordSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    // Simple token validation - in production, use JWT
    req.userId = token.replace('Bearer ', '');
    next();
  };

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // In production, generate JWT token
      const token = user.id;
      res.json({ token, user: { ...user, password: undefined } });
    } catch (error) {
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // User routes
  app.get('/api/users/profile', requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get user profile' });
    }
  });

  app.post('/api/users', requireAuth, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: 'Invalid user data' });
    }
  });

  // Student routes
  app.get('/api/students', requireAuth, async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      res.json(students);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get students' });
    }
  });

  app.post('/api/students', requireAuth, async (req, res) => {
    try {
      const studentData = insertStudentSchema.parse(req.body);
      const student = await storage.createStudent(studentData);
      res.status(201).json(student);
    } catch (error) {
      res.status(400).json({ message: 'Invalid student data' });
    }
  });

  app.get('/api/students/:id', requireAuth, async (req, res) => {
    try {
      const student = await storage.getStudent(req.params.id);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get student' });
    }
  });

  // Lecturer routes
  app.get('/api/lecturers', requireAuth, async (req, res) => {
    try {
      const lecturers = await storage.getAllLecturers();
      res.json(lecturers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get lecturers' });
    }
  });

  app.post('/api/lecturers', requireAuth, async (req, res) => {
    try {
      const lecturerData = insertLecturerSchema.parse(req.body);
      const lecturer = await storage.createLecturer(lecturerData);
      res.status(201).json(lecturer);
    } catch (error) {
      res.status(400).json({ message: 'Invalid lecturer data' });
    }
  });

  // Class routes
  app.get('/api/classes', requireAuth, async (req, res) => {
    try {
      const classes = await storage.getAllClasses();
      res.json(classes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get classes' });
    }
  });

  app.post('/api/classes', requireAuth, async (req, res) => {
    try {
      const classData = insertClassSchema.parse(req.body);
      const newClass = await storage.createClass(classData);
      res.status(201).json(newClass);
    } catch (error) {
      res.status(400).json({ message: 'Invalid class data' });
    }
  });

  app.get('/api/classes/:id', requireAuth, async (req, res) => {
    try {
      const classData = await storage.getClass(req.params.id);
      if (!classData) {
        return res.status(404).json({ message: 'Class not found' });
      }
      res.json(classData);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get class' });
    }
  });

  // Attendance routes
  app.post('/api/attendance', async (req, res) => {
    try {
      const attendanceData = insertAttendanceRecordSchema.parse(req.body);
      const record = await storage.createAttendanceRecord(attendanceData);
      
      // Broadcast real-time update
      broadcast({
        type: 'attendance_update',
        data: record
      });
      
      res.status(201).json(record);
    } catch (error) {
      res.status(400).json({ message: 'Invalid attendance data' });
    }
  });

  app.get('/api/attendance/class/:classId', requireAuth, async (req, res) => {
    try {
      const attendance = await storage.getAttendanceByClass(req.params.classId);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get attendance' });
    }
  });

  app.get('/api/attendance/student/:studentId', requireAuth, async (req, res) => {
    try {
      const attendance = await storage.getAttendanceByStudent(req.params.studentId);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get student attendance' });
    }
  });

  app.get('/api/attendance/today/:classId', requireAuth, async (req, res) => {
    try {
      const today = new Date();
      const attendance = await storage.getAttendanceByClassAndDate(req.params.classId, today);
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get today\'s attendance' });
    }
  });

  // Hardware routes
  app.get('/api/hardware', requireAuth, async (req, res) => {
    try {
      const devices = await storage.getAllHardwareDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get hardware devices' });
    }
  });

  app.post('/api/hardware/heartbeat', async (req, res) => {
    try {
      const { deviceId } = req.body;
      const device = await storage.getHardwareDeviceByDeviceId(deviceId);
      
      if (device) {
        await storage.updateHardwareDevice(device.id, {
          status: 'online',
          lastHeartbeat: new Date()
        });
        
        // Hardware status updated (WebSocket removed for stability)
      }
      
      res.json({ message: 'Heartbeat received' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update heartbeat' });
    }
  });

  // Statistics routes
  app.get('/api/stats/dashboard', requireAuth, async (req, res) => {
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
        examIneligible: examEligibilityStats.ineligible
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get dashboard statistics' });
    }
  });

  // Exam eligibility routes
  app.post('/api/exam-eligibility/calculate', requireAuth, async (req, res) => {
    try {
      const { studentId, classId } = req.body;
      const eligibility = await storage.calculateExamEligibility(studentId, classId);
      res.json(eligibility);
    } catch (error) {
      res.status(500).json({ message: 'Failed to calculate exam eligibility' });
    }
  });

  app.get('/api/exam-eligibility/student/:studentId', requireAuth, async (req, res) => {
    try {
      const eligibility = await storage.getExamEligibilityByStudent(req.params.studentId);
      res.json(eligibility);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get exam eligibility' });
    }
  });

  // Face recognition integration
  app.post('/api/face-recognition/enroll', requireAuth, async (req, res) => {
    try {
      const { studentId, faceEmbedding } = req.body;
      const student = await storage.getStudent(studentId);
      
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      
      await storage.updateStudent(studentId, { faceEmbedding });
      res.json({ message: 'Face enrolled successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to enroll face' });
    }
  });

  app.post('/api/face-recognition/recognize', async (req, res) => {
    try {
      const { faceEmbedding, deviceId, classId, confidence } = req.body;
      
      // Find matching student (simplified - in production, use ML similarity)
      const students = await storage.getAllStudents();
      const matchedStudent = students.find(student => student.faceEmbedding);
      
      if (matchedStudent && confidence > 0.85) {
        // Create attendance record
        const attendanceRecord = await storage.createAttendanceRecord({
          studentId: matchedStudent.id,
          classId,
          attendanceDate: new Date(),
          method: 'face_recognition',
          status: 'present',
          hardwareId: deviceId,
          confidence: confidence.toString()
        });
        
        // Attendance record created (WebSocket removed for stability)
        
        res.json({ 
          message: 'Attendance marked successfully',
          student: matchedStudent,
          record: attendanceRecord
        });
      } else {
        res.status(404).json({ message: 'Face not recognized' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Face recognition failed' });
    }
  });

  // RFID integration
  app.post('/api/rfid/scan', async (req, res) => {
    try {
      const { rfidCard, deviceId, classId } = req.body;
      
      // Find student by RFID card
      const students = await storage.getAllStudents();
      const student = students.find(s => s.rfidCard === rfidCard);
      
      if (!student) {
        return res.status(404).json({ message: 'RFID card not registered' });
      }
      
      // Create attendance record
      const attendanceRecord = await storage.createAttendanceRecord({
        studentId: student.id,
        classId,
        attendanceDate: new Date(),
        method: 'rfid',
        status: 'present',
        hardwareId: deviceId,
        confidence: null
      });
      
      // Attendance record created via RFID (WebSocket removed for stability)
      
      res.json({ 
        message: 'Attendance marked successfully',
        student,
        record: attendanceRecord
      });
    } catch (error) {
      res.status(500).json({ message: 'RFID scan failed' });
    }
  });

  return httpServer;
}
