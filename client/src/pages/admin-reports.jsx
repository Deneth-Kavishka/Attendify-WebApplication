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
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Report Overview Statistics Component
function ReportOverviewStats() {
  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ["/api/reports/overview"],
    queryFn: async () => {
      const response = await fetch("/api/reports/overview", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch overview stats");
      return response.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const overviewCards = [
    {
      title: "Total Reports",
      value: stats.totalReports || 0,
      icon: "fas fa-file-alt",
      color: "blue",
      trend: `+${stats.reportsThisWeek || 0} this week`,
    },
    {
      title: "Attendance Rate",
      value: `${stats.overallAttendanceRate || 0}%`,
      icon: "fas fa-chart-line",
      color: "green",
      trend: stats.attendanceTrend || "No change",
    },
    {
      title: "Hardware Uptime",
      value: `${stats.hardwareUptime || 0}%`,
      icon: "fas fa-server",
      color: "purple",
      trend: `${stats.devicesOnline || 0}/${stats.totalDevices || 0} online`,
    },
    {
      title: "System Events",
      value: stats.systemEvents || 0,
      icon: "fas fa-bell",
      color: "orange",
      trend: `${stats.eventsToday || 0} today`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {overviewCards.map((card, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg bg-${card.color}-100 mr-4`}>
                <i
                  className={`${card.icon} text-${card.color}-600 text-xl`}
                ></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 truncate">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 truncate">{card.trend}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Quick Report Generator Component
function QuickReportGenerator() {
  const [reportType, setReportType] = useState("");
  const [dateRange, setDateRange] = useState("this_week");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateReportMutation = useMutation({
    mutationFn: async (reportData) => {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          type: reportData.reportType,
          dateRange: reportData.dateRange,
          format: "PDF",
          filters: {},
        }),
      });
      if (!response.ok) throw new Error("Failed to generate report");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Report Generated",
        description: `${data.type} report has been generated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/history"] });
      setGenerateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Report Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reportTypes = [
    {
      value: "attendance_summary",
      label: "Attendance Summary",
      description: "Overall attendance statistics and trends",
    },
    {
      value: "student_performance",
      label: "Student Performance",
      description: "Individual student attendance analysis",
    },
    {
      value: "class_analytics",
      label: "Class Analytics",
      description: "Class-wise attendance and participation",
    },
    {
      value: "hardware_performance",
      label: "Hardware Performance",
      description: "Device uptime and scan statistics",
    },
    {
      value: "exam_eligibility",
      label: "Exam Eligibility",
      description: "Students eligible/ineligible for exams",
    },
    {
      value: "system_activity",
      label: "System Activity",
      description: "System usage and activity logs",
    },
    {
      value: "security_audit",
      label: "Security Audit",
      description: "Security events and access logs",
    },
    {
      value: "custom_report",
      label: "Custom Report",
      description: "Build a custom report with specific parameters",
    },
  ];

  const dateRanges = [
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "last_week", label: "Last Week" },
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "last_30_days", label: "Last 30 Days" },
    { value: "last_90_days", label: "Last 90 Days" },
    { value: "custom", label: "Custom Range" },
  ];

  const handleQuickGenerate = (type) => {
    generateReportMutation.mutate({
      reportType: type,
      dateRange: "this_week",
      quickGenerate: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-magic mr-2 text-blue-600"></i>
          Quick Report Generator
        </CardTitle>
        <CardDescription>
          Generate comprehensive reports with real-time hardware integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Quick Action Buttons */}
          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-center space-y-2"
            onClick={() => handleQuickGenerate("attendance_summary")}
            disabled={generateReportMutation.isPending}
          >
            <i className="fas fa-clipboard-check text-2xl text-blue-600"></i>
            <span className="text-sm font-medium">Attendance Summary</span>
            <span className="text-xs text-gray-500 text-center">
              This week's attendance overview
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-center space-y-2"
            onClick={() => handleQuickGenerate("hardware_performance")}
            disabled={generateReportMutation.isPending}
          >
            <i className="fas fa-microchip text-2xl text-green-600"></i>
            <span className="text-sm font-medium">Hardware Status</span>
            <span className="text-xs text-gray-500 text-center">
              ESP32-CAM & RFID performance
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-center space-y-2"
            onClick={() => handleQuickGenerate("exam_eligibility")}
            disabled={generateReportMutation.isPending}
          >
            <i className="fas fa-graduation-cap text-2xl text-purple-600"></i>
            <span className="text-sm font-medium">Exam Eligibility</span>
            <span className="text-xs text-gray-500 text-center">
              75% threshold analysis
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-center space-y-2"
            onClick={() => setGenerateDialogOpen(true)}
          >
            <i className="fas fa-cogs text-2xl text-orange-600"></i>
            <span className="text-sm font-medium">Custom Report</span>
            <span className="text-xs text-gray-500 text-center">
              Build custom report
            </span>
          </Button>
        </div>

        {/* Advanced Report Generator Dialog */}
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Generate Custom Report</DialogTitle>
              <DialogDescription>
                Create a detailed report with specific parameters and filters
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-gray-500">
                            {type.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dateRange">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRanges.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setGenerateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    generateReportMutation.mutate({
                      reportType: reportType,
                      dateRange: dateRange,
                    })
                  }
                  disabled={generateReportMutation.isPending || !reportType}
                >
                  {generateReportMutation.isPending
                    ? "Generating..."
                    : "Generate Report"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Reports History Component
function ReportsHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedReports, setSelectedReports] = useState([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: reports = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/reports/history"],
    queryFn: async () => {
      const response = await fetch("/api/reports/history", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
    refetchInterval: 10000,
  });

  const downloadReportMutation = useMutation({
    mutationFn: async (reportId) => {
      const response = await fetch(`/api/reports/${reportId}/download`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to download report");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Download Started",
        description: "Your report download has been initiated.",
      });
      // In a real app, this would trigger the actual file download
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId) => {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete report");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Deleted",
        description: "Report has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/history"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === "all" || report.type === filterType;

    return matchesSearch && matchesFilter;
  });

  const handleSelectReport = (reportId, checked) => {
    if (checked) {
      setSelectedReports([...selectedReports, reportId]);
    } else {
      setSelectedReports(selectedReports.filter((id) => id !== reportId));
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: {
        color: "bg-green-100 text-green-800 border-green-300",
        icon: "fas fa-check",
      },
      generating: {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: "fas fa-spinner fa-spin",
      },
      failed: {
        color: "bg-red-100 text-red-800 border-red-300",
        icon: "fas fa-times",
      },
      scheduled: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: "fas fa-clock",
      },
    };

    const config = statusConfig[status] || statusConfig.completed;

    return (
      <Badge variant="outline" className={config.color}>
        <i className={`${config.icon} mr-1`}></i>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center">
              <i className="fas fa-history mr-2 text-purple-600"></i>
              Reports History
            </CardTitle>
            <CardDescription>
              {filteredReports.length} reports • Recent activity and downloads
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <i className="fas fa-sync-alt mr-2"></i>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search reports by title or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="attendance_summary">
                Attendance Summary
              </SelectItem>
              <SelectItem value="hardware_performance">
                Hardware Performance
              </SelectItem>
              <SelectItem value="exam_eligibility">Exam Eligibility</SelectItem>
              <SelectItem value="system_activity">System Activity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
            <p className="text-gray-500">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-file-alt text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-500 text-lg mb-2">No reports found</p>
            <p className="text-gray-400 mb-4">
              Generate your first report to get started with analytics
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {report.title}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {report.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {report.type
                          ?.replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>
                          {format(new Date(report.generatedAt), "MMM dd, yyyy")}
                        </div>
                        <div className="text-gray-500">
                          {format(new Date(report.generatedAt), "HH:mm")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {report.size || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadReportMutation.mutate(report.id)
                          }
                          disabled={
                            downloadReportMutation.isPending ||
                            report.status !== "completed"
                          }
                        >
                          <i className="fas fa-download"></i>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // View report functionality
                            window.open(
                              `/api/reports/${report.id}/view`,
                              "_blank"
                            );
                          }}
                          disabled={report.status !== "completed"}
                        >
                          <i className="fas fa-eye"></i>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to delete this report?"
                              )
                            ) {
                              deleteReportMutation.mutate(report.id);
                            }
                          }}
                          disabled={deleteReportMutation.isPending}
                        >
                          <i className="fas fa-trash text-red-600"></i>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main Admin Reports Component
export default function AdminReports() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

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
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Reports & Analytics
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Comprehensive reporting with real-time hardware integration
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800"
                  >
                    <i className="fas fa-check mr-1"></i>
                    All Systems Online
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 lg:p-6 max-w-full">
            {/* Statistics Overview */}
            <ReportOverviewStats />

            {/* Quick Report Generator */}
            <div className="mb-6">
              <QuickReportGenerator />
            </div>

            {/* Reports History */}
            <ReportsHistory />
          </div>
        </div>
      </div>
    </div>
  );
}
