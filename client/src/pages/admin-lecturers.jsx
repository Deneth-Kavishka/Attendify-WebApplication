import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Lecturer form validation schema
const lecturerFormSchema = z.object({
  // User information
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),

  // Lecturer specific information
  lecturerId: z.string().min(3, "Lecturer ID is required"),
  department: z.string().min(2, "Department is required"),
  specialization: z.string().optional(),

  // Additional information
  mobileNumber: z.string().optional(),
  address: z.string().optional(),
  qualifications: z.string().optional(),
  experience: z.string().optional(),
});

function LecturerForm({ lecturer, onSubmit, isLoading, onCancel }) {
  const form = useForm({
    resolver: zodResolver(lecturerFormSchema),
    defaultValues: {
      username: lecturer?.user?.username || "",
      email: lecturer?.user?.email || "",
      fullName: lecturer?.user?.fullName || "",
      password: "",
      lecturerId: lecturer?.lecturerId || "",
      department: lecturer?.user?.department || "",
      specialization: lecturer?.specialization || "",
      mobileNumber: lecturer?.mobileNumber || "",
      address: lecturer?.address || "",
      qualifications: lecturer?.qualifications || "",
      experience: lecturer?.experience || "",
    },
  });

  const handleSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="academic">Academic Info</TabsTrigger>
            <TabsTrigger value="additional">Additional Info</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="lecturer@university.edu"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {lecturer ? "New Password (optional)" : "Password *"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="academic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lecturerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lecturer ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="LEL001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Computer Science">
                            Computer Science
                          </SelectItem>
                          <SelectItem value="Software Engineering">
                            Software Engineering
                          </SelectItem>
                          <SelectItem value="Information Technology">
                            Information Technology
                          </SelectItem>
                          <SelectItem value="Data Science">
                            Data Science
                          </SelectItem>
                          <SelectItem value="Cybersecurity">
                            Cybersecurity
                          </SelectItem>
                          <SelectItem value="Engineering">
                            Engineering
                          </SelectItem>
                          <SelectItem value="Mathematics">
                            Mathematics
                          </SelectItem>
                          <SelectItem value="Physics">Physics</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                          <SelectItem value="Management">Management</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="specialization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialization</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Machine Learning, Web Development, Database Systems"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Areas of expertise and specialization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qualifications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Qualifications</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="PhD in Computer Science, University of Technology (2018)
MSc in Software Engineering, State University (2014)
BSc in Computer Science, Tech College (2012)"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Educational qualifications and certifications
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="additional" className="space-y-4">
            <FormField
              control={form.control}
              name="experience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Experience</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="5 years teaching experience in Computer Science
Previous roles: Senior Software Engineer at TechCorp (2018-2020)
Research interests: AI, Machine Learning, Educational Technology"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Teaching and professional experience
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="123 University Avenue
                      City, State 12345"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {lecturer ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <i
                  className={`fas ${lecturer ? "fa-save" : "fa-plus"} mr-2`}
                ></i>
                {lecturer ? "Update Lecturer" : "Create Lecturer"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function AdminLecturers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectedLecturer, setSelectedLecturer] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lecturerToDelete, setLecturerToDelete] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Fetch lecturers data
  const {
    data: lecturers = [],
    isLoading: lecturersLoading,
    refetch: refetchLecturers,
  } = useQuery({
    queryKey: ["/api/lecturers"],
    refetchInterval: 30000,
  });

  // Fetch classes for lecturer statistics
  const { data: classes = [] } = useQuery({
    queryKey: ["/api/classes"],
  });

  // Add new lecturer mutation
  const addLecturerMutation = useMutation({
    mutationFn: async (lecturerData) => {
      // First create the user
      const userResponse = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          username: lecturerData.username,
          email: lecturerData.email,
          fullName: lecturerData.fullName,
          password: lecturerData.password,
          role: "lecturer",
          department: lecturerData.department,
        }),
      });

      if (!userResponse.ok) {
        const error = await userResponse.json();
        throw new Error(error.message || "Failed to create user");
      }

      const user = await userResponse.json();

      // Then create the lecturer profile
      const lecturerResponse = await fetch("/api/lecturers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          userId: user.id,
          lecturerId: lecturerData.lecturerId,
          specialization: lecturerData.specialization,
          active: true,
        }),
      });

      if (!lecturerResponse.ok) {
        const error = await lecturerResponse.json();
        throw new Error(error.message || "Failed to create lecturer");
      }

      return lecturerResponse.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/lecturers"]);
      queryClient.invalidateQueries(["/api/stats/dashboard"]);
      setIsAddDialogOpen(false);
      toast({
        title: "Lecturer Added Successfully",
        description: `${
          data.user?.fullName || "Lecturer"
        } has been registered successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description:
          error.message ||
          "Failed to add lecturer. Please check all required fields.",
        variant: "destructive",
      });
    },
  });

  // Update lecturer mutation (simplified for this example)
  const updateLecturerMutation = useMutation({
    mutationFn: async ({ id, ...updateData }) => {
      const response = await fetch(`/api/lecturers/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update lecturer");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/lecturers"]);
      setIsEditDialogOpen(false);
      toast({
        title: "Lecturer Updated",
        description: "Lecturer information has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update lecturer",
        variant: "destructive",
      });
    },
  });

  // Delete lecturer mutation (simplified for this example)
  const deleteLecturerMutation = useMutation({
    mutationFn: async (lecturerId) => {
      const response = await fetch(`/api/lecturers/${lecturerId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete lecturer");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/lecturers"]);
      queryClient.invalidateQueries(["/api/stats/dashboard"]);
      setIsDeleteDialogOpen(false);
      setLecturerToDelete(null);
      toast({
        title: "Lecturer Deleted",
        description: "Lecturer has been permanently removed from the system",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete lecturer",
        variant: "destructive",
      });
    },
  });

  // Enhanced filtering and sorting
  const getFilteredAndSortedLecturers = () => {
    let filtered = lecturers.filter((lecturer) => {
      const matchesSearch =
        lecturer.user?.fullName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        lecturer.lecturerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lecturer.user?.email
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        lecturer.specialization
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && lecturer.active) ||
        (filterStatus === "inactive" && !lecturer.active);

      const matchesDepartment =
        filterDepartment === "all" ||
        lecturer.user?.department === filterDepartment;

      return matchesSearch && matchesStatus && matchesDepartment;
    });

    // Sort lecturers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.user?.fullName || "").localeCompare(b.user?.fullName || "");
        case "lecturerId":
          return (a.lecturerId || "").localeCompare(b.lecturerId || "");
        case "department":
          return (a.user?.department || "").localeCompare(
            b.user?.department || ""
          );
        case "specialization":
          return (a.specialization || "").localeCompare(b.specialization || "");
        case "recent":
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredLecturers = getFilteredAndSortedLecturers();

  // Get unique departments for filtering
  const departments = [
    ...new Set(lecturers.map((l) => l.user?.department).filter(Boolean)),
  ];

  // Handle delete confirmation
  const handleDeleteLecturer = (lecturer) => {
    setLecturerToDelete(lecturer);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (lecturerToDelete) {
      deleteLecturerMutation.mutate(lecturerToDelete.id);
    }
  };

  // Statistics calculations
  const stats = {
    total: lecturers.length,
    active: lecturers.filter((l) => l.active).length,
    inactive: lecturers.filter((l) => !l.active).length,
    withClasses: lecturers.filter((l) =>
      classes.some((c) => c.lecturerId === l.id)
    ).length,
    departments: new Set(
      lecturers.map((l) => l.user?.department).filter(Boolean)
    ).size,
  };

  if (lecturersLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="min-h-screen ml-0 lg:ml-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="min-h-screen ml-0 lg:ml-64">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Lecturer Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage lecturer profiles, departments, and assignments
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-blue-700">
                  <i className="fas fa-user-plus mr-2"></i>
                  Add New Lecturer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register New Lecturer</DialogTitle>
                  <DialogDescription>
                    Create a new lecturer profile with academic and personal
                    information
                  </DialogDescription>
                </DialogHeader>
                <LecturerForm
                  onSubmit={(data) => addLecturerMutation.mutate(data)}
                  isLoading={addLecturerMutation.isPending}
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
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-users mr-2 text-blue-600"></i>
                  Total Lecturers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total}
                </div>
                <p className="text-xs text-gray-500">Registered lecturers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-check-circle mr-2 text-green-600"></i>
                  Active Lecturers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.active}
                </div>
                <p className="text-xs text-gray-500">Currently teaching</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-chalkboard-teacher mr-2 text-purple-600"></i>
                  With Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.withClasses}
                </div>
                <p className="text-xs text-gray-500">Teaching classes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-building mr-2 text-orange-600"></i>
                  Departments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {stats.departments}
                </div>
                <p className="text-xs text-gray-500">Different departments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-times-circle mr-2 text-red-600"></i>
                  Inactive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.inactive}
                </div>
                <p className="text-xs text-gray-500">Inactive accounts</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search lecturers (name, ID, email, specialization)..."
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

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="lecturerId">Lecturer ID</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="specialization">Specialization</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lecturers Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Lecturers ({filteredLecturers.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lecturer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Specialization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classes
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
                  {filteredLecturers.map((lecturer) => {
                    const lecturerClasses = classes.filter(
                      (c) => c.lecturerId === lecturer.id
                    );

                    return (
                      <tr key={lecturer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <i className="fas fa-chalkboard-teacher text-blue-600"></i>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {lecturer.user?.fullName || "N/A"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {lecturer.lecturerId} • {lecturer.user?.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="font-medium">
                            {lecturer.user?.department || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="max-w-32 truncate">
                            {lecturer.specialization || "Not specified"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <Badge
                            variant="secondary"
                            className="bg-purple-100 text-purple-800"
                          >
                            <i className="fas fa-door-open mr-1"></i>
                            {lecturerClasses.length} classes
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              lecturer.active ? "secondary" : "destructive"
                            }
                            className={
                              lecturer.active
                                ? "bg-green-100 text-green-800"
                                : ""
                            }
                          >
                            {lecturer.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLecturer(lecturer);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <i className="fas fa-eye"></i>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLecturer(lecturer);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteLecturer(lecturer)}
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredLecturers.length === 0 && (
                <div className="text-center py-12">
                  <i className="fas fa-chalkboard-teacher text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-lg">No lecturers found</p>
                  <p className="text-gray-400 text-sm">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Lecturer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lecturer Information</DialogTitle>
            <DialogDescription>
              Update lecturer details and academic information
            </DialogDescription>
          </DialogHeader>
          {selectedLecturer && (
            <LecturerForm
              lecturer={selectedLecturer}
              onSubmit={(data) =>
                updateLecturerMutation.mutate({
                  id: selectedLecturer.id,
                  ...data,
                })
              }
              isLoading={updateLecturerMutation.isPending}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Lecturer Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Lecturer Details</DialogTitle>
          </DialogHeader>
          {selectedLecturer && (
            <div className="space-y-6">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="academic">Academic Info</TabsTrigger>
                  <TabsTrigger value="classes">Classes</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Full Name</h4>
                      <p className="text-gray-600">
                        {selectedLecturer.user?.fullName}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Email</h4>
                      <p className="text-gray-600">
                        {selectedLecturer.user?.email}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Lecturer ID</h4>
                      <p className="text-gray-600">
                        {selectedLecturer.lecturerId}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Username</h4>
                      <p className="text-gray-600">
                        {selectedLecturer.user?.username}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="academic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Department</h4>
                      <p className="text-gray-600">
                        {selectedLecturer.user?.department || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Specialization
                      </h4>
                      <p className="text-gray-600">
                        {selectedLecturer.specialization || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Status</h4>
                      <Badge
                        variant={
                          selectedLecturer.active ? "default" : "destructive"
                        }
                      >
                        {selectedLecturer.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Registration Date
                      </h4>
                      <p className="text-gray-600">
                        {selectedLecturer.createdAt
                          ? new Date(
                              selectedLecturer.createdAt
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="classes" className="space-y-4">
                  <div className="space-y-3">
                    {classes
                      .filter((c) => c.lecturerId === selectedLecturer.id)
                      .map((cls) => (
                        <Card key={cls.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {cls.className}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {cls.classCode} • Room: {cls.room}
                                </p>
                              </div>
                              <Badge variant="outline">
                                {cls.semester} {cls.academicYear}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    {classes.filter((c) => c.lecturerId === selectedLecturer.id)
                      .length === 0 && (
                      <div className="text-center py-8">
                        <i className="fas fa-door-open text-4xl text-gray-300 mb-4"></i>
                        <p className="text-gray-500">No classes assigned</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="performance" className="space-y-4">
                  <div className="text-center py-8">
                    <i className="fas fa-chart-line text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">
                      Performance analytics will be available soon
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
            <AlertDialogTitle>Delete Lecturer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{lecturerToDelete?.user?.fullName}</strong>? This action
              cannot be undone and will permanently remove the lecturer profile
              and associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteLecturerMutation.isPending}
            >
              {deleteLecturerMutation.isPending
                ? "Deleting..."
                : "Delete Lecturer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
