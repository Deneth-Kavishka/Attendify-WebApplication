import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";

// Firebase configuration (use your existing config)
const firebaseConfig = {
  projectId: "iot-testing-db",
  // Add your other Firebase config values here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SmartTrackRFIDDashboard = () => {
  const [liveScans, setLiveScans] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverStats, setServerStats] = useState({});

  // Real-time Firebase listeners
  useEffect(() => {
    // Live RFID scans from Firebase
    const liveFeedQuery = query(
      collection(db, "rfid_live_feed"),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsubscribeLiveFeed = onSnapshot(
      liveFeedQuery,
      (snapshot) => {
        const scans = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(),
        }));
        setLiveScans(scans);
        setIsConnected(true);
      },
      (error) => {
        console.error("Live feed error:", error);
        setIsConnected(false);
      }
    );

    // Device status from Firebase
    const deviceQuery = query(collection(db, "rfid_devices"));
    const unsubscribeDevices = onSnapshot(deviceQuery, (snapshot) => {
      const devices = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        lastActivity: doc.data().lastActivity?.toDate?.() || new Date(),
      }));
      setDeviceStatus(devices);
    });

    // Recent attendance from Firebase
    const attendanceQuery = query(
      collection(db, "rfid_attendance"),
      orderBy("scanTime", "desc"),
      limit(20)
    );

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const attendance = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        scanTime: doc.data().scanTime?.toDate?.() || new Date(),
      }));
      setRecentAttendance(attendance);
    });

    // Daily summary from Firebase
    const summaryQuery = query(collection(db, "rfid_daily_summary"));
    const unsubscribeSummary = onSnapshot(summaryQuery, (snapshot) => {
      const summaries = snapshot.docs.map((doc) => doc.data());
      if (summaries.length > 0) {
        setDailySummary(summaries[0]);
      }
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeLiveFeed();
      unsubscribeDevices();
      unsubscribeAttendance();
      unsubscribeSummary();
    };
  }, []);

  // Fetch data from your HTTP backend
  useEffect(() => {
    const fetchServerData = async () => {
      try {
        // Fetch recent scans from your HTTP server
        const response = await fetch("http://localhost:5080/api/recent-scans");
        if (response.ok) {
          const data = await response.json();
          // Merge with Firebase data if needed
        }

        // Fetch server statistics
        const statsResponse = await fetch("http://localhost:5080/api/stats");
        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          setServerStats(stats);
        }
      } catch (error) {
        console.error("Error fetching server data:", error);
      }
    };

    fetchServerData();
    const interval = setInterval(fetchServerData, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "text-green-500";
      case "offline":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            SmartTrack RFID Dashboard
          </h1>
          <div className="flex items-center space-x-4">
            <div
              className={`flex items-center ${
                isConnected ? "text-green-500" : "text-red-500"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              {isConnected ? "Connected to Firebase" : "Firebase Disconnected"}
            </div>
            <div className="text-gray-500">
              Last Updated: {formatTime(new Date())}
            </div>
          </div>
        </div>

        {/* Live Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Today's Scans
            </h3>
            <p className="text-2xl font-bold text-blue-600">
              {dailySummary?.totalScans || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Unique Students
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {dailySummary?.uniqueStudents || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Active Devices
            </h3>
            <p className="text-2xl font-bold text-purple-600">
              {deviceStatus.filter((d) => d.status === "active").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Success Rate
            </h3>
            <p className="text-2xl font-bold text-indigo-600">
              {serverStats.successRate || "100"}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live RFID Feed */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Live RFID Scans
              </h2>
              <p className="text-sm text-gray-500">
                Real-time updates from Firebase
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {liveScans.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <div className="animate-pulse">
                      <div className="w-8 h-8 bg-blue-500 rounded-full mx-auto mb-2"></div>
                    </div>
                    <p>Waiting for RFID scans...</p>
                  </div>
                ) : (
                  liveScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {scan.studentName ||
                              scan.fullName ||
                              "Unknown Student"}
                          </p>
                          <p className="text-sm text-gray-600">
                            ID: {scan.studentId || "N/A"} | Card:{" "}
                            {scan.rfidCard}
                          </p>
                          <p className="text-xs text-gray-500">
                            Device: {scan.deviceId} | Location: {scan.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatTime(scan.timestamp)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(scan.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Attendance */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Recent Attendance
              </h2>
              <p className="text-sm text-gray-500">
                PostgreSQL + Firebase records
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentAttendance.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {(record.fullName || record.studentId || "U")[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {record.fullName || "Unknown Student"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {record.department || "N/A"} | {record.studentId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {formatTime(record.scanTime)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {record.location || "Unknown Location"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Device Status */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Device Status
            </h2>
            <p className="text-sm text-gray-500">RFID reader monitoring</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deviceStatus.map((device) => (
                <div
                  key={device.id}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">
                      {device.deviceId}
                    </h3>
                    <span
                      className={`text-sm font-medium ${getStatusColor(
                        device.status
                      )}`}
                    >
                      {device.status || "unknown"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    Location: {device.location || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    Total Scans: {device.totalScans || 0}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last Activity: {formatTime(device.lastActivity)}
                  </p>
                </div>
              ))}
              {deviceStatus.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-4">
                  No devices connected
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Summary */}
        {dailySummary && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Daily Summary
              </h2>
              <p className="text-sm text-gray-500">{formatDate(new Date())}</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {dailySummary.totalScans}
                  </p>
                  <p className="text-sm text-gray-500">Total Scans</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {dailySummary.uniqueStudents}
                  </p>
                  <p className="text-sm text-gray-500">Unique Students</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {dailySummary.peakHour || "N/A"}
                  </p>
                  <p className="text-sm text-gray-500">Peak Hour</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600">
                    {dailySummary.attendanceRate
                      ? `${dailySummary.attendanceRate}%`
                      : "N/A"}
                  </p>
                  <p className="text-sm text-gray-500">Attendance Rate</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartTrackRFIDDashboard;
