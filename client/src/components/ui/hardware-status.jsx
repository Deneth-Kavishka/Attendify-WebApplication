import { useState, useEffect } from 'react';

export default function HardwareStatus() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHardwareStatus();
    
    // WebSocket connection for real-time hardware updates
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'hardware_status') {
        setDevices(prev => prev.map(device => 
          device.deviceId === data.deviceId 
            ? { ...device, status: data.status, lastHeartbeat: data.timestamp }
            : device
        ));
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const fetchHardwareStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/hardware', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Failed to fetch hardware status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceType) => {
    return deviceType === 'esp32_cam' ? 'fas fa-camera' : 'fas fa-id-card';
  };

  const getDeviceName = (deviceType) => {
    return deviceType === 'esp32_cam' ? 'ESP32-CAM' : 'RFID Reader';
  };

  const getStatusStyle = (status) => {
    return status === 'online' ? 'hardware-status-online' : 'hardware-status-offline';
  };

  const calculateUptime = (lastHeartbeat) => {
    if (!lastHeartbeat) return 'Unknown';
    const now = new Date();
    const last = new Date(lastHeartbeat);
    const diff = Math.floor((now - last) / 1000 / 60); // minutes
    
    if (diff < 5) return '99% uptime';
    if (diff < 60) return '95% uptime';
    return '< 90% uptime';
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Hardware Status</h3>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {devices.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-microchip text-4xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">No hardware devices found</p>
            </div>
          ) : (
            devices.map((device) => (
              <div key={device.id} className={`flex items-center justify-between p-3 ${getStatusStyle(device.status)}`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${device.status === 'online' ? 'bg-secondary' : 'bg-red-500'}`}>
                    <i className={`${getDeviceIcon(device.deviceType)} text-white text-sm`}></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{getDeviceName(device.deviceType)}</p>
                    <p className="text-sm text-gray-600">{device.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-secondary' : 'bg-red-500'}`}></div>
                    <span className={`text-sm font-medium ${device.status === 'online' ? 'text-secondary' : 'text-red-500'}`}>
                      {device.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{calculateUptime(device.lastHeartbeat)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
