import { useState } from 'react';
import { useAuth } from '@/lib/auth.jsx';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect if already authenticated
  if (user) {
    const dashboardRoutes = {
      admin: '/admin',
      lecturer: '/lecturer',
      student: '/student'
    };
    setLocation(dashboardRoutes[user.role] || '/admin');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        toast({
          title: "Login successful",
          description: "Welcome to Smart Attendance Management System"
        });
        
        // Redirect based on user role will be handled by the auth context
        const user = JSON.parse(localStorage.getItem('user'));
        const dashboardRoutes = {
          admin: '/admin',
          lecturer: '/lecturer',
          student: '/student'
        };
        setLocation(dashboardRoutes[user?.role] || '/admin');
      } else {
        toast({
          title: "Login failed",
          description: result.message || "Invalid credentials",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Login error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-20 h-20 bg-blue-200 rounded-full animate-pulse"></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-purple-200 rounded-full animate-bounce delay-300"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-indigo-200 rounded-full animate-pulse delay-700"></div>
        <div className="absolute bottom-32 right-10 w-12 h-12 bg-pink-200 rounded-full animate-bounce delay-1000"></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* 3D Card with enhanced styling */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 transform hover:scale-105 transition-all duration-300 overflow-hidden">
          {/* Header with 3D logo */}
          <div className="text-center pt-12 pb-8 relative">
            {/* 3D Logo container */}
            <div className="relative mx-auto mb-6">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl transform rotate-3 hover:rotate-6 transition-transform duration-300">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl flex items-center justify-center shadow-inner">
                  <i className="fas fa-user-check text-white text-3xl"></i>
                </div>
              </div>
              {/* 3D shadow effect */}
              <div className="absolute top-2 left-2 w-24 h-24 bg-gradient-to-r from-blue-300/30 to-purple-400/30 rounded-2xl -z-10 transform rotate-3"></div>
            </div>
            
            {/* Brand name with 3D text effect */}
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 drop-shadow-sm">
              Attendify
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide">
              Smart Attendance Management
            </p>
          </div>
          
          {/* Form content */}
          <div className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="h-12 pl-12 bg-gray-50/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                  <i className="fas fa-user absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 pl-12 bg-gray-50/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    required
                  />
                  <i className="fas fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                </div>
              </div>

              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    Sign In to Attendify
                  </>
                )}
              </Button>
            </form>

            {/* Demo credentials section */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-700 dark:to-slate-600 rounded-xl border border-blue-100 dark:border-slate-600">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mb-3 flex items-center">
                <i className="fas fa-info-circle mr-2 text-blue-500"></i>
                Demo Credentials
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <div className="flex items-center justify-between p-2 bg-white/50 dark:bg-slate-700/50 rounded-lg">
                  <span><strong>Admin:</strong></span>
                  <span className="font-mono">admin / admin123</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white/50 dark:bg-slate-700/50 rounded-lg">
                  <span><strong>Lecturer:</strong></span>
                  <span className="font-mono">lecturer / lecturer123</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white/50 dark:bg-slate-700/50 rounded-lg">
                  <span><strong>Student:</strong></span>
                  <span className="font-mono">student / student123</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
