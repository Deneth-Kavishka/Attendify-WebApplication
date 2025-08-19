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
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;

  // Student management
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  getStudentByStudentId(studentId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(
    id: string,
    student: Partial<Student>
  ): Promise<Student | undefined>;
  getAllStudents(): Promise<Student[]>;

  // Lecturer management
  getLecturer(id: string): Promise<Lecturer | undefined>;
  getLecturerByUserId(userId: string): Promise<Lecturer | undefined>;
  createLecturer(lecturer: InsertLecturer): Promise<Lecturer>;
  getAllLecturers(): Promise<Lecturer[]>;

  // Class management
  getClass(id: string): Promise<Class | undefined>;
  getClassesByLecturerId(lecturerId: string): Promise<Class[]>;
  createClass(classData: InsertClass): Promise<Class>;
  getAllClasses(): Promise<Class[]>;

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
  getAttendanceByClass(classId: string): Promise<AttendanceRecord[]>;

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

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = randomUUID();
    const student: Student = { ...insertStudent, id };
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

  async getAttendanceByClass(classId: string): Promise<AttendanceRecord[]> {
    return Array.from(this.attendanceRecords.values()).filter(
      (record) => record.classId === classId
    );
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
    }

    console.log("Demo data initialized successfully");
  } catch (error) {
    console.error("Failed to initialize demo data:", error);
  }
}

// Initialize demo data on startup
initializeDemoData();
