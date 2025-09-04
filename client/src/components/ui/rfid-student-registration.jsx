import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Alert, AlertDescription } from "./alert";
import { Textarea } from "./textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import {
  CreditCard,
  User,
  Mail,
  Phone,
  Calendar,
  Hash,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  UserPlus,
  Zap,
} from "lucide-react";

const RFIDStudentRegistration = () => {
  // RFID Scanner States
  const [isRFIDConnected, setIsRFIDConnected] = useState(false);
  const [rfidStatus, setRfidStatus] = useState("disconnected");
  const [lastCardRead, setLastCardRead] = useState(null);
  const [waitingForCard, setWaitingForCard] = useState(false);
  const [cardReadTimeout, setCardReadTimeout] = useState(null);

  // Student Form States
  const [studentData, setStudentData] = useState({
    student_id: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    enrollment_year: new Date().getFullYear(),
    rfid_card_id: "",
    status: "active",
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // WebSocket connection for RFID
  const ws = useRef(null);

  // Connect to RFID WebSocket service
  useEffect(() => {
    connectToRFID();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (cardReadTimeout) {
        clearTimeout(cardReadTimeout);
      }
    };
  }, []);

  const connectToRFID = () => {
    try {
      // Connect to the correct WebSocket server (port 8080, not 5000)
      ws.current = new WebSocket("ws://localhost:8080");

      ws.current.onopen = () => {
        console.log("✅ RFID WebSocket connected");
        setIsRFIDConnected(true);
        setRfidStatus("connected");

        // Subscribe to RFID events
        ws.current.send(
          JSON.stringify({
            type: "subscribe_rfid",
            component: "student_registration",
          })
        );
      };

      ws.current.onclose = () => {
        console.log("❌ RFID WebSocket disconnected");
        setIsRFIDConnected(false);
        setRfidStatus("disconnected");
        setWaitingForCard(false);
      };

      ws.current.onerror = (error) => {
        console.error("❌ RFID WebSocket error:", error);
        setIsRFIDConnected(false);
        setRfidStatus("error");
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRFIDMessage(data);
        } catch (error) {
          console.error("Error parsing RFID message:", error);
        }
      };
    } catch (error) {
      console.error("Failed to connect to RFID service:", error);
      setRfidStatus("error");
    }
  };

  const handleRFIDMessage = (data) => {
    console.log("📡 RFID Message:", data);

    // Handle different card detection message types
    if (data.type === "card_detected" || data.type === "rfid_card_detected") {
      const cardId = data.cardId;
      console.log("🏷️ Card detected:", cardId);

      setLastCardRead({
        cardId: cardId,
        timestamp: new Date(),
        deviceId: data.deviceId,
      });

      // Auto-fill the RFID card ID in the form
      setStudentData((prev) => ({
        ...prev,
        rfid_card_id: cardId,
      }));

      setWaitingForCard(false);
      if (cardReadTimeout) {
        clearTimeout(cardReadTimeout);
        setCardReadTimeout(null);
      }

      // Clear any previous errors for RFID field
      setFormErrors((prev) => ({
        ...prev,
        rfid_card_id: null,
      }));
    }

    // Handle device registration
    if (data.type === "device_register" && data.deviceType === "RFID_READER") {
      console.log("📝 RFID Device registered:", data.deviceId);
      setRfidStatus("ready");
    }

    // Handle welcome messages
    if (data.type === "welcome") {
      console.log("🔗 RFID Service:", data.message);
      setRfidStatus("ready");
    }

    // Handle subscription confirmation
    if (data.type === "rfid_subscription_confirmed") {
      console.log("✅ RFID subscription confirmed");
      setRfidStatus("ready");
    }
  };

  const startRFIDScanning = () => {
    if (!isRFIDConnected) {
      alert("RFID scanner not connected. Please check the device.");
      return;
    }

    setWaitingForCard(true);
    setLastCardRead(null);

    // Send start scanning command
    const command = {
      type: "command",
      command: "START_SCAN",
      deviceId: "RFID_NODEMCU_001",
    };

    ws.current.send(JSON.stringify(command));

    // Set timeout for card reading (30 seconds)
    const timeout = setTimeout(() => {
      setWaitingForCard(false);
      alert("Card reading timeout. Please try again.");
    }, 30000);

    setCardReadTimeout(timeout);
  };

  const stopRFIDScanning = () => {
    setWaitingForCard(false);
    if (cardReadTimeout) {
      clearTimeout(cardReadTimeout);
      setCardReadTimeout(null);
    }

    if (isRFIDConnected) {
      const command = {
        type: "command",
        command: "STOP_SCAN",
        deviceId: "RFID_NODEMCU_001",
      };
      ws.current.send(JSON.stringify(command));
    }
  };

  const handleInputChange = (field, value) => {
    setStudentData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!studentData.student_id.trim()) {
      errors.student_id = "Student ID is required";
    }

    if (!studentData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!studentData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/\\S+@\\S+\\.\\S+/.test(studentData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!studentData.rfid_card_id.trim()) {
      errors.rfid_card_id = "RFID Card ID is required. Please scan a card.";
    }

    if (!studentData.enrollment_year || studentData.enrollment_year < 2000) {
      errors.enrollment_year = "Please enter a valid enrollment year";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(studentData),
      });

      if (response.ok) {
        setSubmitStatus("success");
        // Reset form
        setStudentData({
          student_id: "",
          name: "",
          email: "",
          phone: "",
          address: "",
          enrollment_year: new Date().getFullYear(),
          rfid_card_id: "",
          status: "active",
        });
        setLastCardRead(null);
      } else {
        const error = await response.json();
        setSubmitStatus("error");
        console.error("Registration failed:", error);
      }
    } catch (error) {
      console.error("Registration error:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearForm = () => {
    setStudentData({
      student_id: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      enrollment_year: new Date().getFullYear(),
      rfid_card_id: "",
      status: "active",
    });
    setFormErrors({});
    setLastCardRead(null);
    setSubmitStatus(null);
  };

  return (
    <div className="space-y-6">
      {/* RFID Scanner Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            RFID Card Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRFIDConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm">
                Scanner Status:{" "}
                <Badge
                  variant={isRFIDConnected ? "default" : "destructive"}
                  className="ml-1"
                >
                  {rfidStatus}
                </Badge>
              </span>
            </div>

            <div className="flex gap-2">
              {!waitingForCard ? (
                <Button
                  onClick={startRFIDScanning}
                  disabled={!isRFIDConnected}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Zap className="w-4 h-4" />
                  Scan Card
                </Button>
              ) : (
                <Button
                  onClick={stopRFIDScanning}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cancel Scan
                </Button>
              )}
            </div>
          </div>

          {waitingForCard && (
            <Alert className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Waiting for RFID card... Please place your card near the
                scanner.
              </AlertDescription>
            </Alert>
          )}

          {lastCardRead && (
            <Alert className="mt-3">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Card scanned successfully:{" "}
                <strong>{lastCardRead.cardId}</strong>
                <br />
                <span className="text-xs text-gray-500">
                  {lastCardRead.timestamp.toLocaleString()}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Student Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Register New Student
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Student ID */}
            <div className="space-y-2">
              <Label htmlFor="student_id">
                <Hash className="w-4 h-4 inline mr-1" />
                Student ID *
              </Label>
              <Input
                id="student_id"
                value={studentData.student_id}
                onChange={(e) =>
                  handleInputChange("student_id", e.target.value)
                }
                placeholder="Enter student ID (e.g., ST2024001)"
                className={formErrors.student_id ? "border-red-500" : ""}
              />
              {formErrors.student_id && (
                <p className="text-sm text-red-500">{formErrors.student_id}</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                <User className="w-4 h-4 inline mr-1" />
                Full Name *
              </Label>
              <Input
                id="name"
                value={studentData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter student's full name"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500">{formErrors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                value={studentData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter email address"
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && (
                <p className="text-sm text-red-500">{formErrors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </Label>
              <Input
                id="phone"
                value={studentData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Enter phone number (optional)"
              />
            </div>

            {/* RFID Card ID */}
            <div className="space-y-2">
              <Label htmlFor="rfid_card_id">
                <CreditCard className="w-4 h-4 inline mr-1" />
                RFID Card ID *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="rfid_card_id"
                  value={studentData.rfid_card_id}
                  onChange={(e) =>
                    handleInputChange("rfid_card_id", e.target.value)
                  }
                  placeholder="Scan card or enter manually"
                  className={formErrors.rfid_card_id ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  onClick={startRFIDScanning}
                  disabled={!isRFIDConnected || waitingForCard}
                  variant="outline"
                  size="sm"
                >
                  {waitingForCard ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {formErrors.rfid_card_id && (
                <p className="text-sm text-red-500">
                  {formErrors.rfid_card_id}
                </p>
              )}
            </div>

            {/* Enrollment Year */}
            <div className="space-y-2">
              <Label htmlFor="enrollment_year">
                <Calendar className="w-4 h-4 inline mr-1" />
                Enrollment Year *
              </Label>
              <Input
                id="enrollment_year"
                type="number"
                value={studentData.enrollment_year}
                onChange={(e) =>
                  handleInputChange("enrollment_year", parseInt(e.target.value))
                }
                min="2000"
                max="2030"
                className={formErrors.enrollment_year ? "border-red-500" : ""}
              />
              {formErrors.enrollment_year && (
                <p className="text-sm text-red-500">
                  {formErrors.enrollment_year}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={studentData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter student's address (optional)"
                rows={3}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={studentData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Status */}
            {submitStatus === "success" && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Student registered successfully! RFID card is now linked.
                </AlertDescription>
              </Alert>
            )}

            {submitStatus === "error" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Registration failed. Please check the details and try again.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {isSubmitting ? "Registering..." : "Register Student"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={clearForm}
                disabled={isSubmitting}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RFIDStudentRegistration;
