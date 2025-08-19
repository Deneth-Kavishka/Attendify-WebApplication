import { useAuth } from '@/lib/auth.jsx';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    } else if (user && role && user.role !== role) {
      // Redirect to appropriate dashboard based on user role
      const dashboardRoutes = {
        admin: '/admin',
        lecturer: '/lecturer',
        student: '/student'
      };
      setLocation(dashboardRoutes[user.role] || '/login');
    }
  }, [user, loading, role, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (role && user.role !== role) {
    return null;
  }

  return children;
}
