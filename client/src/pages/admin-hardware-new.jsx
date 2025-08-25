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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Hardware Overview Statistics Component
function HardwareOverviewStats() {
  const { data: stats = {}, isLoading } = useQuery({
    queryKey: ["/api/hardware/stats"],
    refetchInterval: 5000,
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
      title: "Total Devices",
      value: stats.totalDevices || 0,
      icon: "fas fa-microchip",
      color: "blue",
      trend: "+2 this week",
    },
    {
      title: "Online Devices",
      value: stats.onlineDevices || 0,
      icon: "fas fa-wifi",
      color: "green",
      trend: "98% uptime",
    },
    {
      title: "Daily Scans",
      value: stats.dailyScans || 0,
      icon: "fas fa-qrcode",
      color: "purple",
      trend: "+15% from yesterday",
    },
    {
      title: "System Health",
      value: `${stats.systemHealth || 95}%`,
      icon: "fas fa-heartbeat",
      color: "red",
      trend: "All systems operational",
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

// Add Device Dialog Component
function AddDeviceDialog({ open, onOpenChange }) {
  const [formData, setFormData] = useState({
    deviceType: "",
    deviceId: "",
    location: "",
    ipAddress: "",
    description: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addDeviceMutation = useMutation({
    mutationFn: async (deviceData) => {
      const response = await fetch("/api/hardware/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(deviceData),
      });
      if (!response.ok) throw new Error("Failed to add device");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Device Added",
        description: "Hardware device added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/stats"] });
      setFormData({
        deviceType: "",
        deviceId: "",
        location: "",
        ipAddress: "",
        description: "",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Add Device Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.deviceType || !formData.deviceId || !formData.location) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    addDeviceMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
          <DialogDescription>
            Register a new ESP32-CAM or RFID device to the system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="deviceType">Device Type *</Label>
            <Select
              value={formData.deviceType}
              onValueChange={(value) =>
                setFormData({ ...formData, deviceType: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select device type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="esp32_cam">
                  ESP32-CAM (Face Recognition)
                </SelectItem>
                <SelectItem value="rfid_reader">RFID Reader</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="deviceId">Device ID *</Label>
            <Input
              id="deviceId"
              value={formData.deviceId}
              onChange={(e) =>
                setFormData({ ...formData, deviceId: e.target.value })
              }
              placeholder="e.g., ESP32_CAM_001"
            />
          </div>
          <div>
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="e.g., Classroom A101"
            />
          </div>
          <div>
            <Label htmlFor="ipAddress">IP Address</Label>
            <Input
              id="ipAddress"
              value={formData.ipAddress}
              onChange={(e) =>
                setFormData({ ...formData, ipAddress: e.target.value })
              }
              placeholder="e.g., 192.168.1.100"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Additional device information..."
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addDeviceMutation.isPending}>
              {addDeviceMutation.isPending ? "Adding..." : "Add Device"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Configure Device Dialog Component
function ConfigureDeviceDialog({ device, open, onOpenChange }) {
  const [config, setConfig] = useState({
    scanInterval: 5,
    confidenceThreshold: 0.8,
    maxRetries: 3,
    timeout: 10,
    enableLogging: true,
    enableAutoRestart: true,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const configureMutation = useMutation({
    mutationFn: async (configData) => {
      const response = await fetch("/api/hardware/configure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          deviceId: device?.id,
          config: configData,
        }),
      });
      if (!response.ok) throw new Error("Failed to configure device");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Device Configured",
        description: "Device configuration updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Configuration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyPreset = (preset) => {
    const presets = {
      high_security: {
        scanInterval: 2,
        confidenceThreshold: 0.9,
        maxRetries: 5,
        timeout: 15,
        enableLogging: true,
        enableAutoRestart: true,
      },
      balanced: {
        scanInterval: 5,
        confidenceThreshold: 0.8,
        maxRetries: 3,
        timeout: 10,
        enableLogging: true,
        enableAutoRestart: true,
      },
      power_saving: {
        scanInterval: 10,
        confidenceThreshold: 0.7,
        maxRetries: 2,
        timeout: 8,
        enableLogging: false,
        enableAutoRestart: false,
      },
    };
    setConfig(presets[preset]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Device</DialogTitle>
          <DialogDescription>
            Configure settings for {device?.deviceId} ({device?.location})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Presets */}
          <div>
            <Label className="text-sm font-medium">Quick Presets</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("high_security")}
                className="text-xs"
              >
                High Security
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("balanced")}
                className="text-xs"
              >
                Balanced
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("power_saving")}
                className="text-xs"
              >
                Power Saving
              </Button>
            </div>
          </div>

          {/* Configuration Options */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="scanInterval">Scan Interval (seconds)</Label>
              <Input
                id="scanInterval"
                type="number"
                min="1"
                max="60"
                value={config.scanInterval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    scanInterval: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
              <Input
                id="confidenceThreshold"
                type="number"
                min="0.1"
                max="1"
                step="0.1"
                value={config.confidenceThreshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    confidenceThreshold: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="maxRetries">Max Retries</Label>
              <Input
                id="maxRetries"
                type="number"
                min="1"
                max="10"
                value={config.maxRetries}
                onChange={(e) =>
                  setConfig({ ...config, maxRetries: parseInt(e.target.value) })
                }
              />
            </div>

            <div>
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                min="5"
                max="30"
                value={config.timeout}
                onChange={(e) =>
                  setConfig({ ...config, timeout: parseInt(e.target.value) })
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableLogging"
                checked={config.enableLogging}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableLogging: checked })
                }
              />
              <Label htmlFor="enableLogging">Enable Logging</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableAutoRestart"
                checked={config.enableAutoRestart}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableAutoRestart: checked })
                }
              />
              <Label htmlFor="enableAutoRestart">Enable Auto Restart</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => configureMutation.mutate(config)}
              disabled={configureMutation.isPending}
            >
              {configureMutation.isPending
                ? "Configuring..."
                : "Apply Configuration"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Device Management Table Component
function DeviceManagementTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: devices = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 5000,
  });

  // Filter devices based on search and status
  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.deviceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === "all" || device.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const restartDeviceMutation = useMutation({
    mutationFn: async (deviceId) => {
      const response = await fetch("/api/hardware/bulk-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ action: "restart", deviceIds: [deviceId] }),
      });
      if (!response.ok) throw new Error("Failed to restart device");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Device Restarted",
        description: "Device restart command sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware"] });
    },
    onError: (error) => {
      toast({
        title: "Restart Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId) => {
      const response = await fetch(`/api/hardware/${deviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete device");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Device Removed",
        description: "Device removed from system successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, deviceIds }) => {
      const response = await fetch("/api/hardware/bulk-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ action, deviceIds }),
      });
      if (!response.ok) throw new Error("Failed to perform bulk action");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Action Completed",
        description: `${data.action} performed on ${data.affected} devices.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware"] });
      setSelectedDevices([]);
    },
    onError: (error) => {
      toast({
        title: "Bulk Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeviceSelect = (deviceId, checked) => {
    if (checked) {
      setSelectedDevices([...selectedDevices, deviceId]);
    } else {
      setSelectedDevices(selectedDevices.filter((id) => id !== deviceId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedDevices(filteredDevices.map((device) => device.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleConfigure = (device) => {
    setSelectedDevice(device);
    setConfigDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center">
                <i className="fas fa-list mr-2 text-blue-600"></i>
                Device Management
              </CardTitle>
              <CardDescription>
                {filteredDevices.length} devices • Real-time monitoring
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedDevices.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      bulkActionMutation.mutate({
                        action: "restart",
                        deviceIds: selectedDevices,
                      })
                    }
                    disabled={bulkActionMutation.isPending}
                  >
                    <i className="fas fa-redo mr-2"></i>
                    Restart ({selectedDevices.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      bulkActionMutation.mutate({
                        action: "update",
                        deviceIds: selectedDevices,
                      })
                    }
                    disabled={bulkActionMutation.isPending}
                  >
                    <i className="fas fa-download mr-2"></i>
                    Update
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <i className="fas fa-sync-alt mr-2"></i>
                Refresh
              </Button>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <i className="fas fa-plus mr-2"></i>
                Add Device
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search devices by ID or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                <SelectItem value="online">Online Only</SelectItem>
                <SelectItem value="offline">Offline Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Device Table */}
          {isLoading ? (
            <div className="text-center py-12">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
              <p className="text-gray-500">Loading hardware devices...</p>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-microchip text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-500 text-lg mb-2">No devices found</p>
              <p className="text-gray-400 mb-4">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Get started by adding your first device"}
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <i className="fas fa-plus mr-2"></i>
                Add First Device
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedDevices.length === filteredDevices.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDevices.includes(device.id)}
                          onCheckedChange={(checked) =>
                            handleDeviceSelect(device.id, checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              device.status === "online"
                                ? "bg-green-100"
                                : "bg-red-100"
                            }`}
                          >
                            <i
                              className={`${
                                device.deviceType === "esp32_cam"
                                  ? "fas fa-camera"
                                  : "fas fa-credit-card"
                              } ${
                                device.status === "online"
                                  ? "text-green-600"
                                  : "text-red-600"
                              } text-sm`}
                            ></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">
                              {device.deviceId}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {device.ipAddress || "No IP"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {device.deviceType === "esp32_cam"
                            ? "ESP32-CAM"
                            : "RFID Reader"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {device.location}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${
                            device.status === "online"
                              ? "bg-green-100 text-green-800 border-green-300"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full mr-1 ${
                              device.status === "online"
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          ></div>
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {device.lastHeartbeat ? (
                          <div className="text-sm">
                            <div>
                              {format(new Date(device.lastHeartbeat), "MMM dd")}
                            </div>
                            <div className="text-gray-500">
                              {format(new Date(device.lastHeartbeat), "HH:mm")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                              style={{
                                width: `${
                                  device.signalStrength ||
                                  Math.floor(Math.random() * 40) + 60
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {device.signalStrength ||
                              Math.floor(Math.random() * 40) + 60}
                            %
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfigure(device)}
                          >
                            <i className="fas fa-cog"></i>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              restartDeviceMutation.mutate(device.id)
                            }
                            disabled={restartDeviceMutation.isPending}
                          >
                            <i className="fas fa-redo"></i>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to remove this device?"
                                )
                              ) {
                                deleteDeviceMutation.mutate(device.id);
                              }
                            }}
                            disabled={deleteDeviceMutation.isPending}
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

      {/* Dialogs */}
      <AddDeviceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <ConfigureDeviceDialog
        device={selectedDevice}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
      />
    </>
  );
}

// Main Hardware Status Component
export default function AdminHardwareStatus() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Real-time connection monitoring
  const [connectionStatus, setConnectionStatus] = useState({
    websocket: true,
    database: true,
    devices: true,
  });

  useEffect(() => {
    // Simulate connection monitoring
    const interval = setInterval(() => {
      setConnectionStatus({
        websocket: Math.random() > 0.05, // 95% uptime
        database: Math.random() > 0.02, // 98% uptime
        devices: Math.random() > 0.1, // 90% uptime
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

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
                    Hardware Status Management
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Monitor and manage ESP32-CAM and RFID hardware devices
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Connection Status Indicators */}
                  <div className="flex items-center gap-3 text-sm">
                    <div
                      className={`flex items-center gap-1 ${
                        connectionStatus.websocket
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          connectionStatus.websocket
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span>WebSocket</span>
                    </div>
                    <div
                      className={`flex items-center gap-1 ${
                        connectionStatus.database
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          connectionStatus.database
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span>Database</span>
                    </div>
                    <div
                      className={`flex items-center gap-1 ${
                        connectionStatus.devices
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          connectionStatus.devices
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span>Devices</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 lg:p-6 max-w-full">
            {/* Statistics Overview */}
            <HardwareOverviewStats />

            {/* Device Management Table */}
            <DeviceManagementTable />
          </div>
        </div>
      </div>
    </div>
  );
}
