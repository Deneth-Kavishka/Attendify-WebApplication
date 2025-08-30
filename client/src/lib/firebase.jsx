// Firebase configuration for Attendify - Real-time IoT Attendance System
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  onSnapshot,
  collection,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Attendify Firebase Configuration
const firebaseConfig = {
  apiKey:
    process.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyD3PxLHcbORjT_vFoHOqtVoafneXKJN_o4",
  authDomain:
    process.env.VITE_FIREBASE_AUTH_DOMAIN || "iot-testing-db.firebaseapp.com",
  databaseURL:
    process.env.VITE_FIREBASE_DATABASE_URL ||
    "https://iot-testing-db-default-rtdb.firebaseio.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "iot-testing-db",
  storageBucket:
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "iot-testing-db.firebasestorage.app",
  messagingSenderId:
    process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "22167122487",
  appId:
    process.env.VITE_FIREBASE_APP_ID ||
    "1:22167122487:web:2c45c4c9c0a625980645b2",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-3BPQ5MVGG5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const realtimeDb = getDatabase(app);
const storage = getStorage(app);

// Initialize Analytics (only in production)
let analytics = null;
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  analytics = getAnalytics(app);
}

export { db, realtimeDb, storage, analytics };

// Real-time Database functions for IoT hardware integration
import { ref, onValue, set, push, serverTimestamp } from "firebase/database";

// Real-time attendance updates from hardware
export function subscribeToLiveAttendance(classId, callback) {
  const attendanceRef = ref(realtimeDb, `attendance/${classId}`);
  const unsubscribe = onValue(attendanceRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  return unsubscribe;
}

// Hardware status monitoring
export function subscribeToHardwareStatus(callback) {
  const hardwareRef = ref(realtimeDb, "hardware");
  const unsubscribe = onValue(hardwareRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  return unsubscribe;
}

// Live class status updates
export function subscribeToClassStatus(classId, callback) {
  const classRef = ref(realtimeDb, `classes/${classId}/live`);
  const unsubscribe = onValue(classRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
  return unsubscribe;
}

// Update attendance from client (backup/manual entry)
export async function updateAttendanceStatus(classId, studentId, status) {
  try {
    const attendanceRef = ref(realtimeDb, `attendance/${classId}/${studentId}`);
    await set(attendanceRef, {
      status,
      timestamp: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      source: "manual",
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating attendance:", error);
    return { success: false, error: error.message };
  }
}

// Firestore functions for persistent data storage

// Real-time attendance listener
export function subscribeToAttendanceUpdates(callback) {
  const unsubscribe = onSnapshot(collection(db, "attendance"), (snapshot) => {
    const attendanceRecords = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(attendanceRecords);
  });

  return unsubscribe;
}

// Hardware status listener
export function subscribeToHardwareStatus(callback) {
  const unsubscribe = onSnapshot(
    collection(db, "hardware_devices"),
    (snapshot) => {
      const devices = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(devices);
    }
  );

  return unsubscribe;
}

// Add attendance record to Firebase
export async function addAttendanceRecord(record) {
  try {
    const docRef = await addDoc(collection(db, "attendance"), {
      ...record,
      timestamp: new Date(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding attendance record:", error);
    throw error;
  }
}

// Update hardware device status
export async function updateHardwareStatus(deviceId, status) {
  try {
    const deviceRef = doc(db, "hardware_devices", deviceId);
    await updateDoc(deviceRef, {
      status,
      lastHeartbeat: new Date(),
    });
  } catch (error) {
    console.error("Error updating hardware status:", error);
    throw error;
  }
}
