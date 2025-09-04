import { useState, useEffect } from "react";
import { io } from "socket.io-client";

export default function AttendanceFeed({ records = [] }) {
  const [realTimeRecords, setRealTimeRecords] = useState(records);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [rfidServiceConnected, setRfidServiceConnected] = useState(false);
  const [pythonServiceConnected, setPythonServiceConnected] = useState(false);
  const [recentScan, setRecentScan] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);

  // Show visual notification for new scans
  const showScanNotification = (data, type = "success") => {
    setRecentScan({ ...data, type });
    setShowNotification(true);
    setScanCount((prev) => prev + 1);
    setLastScanTime(new Date());

    // Play sound notification
    try {
      const audio = new Audio();
      if (type === "success") {
        // Success sound (higher pitch)
        audio.src =
          "data:audio/wav;base64,UklGRnolAABXQVZFZm10IAAAAAAQAAABAAAAQB8AAEAfAAABAAgAZGF0YQoFAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmsfCD2Wy+/PgyEBJIXQ6tWKOggcb8Fy36Y3Fgls3vrAeiwOOSCS2e2MQQwTYbXh5Z9KGAp+y+jFlEoSD2O76uCRR0oHEm7K6tuJNwYR";
      } else {
        // Error sound (lower pitch)
        audio.src =
          "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IAAAAAAQAAABAAAAQB8AAEAfAAABAAgAZGF0YQoFAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmsfCD2Wy+/PgyEBJIXQ6tWKOggcb8Fy36Y3Fgls3vrAeiwOOSCS2e2MQQwTYbXh5Z9KGAp+y+jFlEoSD2O76uCRR0oHEm7K6tuJNwYR";
      }
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (user needs to interact with page first)
      });
    } catch (error) {
      console.log("Audio notification failed:", error);
    }

    // Hide notification after 3 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  useEffect(() => {
    // Connect to RFID WebSocket Service (Port 5001)
    const rfidSocket = io("http://localhost:5001", {
      transports: ["websocket", "polling"],
    });

    rfidSocket.on("connect", () => {
      console.log("📡 Connected to RFID WebSocket Service");
      setRfidServiceConnected(true);
    });

    rfidSocket.on("disconnect", () => {
      console.log("📡 Disconnected from RFID WebSocket Service");
      setRfidServiceConnected(false);
    });

    // Handle RFID attendance updates
    rfidSocket.on("rfid_attendance", (data) => {
      console.log("🎯 RFID attendance update:", data);

      const attendanceRecord = {
        id: data.id || Date.now(),
        studentId: data.studentId,
        studentName: data.studentName,
        deviceId: data.deviceId,
        method: "rfid",
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.status,
        department: data.department,
        rfidCard: data.rfidCard,
        location: data.location,
        className: `${data.department} - RFID Scanner`,
      };

      setRealTimeRecords((prev) => [attendanceRecord, ...prev.slice(0, 9)]);

      // Show success notification
      showScanNotification(
        {
          title: "✅ Attendance Marked!",
          message: `${data.studentName} (${data.studentId})`,
          subtitle: `RFID: ${data.rfidCard} • ${data.department}`,
          icon: "fas fa-id-card",
        },
        "success"
      );
    });

    // Handle general attendance updates
    rfidSocket.on("attendance_update", (data) => {
      console.log("📨 General attendance update:", data);

      const attendanceRecord = {
        id: data.id || Date.now(),
        studentId: data.studentId,
        studentName: data.studentName,
        deviceId: data.deviceId,
        method: data.method || "rfid",
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.status,
        department: data.department,
        location: data.location,
        className: data.className || `${data.department} - Attendance`,
      };

      setRealTimeRecords((prev) => [attendanceRecord, ...prev.slice(0, 9)]);
    });

    // Handle unknown RFID cards
    rfidSocket.on("unknown_card", (data) => {
      console.log("❌ Unknown RFID card:", data);

      const unknownRecord = {
        id: data.id || Date.now(),
        studentId: "UNKNOWN",
        studentName: `Unknown Card: ${data.rfidCard}`,
        deviceId: data.deviceId,
        method: "rfid",
        timestamp: data.timestamp || new Date().toISOString(),
        status: "unknown_card",
        rfidCard: data.rfidCard,
        location: data.location,
        className: "Unregistered Card",
        isUnknown: true,
      };

      setRealTimeRecords((prev) => [unknownRecord, ...prev.slice(0, 9)]);

      // Show error notification
      showScanNotification(
        {
          title: "❌ Unknown Card",
          message: `Unregistered RFID Card`,
          subtitle: `Card ID: ${data.rfidCard} • Please register this card`,
          icon: "fas fa-question-circle",
        },
        "error"
      );
    });

    // Connect to Node.js WebSocket for general updates (if available)
    const nodeWs = new WebSocket(`ws://${window.location.host}`);

    nodeWs.onopen = () => {
      console.log("📡 Connected to Node.js WebSocket");
      setConnectionStatus("connected");
    };

    nodeWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📨 Node.js WebSocket message:", data);

      if (
        data.type === "attendance_update" ||
        data.type === "face_recognition_attendance"
      ) {
        const newRecord = data.data || data;
        setRealTimeRecords((prev) => [newRecord, ...prev.slice(0, 9)]);
      }
    };

    nodeWs.onclose = () => {
      console.log("🔌 Node.js WebSocket disconnected");
      setConnectionStatus("disconnected");
    };

    nodeWs.onerror = () => {
      setConnectionStatus("error");
    };

    // Connect to Python backend WebSocket for face recognition updates
    const pythonSocket = io("http://localhost:8000", {
      transports: ["websocket", "polling"],
    });

    pythonSocket.on("connect", () => {
      console.log("🐍 Connected to Python Face Recognition Service");
      setPythonServiceConnected(true);
    });

    pythonSocket.on("disconnect", () => {
      console.log("🐍 Disconnected from Python Face Recognition Service");
      setPythonServiceConnected(false);
    });

    pythonSocket.on("attendance_update", (data) => {
      console.log("🎯 Face recognition attendance:", data);

      const attendanceRecord = {
        id: Date.now(),
        studentId: data.studentId,
        studentName: data.studentName,
        deviceId: data.deviceId,
        method: "face_recognition",
        confidence: data.confidence,
        timestamp: data.timestamp || new Date().toISOString(),
        recognitionTime: data.recognitionTime,
        className: "Face Recognition",
      };

      setRealTimeRecords((prev) => [attendanceRecord, ...prev.slice(0, 9)]);
    });

    pythonSocket.on("face_recognized", (data) => {
      console.log("👤 Face recognized:", data);

      const attendanceRecord = {
        id: Date.now(),
        studentId: data.studentId,
        studentName: data.studentName,
        deviceId: data.deviceId || "ESP32_CAM_001",
        method: "face_recognition",
        confidence: data.confidence,
        timestamp: data.timestamp || new Date().toISOString(),
        className: "Live Recognition",
      };

      setRealTimeRecords((prev) => [attendanceRecord, ...prev.slice(0, 9)]);
    });

    return () => {
      nodeWs.close();
      rfidSocket.disconnect();
      pythonSocket.disconnect();
    };
  }, []);

  const getMethodIcon = (method, isUnknown) => {
    if (isUnknown) {
      return {
        icon: "fas fa-question-circle",
        color: "text-red-600",
        bg: "bg-red-100",
        label: "Unknown Card",
      };
    }

    if (method === "face_recognition") {
      return {
        icon: "fas fa-camera",
        color: "text-green-600",
        bg: "bg-green-100",
        label: "Face Recognition",
      };
    } else {
      return {
        icon: "fas fa-id-card",
        color: "text-blue-600",
        bg: "bg-blue-100",
        label: "RFID Card",
      };
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      return "Invalid time";
    }
  };

  return (
    <>
      {/* Real-time Scan Notification */}
      {showNotification && recentScan && (
        <div
          className={`fixed top-4 right-4 z-50 transform transition-all duration-500 ease-in-out ${
            showNotification
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0"
          }`}
        >
          <div
            className={`rounded-lg shadow-2xl border-l-4 p-4 max-w-sm ${
              recentScan.type === "success"
                ? "bg-green-50 border-green-500 text-green-800"
                : "bg-red-50 border-red-500 text-red-800"
            }`}
          >
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                  recentScan.type === "success" ? "bg-green-100" : "bg-red-100"
                }`}
              >
                <i
                  className={`${recentScan.icon} text-lg ${
                    recentScan.type === "success"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                ></i>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{recentScan.title}</h4>
                <p className="text-sm font-medium">{recentScan.message}</p>
                <p className="text-xs opacity-75">{recentScan.subtitle}</p>
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Real-time Attendance Feed
              </h3>
              {/* Live Scan Counter */}
              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-blue-700 font-medium">
                  {scanCount} scans today
                </span>
              </div>
              {lastScanTime && (
                <div className="text-xs text-gray-500">
                  Last scan: {lastScanTime.toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status Indicators */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-green-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                ></div>
                <span className="text-xs text-gray-600">Node.js</span>
              </div>

              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    rfidServiceConnected
                      ? "bg-green-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                ></div>
                <span className="text-xs text-gray-600">RFID System</span>
              </div>

              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    pythonServiceConnected
                      ? "bg-green-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                ></div>
                <span className="text-xs text-gray-600">Face Recognition</span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Live</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {realTimeRecords.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-camera text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No attendance records yet</p>
                <p className="text-sm text-gray-400">
                  Face recognition records will appear here in real-time
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  {/* <p>📡 Node.js Status: {connectionStatus}</p>
                <p>
                  🐍 Python Service:{" "}
                  {pythonServiceConnected ? "Connected" : "Disconnected"}
                </p>*/}
                </div>
              </div>
            ) : (
              realTimeRecords.slice(0, 10).map((record, index) => {
                const methodStyle = getMethodIcon(
                  record.method,
                  record.isUnknown
                );
                const isNewRecord = index === 0; // First record is the newest

                return (
                  <div
                    key={record.id || index}
                    className={`flex items-center space-x-4 p-4 bg-white rounded-lg border transition-all duration-500 ease-in-out transform ${
                      isNewRecord
                        ? "border-blue-300 shadow-lg scale-105 animate-pulse"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                    style={{
                      animation: isNewRecord
                        ? "slideInFromRight 0.5s ease-out"
                        : "none",
                    }}
                  >
                    {/* Student Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-user text-white text-lg"></i>
                    </div>

                    {/* Student Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {record.studentName ||
                          `Student ID: ${record.studentId}`}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {record.className ||
                          record.deviceId ||
                          `Class ID: ${record.classId}`}
                      </p>
                      {record.confidence && (
                        <p
                          className={`text-xs ${getConfidenceColor(
                            record.confidence
                          )}`}
                        >
                          Confidence: {(record.confidence * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>

                    {/* Method & Time */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${methodStyle.bg}`}
                        >
                          <i
                            className={`${methodStyle.icon} text-sm ${methodStyle.color}`}
                          ></i>
                        </div>
                        <span
                          className={`text-sm font-medium ${methodStyle.color}`}
                        >
                          {methodStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatTimestamp(
                          record.attendanceDate ||
                            record.timestamp ||
                            record.createdAt
                        )}
                      </p>
                      {record.recognitionTime && (
                        <p className="text-xs text-gray-400">
                          Processed: {formatTimestamp(record.recognitionTime)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {realTimeRecords.length > 0 && (
            <div className="mt-6 text-center">
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All Attendance Records ({realTimeRecords.length} total)
              </button>
            </div>
          )}

          {/* Debug Info 
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p>
              <strong>Debug Info:</strong>
            </p>
            <p>Connection Status: {connectionStatus}</p>
            <p>
              Python Service:{" "}
              {pythonServiceConnected ? "Connected" : "Disconnected"}
            </p>
            <p>Records Count: {realTimeRecords.length}</p>
            <p>
              Last Update:{" "}
              {realTimeRecords[0]?.timestamp
                ? new Date(realTimeRecords[0].timestamp).toLocaleString()
                : "None"}
            </p>
          </div>
        )}*/}
        </div>
      </div>
    </>
  );
}
