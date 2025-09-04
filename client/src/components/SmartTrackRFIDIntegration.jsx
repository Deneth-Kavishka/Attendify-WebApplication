import React, { useState, useEffect } from "react";

const SmartTrackRFIDIntegration = () => {
  const [recentScans, setRecentScans] = useState([]);
  const [stats, setStats] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Backend server URL
  const SERVER_URL = "http://localhost:5080";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch recent scans from PostgreSQL + Firebase backend
        const scansResponse = await fetch(
          `${SERVER_URL}/api/recent-scans?limit=10`
        );
        if (scansResponse.ok) {
          const scansData = await scansResponse.json();
          setRecentScans(scansData.scans || []);
          setIsConnected(true);
        }

        // Fetch system statistics
        const statsResponse = await fetch(`${SERVER_URL}/api/stats`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error("RFID System Error:", error);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleTimeString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              RFID Attendance System
            </h2>
            <p className="text-gray-600">
              Real-time monitoring with PostgreSQL + Firebase
            </p>
          </div>
          <div
            className={`flex items-center space-x-2 ${
              isConnected ? "text-green-500" : "text-red-500"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span className="font-medium">
              {isConnected ? "System Online" : "System Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats.today && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">
              Today's Scans
            </h3>
            <p className="text-3xl font-bold">{stats.today.totalScans || 0}</p>
            <p className="text-sm opacity-75">Real-time updates</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">
              Students Today
            </h3>
            <p className="text-3xl font-bold">
              {stats.today.uniqueStudents || 0}
            </p>
            <p className="text-sm opacity-75">Unique attendance</p>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">
              Total Scans
            </h3>
            <p className="text-3xl font-bold">
              {stats.allTime?.totalScans || 0}
            </p>
            <p className="text-sm opacity-75">All time record</p>
          </div>
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow p-6 text-white">
            <h3 className="text-sm font-medium uppercase tracking-wide opacity-90">
              Success Rate
            </h3>
            <p className="text-3xl font-bold">{stats.successRate || 100}%</p>
            <p className="text-sm opacity-75">System reliability</p>
          </div>
        </div>
      )}

      {/* Recent RFID Scans */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Recent RFID Scans
              </h3>
              <p className="text-sm text-gray-600">
                Live updates from NodeMCU devices
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {recentScans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Waiting for RFID Scans
              </h4>
              <p className="text-gray-600">
                Place an RFID card near the NodeMCU scanner
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recentScans.map((scan, index) => (
                <div
                  key={scan.id || index}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {(scan.fullName || scan.studentId || "U")[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {scan.fullName || "Unknown Student"}
                        </h4>
                        <p className="text-sm text-gray-600">
                          ID: {scan.studentId} | Department:{" "}
                          {scan.department || "N/A"}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            RFID: {scan.rfidCard}
                          </span>
                          <span className="text-xs text-gray-500">
                            Device: {scan.deviceId}
                          </span>
                          <span className="text-xs text-gray-500">
                            Location: {scan.location}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Present
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatTime(scan.scanTime)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(scan.scanTime)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => window.open(`${SERVER_URL}`, "_blank")}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
          >
            📊 View Dashboard
          </button>
          <button
            onClick={() => {
              fetch(`${SERVER_URL}/api/stats`)
                .then((res) => res.json())
                .then((data) => {
                  alert(
                    `System Stats:\n\nToday's Scans: ${
                      data.today?.totalScans || 0
                    }\nUnique Students: ${
                      data.today?.uniqueStudents || 0
                    }\nSuccess Rate: ${data.successRate || 100}%`
                  );
                })
                .catch((err) => alert("Error fetching stats: " + err.message));
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
          >
            📈 View Stats
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => {
              const csvData = recentScans
                .map(
                  (scan) =>
                    `"${scan.scanTime}","${scan.fullName}","${scan.studentId}","${scan.rfidCard}","${scan.location}","${scan.department}"`
                )
                .join("\n");
              const blob = new Blob(
                [
                  `"Time","Name","Student ID","RFID Card","Location","Department"\n${csvData}`,
                ],
                { type: "text/csv" }
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `rfid_attendance_${
                new Date().toISOString().split("T")[0]
              }.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
          >
            💾 Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartTrackRFIDIntegration;
