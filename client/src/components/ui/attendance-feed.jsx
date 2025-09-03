import { useState, useEffect } from "react";
import { io } from "socket.io-client";

export default function AttendanceFeed({ records = [] }) {
  const [realTimeRecords, setRealTimeRecords] = useState(records);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [pythonServiceConnected, setPythonServiceConnected] = useState(false);

  useEffect(() => {
    // Connect to Node.js WebSocket for general updates
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
        data.type === "face_recognition_attendance" ||
        data.type === "rfid_attendance"
      ) {
        const newRecord = data.data || data;
        setRealTimeRecords((prev) => [newRecord, ...prev.slice(0, 9)]); // Keep latest 10 records
      }
    };

    nodeWs.onclose = () => {
      console.log("🔌 Node.js WebSocket disconnected");
      setConnectionStatus("disconnected");
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
      };

      setRealTimeRecords((prev) => [attendanceRecord, ...prev.slice(0, 9)]);
    });

    pythonSocket.on("face_recognized", (data) => {
      console.log("👤 Face recognized:", data);

      // Create attendance record from face recognition
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
      pythonSocket.disconnect();
    };
  }, []);

  const getMethodIcon = (method) => {
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
    <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Real-time Attendance Feed
          </h3>
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
              const methodStyle = getMethodIcon(record.method);
              return (
                <div
                  key={record.id || index}
                  className="flex items-center space-x-4 p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  {/* Student Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-user text-white text-lg"></i>
                  </div>

                  {/* Student Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {record.studentName || `Student ID: ${record.studentId}`}
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
  );
}
