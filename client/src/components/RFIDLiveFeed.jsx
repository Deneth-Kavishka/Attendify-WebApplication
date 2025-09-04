/**
 * SmartTrack RFID Live Feed Component
 * ====================================
 * Real-time RFID attendance monitoring for React applications
 *
 * Features:
 * - Live RFID scan feed
 * - Device status monitoring
 * - Attendance statistics
 * - Easy integration with existing React apps
 *
 * Usage:
 * import RFIDLiveFeed from './components/RFIDLiveFeed';
 * <RFIDLiveFeed />
 */

import React, { useState, useEffect } from "react";

const RFIDLiveFeed = () => {
  const [recentScans, setRecentScans] = useState([]);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    connectedDevices: 0,
    todayScans: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configuration
  const RFID_SERVER_URL = "http://localhost:5080"; // Updated port
  const REFRESH_INTERVAL = 3000; // 3 seconds

  useEffect(() => {
    // Initial load
    loadData();

    // Set up auto-refresh
    const interval = setInterval(loadData, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load recent scans
      const scansResponse = await fetch(`${RFID_SERVER_URL}/api/live-feed`);
      const scansData = await scansResponse.json();

      if (scansData.success) {
        setRecentScans(scansData.scans || []);
      }

      // Load devices
      const devicesResponse = await fetch(`${RFID_SERVER_URL}/api/devices`);
      const devicesData = await devicesResponse.json();

      if (devicesData.success) {
        setDevices(devicesData.devices || []);
      }

      // Load students count
      const studentsResponse = await fetch(`${RFID_SERVER_URL}/api/students`);
      const studentsData = await studentsResponse.json();

      // Update stats
      setStats({
        totalStudents: studentsData.count || 0,
        connectedDevices: devicesData.count || 0,
        todayScans: scansData.scans
          ? scansData.scans.filter((scan) => {
              const scanDate = new Date(scan.timestamp).toDateString();
              const today = new Date().toDateString();
              return scanDate === today;
            }).length
          : 0,
      });

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error loading RFID data:", err);
      setError("Failed to connect to RFID server");
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="rfid-live-feed loading">
        <div className="loading-spinner">🔄 Loading RFID data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rfid-live-feed error">
        <div className="error-message">
          ⚠️ {error}
          <button onClick={loadData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rfid-live-feed">
      <style jsx>{`
        .rfid-live-feed {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif;
        }

        .rfid-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .rfid-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .rfid-header p {
          color: #666;
          margin: 0;
        }

        .rfid-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          text-align: center;
          border-left: 4px solid #007bff;
        }

        .stat-value {
          font-size: 2em;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 5px;
        }

        .stat-label {
          color: #666;
          font-size: 0.9em;
        }

        .rfid-sections {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 30px;
        }

        .recent-scans {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .section-header {
          background: #f8f9fa;
          padding: 15px 20px;
          border-bottom: 1px solid #dee2e6;
          font-weight: bold;
          color: #333;
        }

        .scan-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .scan-item {
          padding: 15px 20px;
          border-bottom: 1px solid #f1f1f1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s;
        }

        .scan-item:hover {
          background-color: #f8f9fa;
        }

        .scan-item:last-child {
          border-bottom: none;
        }

        .scan-info h4 {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 1em;
        }

        .scan-details {
          color: #666;
          font-size: 0.85em;
        }

        .scan-time {
          text-align: right;
          color: #666;
          font-size: 0.85em;
        }

        .devices-panel {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .device-item {
          padding: 15px 20px;
          border-bottom: 1px solid #f1f1f1;
        }

        .device-item:last-child {
          border-bottom: none;
        }

        .device-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }

        .device-name {
          font-weight: bold;
          color: #333;
        }

        .status-online {
          color: #28a745;
          font-size: 0.85em;
        }

        .status-offline {
          color: #dc3545;
          font-size: 0.85em;
        }

        .device-location {
          color: #666;
          font-size: 0.85em;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .loading-spinner,
        .error-message {
          text-align: center;
          padding: 40px;
          font-size: 1.1em;
        }

        .retry-btn {
          margin-left: 10px;
          padding: 5px 15px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .refresh-indicator {
          display: inline-block;
          margin-left: 10px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .rfid-sections {
            grid-template-columns: 1fr;
          }

          .rfid-stats {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
        }
      `}</style>

      <div className="rfid-header">
        <h2>🎯 RFID Live Attendance Monitor</h2>
        <p>Real-time student attendance tracking</p>
      </div>

      <div className="rfid-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.connectedDevices}</div>
          <div className="stat-label">Connected Devices</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.todayScans}</div>
          <div className="stat-label">Today's Scans</div>
        </div>
      </div>

      <div className="rfid-sections">
        <div className="recent-scans">
          <div className="section-header">
            🔴 Live RFID Scans
            <span className="refresh-indicator">🔄</span>
          </div>
          <div className="scan-list">
            {recentScans.length > 0 ? (
              recentScans.map((scan, index) => (
                <div key={scan.id || index} className="scan-item">
                  <div className="scan-info">
                    <h4>{scan.student.fullName}</h4>
                    <div className="scan-details">
                      {scan.student.studentId} • {scan.student.department}
                      <br />
                      📍 {scan.location} • 📱 {scan.deviceId}
                    </div>
                  </div>
                  <div className="scan-time">
                    <div>{formatTime(scan.timestamp)}</div>
                    <div>{formatDate(scan.timestamp)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                📭 No recent scans
                <br />
                <small>Waiting for RFID activity...</small>
              </div>
            )}
          </div>
        </div>

        <div className="devices-panel">
          <div className="section-header">📡 Connected Devices</div>
          {devices.length > 0 ? (
            devices.map((device) => (
              <div key={device.deviceId} className="device-item">
                <div className="device-status">
                  <span className="device-name">{device.deviceId}</span>
                  <span className={`status-${device.status}`}>
                    {device.status === "online" ? "🟢 Online" : "🔴 Offline"}
                  </span>
                </div>
                <div className="device-location">📍 {device.location}</div>
                <div className="device-location">
                  📊 {device.totalScans || 0} scans
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              📡 No devices connected
              <br />
              <small>Upload Arduino code to connect</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RFIDLiveFeed;
