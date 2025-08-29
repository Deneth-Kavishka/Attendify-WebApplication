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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schedule schema for class timing
const scheduleSchema = z.object({
  day: z.string().min(1, "Day is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  duration: z.number().min(1, "Duration must be at least 1 hour"),
});

// Class form validation schema
const classFormSchema = z.object({
  classCode: z.string().min(3, "Class code must be at least 3 characters"),
  className: z.string().min(3, "Class name must be at least 3 characters"),
  lecturerId: z.string().min(1, "Lecturer must be selected"),
  room: z.string().min(1, "Room is required"),
  semester: z.string().min(1, "Semester is required"),
  academicYear: z.string().min(4, "Academic year is required"),
  minAttendancePercentage: z.number().min(1).max(100),
  schedule: z
    .array(scheduleSchema)
    .min(1, "At least one schedule entry is required"),

  // Hardware integration
  assignedDevices: z.array(z.string()).optional(),
  enableFaceRecognition: z.boolean().default(false),
  enableRFIDAttendance: z.boolean().default(false),
  autoMarkAttendance: z.boolean().default(true),

  // Additional settings
  description: z.string().optional(),
  capacity: z.number().min(1).optional(),
  prerequisites: z.string().optional(),
  active: z.boolean().default(true),
});

// Days of the week
const daysOfWeek = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

// Time slots (in 24-hour format)
const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
];

function ScheduleManager({ schedule, onChange }) {
  const [scheduleEntries, setScheduleEntries] = useState(schedule || []);

  const addScheduleEntry = () => {
    const newEntry = {
      day: "",
      startTime: "",
      endTime: "",
      duration: 1,
    };
    const updated = [...scheduleEntries, newEntry];
    setScheduleEntries(updated);
    onChange(updated);
  };

  const updateScheduleEntry = (index, field, value) => {
    const updated = scheduleEntries.map((entry, i) => {
      if (i === index) {
        const updatedEntry = { ...entry, [field]: value };

        // Auto-calculate duration when times change
        if (field === "startTime" || field === "endTime") {
          if (updatedEntry.startTime && updatedEntry.endTime) {
            const start = new Date(`2000-01-01 ${updatedEntry.startTime}`);
            const end = new Date(`2000-01-01 ${updatedEntry.endTime}`);
            const diffHours = (end - start) / (1000 * 60 * 60);
            updatedEntry.duration = Math.max(0.5, diffHours);
          }
        }

        return updatedEntry;
      }
      return entry;
    });
    setScheduleEntries(updated);
    onChange(updated);
  };

  const removeScheduleEntry = (index) => {
    const updated = scheduleEntries.filter((_, i) => i !== index);
    setScheduleEntries(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-gray-900">Class Schedule</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addScheduleEntry}
        >
          <i className="fas fa-plus mr-2"></i>
          Add Schedule
        </Button>
      </div>

      {scheduleEntries.map((entry, index) => (
        <Card key={index} className="p-4">
          <div className="grid grid-cols-5 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700">Day</label>
              <Select
                value={entry.day}
                onValueChange={(value) =>
                  updateScheduleEntry(index, "day", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Start Time
              </label>
              <Select
                value={entry.startTime}
                onValueChange={(value) =>
                  updateScheduleEntry(index, "startTime", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                End Time
              </label>
              <Select
                value={entry.endTime}
                onValueChange={(value) =>
                  updateScheduleEntry(index, "endTime", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Duration (hrs)
              </label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="8"
                value={entry.duration}
                onChange={(e) =>
                  updateScheduleEntry(
                    index,
                    "duration",
                    parseFloat(e.target.value)
                  )
                }
                className="w-full"
              />
            </div>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeScheduleEntry(index)}
            >
              <i className="fas fa-trash"></i>
            </Button>
          </div>
        </Card>
      ))}

      {scheduleEntries.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <i className="fas fa-calendar-alt text-2xl text-gray-400 mb-2"></i>
          <p className="text-gray-500">No schedule entries yet</p>
          <p className="text-sm text-gray-400">
            Click "Add Schedule" to create class timings
          </p>
        </div>
      )}
    </div>
  );
}

function HardwareDeviceSelector({ selectedDevices, onChange, devices = [] }) {
  const availableDevices = devices.filter(
    (device) => device.status === "online"
  );

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Assign Hardware Devices</h4>

      {availableDevices.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
          <i className="fas fa-microchip text-2xl text-gray-400 mb-2"></i>
          <p className="text-gray-500">No online devices available</p>
          <p className="text-sm text-gray-400">
            Check hardware status in the Hardware section
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {availableDevices.map((device) => (
          <div
            key={device.id}
            className="flex items-center space-x-3 p-3 border rounded-lg"
          >
            <Checkbox
              id={device.id}
              checked={selectedDevices.includes(device.id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selectedDevices, device.id]);
                } else {
                  onChange(selectedDevices.filter((id) => id !== device.id));
                }
              }}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <i
                  className={`fas ${
                    device.deviceType === "esp32_cam"
                      ? "fa-camera"
                      : "fa-credit-card"
                  } text-blue-600`}
                ></i>
                <span className="font-medium">{device.deviceId}</span>
                <Badge variant="outline" className="text-xs">
                  {device.deviceType === "esp32_cam"
                    ? "Face Recognition"
                    : "RFID Reader"}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{device.location}</p>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-green-600">Online</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassForm({ classData, onSubmit, isLoading, onCancel }) {
  const { data: lecturers = [] } = useQuery({ queryKey: ["/api/lecturers"] });
  const { data: devices = [] } = useQuery({ queryKey: ["/api/hardware"] });

  const form = useForm({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      classCode: classData?.classCode || "",
      className: classData?.className || "",
      lecturerId: classData?.lecturerId || "",
      room: classData?.room || "",
      semester: classData?.semester || "",
      academicYear:
        classData?.academicYear || new Date().getFullYear().toString(),
      minAttendancePercentage: classData?.minAttendancePercentage || 75,
      schedule: classData?.schedule || [],
      assignedDevices: classData?.assignedDevices || [],
      enableFaceRecognition: classData?.enableFaceRecognition || false,
      enableRFIDAttendance: classData?.enableRFIDAttendance || false,
      autoMarkAttendance: classData?.autoMarkAttendance || true,
      description: classData?.description || "",
      capacity: classData?.capacity || null,
      prerequisites: classData?.prerequisites || "",
      active: classData?.active !== undefined ? classData.active : true,
    },
  });

  const handleSubmit = (data) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="classCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="CS101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="className"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Introduction to Computer Science"
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
                name="lecturerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lecturer *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select lecturer" />
                        </SelectTrigger>
                        <SelectContent>
                          {lecturers.map((lecturer) => (
                            <SelectItem key={lecturer.id} value={lecturer.id}>
                              {lecturer.user?.fullName} ({lecturer.lecturerId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="room"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room *</FormLabel>
                    <FormControl>
                      <Input placeholder="Room 101, Building A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semester *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Semester 1</SelectItem>
                          <SelectItem value="2">Semester 2</SelectItem>
                          <SelectItem value="3">Semester 3</SelectItem>
                          <SelectItem value="4">Semester 4</SelectItem>
                          <SelectItem value="5">Semester 5</SelectItem>
                          <SelectItem value="6">Semester 6</SelectItem>
                          <SelectItem value="7">Semester 7</SelectItem>
                          <SelectItem value="8">Semester 8</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="academicYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year *</FormLabel>
                    <FormControl>
                      <Input placeholder="2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="50"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Course description and objectives..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prerequisites"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prerequisites</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Required courses or knowledge before taking this class..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <FormField
              control={form.control}
              name="schedule"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ScheduleManager
                      schedule={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="hardware" className="space-y-4">
            <div className="grid grid-cols-1 gap-6">
              <FormField
                control={form.control}
                name="assignedDevices"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <HardwareDeviceSelector
                        selectedDevices={field.value}
                        onChange={field.onChange}
                        devices={devices}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-gray-900">
                  Attendance Methods
                </h4>

                <FormField
                  control={form.control}
                  name="enableFaceRecognition"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center">
                          <i className="fas fa-camera mr-2 text-blue-600"></i>
                          Face Recognition
                        </FormLabel>
                        <FormDescription>
                          Enable automatic attendance marking using ESP32-CAM
                          devices
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableRFIDAttendance"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center">
                          <i className="fas fa-credit-card mr-2 text-green-600"></i>
                          RFID Attendance
                        </FormLabel>
                        <FormDescription>
                          Enable RFID card-based attendance marking
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoMarkAttendance"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center">
                          <i className="fas fa-clock mr-2 text-purple-600"></i>
                          Auto Mark Attendance
                        </FormLabel>
                        <FormDescription>
                          Automatically mark attendance during scheduled class
                          times
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minAttendancePercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Attendance Percentage</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value))
                          }
                          className="w-20"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Required attendance percentage for exam eligibility
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable or disable this class
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
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
                {classData ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <i
                  className={`fas ${classData ? "fa-save" : "fa-plus"} mr-2`}
                ></i>
                {classData ? "Update Class" : "Create Class"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function AdminClasses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [filterLecturer, setFilterLecturer] = useState("all");
  const [sortBy, setSortBy] = useState("classCode");
  const [selectedClass, setSelectedClass] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Check if we should open create dialog from URL parameter
  useEffect(() => {
    if (location.includes("?create=true")) {
      setIsAddDialogOpen(true);
      // Remove the parameter from URL without page reload
      setLocation("/admin/classes");
    }
  }, [location, setLocation]);

  // Fetch classes data
  const {
    data: classes = [],
    isLoading: classesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ["/api/classes"],
    refetchInterval: 30000,
  });

  // Fetch lecturers for statistics
  const { data: lecturers = [] } = useQuery({
    queryKey: ["/api/lecturers"],
  });

  // Fetch hardware devices
  const { data: devices = [] } = useQuery({
    queryKey: ["/api/hardware"],
  });

  // Fetch students for enrollment statistics
  const { data: students = [] } = useQuery({
    queryKey: ["/api/students"],
  });

  // Add new class mutation
  const addClassMutation = useMutation({
    mutationFn: async (classData) => {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(classData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create class");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["/api/classes"]);
      queryClient.invalidateQueries(["/api/stats/dashboard"]);
      setIsAddDialogOpen(false);
      toast({
        title: "Class Created Successfully",
        description: `${data.className} has been created with code ${data.classCode}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description:
          error.message ||
          "Failed to create class. Please check all required fields.",
        variant: "destructive",
      });
    },
  });

  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async ({ id, ...updateData }) => {
      const response = await fetch(`/api/classes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update class");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/classes"]);
      setIsEditDialogOpen(false);
      toast({
        title: "Class Updated",
        description: "Class information has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update class",
        variant: "destructive",
      });
    },
  });

  // Delete class mutation
  const deleteClassMutation = useMutation({
    mutationFn: async (classId) => {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete class");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/classes"]);
      queryClient.invalidateQueries(["/api/stats/dashboard"]);
      setIsDeleteDialogOpen(false);
      setClassToDelete(null);
      toast({
        title: "Class Deleted",
        description: "Class has been permanently removed from the system",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete class",
        variant: "destructive",
      });
    },
  });

  // Enhanced filtering and sorting
  const getFilteredAndSortedClasses = () => {
    let filtered = classes.filter((classItem) => {
      const matchesSearch =
        classItem.className?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        classItem.classCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        classItem.room?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && classItem.active) ||
        (filterStatus === "inactive" && !classItem.active);

      const matchesSemester =
        filterSemester === "all" || classItem.semester === filterSemester;

      const matchesLecturer =
        filterLecturer === "all" || classItem.lecturerId === filterLecturer;

      return (
        matchesSearch && matchesStatus && matchesSemester && matchesLecturer
      );
    });

    // Sort classes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "classCode":
          return (a.classCode || "").localeCompare(b.classCode || "");
        case "className":
          return (a.className || "").localeCompare(b.className || "");
        case "semester":
          return (a.semester || "").localeCompare(b.semester || "");
        case "room":
          return (a.room || "").localeCompare(b.room || "");
        case "recent":
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredClasses = getFilteredAndSortedClasses();

  // Get unique semesters for filtering
  const semesters = [
    ...new Set(classes.map((c) => c.semester).filter(Boolean)),
  ];

  // Handle delete confirmation
  const handleDeleteClass = (classItem) => {
    setClassToDelete(classItem);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (classToDelete) {
      deleteClassMutation.mutate(classToDelete.id);
    }
  };

  // Statistics calculations
  const stats = {
    total: classes.length,
    active: classes.filter((c) => c.active).length,
    inactive: classes.filter((c) => !c.active).length,
    withDevices: classes.filter(
      (c) => c.assignedDevices && c.assignedDevices.length > 0
    ).length,
    onlineDevices: devices.filter((d) => d.status === "online").length,
  };

  if (classesLoading) {
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
                Class Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage classes, schedules, and hardware device assignments
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-blue-700">
                  <i className="fas fa-plus mr-2"></i>
                  Add New Class
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Class</DialogTitle>
                  <DialogDescription>
                    Set up a new class with schedule, hardware devices, and
                    attendance settings
                  </DialogDescription>
                </DialogHeader>
                <ClassForm
                  onSubmit={(data) => addClassMutation.mutate(data)}
                  isLoading={addClassMutation.isPending}
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
                  <i className="fas fa-door-open mr-2 text-blue-600"></i>
                  Total Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total}
                </div>
                <p className="text-xs text-gray-500">Registered classes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-check-circle mr-2 text-green-600"></i>
                  Active Classes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.active}
                </div>
                <p className="text-xs text-gray-500">Currently running</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-microchip mr-2 text-purple-600"></i>
                  With Devices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.withDevices}
                </div>
                <p className="text-xs text-gray-500">Hardware enabled</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
                  <i className="fas fa-wifi mr-2 text-orange-600"></i>
                  Online Devices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {stats.onlineDevices}
                </div>
                <p className="text-xs text-gray-500">Available devices</p>
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
                <p className="text-xs text-gray-500">Disabled classes</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search classes (name, code, room)..."
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

              <Select value={filterSemester} onValueChange={setFilterSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {semesters.map((semester) => (
                    <SelectItem key={semester} value={semester}>
                      Semester {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLecturer} onValueChange={setFilterLecturer}>
                <SelectTrigger>
                  <SelectValue placeholder="Lecturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lecturers</SelectItem>
                  {lecturers.map((lecturer) => (
                    <SelectItem key={lecturer.id} value={lecturer.id}>
                      {lecturer.user?.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classCode">Class Code</SelectItem>
                  <SelectItem value="className">Class Name</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="room">Room</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Classes Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Classes ({filteredClasses.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lecturer & Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hardware
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
                  {filteredClasses.map((classItem) => {
                    const lecturer = lecturers.find(
                      (l) => l.id === classItem.lecturerId
                    );
                    const assignedDeviceCount =
                      classItem.assignedDevices?.length || 0;

                    return (
                      <tr key={classItem.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <i className="fas fa-door-open text-blue-600"></i>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {classItem.className}
                              </div>
                              <div className="text-sm text-gray-500">
                                {classItem.classCode} • Semester{" "}
                                {classItem.semester}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">
                              {lecturer?.user?.fullName || "N/A"}
                            </div>
                            <div className="text-gray-500">
                              {classItem.room}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            {classItem.schedule ? (
                              <>
                                <div className="text-xs">
                                  Days:{" "}
                                  {Array.isArray(classItem.schedule.days)
                                    ? classItem.schedule.days.join(", ")
                                    : classItem.schedule.days || "N/A"}
                                </div>
                                <div className="text-xs">
                                  Time: {classItem.schedule.time || "N/A"}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-gray-500">
                                No schedule set
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="secondary"
                              className="bg-purple-100 text-purple-800"
                            >
                              <i className="fas fa-microchip mr-1"></i>
                              {assignedDeviceCount} devices
                            </Badge>
                            {classItem.enableFaceRecognition && (
                              <Badge
                                variant="outline"
                                className="text-blue-600 border-blue-200"
                              >
                                <i className="fas fa-camera"></i>
                              </Badge>
                            )}
                            {classItem.enableRFIDAttendance && (
                              <Badge
                                variant="outline"
                                className="text-green-600 border-green-200"
                              >
                                <i className="fas fa-credit-card"></i>
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              classItem.active ? "secondary" : "destructive"
                            }
                            className={
                              classItem.active
                                ? "bg-green-100 text-green-800"
                                : ""
                            }
                          >
                            {classItem.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedClass(classItem);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <i className="fas fa-eye"></i>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedClass(classItem);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClass(classItem)}
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

              {filteredClasses.length === 0 && (
                <div className="text-center py-12">
                  <i className="fas fa-door-open text-4xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500 text-lg">No classes found</p>
                  <p className="text-gray-400 text-sm">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Class Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Class Information</DialogTitle>
            <DialogDescription>
              Update class details, schedule, and hardware assignments
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <ClassForm
              classData={selectedClass}
              onSubmit={(data) =>
                updateClassMutation.mutate({ id: selectedClass.id, ...data })
              }
              isLoading={updateClassMutation.isPending}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Class Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Class Details</DialogTitle>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="hardware">Hardware</TabsTrigger>
                  <TabsTrigger value="students">Students</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Class Name</h4>
                      <p className="text-gray-600">{selectedClass.className}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Class Code</h4>
                      <p className="text-gray-600">{selectedClass.classCode}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Lecturer</h4>
                      <p className="text-gray-600">
                        {lecturers.find(
                          (l) => l.id === selectedClass.lecturerId
                        )?.user?.fullName || "N/A"}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Room</h4>
                      <p className="text-gray-600">{selectedClass.room}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Semester</h4>
                      <p className="text-gray-600">
                        Semester {selectedClass.semester}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Academic Year
                      </h4>
                      <p className="text-gray-600">
                        {selectedClass.academicYear}
                      </p>
                    </div>
                  </div>
                  {selectedClass.description && (
                    <div>
                      <h4 className="font-medium text-gray-900">Description</h4>
                      <p className="text-gray-600">
                        {selectedClass.description}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="schedule" className="space-y-4">
                  <div className="space-y-3">
                    {selectedClass.schedule ? (
                      <Card>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                Class Schedule
                              </h4>
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center space-x-2">
                                  <i className="fas fa-calendar-alt text-primary"></i>
                                  <span className="text-sm text-gray-900">
                                    Days:{" "}
                                    {Array.isArray(selectedClass.schedule.days)
                                      ? selectedClass.schedule.days.join(", ")
                                      : selectedClass.schedule.days || "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <i className="fas fa-clock text-primary"></i>
                                  <span className="text-sm text-gray-900">
                                    Time: {selectedClass.schedule.time || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center py-8">
                            <i className="fas fa-calendar-times text-4xl text-gray-300 mb-4"></i>
                            <p className="text-gray-500">
                              No schedule configured
                            </p>
                            <p className="text-sm text-gray-400">
                              Schedule will be displayed here once configured
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="hardware" className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-camera text-blue-600"></i>
                        <span className="text-sm">Face Recognition:</span>
                        <Badge
                          variant={
                            selectedClass.enableFaceRecognition
                              ? "default"
                              : "secondary"
                          }
                        >
                          {selectedClass.enableFaceRecognition
                            ? "Enabled"
                            : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-credit-card text-green-600"></i>
                        <span className="text-sm">RFID Attendance:</span>
                        <Badge
                          variant={
                            selectedClass.enableRFIDAttendance
                              ? "default"
                              : "secondary"
                          }
                        >
                          {selectedClass.enableRFIDAttendance
                            ? "Enabled"
                            : "Disabled"}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">
                        Assigned Devices
                      </h4>
                      <div className="space-y-2">
                        {devices
                          .filter((d) =>
                            selectedClass.assignedDevices?.includes(d.id)
                          )
                          .map((device) => (
                            <div
                              key={device.id}
                              className="flex items-center justify-between p-3 border rounded"
                            >
                              <div className="flex items-center space-x-3">
                                <i
                                  className={`fas ${
                                    device.deviceType === "esp32_cam"
                                      ? "fa-camera"
                                      : "fa-credit-card"
                                  } text-blue-600`}
                                ></i>
                                <div>
                                  <p className="font-medium">
                                    {device.deviceId}
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
                          ))}
                        {(!selectedClass.assignedDevices ||
                          selectedClass.assignedDevices.length === 0) && (
                          <p className="text-gray-500 text-center py-4">
                            No devices assigned
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="students" className="space-y-4">
                  <div className="text-center py-8">
                    <i className="fas fa-users text-4xl text-gray-300 mb-4"></i>
                    <p className="text-gray-500">
                      Student enrollment management coming soon
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
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{classToDelete?.className}</strong> (
              {classToDelete?.classCode})? This action cannot be undone and will
              permanently remove the class and all associated data including
              attendance records and device assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteClassMutation.isPending}
            >
              {deleteClassMutation.isPending ? "Deleting..." : "Delete Class"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
