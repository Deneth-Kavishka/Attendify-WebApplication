import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth.jsx";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import LecturerPortal from "@/pages/lecturer-portal";
import StudentPortal from "@/pages/student-portal";
import ProtectedRoute from "@/components/ui/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      <Route path="/admin">
        <ProtectedRoute role="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
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
