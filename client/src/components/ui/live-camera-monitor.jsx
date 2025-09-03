import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export function LiveCameraMonitor() {
  const { toast } = useToast();
  const [selectedCamera, setSelectedCamera] = useState("");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [cameraStatus, setCameraStatus] = useState({});
  const [recentRecognitions, setRecentRecognitions] = useState([]);
  const [streamUrl, setStreamUrl] = useState("");
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [esp32Devices, setEsp32Devices] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [pythonServiceStatus, setPythonServiceStatus] = useState({
    connected: false,
    health: null,
    statistics: null,
    lastCheck: null,
  });

  // Fetch available hardware devices (cameras)
  const { data: cameras = [], refetch: refetchCameras } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Auto-detect ESP32 devices on local network
  useEffect(() => {
    const scanForESP32Devices = async () => {
      try {
        // Common ESP32 IP ranges to check
        const baseIP = "192.168.8."; // Dialog 4G network
        const ipRanges = [
          "192.168.1.", // Common router default
          "192.168.0.", // Another common default
          "192.168.8.", // Dialog 4G
          "10.0.0.", // Some routers
        ];

        const foundDevices = [];

        for (const baseIP of ipRanges) {
          for (let i = 100; i <= 120; i++) {
            // Check common IP range
            const ip = `${baseIP}${i}`;
            try {
              const response = await fetch(`http://${ip}/`, {
                method: "GET",
                timeout: 2000,
                signal: AbortSignal.timeout(2000),
              });

              if (response.ok) {
                const text = await response.text();
                if (text.includes("ESP32-CAM") || text.includes("ESP32")) {
                  foundDevices.push({
                    deviceId: `ESP32_CAM_${ip.split(".").pop()}`,
                    ipAddress: ip,
                    streamUrl: `http://${ip}/stream`,
                    webInterface: `http://${ip}/`,
                    status: "online",
                    deviceType: "esp32_cam",
                  });
                  console.log(`Found ESP32 device at: ${ip}`);
                }
              }
            } catch (error) {
              // Ignore timeout/connection errors
            }
          }
        }

        setEsp32Devices(foundDevices);

        if (foundDevices.length > 0) {
          toast({
            title: "ESP32 Devices Found",
            description: `Found ${foundDevices.length} ESP32 camera(s) on network`,
          });
        }
      } catch (error) {
        console.log("ESP32 scan completed");
      }
    };

    // Scan for devices on component mount
    scanForESP32Devices();

    // Set up periodic scanning
    const scanInterval = setInterval(scanForESP32Devices, 30000); // Every 30 seconds

    return () => clearInterval(scanInterval);
  }, [toast]);

  // Python service health monitoring
  useEffect(() => {
    const checkPythonService = async () => {
      try {
        const response = await fetch("http://localhost:8000/health", {
          method: "GET",
          timeout: 3000,
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          const health = await response.json();
          setPythonServiceStatus({
            connected: true,
            health: health,
            lastCheck: new Date().toISOString(),
          });

          // Also get statistics
          try {
            const statsResponse = await fetch(
              "http://localhost:8000/api/statistics"
            );
            if (statsResponse.ok) {
              const stats = await statsResponse.json();
              setPythonServiceStatus((prev) => ({
                ...prev,
                statistics: stats.statistics,
              }));
            }
          } catch (error) {
            console.log("Could not fetch Python service statistics");
          }
        } else {
          setPythonServiceStatus((prev) => ({
            ...prev,
            connected: false,
            lastCheck: new Date().toISOString(),
          }));
        }
      } catch (error) {
        setPythonServiceStatus((prev) => ({
          ...prev,
          connected: false,
          lastCheck: new Date().toISOString(),
        }));
      }
    };

    // Initial check
    checkPythonService();

    // Set up periodic health checks
    const healthInterval = setInterval(checkPythonService, 10000); // Every 10 seconds

    return () => clearInterval(healthInterval);
  }, []);

  // Debug: Log cameras data
  useEffect(() => {
    console.log("Fetched cameras:", cameras);
    console.log("ESP32 devices found:", esp32Devices);
    console.log("Python service status:", pythonServiceStatus);
    console.log(
      "ESP32 cameras from API:",
      cameras.filter((device) => device.deviceType === "esp32_cam")
    );
  }, [cameras, esp32Devices, pythonServiceStatus]);

  // Fetch device status updates
  const { data: statusUpdates = [] } = useQuery({
    queryKey: ["/api/hardware/status-updates"],
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
    enabled: !!selectedCamera,
  });

  // Start monitoring selected camera
  const startMonitoring = async () => {
    if (!selectedCamera) {
      toast({
        title: "No Camera Selected",
        description: "Please select a camera to monitor",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsMonitoring(true);

      // Check if this is a direct ESP32 device
      const esp32Device = esp32Devices.find(
        (device) => device.deviceId === selectedCamera
      );

      if (esp32Device) {
        // Direct ESP32 connection
        console.log(`Connecting directly to ESP32: ${esp32Device.ipAddress}`);

        // Test ESP32 availability
        try {
          const testResponse = await fetch(esp32Device.webInterface, {
            method: "GET",
            timeout: 5000,
            signal: AbortSignal.timeout(5000),
          });

          if (testResponse.ok) {
            // ESP32 is online, use direct stream
            setCameraStatus((prev) => ({
              ...prev,
              [selectedCamera]: {
                status: "monitoring",
                message: "Live ESP32-CAM stream active",
                timestamp: new Date().toISOString(),
                streamUrl: esp32Device.streamUrl,
                isDemoStream: false,
                ipAddress: esp32Device.ipAddress,
              },
            }));

            setStreamUrl(esp32Device.streamUrl);

            toast({
              title: "ESP32-CAM Connected",
              description: `Live stream from ${esp32Device.ipAddress}`,
            });

            return;
          }
        } catch (error) {
          console.log(
            `ESP32 at ${esp32Device.ipAddress} not responding, trying server...`
          );
        }
      }

      // Fallback to server-based stream
      console.log(
        `Attempting to connect via server to camera: ${selectedCamera}`
      );
      const response = await fetch(
        `/api/hardware/camera/${selectedCamera}/stream`
      );

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const streamData = await response.json();
      console.log("Stream data received:", streamData);

      if (streamData.success) {
        // Update camera status to indicate we're connecting
        setCameraStatus((prev) => ({
          ...prev,
          [selectedCamera]: {
            status: "connecting",
            message: "Connecting to camera stream...",
            timestamp: new Date().toISOString(),
            streamUrl: streamData.streamUrl,
            isDemoStream: streamData.isDemoStream || false,
          },
        }));

        // Set the stream URL for display
        setStreamUrl(streamData.streamUrl);

        // Simulate connection delay then update to monitoring
        setTimeout(() => {
          setCameraStatus((prev) => ({
            ...prev,
            [selectedCamera]: {
              ...prev[selectedCamera],
              status: "monitoring",
              message: streamData.isDemoStream
                ? "Demo stream active (ESP32 offline)"
                : "Live stream active",
              timestamp: new Date().toISOString(),
            },
          }));
        }, 1000);

        toast({
          title: "Monitoring Started",
          description: `Connected to ${selectedCamera}`,
        });
      } else {
        throw new Error(streamData.message || "Camera stream not available");
      }
    } catch (error) {
      console.error("Failed to start monitoring:", error);
      toast({
        title: "Connection Error",
        description: error.message || "Failed to connect to camera",
        variant: "destructive",
      });
      setIsMonitoring(false);
      setCameraStatus((prev) => ({
        ...prev,
        [selectedCamera]: {
          status: "error",
          message: "Connection failed: " + (error.message || "Unknown error"),
          timestamp: new Date().toISOString(),
        },
      }));
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setStreamUrl("");
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    // Update camera status to stopped
    if (selectedCamera) {
      setCameraStatus((prev) => ({
        ...prev,
        [selectedCamera]: {
          status: "standby",
          message: "Monitoring stopped",
          timestamp: new Date().toISOString(),
        },
      }));
    }

    toast({
      title: "Monitoring Stopped",
      description: "Camera monitoring has been stopped",
    });
  };

  // Update camera status from status updates
  useEffect(() => {
    if (statusUpdates.length > 0) {
      const latestUpdate = statusUpdates[0];
      setCameraStatus((prev) => ({
        ...prev,
        [latestUpdate.deviceId]: {
          status: latestUpdate.status,
          message: latestUpdate.message,
          timestamp: latestUpdate.timestamp,
          lastRecognizedStudent: latestUpdate.lastRecognizedStudent,
          lastConfidence: latestUpdate.lastConfidence,
          proximityMode: latestUpdate.proximityMode,
          motionDetected: latestUpdate.motionDetected,
        },
      }));

      // Add to recent recognitions if it's a recognition event
      if (
        latestUpdate.status === "face_recognized" &&
        latestUpdate.lastRecognizedStudent
      ) {
        setRecentRecognitions((prev) => [
          {
            id: Date.now(),
            deviceId: latestUpdate.deviceId,
            student: latestUpdate.lastRecognizedStudent,
            confidence: latestUpdate.lastConfidence,
            timestamp: latestUpdate.timestamp,
          },
          ...prev.slice(0, 9), // Keep only last 10 recognitions
        ]);
      }
    }
  }, [statusUpdates]);

  const getStatusColor = (status) => {
    switch (status) {
      case "monitoring":
        return "bg-green-100 text-green-800 border-green-300";
      case "connecting":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "face_recognized":
        return "bg-green-100 text-green-800 border-green-300";
      case "motion_detected":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "capturing":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "face_not_recognized":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "standby":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "error":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "monitoring":
        return "fas fa-video text-green-600";
      case "connecting":
        return "fas fa-spinner fa-spin text-blue-600";
      case "face_recognized":
        return "fas fa-check-circle text-green-600";
      case "motion_detected":
        return "fas fa-running text-blue-600";
      case "capturing":
        return "fas fa-camera text-yellow-600";
      case "face_not_recognized":
        return "fas fa-times-circle text-orange-600";
      case "standby":
        return "fas fa-pause-circle text-gray-600";
      case "error":
        return "fas fa-exclamation-triangle text-red-600";
      default:
        return "fas fa-circle text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Camera Selection and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <i className="fas fa-video text-blue-600"></i>
            <span>Live Camera Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Select Camera Device
              </label>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      cameras.length === 0 && esp32Devices.length === 0
                        ? "Scanning for cameras..."
                        : cameras.filter(
                            (device) => device.deviceType === "esp32_cam"
                          ).length === 0 && esp32Devices.length === 0
                        ? `${cameras.length} devices found, no ESP32 cameras`
                        : "Choose a camera device..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {/* Direct ESP32 devices found on network */}
                  {esp32Devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-circle text-xs text-green-500"></i>
                        <span className="text-green-600">🎯 DIRECT:</span>
                        <span>
                          {device.deviceId} ({device.ipAddress})
                        </span>
                      </div>
                    </SelectItem>
                  ))}

                  {/* Server-registered cameras */}
                  {cameras
                    .filter((device) => device.deviceType === "esp32_cam")
                    .map((camera) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        <div className="flex items-center space-x-2">
                          <i
                            className={`fas fa-circle text-xs ${
                              camera.status === "online"
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          ></i>
                          <span className="text-blue-600">SERVER:</span>
                          <span>
                            {camera.deviceId} - {camera.location}
                          </span>
                        </div>
                      </SelectItem>
                    ))}

                  {/* No cameras found */}
                  {cameras.filter((device) => device.deviceType === "esp32_cam")
                    .length === 0 &&
                    esp32Devices.length === 0 && (
                      <SelectItem value="no-cameras" disabled>
                        <div className="text-gray-500">
                          {cameras.length === 0
                            ? "No devices found - Upload ESP32 firmware!"
                            : `Found ${cameras.length} devices, but no ESP32 cameras`}
                        </div>
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={isMonitoring}
                onCheckedChange={
                  isMonitoring ? stopMonitoring : startMonitoring
                }
                disabled={!selectedCamera}
              />
              <span className="text-sm font-medium">
                {isMonitoring ? "Monitoring" : "Stopped"}
              </span>
            </div>

            {/* Additional Controls */}
            <div className="flex items-center space-x-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  // Scan for ESP32 devices
                  setEsp32Devices([]);
                  const baseIP = "192.168.8.";
                  const foundDevices = [];

                  toast({
                    title: "Scanning Network",
                    description: "Looking for ESP32-CAM devices...",
                  });

                  for (let i = 100; i <= 120; i++) {
                    const ip = `${baseIP}${i}`;
                    try {
                      const response = await fetch(`http://${ip}/`, {
                        method: "GET",
                        timeout: 1000,
                        signal: AbortSignal.timeout(1000),
                      });

                      if (response.ok) {
                        const text = await response.text();
                        if (
                          text.includes("ESP32-CAM") ||
                          text.includes("ESP32")
                        ) {
                          foundDevices.push({
                            deviceId: `ESP32_CAM_${ip.split(".").pop()}`,
                            ipAddress: ip,
                            streamUrl: `http://${ip}/stream`,
                            webInterface: `http://${ip}/`,
                            status: "online",
                            deviceType: "esp32_cam",
                          });
                        }
                      }
                    } catch (error) {
                      // Ignore timeout errors
                    }
                  }

                  setEsp32Devices(foundDevices);
                  toast({
                    title:
                      foundDevices.length > 0
                        ? "Devices Found"
                        : "Scan Complete",
                    description:
                      foundDevices.length > 0
                        ? `Found ${foundDevices.length} ESP32 device(s)`
                        : "No ESP32 devices found on network",
                    variant:
                      foundDevices.length > 0 ? "default" : "destructive",
                  });
                }}
              >
                <i className="fas fa-search mr-1"></i>
                Scan for ESP32
              </Button>

              {selectedCamera &&
                esp32Devices.find((d) => d.deviceId === selectedCamera) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const device = esp32Devices.find(
                        (d) => d.deviceId === selectedCamera
                      );
                      if (device) {
                        window.open(device.webInterface, "_blank");
                      }
                    }}
                  >
                    <i className="fas fa-external-link-alt mr-1"></i>
                    ESP32 Web UI
                  </Button>
                )}

              {streamUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Force refresh the stream
                    const img = document.querySelector(
                      'img[alt="Camera Stream"]'
                    );
                    if (img) {
                      const timestamp = new Date().getTime();
                      img.src = streamUrl + "?t=" + timestamp;
                    }
                  }}
                >
                  <i className="fas fa-sync-alt mr-1"></i>
                  Refresh Stream
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              <div>Total devices: {cameras.length}</div>
              <div>
                ESP32 cameras:{" "}
                {
                  cameras.filter((device) => device.deviceType === "esp32_cam")
                    .length
                }
              </div>
              <div>
                Device types: {cameras.map((d) => d.deviceType).join(", ")}
              </div>
              <details>
                <summary>Raw camera data:</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {JSON.stringify(cameras, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Python Service Debug Panel 
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-sm">🐍 Python Debug Service</span>
            <Badge className="bg-green-100 text-green-800">
              <i className="fas fa-circle mr-1 text-green-500"></i>
              Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Service URL:</span>
              <a 
                href="http://localhost:8000" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                http://localhost:8000
              </a>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch('http://localhost:8000/health');
                    const data = await response.json();
                    toast({
                      title: "Health Check",
                      description: `Status: ${data.status}`,
                    });
                  } catch (error) {
                    toast({
                      title: "Health Check Failed",
                      description: "Python service not responding",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <i className="fas fa-heartbeat mr-2"></i>
                Health Check
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch('http://localhost:8000/debug/stats');
                    const data = await response.json();
                    console.log('Python Service Stats:', data);
                    toast({
                      title: "Stats Retrieved",
                      description: `${data.request_statistics?.total_requests || 0} total requests`,
                    });
                  } catch (error) {
                    toast({
                      title: "Stats Failed",
                      description: "Could not retrieve stats",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <i className="fas fa-chart-bar mr-2"></i>
                View Stats
              </Button>
            </div>

            <div className="text-xs text-gray-600">
              <div>• Face recognition service ready</div>
              <div>• Debug logging enabled</div>
              <div>• Image validation active</div>
            </div>
          </div>
        </CardContent>
      </Card>*/}

      {/* Live Camera Feed and Status */}
      {selectedCamera && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Camera Feed: {selectedCamera}</span>
                <Badge
                  className={getStatusColor(
                    cameraStatus[selectedCamera]?.status || "standby"
                  )}
                >
                  <i
                    className={getStatusIcon(
                      cameraStatus[selectedCamera]?.status || "standby"
                    )}
                  ></i>
                  <span className="ml-1">
                    {cameraStatus[selectedCamera]?.status
                      ?.replace("_", " ")
                      .toUpperCase() || "STANDBY"}
                  </span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="relative bg-gray-900 rounded-lg overflow-hidden"
                style={{ aspectRatio: "4/3" }}
              >
                {isMonitoring ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {/* Dynamic camera feed display based on status */}
                    {cameraStatus[selectedCamera]?.status === "connecting" ? (
                      <div className="text-center text-white">
                        <i className="fas fa-spinner fa-spin text-4xl mb-4 text-blue-400"></i>
                        <p className="text-lg">Connecting to Camera</p>
                        <p className="text-sm opacity-75">
                          ESP32-CAM: {selectedCamera}
                        </p>
                        <div className="mt-4">
                          <div className="animate-pulse text-blue-400">
                            Establishing connection...
                          </div>
                        </div>
                      </div>
                    ) : cameraStatus[selectedCamera]?.status ===
                      "monitoring" ? (
                      <div className="relative w-full h-full">
                        {/* Stream Display */}
                        {streamUrl && (
                          <img
                            src={streamUrl}
                            alt="Camera Stream"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error("Stream load error:", e);
                              // Fallback to demo message on error
                              e.target.style.display = "none";
                            }}
                          />
                        )}

                        {/* Stream overlay info */}
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-green-500/80 text-white">
                            <i className="fas fa-circle mr-1 animate-pulse"></i>
                            LIVE
                          </Badge>
                        </div>

                        <div className="absolute top-4 right-4">
                          <Badge className="bg-black/50 text-white">
                            {selectedCamera}
                          </Badge>
                        </div>

                        <div className="absolute bottom-4 left-4">
                          <Badge className="bg-black/50 text-white">
                            {cameraStatus[selectedCamera]?.isDemoStream
                              ? "Demo Stream"
                              : "ESP32-CAM Stream"}
                          </Badge>
                        </div>

                        {/* Status overlays */}
                        {cameraStatus[selectedCamera]?.proximityMode && (
                          <div className="absolute top-14 left-4">
                            <Badge className="bg-blue-500 text-white animate-pulse">
                              <i className="fas fa-eye mr-1"></i>
                              PROXIMITY MODE
                            </Badge>
                          </div>
                        )}
                        {cameraStatus[selectedCamera]?.motionDetected && (
                          <div className="absolute top-14 right-4">
                            <Badge className="bg-yellow-500 text-white animate-pulse">
                              <i className="fas fa-running mr-1"></i>
                              MOTION
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : cameraStatus[selectedCamera]?.status === "error" ? (
                      <div className="text-center text-red-400">
                        <i className="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <p className="text-lg">Connection Error</p>
                        <p className="text-sm opacity-75">
                          {cameraStatus[selectedCamera]?.message ||
                            "Failed to connect to camera"}
                        </p>
                        <div className="mt-4">
                          <button
                            onClick={startMonitoring}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            <i className="fas fa-redo mr-2"></i>
                            Retry Connection
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-white">
                        <i className="fas fa-camera text-4xl mb-4 opacity-50"></i>
                        <p className="text-lg">Camera Ready</p>
                        <p className="text-sm opacity-75">
                          ESP32-CAM: {selectedCamera}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <i className="fas fa-video-slash text-4xl mb-4"></i>
                      <p>Camera monitoring stopped</p>
                      <p className="text-sm">
                        Click monitoring switch to start
                      </p>
                    </div>
                  </div>
                )}

                {/* Status Overlay */}
                {isMonitoring && cameraStatus[selectedCamera] && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm">
                      <div className="flex items-center justify-between">
                        <span>{cameraStatus[selectedCamera].message}</span>
                        <span className="text-xs opacity-75">
                          {new Date(
                            cameraStatus[selectedCamera].timestamp
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                      {cameraStatus[selectedCamera].lastRecognizedStudent && (
                        <div className="mt-1 pt-1 border-t border-gray-600">
                          <span className="font-medium">
                            {cameraStatus[selectedCamera].lastRecognizedStudent}
                          </span>
                          <span className="ml-2 text-green-400">
                            (
                            {(
                              cameraStatus[selectedCamera].lastConfidence * 100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              {selectedCamera && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(
                            `/api/hardware/camera/${selectedCamera}/snapshot`
                          );
                          const data = await response.json();
                          if (data.success) {
                            toast({
                              title: "Snapshot Captured",
                              description: `Snapshot taken from ${selectedCamera}`,
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Snapshot Failed",
                            description: "Could not capture snapshot",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!isMonitoring}
                    >
                      <i className="fas fa-camera mr-2"></i>
                      Snapshot
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          // Trigger ESP32 face recognition via debug endpoint
                          const device = cameras.find(
                            (c) => c.deviceId === selectedCamera
                          );
                          if (device && device.ipAddress) {
                            const esp32DebugUrl = `http://${device.ipAddress}/debug-trigger`;
                            await fetch(esp32DebugUrl, { method: "GET" });
                            toast({
                              title: "Face Recognition Triggered",
                              description: `Triggered face recognition on ${selectedCamera}`,
                            });
                          } else {
                            // Fallback: test via Python service directly
                            const response = await fetch(
                              "http://localhost:8000/api/test",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  test: "manual_trigger",
                                  deviceId: selectedCamera,
                                }),
                              }
                            );
                            if (response.ok) {
                              toast({
                                title: "Debug Test Sent",
                                description:
                                  "Test request sent to Python service",
                              });
                            }
                          }
                        } catch (error) {
                          toast({
                            title: "Trigger Failed",
                            description: "Could not trigger face recognition",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!isMonitoring}
                    >
                      <i className="fas fa-bolt mr-2"></i>
                      Trigger Recognition
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Simulate motion detection for testing
                        setCameraStatus((prev) => ({
                          ...prev,
                          [selectedCamera]: {
                            ...prev[selectedCamera],
                            status: "motion_detected",
                            message:
                              "Motion detected - preparing for face recognition",
                            motionDetected: true,
                            timestamp: new Date().toISOString(),
                          },
                        }));

                        // Reset after 3 seconds
                        setTimeout(() => {
                          setCameraStatus((prev) => ({
                            ...prev,
                            [selectedCamera]: {
                              ...prev[selectedCamera],
                              status: "monitoring",
                              message: "Live stream active",
                              motionDetected: false,
                              timestamp: new Date().toISOString(),
                            },
                          }));
                        }, 3000);
                      }}
                      disabled={!isMonitoring}
                    >
                      <i className="fas fa-running mr-2"></i>
                      Test Motion
                    </Button>
                  </div>

                  <div className="text-sm text-gray-500">
                    Stream:{" "}
                    {cameraStatus[selectedCamera]?.streamUrl || "Not connected"}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Recognitions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <i className="fas fa-history text-green-600"></i>
                <span>Recent Recognitions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentRecognitions.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <i className="fas fa-search text-2xl mb-2 opacity-50"></i>
                    <p>No recent recognitions</p>
                    <p className="text-sm">
                      Face recognitions will appear here
                    </p>
                  </div>
                ) : (
                  recentRecognitions.map((recognition) => (
                    <div
                      key={recognition.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200"
                    >
                      <div className="flex items-center space-x-3">
                        <i className="fas fa-user-check text-green-600"></i>
                        <div>
                          <p className="font-medium">{recognition.student}</p>
                          <p className="text-sm text-gray-600">
                            Device: {recognition.deviceId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          {(recognition.confidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(recognition.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Python Face Recognition Service Status */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <i className="fas fa-python mr-2 text-blue-600"></i>
              Face Recognition Service
            </span>
            <Badge
              className={
                pythonServiceStatus.connected
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }
            >
              <i
                className={`fas fa-circle mr-1 ${
                  pythonServiceStatus.connected
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              ></i>
              {pythonServiceStatus.connected ? "Online" : "Offline"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Service Status</h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-gray-600">Connection:</span>{" "}
                  <span
                    className={
                      pythonServiceStatus.connected
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {pythonServiceStatus.connected
                      ? "Connected"
                      : "Disconnected"}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Last Check:</span>{" "}
                  {pythonServiceStatus.lastCheck
                    ? new Date(
                        pythonServiceStatus.lastCheck
                      ).toLocaleTimeString()
                    : "Never"}
                </p>
                <p>
                  <span className="text-gray-600">Service URL:</span>{" "}
                  <a
                    href="http://localhost:8000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    http://localhost:8000
                  </a>
                </p>
              </div>
            </div>

            {pythonServiceStatus.statistics && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">
                  Recognition Statistics
                </h4>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-600">Total Attempts:</span>{" "}
                    <span className="font-medium">
                      {pythonServiceStatus.statistics.total_recognitions}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Successful:</span>{" "}
                    <span className="font-medium text-green-600">
                      {pythonServiceStatus.statistics.successful_recognitions}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Failed:</span>{" "}
                    <span className="font-medium text-red-600">
                      {pythonServiceStatus.statistics.failed_recognitions}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Success Rate:</span>{" "}
                    <span className="font-medium">
                      {pythonServiceStatus.statistics.recognition_success_rate?.toFixed(
                        1
                      ) || 0}
                      %
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Enrolled Students:</span>{" "}
                    <span className="font-medium">
                      {pythonServiceStatus.statistics.enrolled_students || 0}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch("http://localhost:8000/health");
                  if (response.ok) {
                    const data = await response.json();
                    toast({
                      title: "Service Health Check",
                      description: `Python service is ${
                        data.status
                      }. Uptime: ${Math.floor(
                        data.uptime_seconds / 60
                      )} minutes`,
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Service Offline",
                    description:
                      "Python face recognition service is not responding",
                    variant: "destructive",
                  });
                }
              }}
            >
              <i className="fas fa-heartbeat mr-1"></i>
              Health Check
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open("http://localhost:8000", "_blank")}
            >
              <i className="fas fa-external-link-alt mr-1"></i>
              Open Service
            </Button>

            {pythonServiceStatus.connected && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch(
                      "http://localhost:8000/api/students"
                    );
                    if (response.ok) {
                      const data = await response.json();
                      toast({
                        title: "Student Database",
                        description: `${data.total} students registered in face recognition database`,
                      });
                    }
                  } catch (error) {
                    toast({
                      title: "Database Error",
                      description: "Could not fetch student database info",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <i className="fas fa-users mr-1"></i>
                View Students
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
