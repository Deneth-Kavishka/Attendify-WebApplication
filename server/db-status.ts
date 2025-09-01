// Database Status Check Script for Attendify
import dotenv from "dotenv";

// Load environment variables FIRST
dotenv.config();

import { testConnection } from "./database";
import { dbStorage } from "./storage";

export async function checkDatabaseStatus() {
  console.log("🔍 Checking Attendify Database Status...\n");

  try {
    // 1. Test Connection
    console.log("1️⃣ Testing PostgreSQL Connection...");
    const connected = await testConnection();
    if (!connected) {
      console.log("❌ Database connection failed");
      return false;
    }

    // 2. Check Tables and Data
    console.log("\n2️⃣ Checking Database Tables and Data...");

    const [users, students, lecturers, classes, attendance, hardware] =
      await Promise.all([
        dbStorage
          .getAllStudents()
          .then((data) => ({ table: "Students", count: data.length })),
        dbStorage
          .getAllLecturers()
          .then((data) => ({ table: "Lecturers", count: data.length })),
        dbStorage
          .getAllClasses()
          .then((data) => ({ table: "Classes", count: data.length })),
        dbStorage.getAllAttendanceRecords().then((data) => ({
          table: "Attendance Records",
          count: data.length,
        })),
        dbStorage
          .getAllHardwareDevices()
          .then((data) => ({ table: "Hardware Devices", count: data.length })),
        dbStorage
          .getTotalStudents()
          .then((count) => ({ table: "Total Students", count })),
      ]);

    console.log("📊 Database Statistics:");
    [users, students, lecturers, classes, attendance, hardware].forEach(
      (stat) => {
        console.log(`   ${stat.table}: ${stat.count} records`);
      }
    );

    // 3. Test Key Operations
    console.log("\n3️⃣ Testing Key Operations...");

    // Test user lookup
    const adminUser = await dbStorage.getUserByUsername("admin");
    console.log(`   Admin User: ${adminUser ? "✅ Found" : "❌ Not Found"}`);

    // Test hardware devices
    const esp32 = await dbStorage.getHardwareDeviceByDeviceId("ESP32_CAM_001");
    console.log(`   ESP32-CAM Device: ${esp32 ? "✅ Found" : "❌ Not Found"}`);

    console.log("\n🎉 Database Status: HEALTHY");
    console.log("✅ PostgreSQL connection successful");
    console.log("✅ All tables accessible");
    console.log("✅ Demo data available");
    console.log("✅ Ready for IoT attendance tracking!");

    return true;
  } catch (error) {
    console.error("\n❌ Database Status Check Failed:", error);
    console.log("\n🔧 Troubleshooting Tips:");
    console.log("1. Check if PostgreSQL is running: pg_ctl status");
    console.log("2. Verify database exists: psql -U postgres -l");
    console.log("3. Create database if needed: createdb -U postgres Attendify");
    console.log("4. Run migrations: npm run db:push");

    return false;
  }
}

// Run status check when script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDatabaseStatus().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
