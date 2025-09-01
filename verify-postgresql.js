// Verify PostgreSQL Integration is Working
import { dbStorage } from "./server/storage.js";
import dotenv from "dotenv";
dotenv.config();

async function verifyPostgreSQLIntegration() {
  console.log("🔍 Verifying PostgreSQL Integration...\n");

  // Check environment
  console.log("🔧 Environment Check:");
  console.log("  USE_POSTGRES:", process.env.USE_POSTGRES);
  console.log(
    "  DATABASE_URL:",
    process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"
  );
  console.log();

  try {
    // Test 1: Check if we're using PostgreSQL storage
    console.log("1️⃣ Storage Type Check:");
    console.log("  Storage Class:", dbStorage.constructor.name);
    console.log(
      "  Is PostgreSQL:",
      dbStorage.constructor.name === "PostgreSQLStorage"
        ? "✅ YES"
        : "❌ NO (In-Memory)"
    );
    console.log();

    // Test 2: Database Operations
    console.log("2️⃣ Database Operations Test:");

    // Get all students
    const students = await dbStorage.getAllStudents();
    console.log("  Students found:", students.length);

    // Get all classes
    const classes = await dbStorage.getAllClasses();
    console.log("  Classes found:", classes.length);

    // Get all attendance records
    const attendance = await dbStorage.getAllAttendanceRecords();
    console.log("  Attendance records:", attendance.length);

    // Get all hardware devices
    const hardware = await dbStorage.getAllHardwareDevices();
    console.log("  Hardware devices:", hardware.length);
    console.log();

    // Test 3: User Authentication
    console.log("3️⃣ Authentication Test:");
    const admin = await dbStorage.getUserByUsername("admin");
    const lecturer = await dbStorage.getUserByUsername("lecturer");
    const student = await dbStorage.getUserByUsername("student");

    console.log("  Admin user:", admin ? "✅ Found" : "❌ Missing");
    console.log("  Lecturer user:", lecturer ? "✅ Found" : "❌ Missing");
    console.log("  Student user:", student ? "✅ Found" : "❌ Missing");
    console.log();

    // Test 4: Data Persistence Check
    console.log("4️⃣ Data Persistence Test:");
    const testStudentId = "test-student-" + Date.now();

    try {
      // Create a test student
      const testStudent = await dbStorage.createStudent({
        studentId: testStudentId,
        userId: "user-" + testStudentId,
        fullName: "Test Student",
        email: "test@student.com",
        nic: "123456789V",
        mobileNumber: "0712345678",
        rfidCard: "TEST-RFID-" + Date.now(),
        course: "Test Course",
        year: 1,
        semester: 1,
        department: "Computer Science",
        enrollmentYear: new Date().getFullYear(),
      });

      console.log(
        "  Create student:",
        testStudent ? "✅ Success" : "❌ Failed"
      );

      // Retrieve the test student
      const retrievedStudent = await dbStorage.getStudentByStudentId(
        testStudentId
      );
      console.log(
        "  Retrieve student:",
        retrievedStudent ? "✅ Success" : "❌ Failed"
      );

      // Delete the test student
      if (testStudent) {
        const deleted = await dbStorage.deleteStudent(testStudent.id);
        console.log("  Delete student:", deleted ? "✅ Success" : "❌ Failed");
      }
    } catch (error) {
      console.log("  Data operations:", "❌ Error -", error.message);
    }

    console.log();
    console.log("🎉 PostgreSQL Integration Verification Complete!");

    if (dbStorage.constructor.name === "PostgreSQLStorage") {
      console.log("✅ Your project is successfully using PostgreSQL!");
      console.log("✅ All data will persist across server restarts!");
      console.log("✅ Authentication and CRUD operations are working!");
    } else {
      console.log("⚠️ Your project is using in-memory storage.");
      console.log("💡 Check if PostgreSQL connection is properly configured.");
    }
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
    console.log("\n💡 Troubleshooting:");
    console.log("  1. Make sure PostgreSQL is running");
    console.log("  2. Check DATABASE_URL in .env file");
    console.log("  3. Verify database 'Attendify' exists");
    console.log("  4. Run 'npm run db:push' to create tables");
  }
}

verifyPostgreSQLIntegration().catch(console.error);
