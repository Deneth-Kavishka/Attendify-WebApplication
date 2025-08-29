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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// System Configuration Component
function SystemConfiguration() {
  const [config, setConfig] = useState({
    attendanceThreshold: 75,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    autoBackup: true,
    emailNotifications: true,
    smsNotifications: false,
    maintenanceMode: false,
    debugMode: false,
    logLevel: "info",
    timezone: "UTC",
    dateFormat: "MM/dd/yyyy",
    timeFormat: "12h",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: systemConfig, isLoading } = useQuery({
    queryKey: ["/api/settings/system"],
    queryFn: async () => {
      const response = await fetch("/api/settings/system", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch system settings");
      return response.json();
    },
  });

  // Sync fetched data with local state
  useEffect(() => {
    if (systemConfig) {
      setConfig({ ...config, ...systemConfig });
    }
  }, [systemConfig]);

  const updateConfigMutation = useMutation({
    mutationFn: async (configData) => {
      const response = await fetch("/api/settings/system", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(configData),
      });
      if (!response.ok)
        throw new Error("Failed to update system configuration");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "System configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/system"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfigChange = (key, value) => {
    setConfig({ ...config, [key]: value });
  };

  const handleSave = () => {
    updateConfigMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-cogs mr-2 text-blue-600"></i>
          System Configuration
        </CardTitle>
        <CardDescription>
          Configure core system settings and behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Attendance Settings</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="attendanceThreshold">
                Exam Eligibility Threshold (%)
              </Label>
              <Input
                id="attendanceThreshold"
                type="number"
                min="0"
                max="100"
                value={config.attendanceThreshold}
                onChange={(e) =>
                  handleConfigChange(
                    "attendanceThreshold",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum attendance percentage required for exam eligibility
              </p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Security Settings</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min="5"
                max="480"
                value={config.sessionTimeout}
                onChange={(e) =>
                  handleConfigChange("sessionTimeout", parseInt(e.target.value))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="maxLoginAttempts">Maximum Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                min="1"
                max="10"
                value={config.maxLoginAttempts}
                onChange={(e) =>
                  handleConfigChange(
                    "maxLoginAttempts",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* System Behavior */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">System Behavior</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoBackup">Automatic Backup</Label>
                <p className="text-sm text-gray-500">
                  Enable daily automatic backups
                </p>
              </div>
              <Switch
                id="autoBackup"
                checked={config.autoBackup}
                onCheckedChange={(checked) =>
                  handleConfigChange("autoBackup", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <p className="text-sm text-gray-500">
                  Send system alerts via email
                </p>
              </div>
              <Switch
                id="emailNotifications"
                checked={config.emailNotifications}
                onCheckedChange={(checked) =>
                  handleConfigChange("emailNotifications", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="smsNotifications">SMS Notifications</Label>
                <p className="text-sm text-gray-500">
                  Send critical alerts via SMS
                </p>
              </div>
              <Switch
                id="smsNotifications"
                checked={config.smsNotifications}
                onCheckedChange={(checked) =>
                  handleConfigChange("smsNotifications", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
                <p className="text-sm text-gray-500">
                  Put system in maintenance mode
                </p>
              </div>
              <Switch
                id="maintenanceMode"
                checked={config.maintenanceMode}
                onCheckedChange={(checked) =>
                  handleConfigChange("maintenanceMode", checked)
                }
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Display Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={config.timezone}
                onValueChange={(value) => handleConfigChange("timezone", value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">
                    Pacific Time
                  </SelectItem>
                  <SelectItem value="Asia/Colombo">Sri Lanka Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={config.dateFormat}
                onValueChange={(value) =>
                  handleConfigChange("dateFormat", value)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setConfig(systemConfig || {})}
          >
            Reset Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending}
          >
            {updateConfigMutation.isPending
              ? "Saving..."
              : "Save Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Hardware Configuration Component
function HardwareConfiguration() {
  const [hardwareConfig, setHardwareConfig] = useState({
    esp32CamSettings: {
      resolution: "VGA",
      frameRate: 10,
      quality: 10,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      faceDetectionEnabled: true,
      faceRecognitionThreshold: 0.8,
      maxFaces: 5,
      autoRestart: true,
      heartbeatInterval: 30,
    },
    rfidSettings: {
      readRange: "medium",
      scanInterval: 2,
      duplicateDelay: 3,
      autoRestart: true,
      heartbeatInterval: 30,
      errorRetries: 3,
      signalStrength: "high",
    },
    networkSettings: {
      connectionTimeout: 10,
      retryAttempts: 3,
      keepAliveInterval: 60,
      dataEncryption: true,
      compressionEnabled: true,
    },
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/settings/hardware"],
    queryFn: async () => {
      const response = await fetch("/api/settings/hardware", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch hardware settings");
      return response.json();
    },
  });

  // Sync fetched data with local state
  useEffect(() => {
    if (config) {
      setHardwareConfig({ ...hardwareConfig, ...config });
    }
  }, [config]);

  const updateHardwareConfigMutation = useMutation({
    mutationFn: async (configData) => {
      const response = await fetch("/api/settings/hardware", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(configData),
      });
      if (!response.ok)
        throw new Error("Failed to update hardware configuration");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Hardware Configuration Updated",
        description: "All hardware devices will be updated with new settings.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hardware"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware"] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleHardwareConfigChange = (category, key, value) => {
    setHardwareConfig({
      ...hardwareConfig,
      [category]: {
        ...hardwareConfig[category],
        [key]: value,
      },
    });
  };

  const handleSaveHardwareConfig = () => {
    updateHardwareConfigMutation.mutate(hardwareConfig);
  };

  const restartDeviceMutation = useMutation({
    mutationFn: async (deviceType) => {
      const response = await fetch(
        `/api/settings/hardware/restart/${deviceType}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!response.ok) throw new Error(`Failed to restart ${deviceType}`);
      return response.json();
    },
    onSuccess: (data, deviceType) => {
      toast({
        title: "Device Restart Initiated",
        description: `${deviceType.toUpperCase()} device restart has been initiated.`,
      });
    },
    onError: (error, deviceType) => {
      toast({
        title: "Restart Failed",
        description: `Failed to restart ${deviceType}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-microchip mr-2 text-green-600"></i>
          Hardware Configuration
        </CardTitle>
        <CardDescription>
          Configure ESP32-CAM and RFID device settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ESP32-CAM Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <i className="fas fa-camera mr-2 text-blue-600"></i>
            ESP32-CAM Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="resolution">Camera Resolution</Label>
              <Select
                value={hardwareConfig.esp32CamSettings.resolution}
                onValueChange={(value) =>
                  handleHardwareConfigChange(
                    "esp32CamSettings",
                    "resolution",
                    value
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QVGA">QVGA (320x240)</SelectItem>
                  <SelectItem value="VGA">VGA (640x480)</SelectItem>
                  <SelectItem value="SVGA">SVGA (800x600)</SelectItem>
                  <SelectItem value="XGA">XGA (1024x768)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="frameRate">Frame Rate (FPS)</Label>
              <Input
                id="frameRate"
                type="number"
                min="1"
                max="30"
                value={hardwareConfig.esp32CamSettings.frameRate}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "esp32CamSettings",
                    "frameRate",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="quality">
                Image Quality (1-63, lower = better)
              </Label>
              <Input
                id="quality"
                type="number"
                min="1"
                max="63"
                value={hardwareConfig.esp32CamSettings.quality}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "esp32CamSettings",
                    "quality",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="faceRecognitionThreshold">
                Face Recognition Threshold
              </Label>
              <Input
                id="faceRecognitionThreshold"
                type="number"
                min="0.1"
                max="1"
                step="0.1"
                value={hardwareConfig.esp32CamSettings.faceRecognitionThreshold}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "esp32CamSettings",
                    "faceRecognitionThreshold",
                    parseFloat(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between col-span-2">
              <div>
                <Label htmlFor="faceDetectionEnabled">Face Detection</Label>
                <p className="text-sm text-gray-500">
                  Enable automatic face detection
                </p>
              </div>
              <Switch
                id="faceDetectionEnabled"
                checked={hardwareConfig.esp32CamSettings.faceDetectionEnabled}
                onCheckedChange={(checked) =>
                  handleHardwareConfigChange(
                    "esp32CamSettings",
                    "faceDetectionEnabled",
                    checked
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between col-span-2">
              <div>
                <Label htmlFor="autoRestart">Auto Restart</Label>
                <p className="text-sm text-gray-500">
                  Automatically restart on errors
                </p>
              </div>
              <Switch
                id="autoRestart"
                checked={hardwareConfig.esp32CamSettings.autoRestart}
                onCheckedChange={(checked) =>
                  handleHardwareConfigChange(
                    "esp32CamSettings",
                    "autoRestart",
                    checked
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* RFID Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <i className="fas fa-credit-card mr-2 text-purple-600"></i>
            RFID Reader Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="readRange">Read Range</Label>
              <Select
                value={hardwareConfig.rfidSettings.readRange}
                onValueChange={(value) =>
                  handleHardwareConfigChange("rfidSettings", "readRange", value)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (1-3 cm)</SelectItem>
                  <SelectItem value="medium">Medium (3-7 cm)</SelectItem>
                  <SelectItem value="long">Long (7-15 cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scanInterval">Scan Interval (seconds)</Label>
              <Input
                id="scanInterval"
                type="number"
                min="1"
                max="60"
                value={hardwareConfig.rfidSettings.scanInterval}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "rfidSettings",
                    "scanInterval",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="duplicateDelay">
                Duplicate Card Delay (seconds)
              </Label>
              <Input
                id="duplicateDelay"
                type="number"
                min="1"
                max="300"
                value={hardwareConfig.rfidSettings.duplicateDelay}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "rfidSettings",
                    "duplicateDelay",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="signalStrength">Signal Strength</Label>
              <Select
                value={hardwareConfig.rfidSettings.signalStrength}
                onValueChange={(value) =>
                  handleHardwareConfigChange(
                    "rfidSettings",
                    "signalStrength",
                    value
                  )
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="maximum">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between col-span-2">
              <div>
                <Label htmlFor="rfidAutoRestart">Auto Restart</Label>
                <p className="text-sm text-gray-500">
                  Automatically restart on errors
                </p>
              </div>
              <Switch
                id="rfidAutoRestart"
                checked={hardwareConfig.rfidSettings.autoRestart}
                onCheckedChange={(checked) =>
                  handleHardwareConfigChange(
                    "rfidSettings",
                    "autoRestart",
                    checked
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* Network Settings */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center">
            <i className="fas fa-wifi mr-2 text-orange-600"></i>
            Network Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="connectionTimeout">
                Connection Timeout (seconds)
              </Label>
              <Input
                id="connectionTimeout"
                type="number"
                min="5"
                max="60"
                value={hardwareConfig.networkSettings.connectionTimeout}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "networkSettings",
                    "connectionTimeout",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="retryAttempts">Retry Attempts</Label>
              <Input
                id="retryAttempts"
                type="number"
                min="1"
                max="10"
                value={hardwareConfig.networkSettings.retryAttempts}
                onChange={(e) =>
                  handleHardwareConfigChange(
                    "networkSettings",
                    "retryAttempts",
                    parseInt(e.target.value)
                  )
                }
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="dataEncryption">Data Encryption</Label>
                <p className="text-sm text-gray-500">
                  Encrypt data transmission
                </p>
              </div>
              <Switch
                id="dataEncryption"
                checked={hardwareConfig.networkSettings.dataEncryption}
                onCheckedChange={(checked) =>
                  handleHardwareConfigChange(
                    "networkSettings",
                    "dataEncryption",
                    checked
                  )
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="compressionEnabled">Data Compression</Label>
                <p className="text-sm text-gray-500">
                  Compress transmitted data
                </p>
              </div>
              <Switch
                id="compressionEnabled"
                checked={hardwareConfig.networkSettings.compressionEnabled}
                onCheckedChange={(checked) =>
                  handleHardwareConfigChange(
                    "networkSettings",
                    "compressionEnabled",
                    checked
                  )
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => restartDeviceMutation.mutate("esp32_cam")}
            disabled={restartDeviceMutation.isPending}
          >
            <i className="fas fa-redo mr-2"></i>
            {restartDeviceMutation.isPending
              ? "Restarting..."
              : "Restart ESP32-CAM"}
          </Button>
          <Button
            variant="outline"
            onClick={() => restartDeviceMutation.mutate("rfid")}
            disabled={restartDeviceMutation.isPending}
          >
            <i className="fas fa-redo mr-2"></i>
            {restartDeviceMutation.isPending ? "Restarting..." : "Restart RFID"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setHardwareConfig(config || {})}
          >
            Reset Changes
          </Button>
          <Button
            onClick={handleSaveHardwareConfig}
            disabled={updateHardwareConfigMutation.isPending}
          >
            {updateHardwareConfigMutation.isPending
              ? "Updating Hardware..."
              : "Save & Update Hardware"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// User Management Component
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userData = [], isLoading } = useQuery({
    queryKey: ["/api/settings/users"],
    queryFn: async () => {
      const response = await fetch("/api/settings/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Sync fetched data with local state
  useEffect(() => {
    if (userData) {
      setUsers(userData);
    }
  }, [userData]);

  const updateUserMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await fetch(`/api/settings/users/${userData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/users"] });
      setUserDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await fetch("/api/settings/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error("Failed to create user");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Created",
        description: "New user has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/users"] });
      setUserDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await fetch(`/api/settings/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete user");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/users"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (actionData) => {
      const response = await fetch("/api/settings/users/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(actionData),
      });
      if (!response.ok) throw new Error("Failed to perform bulk action");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Action Completed",
        description: `${data.action} performed on ${data.affected} users.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/users"] });
      setBulkActionDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Bulk Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-users mr-2 text-indigo-600"></i>
          User Management
        </CardTitle>
        <CardDescription>
          Manage user accounts, roles, and permissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {userData.length} users registered in the system
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkActionDialogOpen(true)}
              >
                <i className="fas fa-users-cog mr-2"></i>
                Bulk Actions
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedUser(null);
                  setUserDialogOpen(true);
                }}
              >
                <i className="fas fa-user-plus mr-2"></i>
                Add User
              </Button>
            </div>
          </div>

          {/* Quick User Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <i className="fas fa-user-shield text-blue-600 text-xl mr-3"></i>
                <div>
                  <p className="text-sm text-gray-600">Administrators</p>
                  <p className="text-xl font-semibold">
                    {userData.filter((u) => u.role === "admin").length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <i className="fas fa-chalkboard-teacher text-green-600 text-xl mr-3"></i>
                <div>
                  <p className="text-sm text-gray-600">Lecturers</p>
                  <p className="text-xl font-semibold">
                    {userData.filter((u) => u.role === "lecturer").length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <i className="fas fa-user-graduate text-purple-600 text-xl mr-3"></i>
                <div>
                  <p className="text-sm text-gray-600">Students</p>
                  <p className="text-xl font-semibold">
                    {userData.filter((u) => u.role === "student").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User List Table */}
          <div className="border rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userData.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <i className="fas fa-user text-gray-600"></i>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === "admin"
                              ? "bg-red-100 text-red-800"
                              : user.role === "lecturer"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setUserDialogOpen(true);
                            }}
                          >
                            <i className="fas fa-edit mr-1"></i>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete ${user.name}?`
                                )
                              ) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                          >
                            <i className="fas fa-trash mr-1"></i>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {userData.length === 0 && (
              <div className="text-center py-8">
                <i className="fas fa-users text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? "Update user information and permissions"
                : "Create a new user account with role assignment"}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const userData = {
                name: formData.get("name"),
                email: formData.get("email"),
                role: formData.get("role"),
                status: formData.get("status") || "active",
              };

              if (selectedUser) {
                updateUserMutation.mutate({ id: selectedUser.id, ...userData });
              } else {
                userData.password = formData.get("password");
                createUserMutation.mutate(userData);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={selectedUser?.name || ""}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={selectedUser?.email || ""}
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            {!selectedUser && (
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter password"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue={selectedUser?.role || "student"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={selectedUser?.status || "active"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  selectedUser
                    ? updateUserMutation.isPending
                    : createUserMutation.isPending
                }
              >
                {selectedUser
                  ? updateUserMutation.isPending
                    ? "Updating..."
                    : "Update User"
                  : createUserMutation.isPending
                  ? "Creating..."
                  : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Dialog */}
      <Dialog
        open={bulkActionDialogOpen}
        onOpenChange={setBulkActionDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk User Actions</DialogTitle>
            <DialogDescription>
              Perform actions on multiple users at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center"
              >
                <i className="fas fa-file-export mr-2"></i>
                Export Users
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center"
              >
                <i className="fas fa-file-import mr-2"></i>
                Import Users
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center"
              >
                <i className="fas fa-user-check mr-2"></i>
                Activate All
              </Button>
              <Button
                variant="outline"
                className="flex items-center justify-center"
              >
                <i className="fas fa-user-times mr-2"></i>
                Deactivate All
              </Button>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setBulkActionDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Backup & Maintenance Component
function BackupMaintenance() {
  const [backupStatus, setBackupStatus] = useState("idle");
  const [maintenanceScheduled, setMaintenanceScheduled] = useState(false);
  const { toast } = useToast();

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/backup/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to create backup");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Backup Created",
        description: "Database backup has been created successfully.",
      });
      setBackupStatus("completed");
    },
    onError: (error) => {
      toast({
        title: "Backup Failed",
        description: error.message,
        variant: "destructive",
      });
      setBackupStatus("failed");
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/maintenance/clean-logs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to clean logs");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Logs Cleaned",
        description:
          data.message || "System logs have been cleaned successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Clean Logs Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const optimizeDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/maintenance/optimize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to optimize database");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Database Optimized",
        description:
          data.message || "Database optimization completed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Optimization Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const runDiagnosticsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/maintenance/diagnostics", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to run diagnostics");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Diagnostics Completed",
        description:
          data.message || "System health check completed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Diagnostics Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-tools mr-2 text-yellow-600"></i>
          Backup & Maintenance
        </CardTitle>
        <CardDescription>
          System backup and maintenance operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backup Section */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">Database Backup</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Last backup: Yesterday at 3:00 AM
              </p>
              <p className="text-xs text-gray-500">
                Automatic backups run daily at 3:00 AM
              </p>
            </div>
            <Button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
            >
              {createBackupMutation.isPending
                ? "Creating..."
                : "Create Backup Now"}
            </Button>
          </div>
        </div>

        {/* Maintenance Section */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">System Maintenance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Clean System Logs</Label>
                <p className="text-sm text-gray-500">
                  Remove old log files and free up storage space
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => clearCacheMutation.mutate()}
                disabled={clearCacheMutation.isPending}
              >
                {clearCacheMutation.isPending ? "Cleaning..." : "Clean Logs"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Optimize Database</Label>
                <p className="text-sm text-gray-500">
                  Optimize database tables and indexes
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => optimizeDatabaseMutation.mutate()}
                disabled={optimizeDatabaseMutation.isPending}
              >
                {optimizeDatabaseMutation.isPending
                  ? "Optimizing..."
                  : "Optimize Now"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>System Health Check</Label>
                <p className="text-sm text-gray-500">
                  Run comprehensive system diagnostics
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => runDiagnosticsMutation.mutate()}
                disabled={runDiagnosticsMutation.isPending}
              >
                {runDiagnosticsMutation.isPending
                  ? "Running..."
                  : "Run Diagnostics"}
              </Button>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <Label>System Version</Label>
              <p className="text-gray-600">SmartTrack v2.1.0</p>
            </div>
            <div>
              <Label>Database Size</Label>
              <p className="text-gray-600">45.7 MB</p>
            </div>
            <div>
              <Label>Uptime</Label>
              <p className="text-gray-600">7 days, 14 hours</p>
            </div>
            <div>
              <Label>Connected Devices</Label>
              <p className="text-gray-600">8 devices online</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Admin Settings Component
export default function AdminSettings() {
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
                    System Settings
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Configure system behavior and hardware integration settings
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800"
                  >
                    <i className="fas fa-shield-alt mr-1"></i>
                    Administrator Access
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 lg:p-6 max-w-full">
            <Tabs defaultValue="system" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="hardware">Hardware</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              </TabsList>

              <TabsContent value="system">
                <SystemConfiguration />
              </TabsContent>

              <TabsContent value="hardware">
                <HardwareConfiguration />
              </TabsContent>

              <TabsContent value="users">
                <UserManagement />
              </TabsContent>

              <TabsContent value="maintenance">
                <BackupMaintenance />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
