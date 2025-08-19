import { useState, useEffect } from 'react';

export default function AttendanceFeed({ records = [] }) {
  const [realTimeRecords, setRealTimeRecords] = useState(records);

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'attendance_update' || data.type === 'face_recognition_attendance' || data.type === 'rfid_attendance') {
        setRealTimeRecords(prev => [data.data, ...prev.slice(0, 9)]); // Keep latest 10 records
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const getMethodIcon = (method) => {
    return method === 'face_recognition' ? 
      { icon: 'fas fa-camera', color: 'text-secondary', bg: 'bg-secondary' } :
      { icon: 'fas fa-id-card', color: 'text-accent', bg: 'bg-accent' };
  };

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Real-time Attendance Feed</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-secondary rounded-full animate-pulse-dot"></div>
            <span className="text-sm text-gray-600">Live</span>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {realTimeRecords.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">No attendance records yet</p>
              <p className="text-sm text-gray-400">Records will appear here in real-time</p>
            </div>
          ) : (
            realTimeRecords.slice(0, 10).map((record, index) => {
              const methodStyle = getMethodIcon(record.method);
              return (
                <div key={record.id || index} className="attendance-feed-item">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <i className="fas fa-user text-white text-sm"></i>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{record.studentName || `Student ID: ${record.studentId}`}</p>
                    <p className="text-sm text-gray-600">{record.className || `Class ID: ${record.classId}`}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${methodStyle.bg}`}>
                        <i className={`${methodStyle.icon} text-white text-xs`}></i>
                      </div>
                      <span className={`text-sm font-medium ${methodStyle.color}`}>
                        {record.method === 'face_recognition' ? 'Face Recognition' : 'RFID Card'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(record.attendanceDate || record.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {realTimeRecords.length > 0 && (
          <div className="mt-4 text-center">
            <button className="text-primary hover:text-blue-700 text-sm font-medium">
              View All Attendance Records
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
