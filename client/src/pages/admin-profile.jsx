import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth.jsx";
import { useToast } from "@/hooks/use-toast";

export default function AdminProfile() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [profileFormData, setProfileFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Fetch user profile data
  const { data: profileData = {}, isLoading } = useQuery({
    queryKey: ["/api/users/profile"],
    queryFn: async () => {
      const response = await fetch("/api/users/profile", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  // Fetch hardware devices for sidebar
  const { data: hardwareDevices = [] } = useQuery({
    queryKey: ["/api/hardware"],
    refetchInterval: 5000,
  });

  // Fetch activity logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["/api/users/activity"],
    queryFn: async () => {
      const response = await fetch("/api/users/activity", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      return response.json();
    },
  });

  // Update profile information
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData) => {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
      queryClient.invalidateQueries(["/api/users/profile"]);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (passwordData) => {
      const response = await fetch("/api/users/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(passwordData),
      });
      if (!response.ok) throw new Error("Failed to change password");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been changed successfully.",
      });
      setProfileFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    },
    onError: (error) => {
      toast({
        title: "Password Change Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (profileData) {
      setProfileFormData((prev) => ({
        ...prev,
        fullName: profileData.fullName || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
        department: profileData.department || "",
      }));
    }
  }, [profileData]);

  const handleInputChange = (field, value) => {
    setProfileFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    const { fullName, email, phone, department } = profileFormData;
    updateProfileMutation.mutate({ fullName, email, phone, department });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = profileFormData;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-background">
      <Sidebar hardwareStatus={hardwareDevices} />

      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-surface shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/admin")}
                className="text-gray-600 hover:text-gray-900"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back to Dashboard
              </Button>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Profile Settings
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your account information and preferences
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Profile Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-white text-2xl"></i>
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profileData.fullName || "Administrator"}
                  </h1>
                  <p className="text-gray-600">{profileData.email}</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700"
                    >
                      <i className="fas fa-shield-alt mr-1"></i>
                      {profileData.role || "Administrator"}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      <i className="fas fa-calendar mr-1"></i>
                      Joined{" "}
                      {new Date(
                        profileData.createdAt || Date.now()
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Last Login</div>
                  <div className="text-sm font-medium">
                    {new Date(
                      profileData.lastLogin || Date.now()
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Tabs */}
            <Tabs defaultValue="general" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General Information</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="activity">Activity Logs</TabsTrigger>
              </TabsList>

              {/* General Information Tab */}
              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      Update your personal details and contact information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Full Name
                          </label>
                          <Input
                            value={profileFormData.fullName}
                            onChange={(e) =>
                              handleInputChange("fullName", e.target.value)
                            }
                            placeholder="Enter your full name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Email Address
                          </label>
                          <Input
                            type="email"
                            value={profileFormData.email}
                            onChange={(e) =>
                              handleInputChange("email", e.target.value)
                            }
                            placeholder="Enter your email"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Phone Number
                          </label>
                          <Input
                            value={profileFormData.phone}
                            onChange={(e) =>
                              handleInputChange("phone", e.target.value)
                            }
                            placeholder="Enter your phone number"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Department
                          </label>
                          <Input
                            value={profileFormData.department}
                            onChange={(e) =>
                              handleInputChange("department", e.target.value)
                            }
                            placeholder="Enter your department"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={updateProfileMutation.isPending}
                        >
                          {updateProfileMutation.isPending
                            ? "Updating..."
                            : "Update Profile"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Current Password
                        </label>
                        <Input
                          type="password"
                          value={profileFormData.currentPassword}
                          onChange={(e) =>
                            handleInputChange("currentPassword", e.target.value)
                          }
                          placeholder="Enter current password"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            New Password
                          </label>
                          <Input
                            type="password"
                            value={profileFormData.newPassword}
                            onChange={(e) =>
                              handleInputChange("newPassword", e.target.value)
                            }
                            placeholder="Enter new password"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Confirm New Password
                          </label>
                          <Input
                            type="password"
                            value={profileFormData.confirmPassword}
                            onChange={(e) =>
                              handleInputChange(
                                "confirmPassword",
                                e.target.value
                              )
                            }
                            placeholder="Confirm new password"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-4">
                        <Button
                          type="submit"
                          disabled={changePasswordMutation.isPending}
                        >
                          {changePasswordMutation.isPending
                            ? "Changing..."
                            : "Change Password"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Security Information</CardTitle>
                    <CardDescription>
                      Your account security details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-gray-600">
                          Two-Factor Authentication
                        </span>
                        <Badge variant="outline" className="text-yellow-600">
                          Not Enabled
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-gray-600">
                          Last Password Change
                        </span>
                        <span className="text-sm font-medium">
                          {new Date(
                            profileData.lastPasswordChange || Date.now()
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-600">
                          Account Status
                        </span>
                        <Badge className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Logs Tab */}
              <TabsContent value="activity">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Your recent login and system activity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activityLogs.length > 0 ? (
                        activityLogs.map((log, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-4 p-3 border rounded-lg"
                          >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <i
                                className={`fas ${log.icon} text-blue-600 text-sm`}
                              ></i>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {log.action}
                              </p>
                              <p className="text-xs text-gray-500">
                                {log.description}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">
                                {new Date(log.timestamp).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-400">
                                {log.ipAddress}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <i className="fas fa-history text-4xl text-gray-300 mb-4"></i>
                          <p className="text-gray-500">
                            No recent activity found
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
