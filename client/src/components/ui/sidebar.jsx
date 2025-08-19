import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth.jsx';

const adminNavItems = [
  { path: '/admin', label: 'Dashboard', icon: 'fas fa-home' },
  { path: '/admin/students', label: 'Students', icon: 'fas fa-user-graduate' },
  { path: '/admin/lecturers', label: 'Lecturers', icon: 'fas fa-chalkboard-teacher' },
  { path: '/admin/classes', label: 'Classes', icon: 'fas fa-door-open' },
  { path: '/admin/attendance', label: 'Attendance', icon: 'fas fa-clipboard-check' },
  { path: '/admin/exams', label: 'Exam Eligibility', icon: 'fas fa-file-alt' },
  { path: '/admin/hardware', label: 'Hardware Status', icon: 'fas fa-microchip' },
  { path: '/admin/reports', label: 'Reports', icon: 'fas fa-chart-bar' },
  { path: '/admin/settings', label: 'Settings', icon: 'fas fa-cog' }
];

const lecturerNavItems = [
  { path: '/lecturer', label: 'Dashboard', icon: 'fas fa-home' },
  { path: '/lecturer/classes', label: 'My Classes', icon: 'fas fa-door-open' },
  { path: '/lecturer/attendance', label: 'Attendance', icon: 'fas fa-clipboard-check' },
  { path: '/lecturer/reports', label: 'Reports', icon: 'fas fa-chart-bar' }
];

const studentNavItems = [
  { path: '/student', label: 'Dashboard', icon: 'fas fa-home' },
  { path: '/student/attendance', label: 'My Attendance', icon: 'fas fa-clipboard-check' },
  { path: '/student/eligibility', label: 'Exam Eligibility', icon: 'fas fa-file-alt' },
  { path: '/student/profile', label: 'Profile', icon: 'fas fa-user' }
];

export default function Sidebar({ hardwareStatus = [] }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const getNavItems = () => {
    switch (user?.role) {
      case 'admin': return adminNavItems;
      case 'lecturer': return lecturerNavItems;
      case 'student': return studentNavItems;
      default: return [];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="w-64 bg-surface shadow-lg border-r border-gray-200 fixed h-full overflow-y-auto">
      {/* Logo and Title */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-graduation-cap text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Smart Attendance</h1>
            <p className="text-xs text-gray-500">Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <a className={`sidebar-nav-item ${location === item.path ? 'active' : ''}`}>
                  <i className={`${item.icon} w-5`}></i>
                  <span>{item.label}</span>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Hardware Status Panel (Admin only) */}
      {user?.role === 'admin' && (
        <div className="p-4 border-t border-gray-200 mt-auto">
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Hardware Status</h3>
            <div className="space-y-2">
              {hardwareStatus.map((device) => (
                <div key={device.id} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{device.deviceType === 'esp32_cam' ? 'ESP32-CAM' : 'RFID Reader'}</span>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-secondary' : 'bg-red-500'}`}></div>
                    <span className={`text-xs ${device.status === 'online' ? 'text-secondary' : 'text-red-500'}`}>
                      {device.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button 
          onClick={logout}
          className="w-full flex items-center space-x-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <i className="fas fa-sign-out-alt w-5"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
