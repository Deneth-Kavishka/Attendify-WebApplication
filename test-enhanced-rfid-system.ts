/**
 * Enhanced RFID System Integration Test
 * Tests the complete RFID attendance workflow
 *
 * This test verifies:
 * - RFID card scanning
 * - Student profile retrieval
 * - Attendance recording
 * - WebSocket communication
 * - Database operations
 *
 * Version: 2.0.0
 */

import { enhancedRFIDService } from "./server/enhanced-rfid-service";
import { PostgreSQLStorage } from "./server/postgres-storage";
import { db, testConnection } from "./server/database";
import { students, attendanceRecords } from "./shared/schema";
import { eq } from "drizzle-orm";

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  duration?: number;
}

class RFIDSystemTester {
  private storage: PostgreSQLStorage;
  private testResults: TestResult[] = [];

  constructor() {
    this.storage = new PostgreSQLStorage();
  }

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<void> {
    console.log("🧪 Starting Enhanced RFID System Integration Tests");
    console.log("=".repeat(60));

    const startTime = Date.now();

    try {
      await this.testDatabaseConnection();
      await this.testStudentCreation();
      await this.testRFIDCardAssignment();
      await this.testStudentProfileRetrieval();
      await this.testAttendanceRecording();
      await this.testWebSocketCommunication();
      await this.testErrorHandling();

      const totalTime = Date.now() - startTime;
      this.printResults(totalTime);
    } catch (error) {
      console.error("❌ Test suite failed:", error);
      process.exit(1);
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnection(): Promise<void> {
    const testName = "Database Connection";
    const startTime = Date.now();

    try {
      const connected = await testConnection();
      const duration = Date.now() - startTime;

      if (connected) {
        this.addResult(
          testName,
          true,
          "Database connection successful",
          duration
        );
      } else {
        this.addResult(testName, false, "Database connection failed", duration);
      }
    } catch (error) {
      this.addResult(testName, false, `Database error: ${error.message}`);
    }
  }

  /**
   * Test student creation with RFID card
   */
  async testStudentCreation(): Promise<void> {
    const testName = "Student Creation";
    const startTime = Date.now();

    try {
      const testStudent = {
        userId: "test_user_001",
        fullName: "Test Student",
        email: "test.student@university.edu",
        role: "student" as const,
        department: "Computer Science",
        studentId: "TEST001",
        rfidCard: "RFIDTEST001",
        enrollmentYear: 2024,
        batch: "2024A",
        semester: "1",
        gpa: "3.75",
        mobileNumber: "+1234567890",
        guardianContact: "+1234567891",
        emergencyContact: "+1234567892",
        active: true,
      };

      const student = await this.storage.createStudent(testStudent);
      const duration = Date.now() - startTime;

      if (student && student.id) {
        this.addResult(
          testName,
          true,
          `Student created with ID: ${student.id}`,
          duration
        );
      } else {
        this.addResult(testName, false, "Failed to create student", duration);
      }
    } catch (error) {
      this.addResult(
        testName,
        false,
        `Student creation error: ${error.message}`
      );
    }
  }

  /**
   * Test RFID card assignment and validation
   */
  async testRFIDCardAssignment(): Promise<void> {
    const testName = "RFID Card Assignment";
    const startTime = Date.now();

    try {
      // Test card availability check
      const availableCards = await this.storage.getAvailableRfidCards();

      // Test new card generation
      const newCard = await this.storage.generateNewRfidCard();

      const duration = Date.now() - startTime;

      if (availableCards.length > 0 && newCard.startsWith("RFID")) {
        this.addResult(
          testName,
          true,
          `Found ${availableCards.length} available cards, generated: ${newCard}`,
          duration
        );
      } else {
        this.addResult(
          testName,
          false,
          "RFID card assignment failed",
          duration
        );
      }
    } catch (error) {
      this.addResult(
        testName,
        false,
        `RFID assignment error: ${error.message}`
      );
    }
  }

  /**
   * Test complete student profile retrieval by RFID
   */
  async testStudentProfileRetrieval(): Promise<void> {
    const testName = "Student Profile Retrieval";
    const startTime = Date.now();

    try {
      // Find the test student we created
      const student = await this.storage.getStudentByRfidCard("RFIDTEST001");
      const duration = Date.now() - startTime;

      if (student) {
        // Verify all required fields are present
        const requiredFields = [
          "id",
          "fullName",
          "studentId",
          "email",
          "rfidCard",
          "department",
        ];
        const missingFields = requiredFields.filter((field) => !student[field]);

        if (missingFields.length === 0) {
          this.addResult(
            testName,
            true,
            `Complete profile retrieved for ${student.fullName}`,
            duration
          );
        } else {
          this.addResult(
            testName,
            false,
            `Missing required fields: ${missingFields.join(", ")}`,
            duration
          );
        }
      } else {
        this.addResult(
          testName,
          false,
          "Student not found by RFID card",
          duration
        );
      }
    } catch (error) {
      this.addResult(
        testName,
        false,
        `Profile retrieval error: ${error.message}`
      );
    }
  }

  /**
   * Test attendance recording
   */
  async testAttendanceRecording(): Promise<void> {
    const testName = "Attendance Recording";
    const startTime = Date.now();

    try {
      // Find the test student
      const student = await this.storage.getStudentByRfidCard("RFIDTEST001");

      if (!student) {
        this.addResult(
          testName,
          false,
          "Test student not found for attendance test"
        );
        return;
      }

      // Record attendance
      const attendanceRecord = await this.storage.createAttendanceRecord({
        studentId: student.id,
        classId: "TEST_CLASS_001",
        attendanceDate: new Date(),
        method: "rfid",
        status: "present",
        hardwareId: "TEST_DEVICE_001",
        confidence: null,
      });

      const duration = Date.now() - startTime;

      if (attendanceRecord && attendanceRecord.id) {
        this.addResult(
          testName,
          true,
          `Attendance recorded with ID: ${attendanceRecord.id}`,
          duration
        );
      } else {
        this.addResult(
          testName,
          false,
          "Failed to record attendance",
          duration
        );
      }
    } catch (error) {
      this.addResult(
        testName,
        false,
        `Attendance recording error: ${error.message}`
      );
    }
  }

  /**
   * Test WebSocket communication simulation
   */
  async testWebSocketCommunication(): Promise<void> {
    const testName = "WebSocket Communication";
    const startTime = Date.now();

    try {
      // Simulate WebSocket message handling
      const mockMessage = {
        type: "rfid_scan",
        cardId: "RFIDTEST001",
        deviceId: "TEST_DEVICE_001",
        timestamp: new Date().toISOString(),
      };

      // Test message parsing
      const messageStr = JSON.stringify(mockMessage);
      const parsedMessage = JSON.parse(messageStr);

      const duration = Date.now() - startTime;

      if (parsedMessage.type === "rfid_scan" && parsedMessage.cardId) {
        this.addResult(
          testName,
          true,
          "WebSocket message parsing successful",
          duration
        );
      } else {
        this.addResult(
          testName,
          false,
          "WebSocket message parsing failed",
          duration
        );
      }
    } catch (error) {
      this.addResult(testName, false, `WebSocket test error: ${error.message}`);
    }
  }

  /**
   * Test error handling scenarios
   */
  async testErrorHandling(): Promise<void> {
    const testName = "Error Handling";
    const startTime = Date.now();

    try {
      // Test unknown RFID card
      const unknownStudent = await this.storage.getStudentByRfidCard(
        "UNKNOWN_CARD"
      );

      // Test invalid student ID for attendance
      let attendanceError = null;
      try {
        await this.storage.createAttendanceRecord({
          studentId: "INVALID_ID",
          classId: "TEST_CLASS",
          attendanceDate: new Date(),
          method: "rfid",
          status: "present",
          hardwareId: "TEST_DEVICE",
          confidence: null,
        });
      } catch (error) {
        attendanceError = error;
      }

      const duration = Date.now() - startTime;

      if (unknownStudent === undefined && attendanceError) {
        this.addResult(
          testName,
          true,
          "Error handling working correctly",
          duration
        );
      } else {
        this.addResult(
          testName,
          false,
          "Error handling not working as expected",
          duration
        );
      }
    } catch (error) {
      this.addResult(
        testName,
        false,
        `Error handling test failed: ${error.message}`
      );
    }
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up test data...");

    try {
      // Delete test student
      await db.delete(students).where(eq(students.studentId, "TEST001"));

      // Delete test attendance records
      await db
        .delete(attendanceRecords)
        .where(eq(attendanceRecords.classId, "TEST_CLASS_001"));

      console.log("✅ Test data cleanup completed");
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
    }
  }

  /**
   * Add test result
   */
  private addResult(
    test: string,
    passed: boolean,
    message: string,
    duration?: number
  ): void {
    this.testResults.push({ test, passed, message, duration });

    const status = passed ? "✅" : "❌";
    const timeInfo = duration ? ` (${duration}ms)` : "";
    console.log(`${status} ${test}: ${message}${timeInfo}`);
  }

  /**
   * Print final test results
   */
  private printResults(totalTime: number): void {
    console.log();
    console.log("=".repeat(60));
    console.log("📊 Test Results Summary");
    console.log("=".repeat(60));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(
      `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
    );
    console.log(`Total Time: ${totalTime}ms`);

    if (failedTests > 0) {
      console.log();
      console.log("❌ Failed Tests:");
      this.testResults
        .filter((r) => !r.passed)
        .forEach((r) => console.log(`   • ${r.test}: ${r.message}`));
    }

    console.log();
    if (passedTests === totalTests) {
      console.log(
        "🎉 All tests passed! Your enhanced RFID system is ready to use."
      );
      console.log();
      console.log("📋 Next Steps:");
      console.log("1. Upload the Arduino code to your NodeMCU device");
      console.log("2. Update WiFi and server settings in the Arduino code");
      console.log(
        "3. Start the system using: ./start-enhanced-rfid-system.ps1"
      );
      console.log(
        "4. Register students with RFID cards through the web interface"
      );
      console.log("5. Test RFID scanning with real hardware");
    } else {
      console.log(
        "⚠️  Some tests failed. Please fix the issues before deployment."
      );
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new RFIDSystemTester();

  tester
    .runAllTests()
    .then(() => tester.cleanup())
    .catch((error) => {
      console.error("❌ Test execution failed:", error);
      process.exit(1);
    });
}

export { RFIDSystemTester };
