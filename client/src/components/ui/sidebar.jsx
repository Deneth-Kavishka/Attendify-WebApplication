import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth.jsx";

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: "fas fa-home" },
  { path: "/admin/students", label: "Students", icon: "fas fa-user-graduate" },
  {
    path: "/admin/lecturers",
    label: "Lecturers",
    icon: "fas fa-chalkboard-teacher",
  },
  { path: "/admin/classes", label: "Classes", icon: "fas fa-door-open" },
  {
    path: "/admin/attendance",
    label: "Attendance",
    icon: "fas fa-clipboard-check",
  },
  {
    path: "/admin/exam-eligibility",
    label: "Exam Eligibility",
    icon: "fas fa-graduation-cap",
  },
  {
    path: "/admin/hardware",
    label: "Hardware Status",
    icon: "fas fa-microchip",
  },
  { path: "/admin/reports", label: "Reports", icon: "fas fa-chart-bar" },
  { path: "/admin/settings", label: "Settings", icon: "fas fa-cog" },
];

const lecturerNavItems = [
  { path: "/lecturer", label: "Dashboard", icon: "fas fa-home" },
  { path: "/lecturer/classes", label: "My Classes", icon: "fas fa-door-open" },
  {
    path: "/lecturer/attendance",
    label: "Attendance",
    icon: "fas fa-clipboard-check",
  },
  {
    path: "/lecturer/students",
    label: "Students",
    icon: "fas fa-users",
  },
  { path: "/lecturer/reports", label: "Reports", icon: "fas fa-chart-bar" },
  {
    path: "/lecturer/schedule",
    label: "Schedule",
    icon: "fas fa-calendar-alt",
  },
];

const studentNavItems = [
  { path: "/student", label: "Dashboard", icon: "fas fa-home" },
  {
    path: "/student/attendance",
    label: "My Attendance",
    icon: "fas fa-clipboard-check",
  },
  {
    path: "/student/eligibility",
    label: "Exam Eligibility",
    icon: "fas fa-file-alt",
  },
  { path: "/student/profile", label: "Profile", icon: "fas fa-user" },
];

export default function Sidebar({
  hardwareStatus = [],
  activeTab,
  setActiveTab,
}) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  // Map lecturer and student navigation paths to tab values
  const lecturerTabMapping = {
    "/lecturer": "dashboard",
    "/lecturer/classes": "my-classes",
    "/lecturer/attendance": "attendance",
    "/lecturer/students": "students",
    "/lecturer/reports": "reports",
    "/lecturer/schedule": "schedule",
  };

  const studentTabMapping = {
    "/student": "dashboard",
    "/student/attendance": "attendance",
    "/student/eligibility": "eligibility",
    "/student/profile": "profile",
  };

  const getNavItems = () => {
    switch (user?.role) {
      case "admin":
        return adminNavItems;
      case "lecturer":
        return lecturerNavItems;
      case "student":
        return studentNavItems;
      default:
        return [];
    }
  };

  // Handle navigation for lecturer and student (tabs) vs admin (routing)
  const handleNavClick = (item, e) => {
    if (user?.role === "lecturer" && setActiveTab) {
      e.preventDefault();
      const tabValue = lecturerTabMapping[item.path];
      if (tabValue) {
        console.log(`Switching to lecturer tab: ${tabValue}`);
        setActiveTab(tabValue);
      }
    } else if (user?.role === "student" && setActiveTab) {
      e.preventDefault();
      const tabValue = studentTabMapping[item.path];
      if (tabValue) {
        console.log(`Switching to student tab: ${tabValue}`);
        setActiveTab(tabValue);
      }
    }
    // For admin role, let the Link handle navigation normally
  };

  // Determine if an item is active
  const isItemActive = (item) => {
    if (user?.role === "lecturer" && activeTab) {
      const tabValue = lecturerTabMapping[item.path];
      return tabValue === activeTab;
    } else if (user?.role === "student" && activeTab) {
      const tabValue = studentTabMapping[item.path];
      return tabValue === activeTab;
    }
    return location === item.path;
  };

  const navItems = getNavItems();

  return (
    <div className="w-64 bg-surface shadow-lg border-r border-gray-200 fixed h-full overflow-y-auto z-30 lg:block hidden">
      {/* Logo and Title */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-graduation-cap text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Attendify
            </h1>
            <p className="text-xs text-gray-500">Your Presence</p>
            <p className="text-xs text-gray-500">Our Precision</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <a
                  className={`sidebar-nav-item ${
                    isItemActive(item) ? "active" : ""
                  }`}
                  onClick={(e) => handleNavClick(item, e)}
                >
                  <i className={`${item.icon} w-5`}></i>
                  <span>{item.label}</span>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Hardware Status Panel (Admin only) */}
      {user?.role === "admin" && (
        <div className="p-4 border-t border-gray-200 mt-auto">
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Hardware Status
            </h3>
            <div className="space-y-2">
              {hardwareStatus.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-gray-600">
                    {device.deviceType === "esp32_cam"
                      ? "ESP32-CAM"
                      : "RFID Reader"}
                  </span>
                  <div className="flex items-center space-x-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        device.status === "online"
                          ? "bg-secondary"
                          : "bg-red-500"
                      }`}
                    ></div>
                    <span
                      className={`text-xs ${
                        device.status === "online"
                          ? "text-secondary"
                          : "text-red-500"
                      }`}
                    >
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
