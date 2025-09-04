import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/ui/sidebar";
import StatsCard from "@/components/ui/stats-card";
import AttendanceFeed from "@/components/ui/attendance-feed";
import HardwareStatus from "@/components/ui/hardware-status";
import EnhancedStudentForm from "@/components/ui/enhanced-student-form";
import ClassCreationForm from "@/components/ui/class-creation-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth.jsx";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] =
    useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const { toast } = useToast();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch dashboard statistics
  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Test RFID scanning function
  const testRFIDScan = async (cardId) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/simulate-scan/${cardId}`
      );
      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Test Scan Successful",
          description: result.message,
          duration: 3000,
        });
      } else {
        toast({
          title: "❌ Test Scan Result",
          description: result.message,
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: "❌ Test Failed",
        description: "Unable to connect to RFID service",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Fetch hardware devices for sidebar
  const { data: hardwareDevices = [] } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch today's classes
  const { data: todaysClasses = [] } = useQuery({
    queryKey: ["/api/classes/today"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (reportType) => {
      const response = await fetch(`/api/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ type: reportType }),
      });
      if (!response.ok) throw new Error("Failed to generate report");
      return response.blob();
    },
    onSuccess: (blob, reportType) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${reportType}-report-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Report Generated",
        description: `${reportType} report has been downloaded successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to mark notification as read");
      return response.json();
    },
    onSuccess: () => {
      // Refresh notifications
      queryClient.invalidateQueries(["/api/notifications"]);
    },
  });

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-background">
      <Sidebar hardwareStatus={hardwareDevices} />

      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Admin Dashboard
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Welcome back, {user?.fullName || "Administrator"}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Real-time Clock */}
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatTime(currentTime)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(currentTime)}
                </div>
              </div>

              {/* Notifications */}
              <DropdownMenu
                open={notificationDropdownOpen}
                onOpenChange={setNotificationDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <i className="fas fa-bell text-lg"></i>
                    {notifications.filter((n) => !n.read).length > 0 && (
                      <Badge className="absolute -top-1 -right-1 min-w-[1.2rem] h-5 p-0 flex items-center justify-center text-xs bg-red-500 hover:bg-red-600">
                        {notifications.filter((n) => !n.read).length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 max-h-96 overflow-y-auto"
                >
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        notifications
                          .filter((n) => !n.read)
                          .forEach((n) => {
                            markNotificationReadMutation.mutate(n.id);
                          });
                      }}
                    >
                      Mark all read
                    </Button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    notifications.slice(0, 10).map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`flex-col items-start p-3 cursor-pointer ${
                          !notification.read ? "bg-blue-50" : ""
                        }`}
                        onClick={() =>
                          markNotificationReadMutation.mutate(notification.id)
                        }
                      >
                        <div className="flex items-start w-full">
                          <div
                            className={`w-2 h-2 rounded-full mt-2 mr-2 ${
                              !notification.read ? "bg-blue-500" : "bg-gray-300"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(
                                notification.createdAt
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem className="text-center text-gray-500 py-4">
                      No notifications
                    </DropdownMenuItem>
                  )}
                  {notifications.length > 10 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-center text-blue-600 cursor-pointer"
                        onClick={() => setLocation("/admin/notifications")}
                      >
                        View all notifications
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Profile Dropdown */}
              <DropdownMenu
                open={accountDropdownOpen}
                onOpenChange={setAccountDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 px-3"
                  >
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-white text-sm"></i>
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden md:block">
                      {user?.fullName || "Admin"}
                    </span>
                    <i className="fas fa-chevron-down text-xs text-gray-500"></i>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.fullName || "Administrator"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user?.email || "admin@smarttrack.com"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setLocation("/admin/profile")}
                  >
                    <i className="fas fa-user mr-2 w-4"></i>
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setLocation("/admin/settings")}
                  >
                    <i className="fas fa-cog mr-2 w-4"></i>
                    System Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setLocation("/admin/reports")}
                  >
                    <i className="fas fa-chart-bar mr-2 w-4"></i>
                    Reports & Analytics
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                      toast({
                        title: "Help & Support",
                        description:
                          "Contact support at support@smarttrack.com",
                      })
                    }
                  >
                    <i className="fas fa-question-circle mr-2 w-4"></i>
                    Help & Support
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                      window.open("https://docs.smarttrack.com", "_blank")
                    }
                  >
                    <i className="fas fa-book mr-2 w-4"></i>
                    Documentation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => {
                      logout();
                      setLocation("/login");
                      toast({
                        title: "Logged Out",
                        description: "You have been successfully logged out.",
                      });
                    }}
                  >
                    <i className="fas fa-sign-out-alt mr-2 w-4"></i>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Primary Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Total Students"
              value={stats.totalStudents || 0}
              change="12% from last month"
              changeType="positive"
              icon="fas fa-user-graduate"
              color="blue"
            />
            <StatsCard
              title="Active Classes"
              value={stats.activeClasses || 0}
              change="8% from last month"
              changeType="positive"
              icon="fas fa-door-open"
              color="green"
            />
            <StatsCard
              title="Today's Attendance"
              value={`${stats.todayAttendance || 0}%`}
              change="Last updated 2 min ago"
              changeType="neutral"
              icon="fas fa-clipboard-check"
              color="orange"
            />
            <StatsCard
              title="Exam Eligible"
              value={stats.examEligible || 0}
              change={`${stats.examIneligible || 0} students at risk`}
              changeType="negative"
              icon="fas fa-file-alt"
              color="red"
            />
          </div>

          {/* Secondary Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">This Week</p>
                  <p className="text-3xl font-bold">
                    {stats.weeklyAttendance || 85}%
                  </p>
                  <p className="text-blue-100 text-xs">Average Attendance</p>
                </div>
                <div className="bg-blue-400 bg-opacity-30 rounded-full p-3">
                  <i className="fas fa-chart-line text-2xl text-blue-100"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Hardware</p>
                  <p className="text-3xl font-bold">
                    {
                      hardwareDevices.filter((d) => d.status === "online")
                        .length
                    }
                    <span className="text-lg">/{hardwareDevices.length}</span>
                  </p>
                  <p className="text-green-100 text-xs">Devices Online</p>
                </div>
                <div className="bg-green-400 bg-opacity-30 rounded-full p-3">
                  <i className="fas fa-wifi text-2xl text-green-100"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Today</p>
                  <p className="text-3xl font-bold">{todaysClasses.length}</p>
                  <p className="text-purple-100 text-xs">Classes Scheduled</p>
                </div>
                <div className="bg-purple-400 bg-opacity-30 rounded-full p-3">
                  <i className="fas fa-calendar-day text-2xl text-purple-100"></i>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">
                    Notifications
                  </p>
                  <p className="text-3xl font-bold">
                    {notifications.filter((n) => !n.read).length}
                  </p>
                  <p className="text-orange-100 text-xs">Unread Alerts</p>
                </div>
                <div className="bg-orange-400 bg-opacity-30 rounded-full p-3">
                  <i className="fas fa-bell text-2xl text-orange-100"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Real-time Attendance Feed */}
            <div className="lg:col-span-2">
              {/* Test RFID Scanning Buttons 
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">🧪 Test RFID System</h4>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => testRFIDScan('BF74B21F')}
                    className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors"
                  >
                    Test Your Card (BF74B21F)
                  </button>
                  <button 
                    onClick={() => testRFIDScan('F6C9D600')}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    Test Card 2 (F6C9D600)
                  </button>
                  <button 
                    onClick={() => testRFIDScan('UNKNOWN123')}
                    className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded-full hover:bg-red-200 transition-colors"
                  >
                    Test Unknown Card
                  </button>
                </div>
              </div>*/}

              <AttendanceFeed />
            </div>

            {/* Quick Actions & Hardware Status */}
            <div className="space-y-6">
              <HardwareStatus />

              {/* Quick Actions */}
              <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Quick Actions
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowStudentForm(true)}
                      className="w-full flex items-center space-x-3 p-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <i className="fas fa-user-plus"></i>
                      <span>Add New Student</span>
                    </button>
                    <button
                      onClick={() => setShowClassForm(true)}
                      className="w-full flex items-center space-x-3 p-3 bg-secondary text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <i className="fas fa-plus-circle"></i>
                      <span>Create New Class</span>
                    </button>
                    <button
                      onClick={() => setLocation("/admin/attendance")}
                      className="w-full flex items-center space-x-3 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <i className="fas fa-calendar-check"></i>
                      <span>View Attendance</span>
                    </button>
                    <button
                      onClick={() => setLocation("/admin/exam-eligibility")}
                      className="w-full flex items-center space-x-3 p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <i className="fas fa-graduation-cap"></i>
                      <span>Exam Eligibility</span>
                    </button>
                    <button
                      onClick={() => setLocation("/admin/reports")}
                      className="w-full flex items-center space-x-3 p-3 bg-accent text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      <i className="fas fa-file-download"></i>
                      <span>Generate Report</span>
                    </button>
                    <button
                      onClick={() => setLocation("/admin/settings")}
                      className="w-full flex items-center space-x-3 p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <i className="fas fa-cog"></i>
                      <span>System Settings</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* System Alerts */}
              <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    System Alerts
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {notifications
                      .filter((n) => !n.read)
                      .slice(0, 3)
                      .map((notification) => (
                        <div
                          key={notification.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg border ${
                            notification.type === "warning"
                              ? "bg-red-50 border-red-200"
                              : notification.type === "info"
                              ? "bg-blue-50 border-blue-200"
                              : "bg-yellow-50 border-yellow-200"
                          }`}
                        >
                          <i
                            className={`mt-1 ${
                              notification.type === "warning"
                                ? "fas fa-exclamation-triangle text-red-500"
                                : notification.type === "info"
                                ? "fas fa-info-circle text-blue-500"
                                : "fas fa-bell text-yellow-500"
                            }`}
                          ></i>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      ))}

                    {notifications.filter((n) => !n.read).length === 0 && (
                      <div className="text-center py-4">
                        <i className="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
                        <p className="text-gray-500 text-sm">
                          All systems running smoothly
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Reports */}
              <div className="bg-surface rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Quick Reports
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    <button
                      onClick={() =>
                        generateReportMutation.mutate("attendance-summary")
                      }
                      disabled={generateReportMutation.isPending}
                      className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <i className="fas fa-file-pdf text-blue-600"></i>
                        <span className="text-sm font-medium text-blue-900">
                          Attendance Summary
                        </span>
                      </div>
                      {generateReportMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin text-blue-600"></i>
                      ) : (
                        <i className="fas fa-download text-blue-600"></i>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        generateReportMutation.mutate("student-performance")
                      }
                      disabled={generateReportMutation.isPending}
                      className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <i className="fas fa-chart-bar text-green-600"></i>
                        <span className="text-sm font-medium text-green-900">
                          Performance Report
                        </span>
                      </div>
                      {generateReportMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin text-green-600"></i>
                      ) : (
                        <i className="fas fa-download text-green-600"></i>
                      )}
                    </button>

                    <button
                      onClick={() =>
                        generateReportMutation.mutate("hardware-status")
                      }
                      disabled={generateReportMutation.isPending}
                      className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <i className="fas fa-microchip text-purple-600"></i>
                        <span className="text-sm font-medium text-purple-900">
                          Hardware Report
                        </span>
                      </div>
                      {generateReportMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin text-purple-600"></i>
                      ) : (
                        <i className="fas fa-download text-purple-600"></i>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Classes Overview */}
          <div className="mt-8 bg-surface rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Today's Classes Overview
                </h3>
                <button
                  onClick={() => setLocation("/admin/classes")}
                  className="text-primary hover:text-blue-700 text-sm font-medium"
                >
                  View All Classes
                </button>
              </div>
            </div>
            <div className="p-6">
              {todaysClasses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todaysClasses.map((classItem) => (
                    <div
                      key={classItem.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() =>
                        setLocation(`/admin/classes/${classItem.id}`)
                      }
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {classItem.name}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            classItem.status === "active"
                              ? "bg-green-100 text-green-800"
                              : classItem.status === "completed"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {classItem.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {classItem.lecturer}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          <i className="fas fa-clock mr-1"></i>
                          {classItem.startTime} - {classItem.endTime}
                        </span>
                        <span>
                          <i className="fas fa-users mr-1"></i>
                          {classItem.attendanceCount || 0}/
                          {classItem.enrolledCount || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-calendar-alt text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">
                    No classes scheduled for today
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    Create classes to see them here
                  </p>
                  <Button
                    onClick={() => setShowClassForm(true)}
                    className="mt-2"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Create Class
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Enhanced Student Registration Dialog */}
      <Dialog open={showStudentForm} onOpenChange={setShowStudentForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Registration</DialogTitle>
          </DialogHeader>
          <EnhancedStudentForm
            onSuccess={() => {
              setShowStudentForm(false);
              // Refresh stats
              window.location.reload();
            }}
            onCancel={() => setShowStudentForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Class Creation Dialog */}
      <Dialog open={showClassForm} onOpenChange={setShowClassForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <ClassCreationForm
            onSuccess={() => {
              setShowClassForm(false);
              // Refresh stats
              window.location.reload();
            }}
            onCancel={() => setShowClassForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
