// Firebase configuration for real-time updates
import { initializeApp } from 'firebase/app';
import { getFirestore, onSnapshot, collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-attendance-demo.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "smart-attendance-demo",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-attendance-demo.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };

// Real-time attendance listener
export function subscribeToAttendanceUpdates(callback) {
  const unsubscribe = onSnapshot(collection(db, 'attendance'), (snapshot) => {
    const attendanceRecords = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(attendanceRecords);
  });

  return unsubscribe;
}

// Hardware status listener
export function subscribeToHardwareStatus(callback) {
  const unsubscribe = onSnapshot(collection(db, 'hardware_devices'), (snapshot) => {
    const devices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(devices);
  });

  return unsubscribe;
}

// Add attendance record to Firebase
export async function addAttendanceRecord(record) {
  try {
    const docRef = await addDoc(collection(db, 'attendance'), {
      ...record,
      timestamp: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding attendance record:', error);
    throw error;
  }
}

// Update hardware device status
export async function updateHardwareStatus(deviceId, status) {
  try {
    const deviceRef = doc(db, 'hardware_devices', deviceId);
    await updateDoc(deviceRef, {
      status,
      lastHeartbeat: new Date()
    });
  } catch (error) {
    console.error('Error updating hardware status:', error);
    throw error;
  }
}
