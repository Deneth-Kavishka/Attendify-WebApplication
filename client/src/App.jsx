import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth.jsx";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminStudents from "@/pages/admin-students";
import AdminLecturers from "@/pages/admin-lecturers";
import AdminClasses from "@/pages/admin-classes";
import AdminAttendance from "@/pages/admin-attendance";
import AdminExamEligibility from "@/pages/admin-exam-eligibility";
import AdminHardwareStatus from "@/pages/admin-hardware";
import LecturerPortal from "@/pages/lecturer-portal";
import StudentPortal from "@/pages/student-portal";
import ProtectedRoute from "@/components/ui/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route
        path="/admin"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/students"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminStudents />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/lecturers"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminLecturers />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/classes"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminClasses />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/attendance"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminAttendance />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/exam-eligibility"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminExamEligibility />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/hardware"
        component={() => (
          <ProtectedRoute role="admin">
            <AdminHardwareStatus />
          </ProtectedRoute>
        )}
      />
      <Route path="/lecturer">
        <ProtectedRoute role="lecturer">
          <LecturerPortal />
        </ProtectedRoute>
      </Route>
      <Route path="/student">
        <ProtectedRoute role="student">
          <StudentPortal />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
