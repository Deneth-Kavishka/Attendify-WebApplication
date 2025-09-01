// Database Setup and Migration Script for Attendify
import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

import { testConnection, db, closeConnection } from "./database";
import { dbStorage } from "./storage";
import { sql } from "drizzle-orm";

export async function setupDatabase() {
  console.log("🗄️  Setting up Attendify PostgreSQL Database...");

  try {
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error("Database connection failed");
    }

    // Run database migrations (create tables)
    console.log("📋 Running database migrations...");
    await runMigrations();

    // Initialize demo data
    console.log("🌱 Initializing demo data...");
    await initializeDemoData();

    console.log("✅ Database setup completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    return false;
  }
}

async function runMigrations() {
  try {
    // This will be handled by drizzle-kit push command
    console.log('📋 Run "npm run db:push" to create/update database tables');
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

async function initializeDemoData() {
  try {
    // Check if admin user already exists
    const existingAdmin = await dbStorage.getUserByUsername("admin");
    if (existingAdmin) {
      console.log("📊 Demo data already exists, skipping initialization");
      return;
    }

    console.log("👤 Creating admin user...");
    const adminUser = await dbStorage.createUser({
      username: "admin",
      password: "admin123",
      email: "admin@attendify.com",
      fullName: "System Administrator",
      role: "admin",
      department: "IT Department",
    });

    console.log("👨‍🏫 Creating lecturer user...");
    const lecturerUser = await dbStorage.createUser({
      username: "lecturer",
      password: "lecturer123",
      email: "lecturer@attendify.com",
      fullName: "Dr. Sarah Johnson",
      role: "lecturer",
      department: "Computer Science",
    });

    console.log("👨‍🎓 Creating student user...");
    const studentUser = await dbStorage.createUser({
      username: "student",
      password: "student123",
      email: "student@attendify.com",
      fullName: "John Smith",
      role: "student",
      department: null,
    });

    // Create lecturer profile
    console.log("👨‍🏫 Creating lecturer profile...");
    const lecturerProfile = await dbStorage.createLecturer({
      userId: lecturerUser.id,
      lecturerId: "LEC001",
      specialization: "Computer Science",
      active: true,
    });

    // Create student profile
    console.log("👨‍🎓 Creating student profile...");
    const studentProfile = await dbStorage.createStudent({
      userId: studentUser.id,
      studentId: "STU001",
      enrollmentYear: 2024,
      rfidCard: "RFID000001",
      active: true,
    });

    console.log("🏫 Creating demo class...");
    const demoClass = await dbStorage.createClass({
      className: "Introduction to Programming",
      lecturerId: lecturerProfile.id, // Use lecturer profile ID, not user ID
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

    console.log("📱 Creating hardware devices...");
    await dbStorage.createHardwareDevice({
      deviceId: "ESP32_CAM_001",
      deviceType: "esp32_cam",
      location: "Room 101",
      status: "online",
      lastHeartbeat: new Date(),
      configuration: { resolution: "640x480", threshold: 0.85 },
    });

    await dbStorage.createHardwareDevice({
      deviceId: "RFID_READER_001",
      deviceType: "rfid_reader",
      location: "Main Entrance",
      status: "online",
      lastHeartbeat: new Date(),
      configuration: { readRange: 10, frequency: 125 },
    });

    console.log("📊 Creating sample attendance records...");
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await dbStorage.createAttendanceRecord({
      studentId: studentProfile.id, // Use student profile ID, not user ID
      classId: demoClass.id,
      attendanceDate: today,
      method: "face_recognition",
      status: "present",
      hardwareId: "ESP32_CAM_001",
      confidence: "0.95",
    });

    await dbStorage.createAttendanceRecord({
      studentId: studentProfile.id, // Use student profile ID, not user ID
      classId: demoClass.id,
      attendanceDate: yesterday,
      method: "rfid",
      status: "present",
      hardwareId: "RFID_READER_001",
      confidence: null,
    });

    console.log("✅ Demo data initialized successfully");
  } catch (error) {
    console.error("❌ Demo data initialization failed:", error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase() {
  await closeConnection();
  console.log("🔌 Database connection closed");
}

// Auto-setup on import in development
if (process.env.NODE_ENV !== "production") {
  setupDatabase().catch(console.error);
}
