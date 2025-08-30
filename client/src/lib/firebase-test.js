// Firebase Connection Test for Attendify
import { db, realtimeDb, analytics } from "./firebase.jsx";
import { ref, set } from "firebase/database";
import { collection, addDoc } from "firebase/firestore";

export async function testFirebaseConnection() {
  console.log("🔥 Testing Attendify Firebase Connection...");

  try {
    // Test Realtime Database (for IoT hardware)
    console.log("📡 Testing Realtime Database...");
    const testRef = ref(realtimeDb, "connection_test");
    await set(testRef, {
      timestamp: new Date().toISOString(),
      status: "connected",
      app: "Attendify",
      test: true,
    });
    console.log("✅ Realtime Database connected successfully!");

    // Test Firestore (for persistent data)
    console.log("📊 Testing Firestore...");
    const testDoc = await addDoc(collection(db, "connection_test"), {
      timestamp: new Date(),
      status: "connected",
      app: "Attendify",
      test: true,
    });
    console.log("✅ Firestore connected successfully!", testDoc.id);

    // Test Analytics (if available)
    if (analytics) {
      console.log("📈 Analytics initialized for production");
    } else {
      console.log("📈 Analytics skipped (development mode)");
    }

    console.log("🎉 All Firebase services connected successfully!");
    return { success: true, message: "Firebase connection successful" };
  } catch (error) {
    console.error("❌ Firebase connection failed:", error);
    return { success: false, error: error.message };
  }
}

// Hardware simulation for testing
export async function simulateHardwareUpdate() {
  try {
    const hardwareRef = ref(realtimeDb, "hardware/test_device");
    await set(hardwareRef, {
      status: "online",
      lastSeen: new Date().toISOString(),
      deviceType: "ESP32-CAM",
      location: "Test Lab",
    });
    console.log("🔧 Hardware status simulation sent");
    return true;
  } catch (error) {
    console.error("❌ Hardware simulation failed:", error);
    return false;
  }
}

// Attendance simulation for testing
export async function simulateAttendanceUpdate() {
  try {
    const attendanceRef = ref(realtimeDb, "attendance/test_class/test_student");
    await set(attendanceRef, {
      status: "present",
      timestamp: new Date().toISOString(),
      method: "face_recognition",
      confidence: 0.95,
    });
    console.log("👨‍🎓 Attendance simulation sent");
    return true;
  } catch (error) {
    console.error("❌ Attendance simulation failed:", error);
    return false;
  }
}
