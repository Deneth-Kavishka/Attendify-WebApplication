import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/ui/sidebar";
import StatsCard from "@/components/ui/stats-card";
import { useAuth } from "@/lib/auth.jsx";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPreferencesDialog, setShowPreferencesDialog] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get student profile data
  const { data: studentData } = useQuery({
    queryKey: ["/api/students/profile"],
    queryFn: async () => {
      const response = await fetch("/api/students/profile", {
        headers: {
          Authorization: `Bearer ${user?.id}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch student profile");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Get student attendance
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["/api/attendance/student", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/attendance/student/${user?.id}`, {
        headers: {
          Authorization: `Bearer ${user?.id}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch attendance");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Get exam eligibility
  const { data: examEligibility = [] } = useQuery({
    queryKey: ["/api/exam-eligibility/student", user?.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/exam-eligibility/student/${user?.id}`,
        {
          headers: {
            Authorization: `Bearer ${user?.id}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch exam eligibility");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Get student's classes
  const { data: studentClasses = [] } = useQuery({
    queryKey: ["/api/classes/student", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/classes`, {
        headers: {
          Authorization: `Bearer ${user?.id}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch classes");
      }
      return response.json();
    },
    enabled: !!user?.id,
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

  const calculateOverallAttendance = () => {
    if (attendanceRecords.length === 0) return 0;
    const presentCount = attendanceRecords.filter(
      (record) => record.status === "present"
    ).length;
    return ((presentCount / attendanceRecords.length) * 100).toFixed(1);
  };

  const getEligibleClasses = () => {
    return examEligibility.filter((record) => record.isEligible).length;
  };

  const getIneligibleClasses = () => {
    return examEligibility.filter((record) => !record.isEligible).length;
  };

  const getAttendanceByClass = (classId) => {
    const classAttendance = attendanceRecords.filter(
      (record) => record.classId === classId
    );
    if (classAttendance.length === 0) return 0;
    const presentCount = classAttendance.filter(
      (record) => record.status === "present"
    ).length;
    return ((presentCount / classAttendance.length) * 100).toFixed(1);
  };

  return (
    <>
      <div className="flex min-h-screen bg-surface-background">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="flex-1 ml-64">
          {/* Header */}
          <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Student Portal
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Welcome back, {user?.fullName}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatTime(currentTime)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(currentTime)}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <i className="fas fa-user-graduate text-white text-sm"></i>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        Student
                      </span>
                      <i className="fas fa-chevron-down text-xs text-gray-500"></i>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setShowProfileDialog(true)}
                    >
                      <i className="fas fa-user mr-2"></i>
                      Profile Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setShowPreferencesDialog(true)}
                    >
                      <i className="fas fa-cog mr-2"></i>
                      Preferences
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600"
                      onClick={logout}
                    >
                      <i className="fas fa-sign-out-alt mr-2"></i>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Content with Tabs */}
          <main className="p-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-6"
            >
              <TabsList className="grid grid-cols-4 w-full max-w-md">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
              </TabsList>

              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="Overall Attendance"
                    value={`${calculateOverallAttendance()}%`}
                    change="Across all classes"
                    changeType={
                      calculateOverallAttendance() >= 75
                        ? "positive"
                        : "negative"
                    }
                    icon="fas fa-clipboard-check"
                    color={calculateOverallAttendance() >= 75 ? "green" : "red"}
                  />
                  <StatsCard
                    title="Total Classes"
                    value={attendanceRecords.length}
                    change="Sessions attended"
                    changeType="neutral"
                    icon="fas fa-door-open"
                    color="blue"
                  />
                  <StatsCard
                    title="Exam Eligible"
                    value={getEligibleClasses()}
                    change={`${getIneligibleClasses()} subjects at risk`}
                    changeType={
                      getIneligibleClasses() > 0 ? "negative" : "positive"
                    }
                    icon="fas fa-file-alt"
                    color={getIneligibleClasses() > 0 ? "red" : "green"}
                  />
                  <StatsCard
                    title="Present Days"
                    value={
                      attendanceRecords.filter((r) => r.status === "present")
                        .length
                    }
                    change="This semester"
                    changeType="neutral"
                    icon="fas fa-calendar-check"
                    color="blue"
                  />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Attendance Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Attendance Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {attendanceRecords.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">No attendance records</p>
                          <p className="text-sm text-gray-400">
                            Your attendance will appear here
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="text-center">
                            <div className="text-4xl font-bold text-primary mb-2">
                              {calculateOverallAttendance()}%
                            </div>
                            <p className="text-gray-600">
                              Overall Attendance Rate
                            </p>
                            <div
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                                calculateOverallAttendance() >= 75
                                  ? "bg-green-100 text-secondary"
                                  : "bg-red-100 text-destructive"
                              }`}
                            >
                              {calculateOverallAttendance() >= 75
                                ? "Good Standing"
                                : "Below Threshold"}
                            </div>
                          </div>

                          <div className="bg-gray-100 rounded-lg p-4">
                            <div className="flex justify-between text-sm mb-2">
                              <span>
                                Present:{" "}
                                {
                                  attendanceRecords.filter(
                                    (r) => r.status === "present"
                                  ).length
                                }
                              </span>
                              <span>
                                Absent:{" "}
                                {
                                  attendanceRecords.filter(
                                    (r) => r.status === "absent"
                                  ).length
                                }
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-secondary h-2 rounded-full"
                                style={{
                                  width: `${calculateOverallAttendance()}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Exam Eligibility */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Exam Eligibility Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {examEligibility.length === 0 ? (
                        <div className="text-center py-8">
                          <i className="fas fa-file-alt text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">No eligibility data</p>
                          <p className="text-sm text-gray-400">
                            Eligibility will be calculated automatically
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {examEligibility.map((record) => (
                            <div
                              key={record.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-900">
                                  Class {record.classId}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {record.attendancePercentage}% attendance
                                </p>
                              </div>
                              <div>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    record.isEligible
                                      ? "bg-green-100 text-secondary"
                                      : "bg-red-100 text-destructive"
                                  }`}
                                >
                                  {record.isEligible
                                    ? "Eligible"
                                    : "Ineligible"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Attendance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Attendance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {attendanceRecords.length === 0 ? (
                      <div className="text-center py-8">
                        <i className="fas fa-history text-4xl text-gray-300 mb-4"></i>
                        <p className="text-gray-500">No attendance history</p>
                        <p className="text-sm text-gray-400">
                          Your attendance records will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Date
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Class
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Method
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceRecords.slice(0, 10).map((record) => (
                              <tr
                                key={record.id}
                                className="border-b border-gray-100 hover:bg-gray-50"
                              >
                                <td className="py-3 px-4 text-sm text-gray-900">
                                  {new Date(
                                    record.attendanceDate
                                  ).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-900">
                                  Class {record.classId}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center space-x-2">
                                    <i
                                      className={`${
                                        record.method === "face_recognition"
                                          ? "fas fa-camera text-secondary"
                                          : "fas fa-id-card text-accent"
                                      } text-sm`}
                                    ></i>
                                    <span className="text-sm text-gray-600">
                                      {record.method === "face_recognition"
                                        ? "Face Recognition"
                                        : "RFID Card"}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      record.status === "present"
                                        ? "bg-green-100 text-secondary"
                                        : "bg-red-100 text-destructive"
                                    }`}
                                  >
                                    {record.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    My Attendance
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {attendanceRecords.length} Total Sessions
                    </Badge>
                  </div>
                </div>

                {/* Attendance by Class */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {studentClasses.map((classItem) => (
                    <Card key={classItem.id}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {classItem.className}
                        </CardTitle>
                        <div className="text-sm text-gray-600">
                          {classItem.classCode} • Room {classItem.room}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {getAttendanceByClass(classItem.id)}%
                            </div>
                            <p className="text-sm text-gray-600">
                              Attendance Rate
                            </p>
                          </div>

                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                getAttendanceByClass(classItem.id) >= 75
                                  ? "bg-secondary"
                                  : "bg-destructive"
                              }`}
                              style={{
                                width: `${getAttendanceByClass(classItem.id)}%`,
                              }}
                            ></div>
                          </div>

                          <div className="flex justify-between text-xs text-gray-600">
                            <span>
                              Present:{" "}
                              {
                                attendanceRecords.filter(
                                  (r) =>
                                    r.classId === classItem.id &&
                                    r.status === "present"
                                ).length
                              }
                            </span>
                            <span>
                              Absent:{" "}
                              {
                                attendanceRecords.filter(
                                  (r) =>
                                    r.classId === classItem.id &&
                                    r.status === "absent"
                                ).length
                              }
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Detailed Attendance History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {attendanceRecords.length === 0 ? (
                      <div className="text-center py-12">
                        <i className="fas fa-calendar-times text-4xl text-gray-300 mb-4"></i>
                        <p className="text-gray-500 text-lg">
                          No attendance records found
                        </p>
                        <p className="text-sm text-gray-400">
                          Your attendance history will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Date
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Class
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Time
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Method
                              </th>
                              <th className="text-left py-3 px-4 font-medium text-gray-600">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceRecords
                              .sort(
                                (a, b) =>
                                  new Date(b.attendanceDate) -
                                  new Date(a.attendanceDate)
                              )
                              .map((record) => (
                                <tr
                                  key={record.id}
                                  className="border-b border-gray-100 hover:bg-gray-50"
                                >
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    {new Date(
                                      record.attendanceDate
                                    ).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-900">
                                    {studentClasses.find(
                                      (c) => c.id === record.classId
                                    )?.className || `Class ${record.classId}`}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-gray-600">
                                    {new Date(
                                      record.attendanceDate
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center space-x-2">
                                      <i
                                        className={`${
                                          record.method === "face_recognition"
                                            ? "fas fa-camera text-secondary"
                                            : "fas fa-id-card text-accent"
                                        } text-sm`}
                                      ></i>
                                      <span className="text-sm text-gray-600">
                                        {record.method === "face_recognition"
                                          ? "Face Recognition"
                                          : "RFID Card"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        record.status === "present"
                                          ? "bg-green-100 text-secondary"
                                          : "bg-red-100 text-destructive"
                                      }`}
                                    >
                                      <i
                                        className={`${
                                          record.status === "present"
                                            ? "fas fa-check"
                                            : "fas fa-times"
                                        } mr-1`}
                                      ></i>
                                      {record.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Exam Eligibility Tab */}
              <TabsContent value="eligibility" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Exam Eligibility
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-secondary border-secondary"
                    >
                      {getEligibleClasses()} Eligible
                    </Badge>
                    {getIneligibleClasses() > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-destructive border-destructive"
                      >
                        {getIneligibleClasses()} At Risk
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Eligibility Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-secondary mb-2">
                          {getEligibleClasses()}
                        </div>
                        <p className="text-sm text-gray-600">
                          Eligible Classes
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-destructive mb-2">
                          {getIneligibleClasses()}
                        </div>
                        <p className="text-sm text-gray-600">At Risk Classes</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {calculateOverallAttendance()}%
                        </div>
                        <p className="text-sm text-gray-600">
                          Overall Attendance
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Eligibility */}
                <Card>
                  <CardHeader>
                    <CardTitle>Class-wise Eligibility Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {examEligibility.length === 0 ? (
                      <div className="text-center py-12">
                        <i className="fas fa-graduation-cap text-4xl text-gray-300 mb-4"></i>
                        <p className="text-gray-500 text-lg">
                          No eligibility data available
                        </p>
                        <p className="text-sm text-gray-400">
                          Exam eligibility will be calculated based on
                          attendance
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {examEligibility.map((record) => (
                          <div
                            key={record.id}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">
                                  Class {record.classId}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Attendance: {record.attendancePercentage}% •
                                  Required: 75%
                                </p>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      record.attendancePercentage >= 75
                                        ? "bg-secondary"
                                        : "bg-destructive"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        record.attendancePercentage,
                                        100
                                      )}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                              <div className="ml-4">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    record.isEligible
                                      ? "bg-green-100 text-secondary"
                                      : "bg-red-100 text-destructive"
                                  }`}
                                >
                                  <i
                                    className={`${
                                      record.isEligible
                                        ? "fas fa-check-circle"
                                        : "fas fa-exclamation-triangle"
                                    } mr-2`}
                                  ></i>
                                  {record.isEligible ? "Eligible" : "At Risk"}
                                </span>
                              </div>
                            </div>
                            {!record.isEligible && (
                              <div className="mt-3 p-3 bg-red-50 rounded-lg">
                                <p className="text-sm text-red-700">
                                  <i className="fas fa-info-circle mr-2"></i>
                                  You need{" "}
                                  {Math.ceil(
                                    ((75 - record.attendancePercentage) *
                                      record.totalSessions) /
                                      100
                                  )}{" "}
                                  more present sessions to become eligible.
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    My Profile
                  </h3>
                  <Button onClick={() => setShowProfileDialog(true)} size="sm">
                    <i className="fas fa-edit mr-2"></i>
                    Edit Profile
                  </Button>
                </div>

                {/* Profile Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="fas fa-user-graduate text-white text-2xl"></i>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {user?.fullName || "Student"}
                        </h3>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                      </div>

                      <div className="space-y-3 pt-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Student ID:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {studentData?.studentId || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Department:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {user?.department || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            RFID Card:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {studentData?.rfidCard || "Not Assigned"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Status:</span>
                          <Badge
                            variant={
                              studentData?.active ? "default" : "destructive"
                            }
                          >
                            {studentData?.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Academic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Enrollment Year:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {studentData?.enrollmentYear || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Batch:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {studentData?.batch || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Semester:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {studentData?.semester || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">GPA:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {studentData?.gpa || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">
                            Face Registration:
                          </span>
                          <Badge
                            variant={
                              studentData?.faceRegistrationStatus ===
                              "completed"
                                ? "default"
                                : studentData?.faceRegistrationStatus ===
                                  "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {studentData?.faceRegistrationStatus || "Pending"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button variant="outline" className="h-auto py-4 px-6">
                        <div className="text-center">
                          <i className="fas fa-download text-xl mb-2"></i>
                          <div className="text-sm font-medium">
                            Download Attendance Report
                          </div>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 px-6">
                        <div className="text-center">
                          <i className="fas fa-camera text-xl mb-2"></i>
                          <div className="text-sm font-medium">
                            Update Face Recognition
                          </div>
                        </div>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 px-6">
                        <div className="text-center">
                          <i className="fas fa-id-card text-xl mb-2"></i>
                          <div className="text-sm font-medium">
                            Request RFID Card
                          </div>
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
                <i className="fas fa-user-graduate text-white text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {user?.fullName || "Student"}
              </h3>
              <p className="text-sm text-gray-500">{user?.role || "Student"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  defaultValue={user?.fullName}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user?.email}
                  placeholder="Enter email"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  defaultValue={studentData?.studentId}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  defaultValue={user?.department}
                  placeholder="Enter department"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowProfileDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast({
                    title: "Profile Updated",
                    description: "Your profile has been updated successfully.",
                  });
                  setShowProfileDialog(false);
                }}
              >
                Save Changes
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
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="notifications">Email Notifications</Label>
              <div className="space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="attendance-alerts"
                    defaultChecked
                  />
                  <Label htmlFor="attendance-alerts" className="text-sm">
                    Attendance alerts
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="exam-eligibility" defaultChecked />
                  <Label htmlFor="exam-eligibility" className="text-sm">
                    Exam eligibility updates
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="class-reminders" />
                  <Label htmlFor="class-reminders" className="text-sm">
                    Class reminders
                  </Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="theme">Theme Preference</Label>
              <Select defaultValue="light">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowPreferencesDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast({
                    title: "Preferences Updated",
                    description: "Your preferences have been saved.",
                  });
                  setShowPreferencesDialog(false);
                }}
              >
                Save Preferences
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
