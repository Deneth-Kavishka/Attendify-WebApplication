import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Types
interface AttendanceStatus {
  status: string;
  timestamp: string;
  updatedAt: any;
}

interface HardwareStatus {
  status: string;
  lastSeen: any;
  timestamp: string;
}

interface ClassStatus {
  status: string;
  studentCount: number;
  lastUpdated: any;
  timestamp: string;
}

// Initialize Firebase Admin SDK (server-side)
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: "",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`,
  });
}

const db = admin.database();
const auth = admin.auth();

// Server-side Firebase services
export const firebaseAdmin = {
  // Real-time attendance updates
  updateAttendance: async (
    classId: string,
    studentId: string,
    status: string
  ) => {
    try {
      const timestamp = new Date().toISOString();
      await db.ref(`attendance/${classId}/${studentId}`).set({
        status,
        timestamp,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating attendance:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Hardware status monitoring
  updateHardwareStatus: async (deviceId: string, status: string) => {
    try {
      await db.ref(`hardware/${deviceId}`).set({
        status,
        lastSeen: admin.database.ServerValue.TIMESTAMP,
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating hardware status:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Live class updates
  updateClassStatus: async (
    classId: string,
    status: string,
    studentCount = 0
  ) => {
    try {
      await db.ref(`classes/${classId}/live`).set({
        status,
        studentCount,
        lastUpdated: admin.database.ServerValue.TIMESTAMP,
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating class status:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Get live data
  getLiveAttendance: async (classId: string) => {
    try {
      const snapshot = await db.ref(`attendance/${classId}`).once("value");
      return snapshot.val() || {};
    } catch (error) {
      console.error("Error getting live attendance:", error);
      return {};
    }
  },

  // Listen to real-time changes (for server-side webhooks)
  listenToAttendance: (classId: string, callback: (data: any) => void) => {
    const ref = db.ref(`attendance/${classId}`);
    ref.on("value", (snapshot) => {
      callback(snapshot.val() || {});
    });
    return () => ref.off("value");
  },
};

export default firebaseAdmin;
