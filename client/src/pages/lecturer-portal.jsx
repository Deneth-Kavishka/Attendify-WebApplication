import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/ui/sidebar';
import StatsCard from '@/components/ui/stats-card';
import { useAuth } from '@/lib/auth.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LecturerPortal() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch lecturer's classes
  const { data: classes = [] } = useQuery({
    queryKey: ['/api/classes'],
    select: (data) => data.filter(cls => cls.lecturerId === user?.id)
  });

  // Fetch attendance for lecturer's classes
  const { data: attendanceStats = {} } = useQuery({
    queryKey: ['/api/stats/lecturer-dashboard'],
    enabled: !!user?.id
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

  return (
    <div className="flex min-h-screen bg-surface-background">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Lecturer Portal</h2>
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
                    <i className="fas fa-chalkboard-teacher text-white text-sm"></i>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Lecturer</span>
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
              title="My Classes"
              value={classes.length}
              change="Active this semester"
              changeType="neutral"
              icon="fas fa-door-open"
              color="blue"
            />
            <StatsCard
              title="Total Students"
              value={attendanceStats.totalStudents || 0}
              change="Across all classes"
              changeType="neutral"
              icon="fas fa-user-graduate"
              color="green"
            />
            <StatsCard
              title="Today's Attendance"
              value={`${attendanceStats.todayAttendance || 0}%`}
              change="Average across classes"
              changeType="neutral"
              icon="fas fa-clipboard-check"
              color="orange"
            />
            <StatsCard
              title="Class Sessions"
              value={attendanceStats.totalSessions || 0}
              change="This week"
              changeType="neutral"
              icon="fas fa-calendar-alt"
              color="blue"
            />
          </div>

          {/* My Classes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>My Classes</CardTitle>
              </CardHeader>
              <CardContent>
                {classes.length === 0 ? (
                  <div className="text-center py-8">
                    <i className="fas fa-door-open text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">No classes assigned</p>
                    <p className="text-sm text-gray-400">Contact admin to get classes assigned</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classes.map((classItem) => (
                      <div key={classItem.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div>
                          <h3 className="font-semibold text-gray-900">{classItem.className}</h3>
                          <p className="text-sm text-gray-600">{classItem.classCode}</p>
                          <p className="text-xs text-gray-500">Room: {classItem.room}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-secondary">
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button className="w-full flex items-center space-x-3 p-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <i className="fas fa-clipboard-check"></i>
                    <span>Mark Manual Attendance</span>
                  </button>
                  <button className="w-full flex items-center space-x-3 p-3 bg-secondary text-white rounded-lg hover:bg-green-700 transition-colors">
                    <i className="fas fa-file-alt"></i>
                    <span>View Attendance Reports</span>
                  </button>
                  <button className="w-full flex items-center space-x-3 p-3 bg-accent text-white rounded-lg hover:bg-orange-600 transition-colors">
                    <i className="fas fa-users"></i>
                    <span>View Class Roster</span>
                  </button>
                  <button className="w-full flex items-center space-x-3 p-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    <i className="fas fa-cog"></i>
                    <span>Class Settings</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <i className="fas fa-history text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">No recent activity</p>
                  <p className="text-sm text-gray-400">Class activities will appear here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
