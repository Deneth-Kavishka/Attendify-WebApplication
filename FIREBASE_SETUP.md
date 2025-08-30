# Firebase Setup Guide

Your project is now configured for both server-side (Admin SDK) and client-side (Web SDK) Firebase integration.

## Current Status

✅ **Admin SDK**: Already configured with your credentials
✅ **Web SDK**: Template ready, needs your specific credentials

## Getting Firebase Web SDK Credentials

You need to get the Web SDK configuration from your Firebase Console:

### Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open your project: **iot-testing-db**

### Step 2: Get Web App Configuration

1. Click on **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. If you don't have a web app, click **Add app** → **Web** → Register your app
4. If you already have a web app, click on it
5. In the **SDK setup and configuration** section, select **Config**
6. Copy the `firebaseConfig` object values

### Step 3: Update Your .env File

Replace the placeholder values in your `.env` file with your actual Firebase config:

```env
# Replace these with your actual Firebase Web SDK credentials:
VITE_FIREBASE_API_KEY="YOUR_ACTUAL_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="iot-testing-db.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="iot-testing-db"
VITE_FIREBASE_STORAGE_BUCKET="iot-testing-db.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_ACTUAL_SENDER_ID"
VITE_FIREBASE_APP_ID="YOUR_ACTUAL_APP_ID"
VITE_FIREBASE_MEASUREMENT_ID="YOUR_ACTUAL_MEASUREMENT_ID"
```

## Firebase Features Enabled

### Server-Side (Admin SDK) ✅

- **Real-time attendance updates**: Hardware → Firebase → Client
- **Hardware status monitoring**: ESP32/NodeMCU status tracking
- **Live class updates**: Student count, class status
- **Authentication**: Admin operations

### Client-Side (Web SDK) 🔄

- **Real-time listeners**: Live attendance feed
- **Hardware status displays**: Connection indicators
- **Live notifications**: Attendance alerts
- **Offline support**: Data synchronization

## Database Structure

Your Firebase Realtime Database will use this structure:

```json
{
  "attendance": {
    "class_123": {
      "student_456": {
        "status": "present",
        "timestamp": "2024-01-15T10:30:00Z",
        "updatedAt": 1705316200000
      }
    }
  },
  "hardware": {
    "esp32_cam_001": {
      "status": "online",
      "lastSeen": 1705316200000,
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "nodemcu_rfid_001": {
      "status": "online",
      "lastSeen": 1705316200000,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  },
  "classes": {
    "class_123": {
      "live": {
        "status": "active",
        "studentCount": 25,
        "lastUpdated": 1705316200000,
        "timestamp": "2024-01-15T10:30:00Z"
      }
    }
  }
}
```

## Testing Firebase Integration

After updating your `.env` file:

1. **Start the development server**:

   ```bash
   npm run dev
   ```

2. **Check the console** for Firebase connection logs

3. **Test real-time features**:
   - Hardware status indicators should show connection status
   - Attendance updates should appear immediately
   - Class status should sync across all connected clients

## Production Deployment

For production deployment:

1. **Environment Variables**: Ensure all `VITE_FIREBASE_*` variables are set
2. **Firebase Rules**: Configure database security rules
3. **Authentication**: Set up proper user authentication
4. **CORS**: Configure Firebase for your domain

## Security Notes

- **Admin SDK credentials** (in .env) should NEVER be exposed to client-side
- **Web SDK credentials** are safe to expose in client bundles
- **Database rules** should restrict access based on authentication
- **Environment separation**: Use different Firebase projects for dev/prod

## Hardware Integration

Your ESP32-CAM and NodeMCU devices will send data to:

- **Attendance endpoint**: `POST /api/attendance/scan`
- **Hardware status**: Automatic Firebase Admin SDK updates
- **Real-time sync**: Immediate client updates via Firebase listeners

## Next Steps

1. ✅ Get Web SDK credentials from Firebase Console
2. ✅ Update `.env` file with actual values
3. ✅ Test real-time features
4. ✅ Deploy with production Firebase project
5. ✅ Connect your ESP32-CAM and NodeMCU devices

Once you update the `.env` file with your actual Firebase Web SDK credentials, your complete IoT attendance system will be ready for production deployment!
