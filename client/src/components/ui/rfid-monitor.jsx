import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { Alert, AlertDescription } from "./alert";
import {
  Wifi,
  WifiOff,
  CreditCard,
  Clock,
  User,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Square,
} from "lucide-react";

const RFIDMonitor = () => {
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [rfidStatus, setRfidStatus] = useState("disconnected"); // disconnected, connected, scanning, idle
  const [lastHeartbeat, setLastHeartbeat] = useState(null);

  // RFID data states
  const [lastCardRead, setLastCardRead] = useState(null);
  const [recentCards, setRecentCards] = useState([]);
  const [scanningActive, setScanningActive] = useState(false);
  const [totalReads, setTotalReads] = useState(0);

  // WebSocket connection
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Connect to RFID WebSocket service
  useEffect(() => {
    connectToRFID();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const connectToRFID = () => {
    try {
      // Connect to main WebSocket server for RFID events
      ws.current = new WebSocket("ws://localhost:8080");

      ws.current.onopen = () => {
        console.log("🔗 RFID WebSocket connected");
        setIsConnected(true);
        setRfidStatus("connected");
        reconnectAttempts.current = 0;

        // Subscribe to RFID events
        ws.current.send(
          JSON.stringify({
            type: "subscribe_rfid",
          })
        );
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRFIDMessage(data);
        } catch (error) {
          console.error("📡 RFID message parse error:", error);
        }
      };

      ws.current.onclose = () => {
        console.log("🔌 RFID WebSocket disconnected");
        setIsConnected(false);
        setRfidStatus("disconnected");

        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setTimeout(() => {
            console.log(
              `🔄 RFID reconnection attempt ${reconnectAttempts.current}`
            );
            connectToRFID();
          }, 3000 * reconnectAttempts.current);
        }
      };

      ws.current.onerror = (error) => {
        console.error("❌ RFID WebSocket error:", error);
        setRfidStatus("error");
      };
    } catch (error) {
      console.error("🚫 RFID connection failed:", error);
      setRfidStatus("error");
    }
  };

  const handleRFIDMessage = (data) => {
    const timestamp = new Date();
    setLastHeartbeat(timestamp);

    switch (data.type) {
      case "rfid_status":
        setRfidStatus(data.status);
        setScanningActive(data.scanning || false);
        break;

      case "rfid_card_detected":
        const cardData = {
          id: data.cardId,
          timestamp: timestamp,
          studentId: data.studentId || null,
          studentName: data.studentName || "Unknown Student",
          classId: data.classId || null,
          className: data.className || null,
          status: data.status || "present",
        };

        setLastCardRead(cardData);
        setRecentCards((prev) => [cardData, ...prev.slice(0, 9)]); // Keep last 10
        setTotalReads((prev) => prev + 1);

        // Play notification sound
        playNotificationSound();
        break;

      case "rfid_heartbeat":
        setLastHeartbeat(timestamp);
        setRfidStatus(data.status || "connected");
        break;

      case "rfid_error":
        console.error("RFID Error:", data.message);
        setRfidStatus("error");
        break;

      default:
        console.log("Unknown RFID message type:", data.type);
    }
  };

  const playNotificationSound = () => {
    try {
      // Create audio context for card read notification
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.log("Audio notification not available");
    }
  };

  const sendRFIDCommand = (command) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "rfid_command",
          command: command,
        })
      );
    }
  };

  const startScanning = () => {
    sendRFIDCommand("START_SCAN");
    setScanningActive(true);
  };

  const stopScanning = () => {
    sendRFIDCommand("STOP_SCAN");
    setScanningActive(false);
  };

  const getStatusColor = () => {
    switch (rfidStatus) {
      case "connected":
        return "text-blue-500";
      case "scanning":
        return "text-green-500";
      case "idle":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getStatusIcon = () => {
    switch (rfidStatus) {
      case "connected":
      case "idle":
        return <Wifi className="h-4 w-4" />;
      case "scanning":
        return <Activity className="h-4 w-4 animate-pulse" />;
      case "error":
        return <WifiOff className="h-4 w-4" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const formatTime = (date) => {
    return date ? date.toLocaleTimeString() : "Never";
  };

  const getTimeSinceLastCard = () => {
    if (!lastCardRead) return "No cards detected";
    const diff = Date.now() - lastCardRead.timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    return `${seconds}s ago`;
  };

  return (
    <div className="space-y-4">
      {/* RFID Status Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              RFID Monitor
            </CardTitle>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1"
                >
                  <XCircle className="h-3 w-3" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 ${getStatusColor()}`}>
                {getStatusIcon()}
                <span className="text-sm font-medium capitalize">
                  {rfidStatus}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Last: {formatTime(lastHeartbeat)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Total: {totalReads} cards</span>
            </div>

            <div className="flex items-center gap-2">
              {scanningActive ? (
                <Button
                  onClick={stopScanning}
                  size="sm"
                  variant="destructive"
                  className="flex items-center gap-1"
                >
                  <Square className="h-3 w-3" />
                  Stop Scan
                </Button>
              ) : (
                <Button
                  onClick={startScanning}
                  size="sm"
                  variant="default"
                  className="flex items-center gap-1"
                  disabled={!isConnected}
                >
                  <Play className="h-3 w-3" />
                  Start Scan
                </Button>
              )}
            </div>
          </div>

          {/* Connection Alert */}
          {!isConnected && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                RFID reader not connected. Check hardware connection and restart
                the service.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Last Card Read */}
      {lastCardRead && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-md flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-500" />
              Last Card Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Card ID</p>
                <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {lastCardRead.id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Student</p>
                <p className="font-medium">{lastCardRead.studentName}</p>
                {lastCardRead.studentId && (
                  <p className="text-xs text-gray-500">
                    ID: {lastCardRead.studentId}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Time</p>
                <p className="font-medium">
                  {formatTime(lastCardRead.timestamp)}
                </p>
                <p className="text-xs text-gray-500">
                  {getTimeSinceLastCard()}
                </p>
              </div>
            </div>

            {lastCardRead.className && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-gray-500">Class</p>
                <p className="font-medium">{lastCardRead.className}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Card Reads ({recentCards.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCards.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No recent card reads
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentCards.map((card, index) => (
                <div
                  key={`${card.id}-${card.timestamp.getTime()}`}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1 rounded-full ${
                        index === 0
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <CreditCard className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="font-mono text-xs">{card.id}</p>
                      <p className="text-xs text-gray-500">
                        {card.studentName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">
                      {formatTime(card.timestamp)}
                    </p>
                    <Badge
                      variant={
                        card.status === "present" ? "success" : "secondary"
                      }
                      className="text-xs"
                    >
                      {card.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RFIDMonitor;
