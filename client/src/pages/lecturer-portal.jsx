import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth.jsx";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/ui/sidebar";
import StatsCard from "@/components/ui/stats-card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

export default function LecturerPortal() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);
  const { toast } = useToast();

  // Debug dialog state
  useEffect(() => {
    console.log("Profile dialog state:", showProfileDialog);
  }, [showProfileDialog]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch lecturer's classes
  const {
    data: lecturerClasses = [],
    isLoading: isClassesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: [`/api/lecturers/${user?.id}/classes`],
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Fetch dashboard statistics
  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/lecturers/${user?.id}/dashboard-stats`],
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Fetch students for selected class
  const { data: classStudents = [] } = useQuery({
    queryKey: [`/api/classes/${selectedClass}/students`],
    enabled: !!selectedClass,
    refetchInterval: 10000,
  });

  // Fetch attendance for selected class and date
  const { data: classAttendance = {} } = useQuery({
    queryKey: [
      `/api/classes/${selectedClass}/attendance`,
      format(selectedDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      if (!selectedClass) return {};
      const response = await fetch(
        `/api/classes/${selectedClass}/attendance?date=${format(
          selectedDate,
          "yyyy-MM-dd"
        )}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch attendance");
      return response.json();
    },
    enabled: !!selectedClass,
    refetchInterval: 5000,
  });

  // Fetch hardware devices
  const { data: hardwareDevices = [] } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 5000,
  });

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ classId, studentId, status }) => {
      const response = await fetch(`/api/classes/${classId}/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          studentId,
          status,
          timestamp: selectedDate.toISOString(),
          method: "manual",
        }),
      });
      if (!response.ok) throw new Error("Failed to mark attendance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries([
        `/api/classes/${selectedClass}/attendance`,
      ]);
      queryClient.invalidateQueries([
        `/api/lecturers/${user?.id}/dashboard-stats`,
      ]);
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark attendance",
        variant: "destructive",
      });
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async ({ classId, startDate, endDate, type }) => {
      const response = await fetch(
        `/api/lecturers/${user?.id}/generate-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ classId, startDate, endDate, type }),
        }
      );
      if (!response.ok) throw new Error("Failed to generate report");
      return response.json();
    },
    onSuccess: (data) => {
      // Handle report data - show summary and offer download
      toast({
        title: "Report Generated",
        description: `Report generated successfully for ${
          data.report?.classInfo?.className || "class"
        }. Overall attendance: ${
          data.report?.statistics?.overallAttendanceRate || 0
        }%`,
      });
      console.log("Report data:", data);

      // Create downloadable JSON file with report data
      if (data.report) {
        const blob = new Blob([JSON.stringify(data.report, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance-report-${data.report.classInfo.classCode}-${data.report.reportPeriod.startDate}-to-${data.report.reportPeriod.endDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
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

  const getAttendanceStatus = (studentId, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayAttendance = classAttendance[dateStr] || [];
    const studentRecord = dayAttendance.find(
      (record) => record.studentId === studentId
    );
    return studentRecord?.status || null;
  };

  const handleMarkAttendance = (studentId, status) => {
    if (!selectedClass) {
      toast({
        title: "Error",
        description: "Please select a class first",
        variant: "destructive",
      });
      return;
    }
    markAttendanceMutation.mutate({
      classId: selectedClass,
      studentId,
      status,
    });
  };

  if (statsLoading || isClassesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen bg-surface-background">
        <Sidebar
          hardwareStatus={hardwareDevices}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div className="flex-1 ml-64">
          {/* Header */}
          <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Lecturer Portal
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Welcome back, {user?.fullName || "Lecturer"}
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

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-2 px-3"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <i className="fas fa-chalkboard-teacher text-white text-sm"></i>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 hidden md:block">
                        {user?.fullName || "Lecturer"}
                      </span>
                      <i className="fas fa-chevron-down text-xs text-gray-500"></i>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.fullName || "Lecturer"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user?.email || "lecturer@smarttrack.com"}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        console.log("Profile Settings clicked");
                        setShowProfileDialog(true);
                      }}
                    >
                      <i className="fas fa-user mr-2 w-4"></i>
                      Profile Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setShowPreferencesDialog(true)}
                    >
                      <i className="fas fa-cog mr-2 w-4"></i>
                      Preferences
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
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="My Classes"
                    value={stats.totalClasses || 0}
                    change="Active this semester"
                    changeType="neutral"
                    icon="fas fa-door-open"
                    color="blue"
                  />
                  <StatsCard
                    title="Total Students"
                    value={stats.totalStudents || 0}
                    change="Across all classes"
                    changeType="neutral"
                    icon="fas fa-user-graduate"
                    color="green"
                  />
                  <StatsCard
                    title="Today's Attendance"
                    value={`${stats.todayAttendance || 0}%`}
                    change="Average across classes"
                    changeType="neutral"
                    icon="fas fa-clipboard-check"
                    color="orange"
                  />
                  <StatsCard
                    title="Weekly Average"
                    value={`${stats.weeklyAttendance || 0}%`}
                    change="This week's performance"
                    changeType="neutral"
                    icon="fas fa-chart-line"
                    color="purple"
                  />
                </div>

                {/* Quick Actions and Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <i className="fas fa-bolt text-primary mr-2"></i>
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Button
                          onClick={() => setActiveTab("attendance")}
                          className="w-full flex items-center justify-start space-x-3 h-12"
                          variant="outline"
                        >
                          <i className="fas fa-clipboard-check text-primary"></i>
                          <span>Mark Attendance</span>
                          <i className="fas fa-arrow-right ml-auto text-gray-400"></i>
                        </Button>
                        <Button
                          onClick={() => setActiveTab("students")}
                          className="w-full flex items-center justify-start space-x-3 h-12"
                          variant="outline"
                        >
                          <i className="fas fa-users text-green-600"></i>
                          <span>View Class Roster</span>
                          <i className="fas fa-arrow-right ml-auto text-gray-400"></i>
                        </Button>
                        <Button
                          onClick={() => setActiveTab("reports")}
                          className="w-full flex items-center justify-start space-x-3 h-12"
                          variant="outline"
                        >
                          <i className="fas fa-chart-bar text-orange-600"></i>
                          <span>Generate Reports</span>
                          <i className="fas fa-arrow-right ml-auto text-gray-400"></i>
                        </Button>
                        <Button
                          onClick={() => setActiveTab("schedule")}
                          className="w-full flex items-center justify-start space-x-3 h-12"
                          variant="outline"
                        >
                          <i className="fas fa-calendar-alt text-purple-600"></i>
                          <span>View Schedule</span>
                          <i className="fas fa-arrow-right ml-auto text-gray-400"></i>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* My Classes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <i className="fas fa-door-open text-primary mr-2"></i>
                        My Classes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {lecturerClasses.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-door-open text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">No classes assigned</p>
                          <p className="text-sm text-gray-400">
                            Contact admin to get classes assigned
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {lecturerClasses.map((classItem) => (
                            <div
                              key={classItem.id}
                              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedClass(classItem.id);
                                setActiveTab("attendance");
                              }}
                            >
                              <div>
                                <h3 className="font-semibold text-gray-900">
                                  {classItem.className}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {classItem.classCode}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Room: {classItem.room}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge
                                  variant={
                                    classItem.active ? "default" : "secondary"
                                  }
                                  className={
                                    classItem.active
                                      ? "bg-green-100 text-green-800"
                                      : ""
                                  }
                                >
                                  {classItem.active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Hardware Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <i className="fas fa-microchip text-primary mr-2"></i>
                      Hardware Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {hardwareDevices.length === 0 ? (
                        <div className="col-span-full text-center py-8">
                          <i className="fas fa-exclamation-triangle text-4xl text-yellow-300 mb-4"></i>
                          <p className="text-gray-500">
                            No hardware devices found
                          </p>
                        </div>
                      ) : (
                        hardwareDevices.map((device) => (
                          <div
                            key={device.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  device.status === "online"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }`}
                              ></div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {device.deviceType}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {device.location}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={
                                device.status === "online"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {device.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* My Classes Tab */}
              <TabsContent value="my-classes" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">My Classes Overview</h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => refetchClasses()}
                      disabled={isClassesLoading}
                    >
                      <i className="fas fa-sync-alt mr-2"></i>
                      Refresh
                    </Button>
                  </div>
                </div>

                {isClassesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="h-20 bg-gray-200 rounded"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : lecturerClasses.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-16">
                      <i className="fas fa-chalkboard-teacher text-4xl text-gray-300 mb-4"></i>
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">
                        No Classes Assigned
                      </h3>
                      <p className="text-gray-500">
                        You don't have any classes assigned yet.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lecturerClasses.map((classItem) => (
                      <Card
                        key={classItem.id}
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                              {classItem.className}
                            </CardTitle>
                            <Badge
                              variant={
                                classItem.active ? "default" : "secondary"
                              }
                            >
                              {classItem.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {classItem.classCode}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-door-open text-gray-500"></i>
                              <span>Room: {classItem.room}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-calendar text-gray-500"></i>
                              <span>Sem: {classItem.semester}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-graduation-cap text-gray-500"></i>
                              <span>Year: {classItem.academicYear}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-percentage text-gray-500"></i>
                              <span>
                                Min: {classItem.minAttendancePercentage || 75}%
                              </span>
                            </div>
                          </div>

                          {/* Quick Stats */}
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">
                                Total Students:
                              </span>
                              <span className="font-medium">
                                {classItem.totalStudents || 0}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">
                                Avg Attendance:
                              </span>
                              <span className="font-medium text-primary">
                                {classItem.averageAttendance || 0}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">
                                Last Session:
                              </span>
                              <span className="font-medium text-gray-700">
                                {classItem.lastSession
                                  ? format(
                                      new Date(classItem.lastSession),
                                      "MMM d"
                                    )
                                  : "None"}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedClass(classItem.id);
                                setActiveTab("attendance");
                              }}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <i className="fas fa-clipboard-check mr-1"></i>
                              Attendance
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClass(classItem.id);
                                setActiveTab("students");
                              }}
                            >
                              <i className="fas fa-users mr-1"></i>
                              Students
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setSelectedClass(classItem.id);
                              setActiveTab("reports");
                            }}
                          >
                            <i className="fas fa-chart-bar mr-2"></i>
                            View Reports
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Attendance Management
                  </h3>
                  <div className="flex items-center space-x-4">
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {lecturerClasses.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.className} ({classItem.classCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <i className="fas fa-calendar mr-2"></i>
                          {format(selectedDate, "PP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {selectedClass ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Student Attendance -{" "}
                        {format(selectedDate, "EEEE, MMMM d, yyyy")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {classStudents.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-user-graduate text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">
                            No students enrolled in this class
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {classStudents.map((student) => {
                            const attendanceStatus = getAttendanceStatus(
                              student.id,
                              selectedDate
                            );
                            return (
                              <div
                                key={student.id}
                                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                              >
                                <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                    <i className="fas fa-user text-gray-500"></i>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {student.studentId}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Attendance: {student.attendancePercentage}
                                      %
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {attendanceStatus && (
                                    <Badge
                                      variant={
                                        attendanceStatus === "present"
                                          ? "default"
                                          : "destructive"
                                      }
                                      className="mr-2"
                                    >
                                      {attendanceStatus}
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleMarkAttendance(
                                        student.id,
                                        "present"
                                      )
                                    }
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={markAttendanceMutation.isPending}
                                  >
                                    Present
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleMarkAttendance(student.id, "absent")
                                    }
                                    disabled={markAttendanceMutation.isPending}
                                  >
                                    Absent
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-16">
                      <i className="fas fa-arrow-up text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500">
                        Please select a class to manage attendance
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Student Management</h3>
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {lecturerClasses.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.className} ({classItem.classCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClass ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Class Roster</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {classStudents.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-user-graduate text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">
                            No students enrolled in this class
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {classStudents.map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                  <i className="fas fa-user text-white"></i>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {student.studentId}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Batch: {student.batch || "N/A"}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {student.presentSessions || 0}/
                                    {student.totalSessions || 0} sessions
                                    attended
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center space-x-4">
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-primary">
                                      {student.attendancePercentage || 0}%
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Attendance
                                    </p>
                                  </div>
                                  <Badge
                                    variant={
                                      student.attendancePercentage >= 75
                                        ? "default"
                                        : "destructive"
                                    }
                                    className={
                                      student.attendancePercentage >= 75
                                        ? "bg-green-100 text-green-800"
                                        : ""
                                    }
                                  >
                                    {student.attendancePercentage >= 75
                                      ? "Good"
                                      : "At Risk"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-16">
                      <i className="fas fa-arrow-up text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500">
                        Please select a class to view student roster
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Reports & Analytics</h3>
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {lecturerClasses.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id}>
                          {classItem.className} ({classItem.classCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClass ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card
                      className={`cursor-pointer hover:shadow-lg transition-shadow ${
                        generateReportMutation.isPending
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                      onClick={() =>
                        !generateReportMutation.isPending &&
                        generateReportMutation.mutate({
                          classId: selectedClass,
                          startDate: format(
                            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                            "yyyy-MM-dd"
                          ),
                          endDate: format(new Date(), "yyyy-MM-dd"),
                          type: "summary",
                        })
                      }
                    >
                      <CardContent className="p-6 text-center">
                        {generateReportMutation.isPending ? (
                          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                        ) : (
                          <i className="fas fa-file-pdf text-4xl text-red-500 mb-4"></i>
                        )}
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Monthly Summary
                        </h3>
                        <p className="text-sm text-gray-600">
                          {generateReportMutation.isPending
                            ? "Generating report..."
                            : "Last 30 days attendance summary"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card
                      className={`cursor-pointer hover:shadow-lg transition-shadow ${
                        generateReportMutation.isPending
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                      onClick={() =>
                        !generateReportMutation.isPending &&
                        generateReportMutation.mutate({
                          classId: selectedClass,
                          startDate: format(
                            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                            "yyyy-MM-dd"
                          ),
                          endDate: format(new Date(), "yyyy-MM-dd"),
                          type: "detailed",
                        })
                      }
                    >
                      <CardContent className="p-6 text-center">
                        {generateReportMutation.isPending ? (
                          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                        ) : (
                          <i className="fas fa-chart-line text-4xl text-blue-500 mb-4"></i>
                        )}
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Weekly Detailed
                        </h3>
                        <p className="text-sm text-gray-600">
                          {generateReportMutation.isPending
                            ? "Generating report..."
                            : "Detailed weekly performance"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card
                      className={`cursor-pointer hover:shadow-lg transition-shadow ${
                        generateReportMutation.isPending
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                      onClick={() =>
                        !generateReportMutation.isPending &&
                        generateReportMutation.mutate({
                          classId: selectedClass,
                          startDate: format(
                            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                            "yyyy-MM-dd"
                          ),
                          endDate: format(new Date(), "yyyy-MM-dd"),
                          type: "analytics",
                        })
                      }
                    >
                      <CardContent className="p-6 text-center">
                        {generateReportMutation.isPending ? (
                          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                        ) : (
                          <i className="fas fa-chart-bar text-4xl text-green-500 mb-4"></i>
                        )}
                        <h3 className="font-semibold text-gray-900 mb-2">
                          Semester Analytics
                        </h3>
                        <p className="text-sm text-gray-600">
                          {generateReportMutation.isPending
                            ? "Generating report..."
                            : "Full semester analysis"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-16">
                      <i className="fas fa-arrow-up text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500">
                        Please select a class to generate reports
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="space-y-6">
                <h3 className="text-lg font-semibold">Class Schedule</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {lecturerClasses.length === 0 ? (
                    <div className="col-span-full">
                      <Card>
                        <CardContent className="text-center py-16">
                          <i className="fas fa-calendar-alt text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">No classes scheduled</p>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    lecturerClasses.map((classItem) => (
                      <Card key={classItem.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>{classItem.className}</span>
                            <Badge
                              variant={
                                classItem.active ? "default" : "secondary"
                              }
                            >
                              {classItem.active ? "Active" : "Inactive"}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-code text-gray-500"></i>
                              <span className="text-sm">
                                Code: {classItem.classCode}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-door-open text-gray-500"></i>
                              <span className="text-sm">
                                Room: {classItem.room}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-calendar text-gray-500"></i>
                              <span className="text-sm">
                                Semester: {classItem.semester}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-graduation-cap text-gray-500"></i>
                              <span className="text-sm">
                                Academic Year: {classItem.academicYear}
                              </span>
                            </div>
                            {classItem.schedule && (
                              <div className="flex items-center space-x-2">
                                <i className="fas fa-clock text-gray-500"></i>
                                <span className="text-sm">
                                  Schedule: {JSON.stringify(classItem.schedule)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-percentage text-gray-500"></i>
                              <span className="text-sm">
                                Min Attendance:{" "}
                                {classItem.minAttendancePercentage || 75}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <Button
                              onClick={() => {
                                setSelectedClass(classItem.id);
                                setActiveTab("attendance");
                              }}
                              className="w-full"
                              variant="outline"
                            >
                              <i className="fas fa-clipboard-check mr-2"></i>
                              Mark Attendance
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      {/* Profile Settings Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <i className="fas fa-user text-primary"></i>
              <span>Profile Settings</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-chalkboard-teacher text-white text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {user?.fullName || "Lecturer"}
              </h3>
              <p className="text-sm text-gray-500">
                {user?.role || "Lecturer"}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Full Name
                </label>
                <Input
                  value={user?.fullName || ""}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Email Address
                </label>
                <Input
                  value={user?.email || ""}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Department
                </label>
                <Input
                  value={user?.department || "Computer Science"}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
                <div>
                  <h4 className="text-sm font-medium text-blue-900">
                    Information
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Profile information is managed by the system administrator.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowProfileDialog(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preferences Dialog */}
      <Dialog
        open={showPreferencesDialog}
        onOpenChange={setShowPreferencesDialog}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <i className="fas fa-cog text-primary"></i>
              <span>Preferences</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Dashboard Refresh Rate
                </label>
                <Select defaultValue="30">
                  <SelectTrigger>
                    <SelectValue placeholder="Select refresh rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Every 10 seconds</SelectItem>
                    <SelectItem value="30">Every 30 seconds</SelectItem>
                    <SelectItem value="60">Every 1 minute</SelectItem>
                    <SelectItem value="300">Every 5 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Default Date Range for Reports
                </label>
                <Select defaultValue="7">
                  <SelectTrigger>
                    <SelectValue placeholder="Select default range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Notification Settings
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Email notifications
                    </span>
                    <Button variant="outline" size="sm">
                      <i className="fas fa-bell mr-2"></i>
                      Enabled
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Desktop notifications
                    </span>
                    <Button variant="outline" size="sm">
                      <i className="fas fa-desktop mr-2"></i>
                      Enabled
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sound alerts</span>
                    <Button variant="outline" size="sm">
                      <i className="fas fa-volume-up mr-2"></i>
                      Disabled
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Display Theme
                </label>
                <Select defaultValue="light">
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light Mode</SelectItem>
                    <SelectItem value="dark">Dark Mode</SelectItem>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowPreferencesDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast({
                    title: "Preferences Saved",
                    description:
                      "Your preferences have been updated successfully.",
                  });
                  setShowPreferencesDialog(false);
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
