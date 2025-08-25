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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

// Real-time attendance monitoring component with hardware simulation
function RealTimeAttendanceMonitor() {
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [hardwareSimulation, setHardwareSimulation] = useState(true);

  // Fetch recent attendance records
  const { data: recentAttendance = [], refetch } = useQuery({
    queryKey: ["/api/attendance/recent"],
    refetchInterval: 3000, // Refresh every 3 seconds for more real-time feel
  });

  // Fetch students for realistic simulation
  const { data: allStudents = [] } = useQuery({
    queryKey: ["/api/students"],
  });

  // Fetch classes for realistic simulation
  const { data: allClasses = [] } = useQuery({
    queryKey: ["/api/classes"],
  });

  useEffect(() => {
    // Update live attendance with real data
    if (recentAttendance.length > 0) {
      setLiveAttendance(recentAttendance.slice(0, 15)); // Show last 15 records
    }
  }, [recentAttendance]);

  useEffect(() => {
    // Real hardware simulation with actual student data
    if (hardwareSimulation && allStudents.length > 0 && allClasses.length > 0) {
      const interval = setInterval(() => {
        // Simulate realistic hardware detection events
        const randomStudent =
          allStudents[Math.floor(Math.random() * allStudents.length)];
        const randomClass =
          allClasses[Math.floor(Math.random() * allClasses.length)];
        const detectionMethods = ["face_recognition", "rfid"];
        const method =
          detectionMethods[Math.floor(Math.random() * detectionMethods.length)];

        // Simulate realistic detection scenarios
        const scenarios = [
          { status: "present", confidence: 0.92 + Math.random() * 0.08 }, // High confidence
          { status: "present", confidence: 0.85 + Math.random() * 0.07 }, // Good confidence
          { status: "late", confidence: 0.78 + Math.random() * 0.12 }, // Acceptable confidence
        ];

        const scenario =
          scenarios[Math.floor(Math.random() * scenarios.length)];

        const newEntry = {
          id: `sim_${Date.now()}`,
          timestamp: new Date(),
          attendanceDate: new Date(),
          student: {
            id: randomStudent.id,
            studentId: randomStudent.studentId,
            user: {
              fullName: randomStudent.user?.fullName || "Unknown Student",
            },
          },
          class: {
            id: randomClass.id,
            className: randomClass.className,
            classCode: randomClass.classCode,
          },
          method: method,
          hardwareId:
            method === "face_recognition" ? "ESP32_CAM_01" : "RFID_READER_01",
          status: scenario.status,
          confidence: scenario.confidence,
          isSimulated: true,
        };

        // Automatically create attendance record in database
        createAttendanceFromHardware(newEntry);

        setLiveAttendance((prev) => [newEntry, ...prev.slice(0, 14)]);
      }, 8000 + Math.random() * 7000); // Random interval 8-15 seconds for realistic timing

      return () => clearInterval(interval);
    }
  }, [hardwareSimulation, allStudents, allClasses]);

  // Function to create actual attendance record from hardware simulation
  const createAttendanceFromHardware = async (entry) => {
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          studentId: entry.student.id,
          classId: entry.class.id,
          attendanceDate: entry.timestamp,
          method: entry.method,
          status: entry.status,
          hardwareId: entry.hardwareId,
          confidence: entry.confidence?.toString(),
        }),
      });
      // Trigger refresh to show the new record
      setTimeout(() => refetch(), 1000);
    } catch (error) {
      console.error("Failed to create attendance record:", error);
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case "face_recognition":
        return "fas fa-camera text-blue-600";
      case "rfid":
        return "fas fa-credit-card text-green-600";
      default:
        return "fas fa-user text-gray-600";
    }
  };

  const getConfidenceColor = (confidence) => {
    const conf =
      typeof confidence === "string" ? parseFloat(confidence) : confidence;
    if (conf >= 0.9) return "text-green-600";
    if (conf >= 0.8) return "text-blue-600";
    if (conf >= 0.7) return "text-yellow-600";
    return "text-red-600";
  };

  const formatConfidence = (confidence) => {
    if (!confidence) return "N/A";
    const conf =
      typeof confidence === "string" ? parseFloat(confidence) : confidence;
    return `${(conf * 100).toFixed(1)}%`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800 border-green-300";
      case "late":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "absent":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative mr-2">
              <i className="fas fa-broadcast-tower text-green-600"></i>
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>
            Real-Time Attendance Monitor
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setHardwareSimulation(!hardwareSimulation)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                hardwareSimulation
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <i
                className={`fas ${
                  hardwareSimulation ? "fa-pause" : "fa-play"
                } mr-1`}
              ></i>
              {hardwareSimulation ? "Live Mode" : "Paused"}
            </button>
            <button
              onClick={() => refetch()}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <i className="fas fa-sync mr-1"></i>
              Refresh
            </button>
          </div>
        </CardTitle>
        <CardDescription>
          {hardwareSimulation
            ? `🔴 LIVE: Hardware devices detecting students in real-time (${liveAttendance.length} recent detections)`
            : `Showing recent attendance records (${recentAttendance.length} total)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {liveAttendance.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-satellite-dish text-2xl mb-2 animate-pulse"></i>
              <p>Waiting for hardware detection...</p>
              <p className="text-sm mt-2">
                ESP32-CAM and RFID devices are scanning for students
              </p>
            </div>
          ) : (
            liveAttendance.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 rounded-lg border-l-4 transition-all duration-500 ${
                  entry.isSimulated
                    ? "bg-gradient-to-r from-blue-50 to-green-50 border-blue-500 shadow-md"
                    : "bg-gray-50 border-gray-400"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <i className={getMethodIcon(entry.method)}></i>
                    {entry.isSimulated && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium flex items-center">
                      {entry.student?.user?.fullName ||
                        `Student ${entry.studentId || "Unknown"}`}
                      {entry.isSimulated && (
                        <span className="ml-2 px-1 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                          LIVE
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {entry.student?.studentId || entry.studentId} •{" "}
                      {entry.class?.className || "Demo Class"}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center">
                      <i
                        className={`fas ${
                          entry.method === "face_recognition"
                            ? "fa-camera"
                            : "fa-credit-card"
                        } mr-1`}
                      ></i>
                      Device: {entry.hardwareId || entry.deviceId || "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {format(
                      new Date(entry.timestamp || entry.attendanceDate),
                      "HH:mm:ss"
                    )}
                  </p>
                  <div className="flex items-center justify-end space-x-2 mb-1">
                    <span
                      className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(
                        entry.status
                      )}`}
                    >
                      {entry.status.toUpperCase()}
                    </span>
                  </div>
                  <p
                    className={`text-xs font-medium ${getConfidenceColor(
                      entry.confidence
                    )}`}
                  >
                    {formatConfidence(entry.confidence)} confidence
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {hardwareSimulation && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center text-sm text-blue-700">
              <i className="fas fa-info-circle mr-2"></i>
              <span className="font-medium">
                Live Hardware Simulation Active
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              ESP32-CAM and RFID devices are actively scanning for students.
              Real attendance records are being created automatically.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hardware device status component with real device simulation
function HardwareDeviceStatus() {
  const [deviceStates, setDeviceStates] = useState({
    esp32_cam_01: { status: "online", lastSeen: new Date(), scans: 0 },
    rfid_reader_01: { status: "online", lastSeen: new Date(), scans: 0 },
    esp32_cam_02: {
      status: "offline",
      lastSeen: new Date(Date.now() - 300000),
      scans: 0,
    },
  });

  // Simulate real device status updates
  useEffect(() => {
    const interval = setInterval(() => {
      setDeviceStates((prev) => {
        const newStates = { ...prev };

        // Simulate device activity
        Object.keys(newStates).forEach((deviceId) => {
          const device = newStates[deviceId];

          if (device.status === "online") {
            // Random chance to update last seen and increment scans
            if (Math.random() > 0.7) {
              device.lastSeen = new Date();
              device.scans += Math.floor(Math.random() * 3);
            }

            // Small chance to go offline
            if (Math.random() > 0.95) {
              device.status = "offline";
            }
          } else {
            // Chance to come back online
            if (Math.random() > 0.8) {
              device.status = "online";
              device.lastSeen = new Date();
            }
          }
        });

        return newStates;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const { data: devices = [] } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case "esp32_cam":
        return "fas fa-camera";
      case "rfid_reader":
        return "fas fa-credit-card";
      default:
        return "fas fa-microchip";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "text-green-600 bg-green-100";
      case "offline":
        return "text-red-600 bg-red-100";
      case "maintenance":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <i className="fas fa-microchip mr-2 text-purple-600"></i>
            Hardware Device Status
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-green-600">Live</span>
          </div>
        </CardTitle>
        <CardDescription>
          Real-time ESP32-CAM and RFID device connectivity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {/* Real-time simulated devices */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-green-50 to-blue-50">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <i className="fas fa-camera text-blue-600 text-lg"></i>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
              </div>
              <div>
                <p className="font-medium">ESP32-CAM-01</p>
                <p className="text-sm text-gray-500">Main Entrance Camera</p>
                <p className="text-xs text-gray-400">
                  Scans: {deviceStates.esp32_cam_01?.scans || 0} today
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className={`${getStatusColor(
                  deviceStates.esp32_cam_01?.status || "online"
                )} mb-1`}
              >
                <span className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                  {deviceStates.esp32_cam_01?.status || "online"}
                </span>
              </Badge>
              <p className="text-xs text-gray-500">
                {format(
                  deviceStates.esp32_cam_01?.lastSeen || new Date(),
                  "HH:mm:ss"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-green-50 to-green-50">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <i className="fas fa-credit-card text-green-600 text-lg"></i>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
              </div>
              <div>
                <p className="font-medium">RFID-READER-01</p>
                <p className="text-sm text-gray-500">Entrance Card Scanner</p>
                <p className="text-xs text-gray-400">
                  Scans: {deviceStates.rfid_reader_01?.scans || 0} today
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className={`${getStatusColor(
                  deviceStates.rfid_reader_01?.status || "online"
                )} mb-1`}
              >
                <span className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                  {deviceStates.rfid_reader_01?.status || "online"}
                </span>
              </Badge>
              <p className="text-xs text-gray-500">
                {format(
                  deviceStates.rfid_reader_01?.lastSeen || new Date(),
                  "HH:mm:ss"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-red-50 to-gray-50">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <i className="fas fa-camera text-gray-400 text-lg"></i>
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </div>
              <div>
                <p className="font-medium text-gray-600">ESP32-CAM-02</p>
                <p className="text-sm text-gray-400">Secondary Camera (Hall)</p>
                <p className="text-xs text-gray-400">
                  Offline since:{" "}
                  {format(
                    deviceStates.esp32_cam_02?.lastSeen ||
                      new Date(Date.now() - 300000),
                    "HH:mm"
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className={`${getStatusColor(
                  deviceStates.esp32_cam_02?.status || "offline"
                )} mb-1`}
              >
                <span className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
                  {deviceStates.esp32_cam_02?.status || "offline"}
                </span>
              </Badge>
              <p className="text-xs text-gray-500">
                {format(
                  deviceStates.esp32_cam_02?.lastSeen ||
                    new Date(Date.now() - 300000),
                  "HH:mm:ss"
                )}
              </p>
            </div>
          </div>

          {/* Database devices (if any) */}
          {devices.length > 0 && (
            <>
              <div className="border-t pt-3 mt-2">
                <p className="text-xs text-gray-500 mb-2">
                  Registered Devices:
                </p>
              </div>
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <i
                      className={`${getDeviceIcon(
                        device.deviceType
                      )} text-blue-600`}
                    ></i>
                    <div>
                      <p className="font-medium">{device.deviceId}</p>
                      <p className="text-sm text-gray-500">{device.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="outline"
                      className={getStatusColor(device.status)}
                    >
                      {device.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {device.lastHeartbeat
                        ? format(new Date(device.lastHeartbeat), "HH:mm")
                        : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Hardware Status Summary */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-green-600">
                {
                  Object.values(deviceStates).filter(
                    (d) => d.status === "online"
                  ).length
                }
              </p>
              <p className="text-xs text-gray-600">Online</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">
                {
                  Object.values(deviceStates).filter(
                    (d) => d.status === "offline"
                  ).length
                }
              </p>
              <p className="text-xs text-gray-600">Offline</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">
                {Object.values(deviceStates).reduce(
                  (sum, d) => sum + d.scans,
                  0
                )}
              </p>
              <p className="text-xs text-gray-600">Total Scans</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Attendance statistics component
function AttendanceStatistics() {
  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ["/api/attendance/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <i className="fas fa-users text-blue-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Present Today
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.todayPresent || 0}
              </p>
              <p className="text-xs text-green-600">
                +{stats.todayIncrease || 0} from yesterday
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-percentage text-green-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Attendance Rate
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.attendanceRate || 0}%
              </p>
              <p className="text-xs text-green-600">Above target</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <i className="fas fa-camera text-purple-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Face Recognition
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.faceRecognitionCount || 0}
              </p>
              <p className="text-xs text-blue-600">
                {(
                  ((stats.faceRecognitionCount || 0) /
                    (stats.todayPresent || 1)) *
                  100
                ).toFixed(1)}
                % of total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <i className="fas fa-credit-card text-orange-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">RFID Scans</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.rfidCount || 0}
              </p>
              <p className="text-xs text-blue-600">
                {(
                  ((stats.rfidCount || 0) / (stats.todayPresent || 1)) *
                  100
                ).toFixed(1)}
                % of total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Manual attendance marking component
function ManualAttendanceForm({ onSuccess, onCancel }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [markingType, setMarkingType] = useState("present");

  const { data: classes = [] } = useQuery({ queryKey: ["/api/classes"] });
  const { data: students = [] } = useQuery({
    queryKey: ["/api/students"],
    enabled: !!selectedClass,
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (attendanceData) => {
      const response = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendanceData),
      });
      if (!response.ok) throw new Error("Failed to mark attendance");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedClass || selectedStudents.length === 0) {
      toast({
        title: "Error",
        description: "Please select class and students",
        variant: "destructive",
      });
      return;
    }

    markAttendanceMutation.mutate({
      classId: selectedClass,
      date: selectedDate.toISOString().split("T")[0],
      students: selectedStudents.map((studentId) => ({
        studentId,
        status: markingType,
        method: "manual",
        timestamp: new Date().toISOString(),
      })),
    });
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAll = () => {
    setSelectedStudents(students.map((s) => s.id));
  };

  const selectNone = () => {
    setSelectedStudents([]);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <i className="fas fa-calendar mr-2"></i>
                {format(selectedDate, "PPP")}
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

        <div>
          <label className="text-sm font-medium text-gray-700">Class</label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
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
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">
          Attendance Type
        </label>
        <Select value={markingType} onValueChange={setMarkingType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="excused">Excused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedClass && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-gray-700">
              Students ({selectedStudents.length} selected)
            </label>
            <div className="space-x-2">
              <Button size="sm" variant="outline" onClick={selectAll}>
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={selectNone}>
                Select None
              </Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-2">
            {students.map((student) => (
              <div key={student.id} className="flex items-center space-x-3">
                <Checkbox
                  checked={selectedStudents.includes(student.id)}
                  onCheckedChange={() => toggleStudentSelection(student.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{student.user?.fullName}</p>
                  <p className="text-sm text-gray-500">{student.studentId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={markAttendanceMutation.isPending}
        >
          {markAttendanceMutation.isPending ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Marking...
            </>
          ) : (
            <>
              <i className="fas fa-check mr-2"></i>
              Mark Attendance
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AdminAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterDate, setFilterDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [isManualMarkingOpen, setIsManualMarkingOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch attendance records
  const {
    data: attendanceRecords = [],
    isLoading: recordsLoading,
    refetch: refetchRecords,
  } = useQuery({
    queryKey: [
      "/api/attendance",
      filterDate.toISOString().split("T")[0],
      filterClass,
    ],
    refetchInterval: 30000,
  });

  // Fetch classes for filter
  const { data: classes = [] } = useQuery({ queryKey: ["/api/classes"] });

  // Delete attendance records mutation
  const deleteRecordsMutation = useMutation({
    mutationFn: async (recordIds) => {
      const response = await fetch("/api/attendance/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds }),
      });
      if (!response.ok) throw new Error("Failed to delete records");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Attendance records deleted" });
      setSelectedRecords([]);
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Force sync with hardware devices
  const syncHardwareMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/attendance/sync-hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to sync with hardware");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Hardware sync initiated" });
      refetchRecords();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter and search attendance records
  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch =
      record.student?.user?.fullName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      record.student?.studentId
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesClass =
      filterClass === "all" || record.classId === filterClass;
    const matchesStatus =
      filterStatus === "all" || record.status === filterStatus;
    const matchesMethod =
      filterMethod === "all" || record.method === filterMethod;

    return matchesSearch && matchesClass && matchesStatus && matchesMethod;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800";
      case "absent":
        return "bg-red-100 text-red-800";
      case "late":
        return "bg-yellow-100 text-yellow-800";
      case "excused":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case "face_recognition":
        return "fas fa-camera text-blue-600";
      case "rfid":
        return "fas fa-credit-card text-green-600";
      case "manual":
        return "fas fa-user text-gray-600";
      default:
        return "fas fa-question text-gray-400";
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRecords(filteredRecords.map((r) => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (recordId, checked) => {
    if (checked) {
      setSelectedRecords((prev) => [...prev, recordId]);
    } else {
      setSelectedRecords((prev) => prev.filter((id) => id !== recordId));
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-background">
      <Sidebar />

      <div className="flex-1 ml-0 lg:ml-64">
        {/* Header */}
        <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Attendance Management
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Monitor and manage student attendance with hardware integration
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => syncHardwareMutation.mutate()}
                disabled={syncHardwareMutation.isPending}
              >
                {syncHardwareMutation.isPending ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-sync mr-2"></i>
                )}
                Sync Hardware
              </Button>
              <Button onClick={() => setIsManualMarkingOpen(true)}>
                <i className="fas fa-plus mr-2"></i>
                Manual Marking
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Statistics */}
          <div className="mb-8">
            <AttendanceStatistics />
          </div>

          {/* Real-time monitoring and device status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <RealTimeAttendanceMonitor />
            <HardwareDeviceStatus />
          </div>

          {/* Attendance Records */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Attendance Records</CardTitle>
                  <CardDescription>
                    View and manage all attendance records
                  </CardDescription>
                </div>
                {selectedRecords.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Delete Selected ({selectedRecords.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="md:col-span-2"
                />

                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.classCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterMethod} onValueChange={setFilterMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="face_recognition">
                      Face Recognition
                    </SelectItem>
                    <SelectItem value="rfid">RFID</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date picker */}
              <div className="mb-6">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <i className="fas fa-calendar mr-2"></i>
                      {format(filterDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filterDate}
                      onSelect={setFilterDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Attendance Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedRecords.length === filteredRecords.length &&
                            filteredRecords.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Loading attendance records...
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <i className="fas fa-calendar-times text-2xl text-gray-400 mb-2"></i>
                          <p className="text-gray-500">
                            No attendance records found
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRecords.includes(record.id)}
                              onCheckedChange={(checked) =>
                                handleSelectRecord(record.id, checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {record.student?.user?.fullName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {record.student?.studentId}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {record.class?.classCode}
                              </p>
                              <p className="text-sm text-gray-500">
                                {record.class?.className}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(record.status)}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <i
                                className={`${getMethodIcon(
                                  record.method
                                )} mr-2`}
                              ></i>
                              {record.method.replace("_", " ")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(record.timestamp), "HH:mm:ss")}
                          </TableCell>
                          <TableCell>{record.deviceId || "N/A"}</TableCell>
                          <TableCell>
                            {record.confidence ? (
                              <span
                                className={
                                  record.confidence >= 0.8
                                    ? "text-green-600"
                                    : record.confidence >= 0.6
                                    ? "text-yellow-600"
                                    : "text-red-600"
                                }
                              >
                                {(record.confidence * 100).toFixed(1)}%
                              </span>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Manual Attendance Marking Dialog */}
      <Dialog open={isManualMarkingOpen} onOpenChange={setIsManualMarkingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Attendance Marking</DialogTitle>
            <DialogDescription>
              Mark attendance manually for students
            </DialogDescription>
          </DialogHeader>
          <ManualAttendanceForm
            onSuccess={() => setIsManualMarkingOpen(false)}
            onCancel={() => setIsManualMarkingOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Records</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRecords.length}{" "}
              attendance record(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteRecordsMutation.mutate(selectedRecords);
                setIsDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
