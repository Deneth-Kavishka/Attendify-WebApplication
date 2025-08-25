import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function ClassCreationForm({ onSuccess, onCancel }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lecturers = [] } = useQuery({ queryKey: ["/api/lecturers"] });
  const { data: devices = [] } = useQuery({ queryKey: ["/api/hardware"] });

  const form = useForm({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      classCode: "",
      className: "",
      lecturerId: "",
      room: "",
      semester: "",
      academicYear: new Date().getFullYear().toString(),
      minAttendancePercentage: 75,
      schedule: [],
      assignedDevices: [],
      enableFaceRecognition: false,
      enableRFIDAttendance: false,
      autoMarkAttendance: true,
      description: "",
      capacity: null,
      prerequisites: "",
      active: true,
    },
  });

  // Add new class mutation
  const addClassMutation = useMutation({
    mutationFn: async (classData) => {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(classData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create class");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Class created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      form.reset();
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

  const handleSubmit = (data) => {
    addClassMutation.mutate(data);
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
          <Button type="submit" disabled={addClassMutation.isPending}>
            {addClassMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Creating...
              </>
            ) : (
              <>
                <i className="fas fa-plus mr-2"></i>
                Create Class
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
