import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { useAuth } from "@/lib/auth.jsx";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);

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

  // Fetch hardware devices for sidebar
  const { data: hardwareDevices = [] } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 5000, // Refresh every 5 seconds
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
              <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                <i className="fas fa-bell text-lg"></i>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Profile Dropdown */}
              <div className="relative">
                <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <i className="fas fa-user text-white text-sm"></i>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    Admin
                  </span>
                  <i className="fas fa-chevron-down text-xs text-gray-500"></i>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Statistics Cards */}
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

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Real-time Attendance Feed */}
            <div className="lg:col-span-2">
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
                      onClick={() => setLocation("/admin/lecturers")}
                      className="w-full flex items-center space-x-3 p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <i className="fas fa-chalkboard-teacher"></i>
                      <span>Manage Lecturers</span>
                    </button>
                    <button
                      onClick={() => setLocation("/admin/hardware")}
                      className="w-full flex items-center space-x-3 p-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                    >
                      <i className="fas fa-microchip"></i>
                      <span>Hardware Status</span>
                    </button>
                    <button className="w-full flex items-center space-x-3 p-3 bg-accent text-white rounded-lg hover:bg-orange-600 transition-colors">
                      <i className="fas fa-file-download"></i>
                      <span>Generate Report</span>
                    </button>
                    <button className="w-full flex items-center space-x-3 p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
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
                    <div className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <i className="fas fa-exclamation-triangle text-destructive mt-1"></i>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Low Attendance Alert
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {stats.examIneligible || 0} students below 75%
                          attendance threshold
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <i className="fas fa-info-circle text-accent mt-1"></i>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          System Update
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Face recognition model updated successfully
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <i className="fas fa-bell text-primary mt-1"></i>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          New Registration
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          System ready for new student registrations
                        </p>
                      </div>
                    </div>
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
              <div className="text-center py-8">
                <i className="fas fa-calendar-alt text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No classes scheduled for today</p>
                <p className="text-sm text-gray-400">
                  Create classes to see them here
                </p>
              </div>
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
