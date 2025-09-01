// PostgreSQL Storage Implementation for Attendify
import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import db from "./database";
import {
  users,
  students,
  lecturers,
  classes,
  attendanceRecords,
  hardwareDevices,
  examEligibility,
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
import { IStorage } from "./storage";
import { randomUUID } from "crypto";

export class PostgreSQLStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser = { ...insertUser, id };
    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  }

  async updateUser(
    id: string,
    updateData: Partial<User>
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Student methods
  async getStudent(id: string): Promise<Student | undefined> {
    const result = await db
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);
    return result[0];
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    const result = await db
      .select()
      .from(students)
      .where(eq(students.userId, userId))
      .limit(1);
    return result[0];
  }

  async getStudentByStudentId(studentId: string): Promise<Student | undefined> {
    const result = await db
      .select()
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1);
    return result[0];
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    return this.getStudent(id);
  }

  async getStudentsByClass(classId: string): Promise<Student[]> {
    // Note: This would need a class enrollment table in a real implementation
    // For now, return all active students
    return await db.select().from(students).where(eq(students.active, true));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = randomUUID();
    const newStudent = { ...insertStudent, id };
    const result = await db.insert(students).values(newStudent).returning();
    return result[0];
  }

  async updateStudent(
    id: string,
    updateData: Partial<Student>
  ): Promise<Student | undefined> {
    const result = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, id))
      .returning();
    return result[0];
  }

  async deleteStudent(id: string): Promise<boolean> {
    const result = await db.delete(students).where(eq(students.id, id));
    return (result as any).rowCount > 0;
  }

  async getStudentByRfidCard(rfidCard: string): Promise<Student | undefined> {
    const result = await db
      .select()
      .from(students)
      .where(eq(students.rfidCard, rfidCard))
      .limit(1);
    return result[0];
  }

  async getStudentByNic(nic: string): Promise<Student | undefined> {
    const result = await db
      .select()
      .from(students)
      .where(eq(students.nic, nic))
      .limit(1);
    return result[0];
  }

  async getAvailableRfidCards(): Promise<string[]> {
    const assignedCards = await db
      .select({ rfidCard: students.rfidCard })
      .from(students)
      .where(sql`${students.rfidCard} IS NOT NULL`);

    const assignedCardIds = assignedCards
      .map((card) => card.rfidCard)
      .filter(Boolean);

    // Generate available cards
    const availableCards = [];
    for (let i = 1; i <= 100; i++) {
      const cardId = `RFID${i.toString().padStart(6, "0")}`;
      if (!assignedCardIds.includes(cardId)) {
        availableCards.push(cardId);
      }
    }

    return availableCards.slice(0, 20);
  }

  async generateNewRfidCard(): Promise<string> {
    const assignedCards = await db
      .select({ rfidCard: students.rfidCard })
      .from(students)
      .where(sql`${students.rfidCard} LIKE 'RFID%'`);

    const cardNumbers = assignedCards
      .map((card) => card.rfidCard)
      .filter(Boolean)
      .map((card) => parseInt((card as string).replace("RFID", "")))
      .filter((num) => !isNaN(num));

    const maxNumber = cardNumbers.length > 0 ? Math.max(...cardNumbers) : 0;
    return `RFID${(maxNumber + 1).toString().padStart(6, "0")}`;
  }

  async getAllStudents(): Promise<Student[]> {
    return await db.select().from(students);
  }

  // Lecturer methods
  async getLecturer(id: string): Promise<Lecturer | undefined> {
    const result = await db
      .select()
      .from(lecturers)
      .where(eq(lecturers.id, id))
      .limit(1);
    return result[0];
  }

  async getLecturerByUserId(userId: string): Promise<Lecturer | undefined> {
    const result = await db
      .select()
      .from(lecturers)
      .where(eq(lecturers.userId, userId))
      .limit(1);
    return result[0];
  }

  async createLecturer(insertLecturer: InsertLecturer): Promise<Lecturer> {
    const id = randomUUID();
    const newLecturer = { ...insertLecturer, id };
    const result = await db.insert(lecturers).values(newLecturer).returning();
    return result[0];
  }

  async getAllLecturers(): Promise<Lecturer[]> {
    return await db.select().from(lecturers);
  }

  // Class methods
  async getClass(id: string): Promise<Class | undefined> {
    const result = await db
      .select()
      .from(classes)
      .where(eq(classes.id, id))
      .limit(1);
    return result[0];
  }

  async getClassesByLecturerId(lecturerId: string): Promise<Class[]> {
    return await db
      .select()
      .from(classes)
      .where(eq(classes.lecturerId, lecturerId));
  }

  async createClass(insertClass: InsertClass): Promise<Class> {
    const id = randomUUID();
    const newClass = { ...insertClass, id };
    const result = await db.insert(classes).values(newClass).returning();
    return result[0];
  }

  async getAllClasses(): Promise<Class[]> {
    return await db.select().from(classes);
  }

  async getClassById(id: string): Promise<Class | undefined> {
    return this.getClass(id);
  }

  async getTotalClassesByClass(classId: string): Promise<number> {
    // Return a fixed number for demo purposes
    return 30;
  }

  // Attendance methods
  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    const result = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, id))
      .limit(1);
    return result[0];
  }

  async createAttendanceRecord(
    insertRecord: InsertAttendanceRecord
  ): Promise<AttendanceRecord> {
    const id = randomUUID();
    const newRecord = { ...insertRecord, id };
    const result = await db
      .insert(attendanceRecords)
      .values(newRecord)
      .returning();
    return result[0];
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

    return await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.classId, classId),
          gte(attendanceRecords.attendanceDate, startOfDay),
          lte(attendanceRecords.attendanceDate, endOfDay)
        )
      );
  }

  async getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, studentId))
      .orderBy(desc(attendanceRecords.attendanceDate));
  }

  async getAttendanceByStudentAndClass(
    studentId: string,
    classId: string
  ): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.studentId, studentId),
          eq(attendanceRecords.classId, classId)
        )
      )
      .orderBy(desc(attendanceRecords.attendanceDate));
  }

  async getAttendanceByClass(classId: string): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.classId, classId))
      .orderBy(desc(attendanceRecords.attendanceDate));
  }

  async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .orderBy(desc(attendanceRecords.attendanceDate));
  }

  // Hardware methods
  async getHardwareDevice(id: string): Promise<HardwareDevice | undefined> {
    const result = await db
      .select()
      .from(hardwareDevices)
      .where(eq(hardwareDevices.id, id))
      .limit(1);
    return result[0];
  }

  async getHardwareDeviceByDeviceId(
    deviceId: string
  ): Promise<HardwareDevice | undefined> {
    const result = await db
      .select()
      .from(hardwareDevices)
      .where(eq(hardwareDevices.deviceId, deviceId))
      .limit(1);
    return result[0];
  }

  async createHardwareDevice(
    insertDevice: InsertHardwareDevice
  ): Promise<HardwareDevice> {
    const id = randomUUID();
    const newDevice = { ...insertDevice, id };
    const result = await db
      .insert(hardwareDevices)
      .values(newDevice)
      .returning();
    return result[0];
  }

  async updateHardwareDevice(
    id: string,
    updateData: Partial<HardwareDevice>
  ): Promise<HardwareDevice | undefined> {
    const result = await db
      .update(hardwareDevices)
      .set(updateData)
      .where(eq(hardwareDevices.id, id))
      .returning();
    return result[0];
  }

  async getAllHardwareDevices(): Promise<HardwareDevice[]> {
    return await db.select().from(hardwareDevices);
  }

  // Statistics methods
  async getTotalStudents(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(students);
    return result[0].count;
  }

  async getActiveClasses(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(classes)
      .where(eq(classes.active, true));
    return result[0].count;
  }

  async getTodayAttendanceRate(): Promise<number> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    const [presentCount, totalStudents] = await Promise.all([
      db
        .select({
          count: sql<number>`count(DISTINCT ${attendanceRecords.studentId})`,
        })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.status, "present"),
            gte(attendanceRecords.attendanceDate, startOfDay),
            lte(attendanceRecords.attendanceDate, endOfDay)
          )
        ),
      this.getTotalStudents(),
    ]);

    return totalStudents > 0
      ? (presentCount[0].count / totalStudents) * 100
      : 0;
  }

  async getExamEligibilityStats(): Promise<{
    eligible: number;
    ineligible: number;
  }> {
    const [eligibleCount, ineligibleCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(examEligibility)
        .where(eq(examEligibility.isEligible, true)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(examEligibility)
        .where(eq(examEligibility.isEligible, false)),
    ]);

    return {
      eligible: eligibleCount[0].count,
      ineligible: ineligibleCount[0].count,
    };
  }

  // Exam eligibility methods
  async calculateExamEligibility(
    studentId: string,
    classId: string
  ): Promise<ExamEligibility> {
    const [classAttendance, studentAttendance] = await Promise.all([
      this.getAttendanceByClass(classId),
      this.getAttendanceByStudentAndClass(studentId, classId),
    ]);

    const totalClasses = classAttendance.length;
    const attendedClasses = studentAttendance.filter(
      (record) => record.status === "present"
    ).length;
    const attendancePercentage =
      totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

    const classData = await this.getClass(classId);
    const minPercentage = classData?.minAttendancePercentage || 75;
    const isEligible = attendancePercentage >= minPercentage;

    const id = randomUUID();
    const eligibilityData = {
      id,
      studentId,
      classId,
      attendancePercentage: attendancePercentage.toFixed(2),
      totalClasses,
      attendedClasses,
      isEligible,
      lastUpdated: new Date(),
    };

    const result = await db
      .insert(examEligibility)
      .values(eligibilityData)
      .returning();
    return result[0];
  }

  async getExamEligibilityByStudent(
    studentId: string
  ): Promise<ExamEligibility[]> {
    return await db
      .select()
      .from(examEligibility)
      .where(eq(examEligibility.studentId, studentId))
      .orderBy(desc(examEligibility.lastUpdated));
  }
}

export const postgresStorage = new PostgreSQLStorage();
