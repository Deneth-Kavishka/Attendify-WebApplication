import {
  type User,
  type InsertUser,
  type Student,
  type InsertStudent,
  type Lecturer,
  type InsertLecturer,
  type Class,
  type InsertClass,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type HardwareDevice,
  type InsertHardwareDevice,
  type ExamEligibility,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;

  // Student management
  getStudent(id: string): Promise<Student | undefined>;
  getStudentById(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  getStudentByStudentId(studentId: string): Promise<Student | undefined>;
  getStudentByRfidCard(rfidCard: string): Promise<Student | undefined>;
  getStudentByNic(nic: string): Promise<Student | undefined>;
  getStudentsByClass(classId: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(
    id: string,
    student: Partial<Student>
  ): Promise<Student | undefined>;
  deleteStudent(id: string): Promise<boolean>;
  getAllStudents(): Promise<Student[]>;
  getAvailableRfidCards(): Promise<string[]>;
  generateNewRfidCard(): Promise<string>;

  // Lecturer management
  getLecturer(id: string): Promise<Lecturer | undefined>;
  getLecturerByUserId(userId: string): Promise<Lecturer | undefined>;
  createLecturer(lecturer: InsertLecturer): Promise<Lecturer>;
  getAllLecturers(): Promise<Lecturer[]>;

  // Class management
  getClass(id: string): Promise<Class | undefined>;
  getClassById(id: string): Promise<Class | undefined>;
  getClassesByLecturerId(lecturerId: string): Promise<Class[]>;
  createClass(classData: InsertClass): Promise<Class>;
  getAllClasses(): Promise<Class[]>;
  getTotalClassesByClass(classId: string): Promise<number>;

  // Attendance management
  getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined>;
  createAttendanceRecord(
    record: InsertAttendanceRecord
  ): Promise<AttendanceRecord>;
  getAttendanceByClassAndDate(
    classId: string,
    date: Date
  ): Promise<AttendanceRecord[]>;
  getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]>;
  getAttendanceByStudentAndClass(
    studentId: string,
    classId: string
  ): Promise<AttendanceRecord[]>;
  getAttendanceByClass(classId: string): Promise<AttendanceRecord[]>;
  getAllAttendanceRecords(): Promise<AttendanceRecord[]>;

  // Hardware management
  getHardwareDevice(id: string): Promise<HardwareDevice | undefined>;
  getHardwareDeviceByDeviceId(
    deviceId: string
  ): Promise<HardwareDevice | undefined>;
  createHardwareDevice(device: InsertHardwareDevice): Promise<HardwareDevice>;
  updateHardwareDevice(
    id: string,
    device: Partial<HardwareDevice>
  ): Promise<HardwareDevice | undefined>;
  getAllHardwareDevices(): Promise<HardwareDevice[]>;

  // Statistics
  getTotalStudents(): Promise<number>;
  getActiveClasses(): Promise<number>;
  getTodayAttendanceRate(): Promise<number>;
  getExamEligibilityStats(): Promise<{ eligible: number; ineligible: number }>;

  // Exam eligibility
  calculateExamEligibility(
    studentId: string,
    classId: string
  ): Promise<ExamEligibility>;
  getExamEligibilityByStudent(studentId: string): Promise<ExamEligibility[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private students: Map<string, Student>;
  private lecturers: Map<string, Lecturer>;
  private classes: Map<string, Class>;
  private attendanceRecords: Map<string, AttendanceRecord>;
  private hardwareDevices: Map<string, HardwareDevice>;
  private examEligibility: Map<string, ExamEligibility>;

  constructor() {
    this.users = new Map();
    this.students = new Map();
    this.lecturers = new Map();
    this.classes = new Map();
    this.attendanceRecords = new Map();
    this.hardwareDevices = new Map();
    this.examEligibility = new Map();

    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default admin user with plain text password for demo
    const adminId = randomUUID();
    const adminUser: User = {
      id: adminId,
      username: "admin",
      password: "admin123", // Plain text for demo purposes
      email: "admin@smartattendance.com",
      fullName: "System Administrator",
      role: "admin",
      department: "IT",
      createdAt: new Date(),
    };
    this.users.set(adminId, adminUser);

    // Initialize hardware devices
    const esp32CamId = randomUUID();
    const esp32Cam: HardwareDevice = {
      id: esp32CamId,
      deviceId: "ESP32_CAM_001",
      deviceType: "esp32_cam",
      location: "Room A101",
      status: "online",
      lastHeartbeat: new Date(),
      configuration: { resolution: "640x480", threshold: 0.85 },
    };
    this.hardwareDevices.set(esp32CamId, esp32Cam);

    const rfidReaderId = randomUUID();
    const rfidReader: HardwareDevice = {
      id: rfidReaderId,
      deviceId: "RFID_READER_001",
      deviceType: "rfid_reader",
      location: "Main Entrance",
      status: "online",
      lastHeartbeat: new Date(),
      configuration: { readRange: 10, frequency: 125 },
    };
    this.hardwareDevices.set(rfidReaderId, rfidReader);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(
    id: string,
    updateData: Partial<User>
  ): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updateData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Student methods
  async getStudent(id: string): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(
      (student) => student.userId === userId
    );
  }

  async getStudentByStudentId(studentId: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(
      (student) => student.studentId === studentId
    );
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async getStudentsByClass(classId: string): Promise<Student[]> {
    // For demo purposes, return all students
    // In a real implementation, this would filter by class enrollment
    return Array.from(this.students.values()).filter(
      (student) => student.active
    );
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = randomUUID();
    const student: Student = {
      ...insertStudent,
      id,
      rfidCard: insertStudent.rfidCard ?? null,
      faceEmbedding: insertStudent.faceEmbedding ?? null,
      active: insertStudent.active ?? true,
      nic: insertStudent.nic ?? null,
      mobileNumber: insertStudent.mobileNumber ?? null,
      gender: insertStudent.gender ?? null,
      dateOfBirth: insertStudent.dateOfBirth ?? null,
      address: insertStudent.address ?? null,
      guardianName: insertStudent.guardianName ?? null,
      guardianContact: insertStudent.guardianContact ?? null,
      emergencyContact: insertStudent.emergencyContact ?? null,
      batch: insertStudent.batch ?? null,
      semester: insertStudent.semester ?? null,
      gpa: insertStudent.gpa ?? null,
      faceRegistrationStatus: insertStudent.faceRegistrationStatus ?? "pending",
      faceRegistrationDate: insertStudent.faceRegistrationDate ?? null,
      createdAt: new Date(),
    };
    this.students.set(id, student);
    return student;
  }
  async updateStudent(
    id: string,
    updateData: Partial<Student>
  ): Promise<Student | undefined> {
    const student = this.students.get(id);
    if (!student) return undefined;

    const updatedStudent = { ...student, ...updateData };
    this.students.set(id, updatedStudent);
    return updatedStudent;
  }

  async deleteStudent(id: string): Promise<boolean> {
    return this.students.delete(id);
  }

  async getStudentByRfidCard(rfidCard: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(
      (student) => student.rfidCard === rfidCard
    );
  }

  async getStudentByNic(nic: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(
      (student) => student.nic === nic
    );
  }

  async getAvailableRfidCards(): Promise<string[]> {
    const allStudents = await this.getAllStudents();
    const assignedCards = allStudents
      .map((s) => s.rfidCard)
      .filter((card) => card !== null);

    // Generate available cards
    const availableCards = [];
    for (let i = 1; i <= 100; i++) {
      const cardId = `RFID${i.toString().padStart(6, "0")}`;
      if (!assignedCards.includes(cardId)) {
        availableCards.push(cardId);
      }
    }

    return availableCards.slice(0, 20); // Return first 20 available
  }

  async generateNewRfidCard(): Promise<string> {
    const allStudents = await this.getAllStudents();
    const assignedCards = allStudents
      .map((s) => s.rfidCard)
      .filter((card) => card && card.startsWith("RFID"))
      .map((card) => parseInt(card.replace("RFID", "")))
      .filter((num) => !isNaN(num));

    const maxNumber = assignedCards.length > 0 ? Math.max(...assignedCards) : 0;
    return `RFID${(maxNumber + 1).toString().padStart(6, "0")}`;
  }

  async getAllStudents(): Promise<Student[]> {
    return Array.from(this.students.values());
  }

  // Lecturer methods
  async getLecturer(id: string): Promise<Lecturer | undefined> {
    return this.lecturers.get(id);
  }

  async getLecturerByUserId(userId: string): Promise<Lecturer | undefined> {
    return Array.from(this.lecturers.values()).find(
      (lecturer) => lecturer.userId === userId
    );
  }

  async createLecturer(insertLecturer: InsertLecturer): Promise<Lecturer> {
    const id = randomUUID();
    const lecturer: Lecturer = { ...insertLecturer, id };
    this.lecturers.set(id, lecturer);
    return lecturer;
  }

  async getAllLecturers(): Promise<Lecturer[]> {
    return Array.from(this.lecturers.values());
  }

  // Class methods
  async getClass(id: string): Promise<Class | undefined> {
    return this.classes.get(id);
  }

  async getClassesByLecturerId(lecturerId: string): Promise<Class[]> {
    return Array.from(this.classes.values()).filter(
      (cls) => cls.lecturerId === lecturerId
    );
  }

  async createClass(insertClass: InsertClass): Promise<Class> {
    const id = randomUUID();
    const classData: Class = { ...insertClass, id };
    this.classes.set(id, classData);
    return classData;
  }

  async getAllClasses(): Promise<Class[]> {
    return Array.from(this.classes.values());
  }

  async getClassById(id: string): Promise<Class | undefined> {
    return this.classes.get(id);
  }

  async getTotalClassesByClass(classId: string): Promise<number> {
    // For demo purposes, return a fixed number
    // In a real implementation, this would count total scheduled classes
    return 30; // Assuming 30 classes per semester
  }

  // Attendance methods
  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    return this.attendanceRecords.get(id);
  }

  async createAttendanceRecord(
    insertRecord: InsertAttendanceRecord
  ): Promise<AttendanceRecord> {
    const id = randomUUID();
    const record: AttendanceRecord = {
      ...insertRecord,
      id,
      hardwareId: insertRecord.hardwareId ?? null,
      confidence: insertRecord.confidence ?? null,
      createdAt: new Date(),
    };
    this.attendanceRecords.set(id, record);
    return record;
  }

  async getAttendanceByClassAndDate(
    classId: string,
    date: Date
  ): Promise<AttendanceRecord[]> {
    const startOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const endOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    );

    return Array.from(this.attendanceRecords.values()).filter(
      (record) =>
        record.classId === classId &&
        record.attendanceDate >= startOfDay &&
        record.attendanceDate < endOfDay
    );
  }

  async getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.studentId === studentId
    );
  }

  async getAttendanceByStudentAndClass(
    studentId: string,
    classId: string
  ): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.studentId === studentId && record.classId === classId
    );
  }

  async getAttendanceByClass(classId: string): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.classId === classId
    );
  }

  async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values());
  }

  // Hardware methods
  async getHardwareDevice(id: string): Promise<HardwareDevice | undefined> {
    return this.hardwareDevices.get(id);
  }

  async getHardwareDeviceByDeviceId(
    deviceId: string
  ): Promise<HardwareDevice | undefined> {
    return Array.from(this.hardwareDevices.values()).find(
      (device) => device.deviceId === deviceId
    );
  }

  async createHardwareDevice(
    insertDevice: InsertHardwareDevice
  ): Promise<HardwareDevice> {
    const id = randomUUID();
    const device: HardwareDevice = { ...insertDevice, id };
    this.hardwareDevices.set(id, device);
    return device;
  }

  async updateHardwareDevice(
    id: string,
    updateData: Partial<HardwareDevice>
  ): Promise<HardwareDevice | undefined> {
    const device = this.hardwareDevices.get(id);
    if (!device) return undefined;

    const updatedDevice = { ...device, ...updateData };
    this.hardwareDevices.set(id, updatedDevice);
    return updatedDevice;
  }

  async getAllHardwareDevices(): Promise<HardwareDevice[]> {
    return Array.from(this.hardwareDevices.values());
  }

  // Statistics methods
  async getTotalStudents(): Promise<number> {
    return this.students.size;
  }

  async getActiveClasses(): Promise<number> {
    return Array.from(this.classes.values()).filter((cls) => cls.active).length;
  }

  async getTodayAttendanceRate(): Promise<number> {
    const today = new Date();
    const todayRecords = Array.from(this.attendanceRecords.values()).filter(
      (record) => {
        const recordDate = new Date(record.attendanceDate);
        return (
          recordDate.toDateString() === today.toDateString() &&
          record.status === "present"
        );
      }
    );

    const totalStudents = this.students.size;
    return totalStudents > 0 ? (todayRecords.length / totalStudents) * 100 : 0;
  }

  async getExamEligibilityStats(): Promise<{
    eligible: number;
    ineligible: number;
  }> {
    const eligibilityRecords = Array.from(this.examEligibility.values());
    const eligible = eligibilityRecords.filter(
      (record) => record.isEligible
    ).length;
    const ineligible = eligibilityRecords.filter(
      (record) => !record.isEligible
    ).length;

    return { eligible, ineligible };
  }

  // Exam eligibility methods
  async calculateExamEligibility(
    studentId: string,
    classId: string
  ): Promise<ExamEligibility> {
    const attendanceRecords = await this.getAttendanceByClass(classId);
    const studentAttendance = attendanceRecords.filter(
      (record) => record.studentId === studentId && record.status === "present"
    );

    const totalClasses = attendanceRecords.length;
    const attendedClasses = studentAttendance.length;
    const attendancePercentage =
      totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

    const classData = await this.getClass(classId);
    const minPercentage = classData?.minAttendancePercentage || 75;
    const isEligible = attendancePercentage >= minPercentage;

    const id = randomUUID();
    const eligibility: ExamEligibility = {
      id,
      studentId,
      classId,
      attendancePercentage: parseFloat(attendancePercentage.toFixed(2)),
      totalClasses,
      attendedClasses,
      isEligible,
      lastUpdated: new Date(),
    };

    this.examEligibility.set(id, eligibility);
    return eligibility;
  }

  async getExamEligibilityByStudent(
    studentId: string
  ): Promise<ExamEligibility[]> {
    return Array.from(this.examEligibility.values()).filter(
      (record) => record.studentId === studentId
    );
  }
}

export const storage = new MemStorage();

// Initialize demo data
async function initializeDemoData() {
  try {
    // Check if users already exist to avoid duplicates
    const existingAdmin = await storage.getUserByUsername("admin");
    const existingLecturer = await storage.getUserByUsername("lecturer");
    const existingStudent = await storage.getUserByUsername("student");

    let adminUser, lecturerUser, studentUser;

    // Create demo users only if they don't exist
    if (!existingAdmin) {
      adminUser = await storage.createUser({
        username: "admin",
        password: "admin123",
        email: "admin@attendify.com",
        fullName: "System Administrator",
        role: "admin",
        department: "IT Department",
      });
    } else {
      adminUser = existingAdmin;
    }

    if (!existingLecturer) {
      lecturerUser = await storage.createUser({
        username: "lecturer",
        password: "lecturer123",
        email: "lecturer@attendify.com",
        fullName: "Dr. Sarah Johnson",
        role: "lecturer",
        department: "Computer Science",
      });
    } else {
      lecturerUser = existingLecturer;
    }

    if (!existingStudent) {
      studentUser = await storage.createUser({
        username: "student",
        password: "student123",
        email: "student@attendify.com",
        fullName: "John Smith",
        role: "student",
        department: null,
      });
    } else {
      studentUser = existingStudent;
    }

    // Create lecturer profile if it doesn't exist
    const existingLecturerProfile = await storage.getLecturerByUserId(
      lecturerUser.id
    );
    if (!existingLecturerProfile) {
      await storage.createLecturer({
        userId: lecturerUser.id,
        lecturerId: "LEC001",
        specialization: "Computer Science",
        active: true,
      });
    }

    // Create student profile if it doesn't exist
    const existingStudentProfile = await storage.getStudentByUserId(
      studentUser.id
    );
    if (!existingStudentProfile) {
      await storage.createStudent({
        userId: studentUser.id,
        studentId: "STU001",
        enrollmentYear: 2024,
        rfidCard: "RFID001",
        active: true,
      });
    }

    // Create additional demo students
    const demoStudents = [
      {
        username: "student2",
        password: "student123",
        email: "alice.johnson@university.edu",
        fullName: "Alice Johnson",
        role: "student",
        department: "Computer Science",
        studentId: "STU002",
        enrollmentYear: 2023,
        rfidCard: "RFID002",
      },
      {
        username: "student3",
        password: "student123",
        email: "bob.wilson@university.edu",
        fullName: "Bob Wilson",
        role: "student",
        department: "Information Technology",
        studentId: "STU003",
        enrollmentYear: 2024,
        rfidCard: null,
      },
      {
        username: "student4",
        password: "student123",
        email: "carol.davis@university.edu",
        fullName: "Carol Davis",
        role: "student",
        department: "Data Science",
        studentId: "STU004",
        enrollmentYear: 2022,
        rfidCard: "RFID004",
      },
      {
        username: "student5",
        password: "student123",
        email: "david.brown@university.edu",
        fullName: "David Brown",
        role: "student",
        department: "Software Engineering",
        studentId: "STU005",
        enrollmentYear: 2024,
        rfidCard: "RFID005",
      },
    ];

    for (const studentData of demoStudents) {
      const existingUser = await storage.getUserByUsername(
        studentData.username
      );
      if (!existingUser) {
        const newUser = await storage.createUser({
          username: studentData.username,
          password: studentData.password,
          email: studentData.email,
          fullName: studentData.fullName,
          role: studentData.role,
          department: studentData.department,
        });

        await storage.createStudent({
          userId: newUser.id,
          studentId: studentData.studentId,
          enrollmentYear: studentData.enrollmentYear,
          rfidCard: studentData.rfidCard,
          active: true,
        });
      }
    }

    // Create demo class if it doesn't exist
    const existingClasses = await storage.getClassesByLecturerId(
      lecturerUser.id
    );
    if (existingClasses.length === 0) {
      const demoClass = await storage.createClass({
        className: "Introduction to Programming",
        lecturerId: lecturerUser.id,
        classCode: "CS101",
        room: "Room 101",
        semester: "Fall 2024",
        academicYear: "2024-2025",
        minAttendancePercentage: 75,
        active: true,
        schedule: {
          days: ["Monday", "Wednesday", "Friday"],
          time: "09:00-10:30",
        },
      });

      // Create some demo attendance records
      const allStudents = await storage.getAllStudents();
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000);

      for (const student of allStudents) {
        // Today's attendance
        await storage.createAttendanceRecord({
          studentId: student.id,
          classId: demoClass.id,
          attendanceDate: today,
          method: "face_recognition",
          status: "present",
          hardwareId: "ESP32_CAM_01",
          confidence: "0.95",
        });

        // Yesterday's attendance
        await storage.createAttendanceRecord({
          studentId: student.id,
          classId: demoClass.id,
          attendanceDate: yesterday,
          method: "rfid",
          status: Math.random() > 0.2 ? "present" : "absent",
          hardwareId: "RFID_READER_01",
          confidence: null,
        });

        // Two days ago attendance
        await storage.createAttendanceRecord({
          studentId: student.id,
          classId: demoClass.id,
          attendanceDate: twoDaysAgo,
          method: "face_recognition",
          status: Math.random() > 0.15 ? "present" : "late",
          hardwareId: "ESP32_CAM_01",
          confidence: "0.88",
        });
      }
    }

    console.log("Demo data initialized successfully");
  } catch (error) {
    console.error("Failed to initialize demo data:", error);
  }
}

// Initialize demo data on startup
initializeDemoData();
