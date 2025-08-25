import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Exam Eligibility Statistics Component
function ExamEligibilityStats() {
  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ["/api/exam-eligibility/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {stats.eligible || 0}
              </p>
              <p className="text-sm text-gray-600">Exam Eligible</p>
              <p className="text-xs text-green-600 mt-1">≥75% attendance</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i className="fas fa-check-circle text-green-600 text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red-600">
                {stats.ineligible || 0}
              </p>
              <p className="text-sm text-gray-600">At Risk</p>
              <p className="text-xs text-red-600 mt-1">&lt;75% attendance</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {stats.averageAttendance || 0}%
              </p>
              <p className="text-sm text-gray-600">Average Attendance</p>
              <p className="text-xs text-blue-600 mt-1">All students</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="fas fa-chart-line text-blue-600 text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalClasses || 0}
              </p>
              <p className="text-sm text-gray-600">Active Classes</p>
              <p className="text-xs text-purple-600 mt-1">Being monitored</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <i className="fas fa-door-open text-purple-600 text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Attendance Trend Chart Component
function AttendanceTrendChart({ studentId, classId }) {
  const { data: trendData = [] } = useQuery({
    queryKey: ["/api/exam-eligibility/trend", studentId, classId],
    enabled: !!(studentId && classId),
  });

  const getAttendanceColor = (percentage) => {
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Attendance Trend</CardTitle>
        <CardDescription>
          Weekly attendance percentage over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trendData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-chart-line text-2xl mb-2"></i>
              <p>No trend data available</p>
            </div>
          ) : (
            trendData.map((week, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-20 text-sm text-gray-600">
                  Week {week.week}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getAttendanceColor(
                      week.percentage
                    )}`}
                    style={{ width: `${week.percentage}%` }}
                  ></div>
                </div>
                <div className="w-16 text-sm font-medium">
                  {week.percentage}%
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Bulk Eligibility Check Component
function BulkEligibilityCheck() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
  });

  const bulkCheckMutation = useMutation({
    mutationFn: async (classId) => {
      const response = await fetch("/api/exam-eligibility/bulk-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ classId }),
      });
      if (!response.ok) throw new Error("Failed to perform bulk check");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Check Completed",
        description: `Processed ${data.processed} students. ${data.eligible} eligible, ${data.ineligible} at risk.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exam-eligibility"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBulkCheck = () => {
    if (!selectedClass) {
      toast({
        title: "Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }
    bulkCheckMutation.mutate(selectedClass);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-tasks mr-2 text-blue-600"></i>
          Bulk Eligibility Check
        </CardTitle>
        <CardDescription>
          Check exam eligibility for all students in a class
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Class
            </label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.classCode} - {cls.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleBulkCheck}
            disabled={bulkCheckMutation.isPending || !selectedClass}
            className="mb-0"
          >
            {bulkCheckMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Processing...
              </>
            ) : (
              <>
                <i className="fas fa-check-double mr-2"></i>
                Check Eligibility
              </>
            )}
          </Button>
        </div>

        {bulkCheckMutation.isPending && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center text-sm text-blue-700">
              <i className="fas fa-clock mr-2"></i>
              Processing eligibility check... This may take a few moments.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Exam Eligibility Detail Modal
function ExamEligibilityDetail({ studentId, classId, isOpen, onClose }) {
  const { data: eligibilityDetail, isLoading } = useQuery({
    queryKey: ["/api/exam-eligibility/detail", studentId, classId],
    enabled: !!(isOpen && studentId && classId),
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ["/api/attendance/student", studentId, classId],
    enabled: !!(isOpen && studentId && classId),
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exam Eligibility Details</DialogTitle>
          <DialogDescription>
            Comprehensive attendance and eligibility analysis
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
            <p>Loading eligibility details...</p>
          </div>
        ) : eligibilityDetail ? (
          <div className="space-y-6">
            {/* Student Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <i className="fas fa-user text-blue-600 text-xl"></i>
                    </div>
                    <p className="font-semibold">
                      {eligibilityDetail.student?.user?.fullName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {eligibilityDetail.student?.studentId}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
                        eligibilityDetail.isEligible
                          ? "bg-green-100"
                          : "bg-red-100"
                      }`}
                    >
                      <i
                        className={`fas ${
                          eligibilityDetail.isEligible
                            ? "fa-check-circle text-green-600"
                            : "fa-exclamation-triangle text-red-600"
                        } text-xl`}
                      ></i>
                    </div>
                    <p className="font-semibold">
                      {eligibilityDetail.isEligible
                        ? "Eligible"
                        : "Not Eligible"}
                    </p>
                    <p className="text-sm text-gray-600">For Examination</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-blue-600 text-xl font-bold">
                        {eligibilityDetail.attendancePercentage}%
                      </span>
                    </div>
                    <p className="font-semibold">Attendance</p>
                    <p className="text-sm text-gray-600">
                      {eligibilityDetail.attendedClasses} /{" "}
                      {eligibilityDetail.totalClasses} classes
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Trend */}
            <AttendanceTrendChart studentId={studentId} classId={classId} />

            {/* Recent Attendance History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Recent Attendance History
                </CardTitle>
                <CardDescription>Last 10 attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attendanceHistory.slice(0, 10).map((record, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <i
                          className={`fas ${
                            record.method === "face_recognition"
                              ? "fa-camera text-blue-600"
                              : record.method === "rfid"
                              ? "fa-credit-card text-green-600"
                              : "fa-user text-gray-600"
                          }`}
                        ></i>
                        <div>
                          <p className="font-medium">
                            {format(
                              new Date(record.attendanceDate),
                              "MMM dd, yyyy"
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(record.attendanceDate), "HH:mm")} •{" "}
                            {record.method}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${
                          record.status === "present"
                            ? "bg-green-100 text-green-800"
                            : record.status === "late"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {eligibilityDetail.isEligible ? (
                    <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <i className="fas fa-check-circle text-green-600 mt-1"></i>
                      <div>
                        <p className="font-medium text-green-800">
                          Eligible for Examination
                        </p>
                        <p className="text-sm text-green-700">
                          Student has met the minimum attendance requirement of
                          75%.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <i className="fas fa-exclamation-triangle text-red-600 mt-1"></i>
                        <div>
                          <p className="font-medium text-red-800">
                            Not Eligible for Examination
                          </p>
                          <p className="text-sm text-red-700">
                            Student needs {eligibilityDetail.requiredClasses}{" "}
                            more classes to reach 75% attendance.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <i className="fas fa-lightbulb text-yellow-600 mt-1"></i>
                        <div>
                          <p className="font-medium text-yellow-800">
                            Action Required
                          </p>
                          <p className="text-sm text-yellow-700">
                            Consider counseling session and monitor hardware
                            attendance closely.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-exclamation-circle text-2xl mb-4"></i>
            <p>No eligibility data found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Main Exam Eligibility Component
export default function AdminExamEligibility() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEligibility, setFilterEligibility] = useState("all");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Real-time hardware monitoring
  const [hardwareStatus, setHardwareStatus] = useState({
    esp32cam: { online: true, scanning: false, lastScan: new Date() },
    rfidReader: { online: true, scanning: false, lastScan: new Date() },
  });

  // Queries
  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
  });

  const {
    data: eligibilityData = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/exam-eligibility", selectedClass],
    enabled: !!selectedClass,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Hardware simulation for real-time monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate hardware activity
      setHardwareStatus((prev) => ({
        esp32cam: {
          ...prev.esp32cam,
          scanning: Math.random() > 0.8,
          lastScan: Math.random() > 0.9 ? new Date() : prev.esp32cam.lastScan,
        },
        rfidReader: {
          ...prev.rfidReader,
          scanning: Math.random() > 0.85,
          lastScan: Math.random() > 0.9 ? new Date() : prev.rfidReader.lastScan,
        },
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Filter and search functionality
  const filteredData = eligibilityData.filter((item) => {
    const matchesSearch =
      item.student?.user?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.student?.studentId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterEligibility === "all" ||
      (filterEligibility === "eligible" && item.isEligible) ||
      (filterEligibility === "ineligible" && !item.isEligible);

    return matchesSearch && matchesFilter;
  });

  // Bulk actions
  const sendNotificationMutation = useMutation({
    mutationFn: async (studentIds) => {
      const response = await fetch("/api/exam-eligibility/send-notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ studentIds }),
      });
      if (!response.ok) throw new Error("Failed to send notifications");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Notifications Sent",
        description: `Sent eligibility notifications to ${data.sent} students.`,
      });
      setSelectedStudents([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportReportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/exam-eligibility/export?classId=${selectedClass}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to export report");
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `exam-eligibility-report-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Report Exported",
        description:
          "Exam eligibility report has been downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStudentSelect = (studentId, checked) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentId]);
    } else {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedStudents(filteredData.map((item) => item.student.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleViewDetails = (student, classId) => {
    setSelectedStudentDetail({ studentId: student.id, classId });
    setDetailModalOpen(true);
  };

  if (!user || user.role !== "admin") {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 ml-64">
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Exam Eligibility Management
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Monitor student exam eligibility based on attendance
                    thresholds
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        hardwareStatus.esp32cam.online
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    ></div>
                    <span
                      className={
                        hardwareStatus.esp32cam.scanning
                          ? "text-blue-600 font-medium"
                          : "text-gray-600"
                      }
                    >
                      ESP32-CAM{" "}
                      {hardwareStatus.esp32cam.scanning
                        ? "Scanning..."
                        : "Online"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        hardwareStatus.rfidReader.online
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    ></div>
                    <span
                      className={
                        hardwareStatus.rfidReader.scanning
                          ? "text-blue-600 font-medium"
                          : "text-gray-600"
                      }
                    >
                      RFID Reader{" "}
                      {hardwareStatus.rfidReader.scanning
                        ? "Active..."
                        : "Ready"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6">
            {/* Statistics */}
            <ExamEligibilityStats />

            {/* Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Class Selection and Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-filter mr-2 text-blue-600"></i>
                    Filters & Search
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Select Class
                    </label>
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class to view eligibility" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.classCode} - {cls.className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Search Students
                    </label>
                    <Input
                      placeholder="Search by name or student ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Eligibility Filter
                    </label>
                    <Select
                      value={filterEligibility}
                      onValueChange={setFilterEligibility}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Students</SelectItem>
                        <SelectItem value="eligible">Eligible Only</SelectItem>
                        <SelectItem value="ineligible">At Risk Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Bulk Eligibility Check */}
              <BulkEligibilityCheck />
            </div>

            {/* Student Eligibility Table */}
            {selectedClass && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <i className="fas fa-list mr-2 text-blue-600"></i>
                        Student Eligibility Status
                      </CardTitle>
                      <CardDescription>
                        {filteredData.length} students • Updated every 30
                        seconds
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      {selectedStudents.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            sendNotificationMutation.mutate(selectedStudents)
                          }
                          disabled={sendNotificationMutation.isPending}
                        >
                          <i className="fas fa-bell mr-2"></i>
                          Notify Selected ({selectedStudents.length})
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportReportMutation.mutate()}
                        disabled={exportReportMutation.isPending}
                      >
                        {exportReportMutation.isPending ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-download mr-2"></i>
                        )}
                        Export Report
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                      >
                        <i className="fas fa-sync-alt mr-2"></i>
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12">
                      <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
                      <p className="text-gray-500">
                        Loading eligibility data...
                      </p>
                    </div>
                  ) : filteredData.length === 0 ? (
                    <div className="text-center py-12">
                      <i className="fas fa-search text-2xl text-gray-400 mb-4"></i>
                      <p className="text-gray-500">
                        No students found matching your criteria
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                selectedStudents.length === filteredData.length
                              }
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead>Eligibility</TableHead>
                          <TableHead>Last Detected</TableHead>
                          <TableHead>Hardware Method</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredData.map((item) => (
                          <TableRow key={item.student.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedStudents.includes(
                                  item.student.id
                                )}
                                onCheckedChange={(checked) =>
                                  handleStudentSelect(item.student.id, checked)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <i className="fas fa-user text-blue-600 text-sm"></i>
                                </div>
                                <span className="font-medium">
                                  {item.student.user?.fullName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              {item.student.studentId}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-20 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-500 ${
                                      item.attendancePercentage >= 75
                                        ? "bg-green-500"
                                        : item.attendancePercentage >= 60
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{
                                      width: `${item.attendancePercentage}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">
                                  {item.attendancePercentage}%
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {item.attendedClasses}/{item.totalClasses}{" "}
                                classes
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${
                                  item.isEligible
                                    ? "bg-green-100 text-green-800 border-green-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                                }`}
                              >
                                <i
                                  className={`fas ${
                                    item.isEligible
                                      ? "fa-check-circle"
                                      : "fa-exclamation-triangle"
                                  } mr-1`}
                                ></i>
                                {item.isEligible ? "Eligible" : "At Risk"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.lastAttendance ? (
                                <div className="text-sm">
                                  <div>
                                    {format(
                                      new Date(
                                        item.lastAttendance.attendanceDate
                                      ),
                                      "MMM dd"
                                    )}
                                  </div>
                                  <div className="text-gray-500">
                                    {format(
                                      new Date(
                                        item.lastAttendance.attendanceDate
                                      ),
                                      "HH:mm"
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">
                                  No records
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.lastAttendance?.method ? (
                                <Badge variant="outline" className="text-xs">
                                  <i
                                    className={`fas ${
                                      item.lastAttendance.method ===
                                      "face_recognition"
                                        ? "fa-camera"
                                        : "fa-credit-card"
                                    } mr-1`}
                                  ></i>
                                  {item.lastAttendance.method ===
                                  "face_recognition"
                                    ? "Face"
                                    : "RFID"}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleViewDetails(item.student, selectedClass)
                                }
                              >
                                <i className="fas fa-eye mr-2"></i>
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <ExamEligibilityDetail
        studentId={selectedStudentDetail?.studentId}
        classId={selectedStudentDetail?.classId}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedStudentDetail(null);
        }}
      />
    </div>
  );
}
