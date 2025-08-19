import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/ui/sidebar';
import StatsCard from '@/components/ui/stats-card';
import { useAuth } from '@/lib/auth.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentPortal() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get student data
  const { data: studentData } = useQuery({
    queryKey: ['/api/students/profile'],
    enabled: !!user?.id
  });

  // Get student attendance
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['/api/attendance/student', studentData?.id],
    enabled: !!studentData?.id
  });

  // Get exam eligibility
  const { data: examEligibility = [] } = useQuery({
    queryKey: ['/api/exam-eligibility/student', studentData?.id],
    enabled: !!studentData?.id
  });

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateOverallAttendance = () => {
    if (attendanceRecords.length === 0) return 0;
    const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
    return ((presentCount / attendanceRecords.length) * 100).toFixed(1);
  };

  const getEligibleClasses = () => {
    return examEligibility.filter(record => record.isEligible).length;
  };

  const getIneligibleClasses = () => {
    return examEligibility.filter(record => !record.isEligible).length;
  };

  return (
    <div className="flex min-h-screen bg-surface-background">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Student Portal</h2>
              <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.fullName}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{formatTime(currentTime)}</div>
                <div className="text-xs text-gray-500">{formatDate(currentTime)}</div>
              </div>
              
              <div className="relative">
                <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <i className="fas fa-user-graduate text-white text-sm"></i>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Student</span>
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
              title="Overall Attendance"
              value={`${calculateOverallAttendance()}%`}
              change="Across all classes"
              changeType={calculateOverallAttendance() >= 75 ? 'positive' : 'negative'}
              icon="fas fa-clipboard-check"
              color={calculateOverallAttendance() >= 75 ? 'green' : 'red'}
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
              changeType={getIneligibleClasses() > 0 ? 'negative' : 'positive'}
              icon="fas fa-file-alt"
              color={getIneligibleClasses() > 0 ? 'red' : 'green'}
            />
            <StatsCard
              title="Present Days"
              value={attendanceRecords.filter(r => r.status === 'present').length}
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
                    <p className="text-sm text-gray-400">Your attendance will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-primary mb-2">{calculateOverallAttendance()}%</div>
                      <p className="text-gray-600">Overall Attendance Rate</p>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${
                        calculateOverallAttendance() >= 75 
                          ? 'bg-green-100 text-secondary' 
                          : 'bg-red-100 text-destructive'
                      }`}>
                        {calculateOverallAttendance() >= 75 ? 'Good Standing' : 'Below Threshold'}
                      </div>
                    </div>
                    
                    <div className="bg-gray-100 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Present: {attendanceRecords.filter(r => r.status === 'present').length}</span>
                        <span>Absent: {attendanceRecords.filter(r => r.status === 'absent').length}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-secondary h-2 rounded-full" 
                          style={{ width: `${calculateOverallAttendance()}%` }}
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
                    <p className="text-sm text-gray-400">Eligibility will be calculated automatically</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {examEligibility.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">Class {record.classId}</p>
                          <p className="text-sm text-gray-600">{record.attendancePercentage}% attendance</p>
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.isEligible 
                              ? 'bg-green-100 text-secondary' 
                              : 'bg-red-100 text-destructive'
                          }`}>
                            {record.isEligible ? 'Eligible' : 'Ineligible'}
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
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-history text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">No attendance history</p>
                    <p className="text-sm text-gray-400">Your attendance records will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Class</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Method</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.slice(0, 10).map((record) => (
                          <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-900">
                              {new Date(record.attendanceDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900">
                              Class {record.classId}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <i className={`${record.method === 'face_recognition' ? 'fas fa-camera text-secondary' : 'fas fa-id-card text-accent'} text-sm`}></i>
                                <span className="text-sm text-gray-600">
                                  {record.method === 'face_recognition' ? 'Face Recognition' : 'RFID Card'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                record.status === 'present' 
                                  ? 'bg-green-100 text-secondary' 
                                  : 'bg-red-100 text-destructive'
                              }`}>
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
          </div>
        </main>
      </div>
    </div>
  );
}
