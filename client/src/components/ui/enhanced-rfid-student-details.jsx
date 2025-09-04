/**
 * Enhanced RFID Student Details Component
 * Shows complete student information after RFID scan
 * 
 * Features:
 * - Real-time RFID scanning results
 * - Complete student profile display
 * - Attendance statistics
 * - Fee status
 * - Academic results
 * - Current enrollments
 * 
 * Version: 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { Progress } from './progress';
import { Alert, AlertDescription } from './alert';
import { useToast } from '../../hooks/use-toast';

interface StudentProfile {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  rfidCard: string;
  department: string;
  batch: string;
  semester: string;
  enrollmentYear: number;
  gpa: number;
  mobileNumber: string;
  guardianContact: string;
  emergencyContact: string;
  attendanceStats: {
    totalLectures: number;
    attendedLectures: number;
    attendancePercentage: number;
    lastAttendance: Date | null;
  };
  feeStatus: {
    totalFees: number;
    paidAmount: number;
    pendingAmount: number;
    lastPayment: Date | null;
    status: 'paid' | 'pending' | 'overdue';
  };
  results: {
    currentSemesterGPA: number;
    overallGPA: number;
    completedCredits: number;
    totalCredits: number;
    academicStatus: 'good' | 'probation' | 'warning';
  };
  currentClasses: Array<{
    classId: string;
    subjectName: string;
    lecturerName: string;
    schedule: string;
    attendance: number;
  }>;
}

interface RFIDScanResult {
  success: boolean;
  message: string;
  student: StudentProfile | null;
  timestamp: string;
  attendanceId?: string;
}

interface DeviceStatus {
  id: string;
  status: 'online' | 'offline' | 'scanning';
  location: string;
  totalScans: number;
  successfulScans: number;
  lastHeartbeat: Date;
}

const EnhancedRFIDStudentDetails: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [recentScans, setRecentScans] = useState<RFIDScanResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  // WebSocket connection for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log('🔌 Connected to Enhanced RFID Service');
        toast({
          title: 'RFID Service Connected',
          description: 'Real-time RFID scanning is now active',
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('🔌 Disconnected from RFID Service');
        toast({
          title: 'RFID Service Disconnected',
          description: 'Attempting to reconnect...',
          variant: 'destructive',
        });
        
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to RFID service',
          variant: 'destructive',
        });
      };
    };

    connectWebSocket();
  }, [toast]);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'attendance_update':
        handleAttendanceUpdate(data);
        break;
        
      case 'device_status':
        handleDeviceStatus(data);
        break;
        
      case 'scan_result':
        handleScanResult(data);
        break;
        
      default:
        console.log('Unknown WebSocket message:', data);
    }
  };

  const handleAttendanceUpdate = (data: RFIDScanResult) => {
    // Add to recent scans
    setRecentScans(prev => [data, ...prev.slice(0, 9)]);
    
    if (data.success && data.student) {
      setSelectedStudent(data.student);
      setScanning(false);
      
      toast({
        title: 'Attendance Recorded',
        description: `Welcome ${data.student.fullName}! Attendance: ${data.student.attendanceStats.attendancePercentage.toFixed(1)}%`,
      });
    } else {
      toast({
        title: 'Scan Failed',
        description: data.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeviceStatus = (deviceData: DeviceStatus) => {
    setDevices(prev => {
      const index = prev.findIndex(d => d.id === deviceData.id);
      if (index >= 0) {
        const newDevices = [...prev];
        newDevices[index] = deviceData;
        return newDevices;
      } else {
        return [...prev, deviceData];
      }
    });
  };

  const handleScanResult = (result: RFIDScanResult) => {
    setRecentScans(prev => [result, ...prev.slice(0, 9)]);
    
    if (result.student) {
      setSelectedStudent(result.student);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFeeStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAcademicStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'probation': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RFID Student Scanner</h1>
          <p className="text-gray-600 mt-1">Real-time student information and attendance tracking</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Device Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {devices.map((device) => (
          <Card key={device.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Device: {device.id}</span>
                <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                  {device.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Location: {device.location}</p>
                <p className="text-sm text-gray-600">
                  Scans: {device.successfulScans}/{device.totalScans}
                </p>
                <Progress 
                  value={device.totalScans > 0 ? (device.successfulScans / device.totalScans) * 100 : 0}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Scans */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <i className="fas fa-history mr-2"></i>
              Recent Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentScans.map((scan, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    scan.success ? 'border-green-200 hover:bg-green-50' : 'border-red-200 hover:bg-red-50'
                  } ${selectedStudent?.id === scan.student?.id ? 'bg-blue-50 border-blue-300' : ''}`}
                  onClick={() => scan.student && setSelectedStudent(scan.student)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        scan.success ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm font-medium">
                        {scan.student?.fullName || 'Unknown Card'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(scan.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{scan.message}</p>
                </div>
              ))}
              
              {recentScans.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-credit-card text-3xl mb-2"></i>
                  <p>No recent scans</p>
                  <p className="text-sm">Scan an RFID card to see results</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Student Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStudent ? (
            <>
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <i className="fas fa-user-graduate mr-2"></i>
                      Student Information
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStudent(null)}
                    >
                      <i className="fas fa-times mr-1"></i>
                      Clear
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                        <p className="text-lg font-semibold text-gray-900">{selectedStudent.fullName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Student ID</label>
                        <p className="text-sm text-gray-700">{selectedStudent.studentId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Department</label>
                        <p className="text-sm text-gray-700">{selectedStudent.department}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Batch</label>
                        <p className="text-sm text-gray-700">{selectedStudent.batch}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-sm text-gray-700">{selectedStudent.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">RFID Card</label>
                        <p className="text-sm font-mono text-gray-700">{selectedStudent.rfidCard}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Semester</label>
                        <p className="text-sm text-gray-700">{selectedStudent.semester}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Enrollment Year</label>
                        <p className="text-sm text-gray-700">{selectedStudent.enrollmentYear}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-chart-bar mr-2"></i>
                    Attendance Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getAttendanceColor(selectedStudent.attendanceStats.attendancePercentage)}`}>
                        {selectedStudent.attendanceStats.attendancePercentage.toFixed(1)}%
                      </div>
                      <p className="text-sm text-gray-600">Overall Attendance</p>
                      <Progress 
                        value={selectedStudent.attendanceStats.attendancePercentage} 
                        className="mt-2"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedStudent.attendanceStats.attendedLectures}
                      </div>
                      <p className="text-sm text-gray-600">Attended Lectures</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedStudent.attendanceStats.totalLectures}
                      </div>
                      <p className="text-sm text-gray-600">Total Lectures</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Last Attendance: <span className="font-medium">
                        {formatDate(selectedStudent.attendanceStats.lastAttendance)}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Fee Status & Academic Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <i className="fas fa-dollar-sign mr-2"></i>
                      Fee Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status:</span>
                        <Badge className={getFeeStatusColor(selectedStudent.feeStatus.status)}>
                          {selectedStudent.feeStatus.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Fees:</span>
                          <span className="text-sm font-medium">{formatCurrency(selectedStudent.feeStatus.totalFees)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Paid Amount:</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(selectedStudent.feeStatus.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Pending:</span>
                          <span className="text-sm font-medium text-red-600">{formatCurrency(selectedStudent.feeStatus.pendingAmount)}</span>
                        </div>
                      </div>
                      <Progress 
                        value={(selectedStudent.feeStatus.paidAmount / selectedStudent.feeStatus.totalFees) * 100}
                        className="h-2"
                      />
                      <p className="text-xs text-gray-500">
                        Last Payment: {formatDate(selectedStudent.feeStatus.lastPayment)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <i className="fas fa-graduation-cap mr-2"></i>
                      Academic Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Academic Status:</span>
                        <Badge className={getAcademicStatusColor(selectedStudent.results.academicStatus)}>
                          {selectedStudent.results.academicStatus.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Current GPA:</span>
                          <span className="text-sm font-medium">{selectedStudent.results.currentSemesterGPA.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Overall GPA:</span>
                          <span className="text-sm font-medium">{selectedStudent.results.overallGPA.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Credits:</span>
                          <span className="text-sm font-medium">
                            {selectedStudent.results.completedCredits}/{selectedStudent.results.totalCredits}
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={(selectedStudent.results.completedCredits / selectedStudent.results.totalCredits) * 100}
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Current Classes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-chalkboard-teacher mr-2"></i>
                    Current Enrollments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedStudent.currentClasses.length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.currentClasses.map((classInfo, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">{classInfo.subjectName}</h4>
                              <p className="text-sm text-gray-600">Lecturer: {classInfo.lecturerName}</p>
                              <p className="text-sm text-gray-600">Schedule: {classInfo.schedule}</p>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${getAttendanceColor(classInfo.attendance)}`}>
                                {classInfo.attendance}%
                              </div>
                              <p className="text-xs text-gray-500">Attendance</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-book-open text-3xl mb-2"></i>
                      <p>No current enrollments</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-address-book mr-2"></i>
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Mobile Number</label>
                      <p className="text-sm text-gray-700">{selectedStudent.mobileNumber || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Guardian Contact</label>
                      <p className="text-sm text-gray-700">{selectedStudent.guardianContact || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                      <p className="text-sm text-gray-700">{selectedStudent.emergencyContact || 'Not provided'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-96 flex items-center justify-center">
              <CardContent className="text-center">
                <i className="fas fa-credit-card text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Ready to Scan</h3>
                <p className="text-gray-600 mb-4">
                  Present an RFID card to the scanner to view student details
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span>{isConnected ? 'Scanner Ready' : 'Scanner Offline'}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedRFIDStudentDetails;
