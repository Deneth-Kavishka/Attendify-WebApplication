import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  decimal,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // 'admin', 'lecturer', 'student'
  department: text("department"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const students = pgTable("students", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  studentId: text("student_id").notNull().unique(),
  rfidCard: text("rfid_card"),
  faceEmbedding: jsonb("face_embedding"), // Face recognition data
  enrollmentYear: integer("enrollment_year").notNull(),

  // Personal Information
  nic: text("nic").unique(), // National Identity Card
  mobileNumber: text("mobile_number"),
  gender: text("gender"), // 'male', 'female', 'other'
  dateOfBirth: timestamp("date_of_birth"),
  address: text("address"),
  guardianName: text("guardian_name"),
  guardianContact: text("guardian_contact"),
  emergencyContact: text("emergency_contact"),

  // Academic Information
  batch: text("batch"), // e.g., "2024A", "2024B"
  semester: text("semester"), // Current semester
  gpa: decimal("gpa", { precision: 3, scale: 2 }), // Current GPA

  // Face Recognition Status
  faceRegistrationStatus: text("face_registration_status").default("pending"), // 'pending', 'completed', 'failed'
  faceRegistrationDate: timestamp("face_registration_date"),

  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lecturers = pgTable("lecturers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  lecturerId: text("lecturer_id").notNull().unique(),
  specialization: text("specialization"),
  active: boolean("active").default(true),
});

export const classes = pgTable("classes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  classCode: text("class_code").notNull().unique(),
  className: text("class_name").notNull(),
  lecturerId: varchar("lecturer_id")
    .notNull()
    .references(() => lecturers.id),
  room: text("room").notNull(),
  schedule: jsonb("schedule"), // Day, time, duration
  semester: text("semester").notNull(),
  academicYear: text("academic_year").notNull(),
  minAttendancePercentage: integer("min_attendance_percentage").default(75),
  active: boolean("active").default(true),
});

export const classEnrollments = pgTable("class_enrollments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  classId: varchar("class_id")
    .notNull()
    .references(() => classes.id),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  classId: varchar("class_id")
    .notNull()
    .references(() => classes.id),
  attendanceDate: timestamp("attendance_date").notNull(),
  method: text("method").notNull(), // 'face_recognition', 'rfid'
  status: text("status").notNull(), // 'present', 'absent', 'late'
  hardwareId: text("hardware_id"), // ESP32-CAM or RFID device ID
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // For face recognition
  createdAt: timestamp("created_at").defaultNow(),
});

export const hardwareDevices = pgTable("hardware_devices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  deviceId: text("device_id").notNull().unique(),
  deviceType: text("device_type").notNull(), // 'esp32_cam', 'rfid_reader'
  location: text("location").notNull(),
  status: text("status").notNull(), // 'online', 'offline', 'maintenance'
  lastHeartbeat: timestamp("last_heartbeat"),
  configuration: jsonb("configuration"),

  // Additional ESP32 CAM specific fields
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  description: text("description"),
  firmwareVersion: text("firmware_version"),

  // Real-time monitoring data
  batteryLevel: integer("battery_level"), // 0-100 percentage
  signalStrength: integer("signal_strength"), // WiFi RSSI in dBm
  freeMemory: integer("free_memory"), // Available RAM in bytes

  // Device health metrics
  uptimeHours: decimal("uptime_hours", { precision: 10, scale: 2 }),
  totalScans: integer("total_scans").default(0),
  successfulScans: integer("successful_scans").default(0),
  lastErrorMessage: text("last_error_message"),
  lastErrorTime: timestamp("last_error_time"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const examEligibility = pgTable("exam_eligibility", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  studentId: varchar("student_id")
    .notNull()
    .references(() => students.id),
  classId: varchar("class_id")
    .notNull()
    .references(() => classes.id),
  attendancePercentage: decimal("attendance_percentage", {
    precision: 5,
    scale: 2,
  }).notNull(),
  totalClasses: integer("total_classes").notNull(),
  attendedClasses: integer("attended_classes").notNull(),
  isEligible: boolean("is_eligible").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
});

export const insertLecturerSchema = createInsertSchema(lecturers).omit({
  id: true,
});

export const insertClassSchema = createInsertSchema(classes).omit({
  id: true,
});

export const insertAttendanceRecordSchema = createInsertSchema(
  attendanceRecords
).omit({
  id: true,
  createdAt: true,
});

export const insertHardwareDeviceSchema = createInsertSchema(
  hardwareDevices
).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Lecturer = typeof lecturers.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type HardwareDevice = typeof hardwareDevices.$inferSelect;
export type ExamEligibility = typeof examEligibility.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertLecturer = z.infer<typeof insertLecturerSchema>;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type InsertAttendanceRecord = z.infer<
  typeof insertAttendanceRecordSchema
>;
export type InsertHardwareDevice = z.infer<typeof insertHardwareDeviceSchema>;
