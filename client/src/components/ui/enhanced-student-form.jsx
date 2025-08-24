import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRFIDReader } from "@/lib/rfid-reader";

export default function EnhancedStudentForm({
  student = null,
  onSubmit,
  isLoading = false,
  onCancel,
}) {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    // Basic Information
    fullName: student?.fullName || "",
    email: student?.email || "",
    studentId: student?.studentId || "",
    enrollmentYear: student?.enrollmentYear || new Date().getFullYear(),
    department: student?.department || "",
    active: student?.active ?? true,

    // Personal Information
    nic: student?.nic || "",
    mobileNumber: student?.mobileNumber || "",
    gender: student?.gender || "",
    dateOfBirth: student?.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString().split("T")[0]
      : "",
    address: student?.address || "",
    guardianName: student?.guardianName || "",
    guardianContact: student?.guardianContact || "",
    emergencyContact: student?.emergencyContact || "",

    // Academic Information
    batch: student?.batch || "",
    semester: student?.semester || "1",
    gpa: student?.gpa || "",

    // RFID & Face Recognition
    rfidCard: student?.rfidCard || "",
    rfidOption: student?.rfidCard ? "existing" : "none",
    faceRegistrationStatus: student?.faceRegistrationStatus || "pending",
  });

  const [faceImages, setFaceImages] = useState([]);
  const [faceImagePreviews, setFaceImagePreviews] = useState([]);
  const [rfidScanning, setRfidScanning] = useState(false);
  const [scannedRfid, setScannedRfid] = useState("");
  const [isGeneratingRfid, setIsGeneratingRfid] = useState(false);
  const { scanCard, stopScan, getReaderStatus, isSupported } = useRFIDReader();

  const generateNewRfid = async () => {
    setIsGeneratingRfid(true);
    try {
      const response = await fetch("/api/rfid/generate", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          ...formData,
          rfidCard: data.rfidCard,
          rfidOption: "generate",
        });
        toast({
          title: "RFID Generated",
          description: `New RFID card generated: ${data.rfidCard}`,
        });
      }
    } catch (error) {
      console.error("Error generating RFID:", error);
      toast({
        title: "Error",
        description: "Failed to generate RFID card",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRfid(false);
    }
  };

  const handleFaceImagesChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) return;

    // Check if total images will exceed 15 (max limit)
    if (faceImages.length + files.length > 15) {
      toast({
        title: "Too Many Images",
        description: "Maximum 15 face images allowed",
        variant: "destructive",
      });
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 5MB`,
          variant: "destructive",
        });
        return;
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not an image`,
          variant: "destructive",
        });
        return;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push({
          id: Date.now() + Math.random(),
          file: file,
          preview: e.target.result,
          name: file.name,
        });

        if (newPreviews.length === validFiles.length) {
          setFaceImages((prev) => [...prev, ...validFiles]);
          setFaceImagePreviews((prev) => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFaceImage = (index) => {
    setFaceImages((prev) => prev.filter((_, i) => i !== index));
    setFaceImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const startRfidScan = async () => {
    setRfidScanning(true);
    setScannedRfid("");

    // Check if RFID reader is supported
    if (!isSupported) {
      toast({
        title: "RFID Not Supported",
        description:
          "Your browser doesn't support RFID reader access. Please use Chrome or Edge.",
        variant: "destructive",
      });
      setRfidScanning(false);
      return;
    }

    toast({
      title: "RFID Scanner Starting",
      description: "Connecting to RFID reader... Present your card when ready.",
    });

    try {
      // Start real RFID scanning
      const cardId = await scanCard();

      // Check if card is already assigned to another student
      const checkResponse = await fetch(`/api/rfid/check/${cardId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (!checkData.available) {
          toast({
            title: "RFID Card Already Assigned",
            description: `This card is already assigned to student: ${checkData.assignedTo}`,
            variant: "destructive",
          });
          setRfidScanning(false);
          return;
        }
      }

      // Card is available, assign it
      setScannedRfid(cardId);
      setFormData((prev) => ({
        ...prev,
        rfidCard: cardId,
        rfidOption: "scan",
      }));
      setRfidScanning(false);

      toast({
        title: "RFID Card Scanned Successfully",
        description: `Card ${cardId} is ready for assignment`,
      });
    } catch (error) {
      console.error("RFID scanning error:", error);
      toast({
        title: "RFID Scanning Failed",
        description:
          error.message || "Failed to scan RFID card. Please try again.",
        variant: "destructive",
      });
      setRfidScanning(false);
    }
  };

  const stopRfidScan = () => {
    setRfidScanning(false);
    stopScan();
    toast({
      title: "RFID Scanning Stopped",
      description: "RFID scanner has been stopped",
    });
  };

  const validateForm = () => {
    // Required fields validation
    const requiredFields = [
      "fullName",
      "email",
      "studentId",
      "nic",
      "mobileNumber",
      "gender",
      "dateOfBirth",
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        toast({
          title: "Validation Error",
          description: `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } is required`,
          variant: "destructive",
        });
        return false;
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    // NIC validation (basic check for Sri Lankan NIC)
    const nicRegex = /^(\d{9}[vVxX]|\d{12})$/;
    if (!nicRegex.test(formData.nic)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid NIC number",
        variant: "destructive",
      });
      return false;
    }

    // Mobile number validation
    const mobileRegex = /^(\+94|0)?[7][0-9]{8}$/;
    if (!mobileRegex.test(formData.mobileNumber.replace(/\s/g, ""))) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid Sri Lankan mobile number",
        variant: "destructive",
      });
      return false;
    }

    // Face images validation - minimum 10 images required
    if (faceImages.length < 10) {
      toast({
        title: "Validation Error",
        description: `Face recognition requires minimum 10 images. Currently uploaded: ${faceImages.length}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Prepare form data including face image
    const submitData = {
      ...formData,
      dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
      gpa: formData.gpa ? parseFloat(formData.gpa) : null,
      rfidCard: formData.rfidOption === "none" ? null : formData.rfidCard,
      mobileNumber: formData.mobileNumber.replace(/\s/g, ""), // Remove spaces
    };

    // If face images are provided, convert all to base64
    if (faceImages.length > 0) {
      const faceImageDataArray = [];
      let processedCount = 0;

      const processNextImage = (index) => {
        if (index >= faceImages.length) {
          submitData.faceImagesData = faceImageDataArray;
          submitData.faceRegistrationStatus = "pending";
          onSubmit(submitData);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          faceImageDataArray.push({
            data: reader.result,
            name: faceImages[index].name,
            index: index,
          });
          processNextImage(index + 1);
        };
        reader.readAsDataURL(faceImages[index]);
      };

      processNextImage(0);
    } else {
      onSubmit(submitData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Section */}
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <i className="fas fa-user text-blue-600 mr-2"></i>
            Basic Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="student@university.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID *</Label>
              <Input
                id="studentId"
                value={formData.studentId}
                onChange={(e) =>
                  setFormData({ ...formData, studentId: e.target.value })
                }
                placeholder="e.g., STU2024001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) =>
                  setFormData({ ...formData, department: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Computer Science">
                    Computer Science
                  </SelectItem>
                  <SelectItem value="Information Technology">
                    Information Technology
                  </SelectItem>
                  <SelectItem value="Software Engineering">
                    Software Engineering
                  </SelectItem>
                  <SelectItem value="Data Science">Data Science</SelectItem>
                  <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                  <SelectItem value="Business Information Systems">
                    Business Information Systems
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
            <i className="fas fa-id-card text-green-600 mr-2"></i>
            Personal Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nic">National Identity Card (NIC) *</Label>
              <Input
                id="nic"
                value={formData.nic}
                onChange={(e) =>
                  setFormData({ ...formData, nic: e.target.value })
                }
                placeholder="e.g., 200012345678 or 991234567V"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile Number *</Label>
              <Input
                id="mobileNumber"
                value={formData.mobileNumber}
                onChange={(e) =>
                  setFormData({ ...formData, mobileNumber: e.target.value })
                }
                placeholder="e.g., +94 77 123 4567"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
                required
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                rows="2"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Complete residential address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianName">Guardian Name</Label>
              <Input
                id="guardianName"
                value={formData.guardianName}
                onChange={(e) =>
                  setFormData({ ...formData, guardianName: e.target.value })
                }
                placeholder="Parent/Guardian full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianContact">Guardian Contact</Label>
              <Input
                id="guardianContact"
                value={formData.guardianContact}
                onChange={(e) =>
                  setFormData({ ...formData, guardianContact: e.target.value })
                }
                placeholder="Guardian mobile number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) =>
                  setFormData({ ...formData, emergencyContact: e.target.value })
                }
                placeholder="Emergency contact number"
              />
            </div>
          </div>
        </div>

        {/* Academic Information Section */}
        <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
            <i className="fas fa-graduation-cap text-yellow-600 mr-2"></i>
            Academic Information
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="enrollmentYear">Enrollment Year *</Label>
              <Input
                id="enrollmentYear"
                type="number"
                value={formData.enrollmentYear}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enrollmentYear: parseInt(e.target.value),
                  })
                }
                min="2020"
                max="2030"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch">Batch</Label>
              <Input
                id="batch"
                value={formData.batch}
                onChange={(e) =>
                  setFormData({ ...formData, batch: e.target.value })
                }
                placeholder="e.g., 2024A, 2024B"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Current Semester</Label>
              <Select
                value={formData.semester}
                onValueChange={(value) =>
                  setFormData({ ...formData, semester: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <SelectItem key={sem} value={sem.toString()}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* RFID Card Assignment Section */}
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <i className="fas fa-credit-card text-blue-600 mr-2"></i>
            RFID Card Assignment
          </h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="rfidOption"
                  value="none"
                  checked={formData.rfidOption === "none"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rfidOption: e.target.value,
                      rfidCard: "",
                    })
                  }
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">
                  No RFID Card (Face Recognition Only)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="rfidOption"
                  value="generate"
                  checked={formData.rfidOption === "generate"}
                  onChange={(e) =>
                    setFormData({ ...formData, rfidOption: e.target.value })
                  }
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Generate New RFID Card</span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="rfidOption"
                  value="manual"
                  checked={formData.rfidOption === "manual"}
                  onChange={(e) =>
                    setFormData({ ...formData, rfidOption: e.target.value })
                  }
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Enter Manually</span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="rfidOption"
                  value="scan"
                  checked={formData.rfidOption === "scan"}
                  onChange={(e) =>
                    setFormData({ ...formData, rfidOption: e.target.value })
                  }
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm">Scan RFID Card</span>
              </label>
            </div>

            {formData.rfidOption === "generate" && (
              <div className="flex items-center space-x-3">
                <Button
                  type="button"
                  onClick={generateNewRfid}
                  disabled={isGeneratingRfid}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isGeneratingRfid ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magic mr-2"></i>
                      Generate RFID Card
                    </>
                  )}
                </Button>
                {formData.rfidCard && (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    <i className="fas fa-check mr-1"></i>
                    Generated: {formData.rfidCard}
                  </Badge>
                )}
              </div>
            )}

            {formData.rfidOption === "scan" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  {!rfidScanning ? (
                    <Button
                      type="button"
                      onClick={startRfidScan}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <i className="fas fa-broadcast-tower mr-2"></i>
                      Start RFID Scan
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={stopRfidScan}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <i className="fas fa-stop mr-2"></i>
                      Stop Scanning
                    </Button>
                  )}

                  {rfidScanning && (
                    <div className="flex items-center text-purple-600">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      <span className="text-sm">Scanning for RFID card...</span>
                    </div>
                  )}
                </div>

                {scannedRfid && (
                  <div className="p-3 bg-purple-100 border border-purple-200 rounded-md">
                    <div className="flex items-center">
                      <i className="fas fa-check-circle text-purple-600 mr-2"></i>
                      <span className="text-sm text-purple-700">
                        RFID Card Scanned: <strong>{scannedRfid}</strong>
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Present the RFID card to the scanner when prompted. The card
                  ID will be automatically captured.
                </p>
              </div>
            )}

            {formData.rfidOption === "manual" && (
              <div className="space-y-2">
                <Input
                  placeholder="Enter RFID card number (e.g., RFID123456)"
                  value={formData.rfidCard}
                  onChange={(e) =>
                    setFormData({ ...formData, rfidCard: e.target.value })
                  }
                  className="max-w-md"
                />
                <p className="text-xs text-gray-500">
                  Enter the physical RFID card number that will be given to the
                  student
                </p>
              </div>
            )}

            {formData.rfidCard && formData.rfidOption !== "none" && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <i className="fas fa-check-circle text-green-600 mr-2"></i>
                  <span className="text-sm text-green-700">
                    RFID Card Assigned:{" "}
                    <strong className="font-mono text-lg">
                      {formData.rfidCard}
                    </strong>
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  This card will be linked to the student's account for
                  attendance tracking. Make sure to print and give the physical
                  card to the student.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Face Recognition Section */}
        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
          <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
            <i className="fas fa-camera text-purple-600 mr-2"></i>
            Face Recognition Training Setup
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start">
                <i className="fas fa-info-circle text-yellow-600 mr-2 mt-0.5"></i>
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">
                    Face Recognition Requirements:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Minimum 10 images required for accurate recognition</li>
                    <li>Maximum 15 images allowed</li>
                    <li>
                      Use clear, well-lit photos facing directly at camera
                    </li>
                    <li>
                      Vary slight angles and expressions for better training
                    </li>
                    <li>Remove glasses, hats, or face coverings if possible</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="faceImages"
                className="block text-base font-medium"
              >
                Upload Face Training Images ({faceImages.length}/15)
                <span className="text-red-500 ml-1">* (Min: 10)</span>
              </Label>

              <Input
                id="faceImages"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFaceImagesChange}
                className="mb-2"
              />

              <div className="text-xs text-gray-500 space-y-1">
                <p>
                  • Select multiple images at once (Ctrl+Click or Cmd+Click)
                </p>
                <p>• Supported formats: JPG, PNG (max 5MB each)</p>
                <p>
                  • Current count:{" "}
                  <strong
                    className={
                      faceImages.length < 10 ? "text-red-600" : "text-green-600"
                    }
                  >
                    {faceImages.length}
                  </strong>{" "}
                  images
                </p>
              </div>
            </div>

            {/* Image Previews Grid */}
            {faceImagePreviews.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-purple-900">
                  Uploaded Images:
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {faceImagePreviews.map((preview, index) => (
                    <div key={preview.id} className="relative group">
                      <div className="w-20 h-20 border-2 border-purple-300 rounded-lg overflow-hidden bg-white">
                        <img
                          src={preview.preview}
                          alt={`Face ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFaceImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <p className="text-xs text-center mt-1 truncate">
                        {preview.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Training Data Progress</span>
                <span
                  className={`font-medium ${
                    faceImages.length < 10 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {faceImages.length}/10 minimum
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    faceImages.length < 10 ? "bg-red-400" : "bg-green-500"
                  }`}
                  style={{
                    width: `${Math.min((faceImages.length / 10) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            {faceImages.length > 0 && (
              <div
                className={`p-3 border rounded-md ${
                  faceImages.length >= 10
                    ? "bg-green-100 border-green-200"
                    : "bg-orange-100 border-orange-200"
                }`}
              >
                <div className="flex items-center">
                  <i
                    className={`mr-2 ${
                      faceImages.length >= 10
                        ? "fas fa-check-circle text-green-600"
                        : "fas fa-exclamation-triangle text-orange-600"
                    }`}
                  ></i>
                  <span
                    className={`text-sm ${
                      faceImages.length >= 10
                        ? "text-green-700"
                        : "text-orange-700"
                    }`}
                  >
                    {faceImages.length >= 10
                      ? `Perfect! ${faceImages.length} images ready for face recognition training.`
                      : `${
                          10 - faceImages.length
                        } more images needed for accurate face recognition.`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Section */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) =>
                setFormData({ ...formData, active: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <Label htmlFor="active" className="text-sm font-medium">
              Active Student
            </Label>
            <span className="text-xs text-gray-500">
              (Student can access the system and mark attendance)
            </span>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {student ? "Updating..." : "Registering..."}
              </>
            ) : (
              <>
                <i
                  className={`fas ${student ? "fa-save" : "fa-user-plus"} mr-2`}
                ></i>
                {student ? "Update Student" : "Register Student"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
