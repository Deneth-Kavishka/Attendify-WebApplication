import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function FaceEnrollmentForm() {
  const { toast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      setCameraStream(stream);
      setIsCapturing(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      toast({
        title: "Camera Started",
        description: "Position your face in the camera view and click capture",
      });
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCapturing(false);
    setCapturedImage(null);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);

    toast({
      title: "Image Captured",
      description:
        "Review the captured image and click enroll if it looks good",
    });
  };

  const enrollFace = async () => {
    if (!studentId || !studentName || !capturedImage) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields and capture an image",
        variant: "destructive",
      });
      return;
    }

    setIsEnrolling(true);

    try {
      const response = await fetch("http://localhost:8000/api/face/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentId,
          student_name: studentName,
          image: capturedImage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Enrollment Successful",
          description: `Face enrolled for ${studentName} (ID: ${studentId})`,
        });

        // Reset form
        setStudentId("");
        setStudentName("");
        setCapturedImage(null);
        stopCamera();
      } else {
        toast({
          title: "Enrollment Failed",
          description: data.error || "Could not enroll face",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Enrollment error:", error);
      toast({
        title: "Network Error",
        description: "Could not connect to face recognition service",
        variant: "destructive",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <i className="fas fa-user-plus mr-2 text-blue-600"></i>
          Face Enrollment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Student Information Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="studentId">Student ID</Label>
            <Input
              id="studentId"
              placeholder="e.g., ST001"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="studentName">Student Name</Label>
            <Input
              id="studentName"
              placeholder="e.g., John Doe"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
        </div>

        {/* Camera Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Face Capture</h3>
            <div className="space-x-2">
              {!isCapturing ? (
                <Button onClick={startCamera}>
                  <i className="fas fa-camera mr-2"></i>
                  Start Camera
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={captureImage}>
                    <i className="fas fa-camera mr-2"></i>
                    Capture
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <i className="fas fa-stop mr-2"></i>
                    Stop Camera
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Camera/Image Display */}
          <div
            className="relative bg-gray-100 rounded-lg overflow-hidden"
            style={{ aspectRatio: "4/3" }}
          >
            {isCapturing && !capturedImage && (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
              />
            )}

            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured face"
                className="w-full h-full object-cover"
              />
            )}

            {!isCapturing && !capturedImage && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <i className="fas fa-camera text-4xl mb-2"></i>
                  <p>Click "Start Camera" to begin face capture</p>
                </div>
              </div>
            )}

            {/* Face detection guide overlay */}
            {isCapturing && !capturedImage && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white rounded-full opacity-50">
                  <div className="absolute inset-4 border border-white rounded-full opacity-30"></div>
                </div>
              </div>
            )}
          </div>

          {/* Capture Instructions */}
          {isCapturing && !capturedImage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                Capture Instructions:
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Position your face within the circular guide</li>
                <li>• Look directly at the camera</li>
                <li>• Ensure good lighting on your face</li>
                <li>• Remove glasses or hat if possible</li>
                <li>• Click "Capture" when ready</li>
              </ul>
            </div>
          )}
        </div>

        {/* Enrollment Button */}
        <div className="flex justify-end space-x-2">
          {capturedImage && (
            <Button variant="outline" onClick={() => setCapturedImage(null)}>
              Retake Photo
            </Button>
          )}

          <Button
            onClick={enrollFace}
            disabled={
              !studentId || !studentName || !capturedImage || isEnrolling
            }
            className="min-w-32"
          >
            {isEnrolling ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Enrolling...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus mr-2"></i>
                Enroll Face
              </>
            )}
          </Button>
        </div>

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </CardContent>
    </Card>
  );
}
