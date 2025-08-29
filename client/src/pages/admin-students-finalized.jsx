import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/ui/sidebar";
import EnhancedStudentForm from "@/components/ui/enhanced-student-form";
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
import { useToast } from "@/hooks/use-toast";

export default function AdminStudents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterBatch, setFilterBatch] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Fetch students data
  const {
    data: students = [],
    isLoading: studentsLoading,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ["/api/students"],
    refetchInterval: 30000,
  });

  // Add new student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (studentData) => {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(studentData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add student");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/students"]);
      queryClient.invalidateQueries(["/api/stats/dashboard"]);
      setIsAddDialogOpen(false);
      toast({
        title: "Student Added Successfully",
        description: `${data.fullName} has been registered with ${
          data.faceImagesData ? "face recognition training" : "basic info"
        }${data.rfidCard ? " and RFID card" : ""}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description:
          error.message ||
          "Failed to add student. Please check all required fields.",
        variant: "destructive",
      });
    },
  });

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, ...updateData }) => {
      const response = await fetch(`/api/students/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update student");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/students"]);
      setIsEditDialogOpen(false);
      toast({
        title: "Student Updated",
        description: "Student information has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update student",
        variant: "destructive",
      });
    },
  });

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId) => {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete student");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/students"]);
      queryClient.invalidateQueries(["/api/stats/dashboard"]);
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
      toast({
        title: "Student Deleted",
        description: "Student has been permanently removed from the system",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete student",
        variant: "destructive",
      });
    },
  });

  // Enhanced filtering and sorting
  const getFilteredAndSortedStudents = () => {
    let filtered = students.filter((student) => {
      const matchesSearch =
        student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.nic?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && student.active) ||
        (filterStatus === "inactive" && !student.active) ||
        (filterStatus === "face_enrolled" &&
          student.faceRegistrationStatus === "completed") ||
        (filterStatus === "rfid_enrolled" && student.rfidCard);

      const matchesDepartment =
        filterDepartment === "all" || student.department === filterDepartment;

      const matchesBatch =
        filterBatch === "all" || student.batch === filterBatch;

      return (
        matchesSearch && matchesStatus && matchesDepartment && matchesBatch
      );
    });

    // Sort students
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.fullName || "").localeCompare(b.fullName || "");
        case "studentId":
          return (a.studentId || "").localeCompare(b.studentId || "");
        case "department":
          return (a.department || "").localeCompare(b.department || "");
        case "batch":
          return (a.batch || "").localeCompare(b.batch || "");
        case "recent":
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredStudents = getFilteredAndSortedStudents();

  // Get unique departments and batches for filtering
  const departments = [
    ...new Set(students.map((s) => s.department).filter(Boolean)),
  ];
  const batches = [...new Set(students.map((s) => s.batch).filter(Boolean))];

  // Handle delete confirmation
  const handleDeleteStudent = (student) => {
    setStudentToDelete(student);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate(studentToDelete.id);
    }
  };

  // Statistics calculations
  const stats = {
    total: students.length,
    active: students.filter((s) => s.active).length,
    inactive: students.filter((s) => !s.active).length,
    faceEnrolled: students.filter(
      (s) => s.faceRegistrationStatus === "completed"
    ).length,
    rfidEnrolled: students.filter((s) => s.rfidCard).length,
  };

  if (studentsLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Student Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage student registrations, RFID cards, and face recognition
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-blue-700">
                  <i className="fas fa-user-plus mr-2"></i>
                  Add New Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register New Student</DialogTitle>
                  <DialogDescription>
                    Complete student registration with personal details, RFID
                    card, and face recognition training
                  </DialogDescription>
                </DialogHeader>
                <EnhancedStudentForm
                  onSubmit={(data) => addStudentMutation.mutate(data)}
                  isLoading={addStudentMutation.isPending}
                  onCancel={() => setIsAddDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total}
                </div>
                <p className="text-xs text-gray-500">Registered students</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Active Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.active}
                </div>
                <p className="text-xs text-gray-500">Currently active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Face Enrolled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.faceEnrolled}
                </div>
                <p className="text-xs text-gray-500">Face recognition ready</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  RFID Enrolled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {stats.rfidEnrolled}
                </div>
                <p className="text-xs text-gray-500">With RFID cards</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Inactive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.inactive}
                </div>
                <p className="text-xs text-gray-500">Deactivated accounts</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search students (name, ID, email, NIC)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="face_enrolled">Face Enrolled</SelectItem>
                  <SelectItem value="rfid_enrolled">RFID Enrolled</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterDepartment}
                onValueChange={setFilterDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterBatch} onValueChange={setFilterBatch}>
                <SelectTrigger>
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch} value={batch}>
                      {batch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="studentId">Student ID</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="batch">Batch</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Students ({filteredStudents.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Academic Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RFID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Face Recognition
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <i className="fas fa-user text-gray-600"></i>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {student.fullName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {student.studentId} • {student.email}
                            </div>
                            {student.nic && (
                              <div className="text-xs text-gray-400">
                                NIC: {student.nic}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">
                            {student.department || "N/A"}
                          </div>
                          <div className="text-gray-500">
                            {student.batch && `Batch: ${student.batch}`}
                            {student.semester && ` • Sem: ${student.semester}`}
                          </div>
                          {student.gpa && (
                            <div className="text-xs text-gray-400">
                              GPA: {student.gpa}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.rfidCard ? (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800"
                          >
                            <i className="fas fa-credit-card mr-1"></i>
                            {student.rfidCard}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            <i className="fas fa-times mr-1"></i>
                            No RFID
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.faceRegistrationStatus === "completed" ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800"
                          >
                            <i className="fas fa-check mr-1"></i>
                            Enrolled
                          </Badge>
                        ) : student.faceRegistrationStatus === "pending" ? (
                          <Badge
                            variant="secondary"
                            className="bg-yellow-100 text-yellow-800"
                          >
                            <i className="fas fa-clock mr-1"></i>
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            <i className="fas fa-times mr-1"></i>
                            Not Enrolled
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={student.active ? "secondary" : "destructive"}
                          className={
                            student.active ? "bg-green-100 text-green-800" : ""
                          }
                        >
                          {student.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <i className="fas fa-eye"></i>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteStudent(student)}
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredStudents.length === 0 && (
                <div className="text-center py-12">
                  <i className="fas fa-users text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-lg">No students found</p>
                  <p className="text-gray-400 text-sm">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
            <DialogDescription>
              Update student details, RFID card, and face recognition data
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <EnhancedStudentForm
              student={selectedStudent}
              onSubmit={(data) =>
                updateStudentMutation.mutate({
                  id: selectedStudent.id,
                  ...data,
                })
              }
              isLoading={updateStudentMutation.isPending}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Student Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="academic">Academic Info</TabsTrigger>
                  <TabsTrigger value="technical">Technical Info</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Full Name</h4>
                      <p className="text-gray-600">
                        {selectedStudent.fullName}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Email</h4>
                      <p className="text-gray-600">{selectedStudent.email}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Student ID</h4>
                      <p className="text-gray-600">
                        {selectedStudent.studentId}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">NIC</h4>
                      <p className="text-gray-600">
                        {selectedStudent.nic || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Mobile Number
                      </h4>
                      <p className="text-gray-600">
                        {selectedStudent.mobileNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Gender</h4>
                      <p className="text-gray-600">
                        {selectedStudent.gender || "N/A"}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="academic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Department</h4>
                      <p className="text-gray-600">
                        {selectedStudent.department || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Batch</h4>
                      <p className="text-gray-600">
                        {selectedStudent.batch || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Semester</h4>
                      <p className="text-gray-600">
                        {selectedStudent.semester || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">GPA</h4>
                      <p className="text-gray-600">
                        {selectedStudent.gpa || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Enrollment Year
                      </h4>
                      <p className="text-gray-600">
                        {selectedStudent.enrollmentYear}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">RFID Card</h4>
                      <p className="text-gray-600">
                        {selectedStudent.rfidCard || "Not Assigned"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Face Recognition Status
                      </h4>
                      <Badge
                        variant={
                          selectedStudent.faceRegistrationStatus === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {selectedStudent.faceRegistrationStatus ||
                          "Not Enrolled"}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Account Status
                      </h4>
                      <Badge
                        variant={
                          selectedStudent.active ? "default" : "destructive"
                        }
                      >
                        {selectedStudent.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Registration Date
                      </h4>
                      <p className="text-gray-600">
                        {selectedStudent.createdAt
                          ? new Date(
                              selectedStudent.createdAt
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="attendance" className="space-y-4">
                  <div className="text-center py-8">
                    <i className="fas fa-chart-line text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">
                      Attendance tracking will be available soon
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{studentToDelete?.fullName}</strong>? This action cannot
              be undone and will permanently remove all student data including
              attendance records, RFID assignments, and face recognition data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteStudentMutation.isPending}
            >
              {deleteStudentMutation.isPending
                ? "Deleting..."
                : "Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
