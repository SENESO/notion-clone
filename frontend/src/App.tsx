import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/authStore';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import Dashboard from '@/pages/Dashboard';
import PageView from '@/pages/PageView';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/common/ProtectedRoute';

function App() {
  const { initialized } = useAuthStore();

  if (!initialized) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="notion-theme">
      <Router>
        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/page/:pageId" element={<PageView />} />
          </Route>

          {/* Fallback routes */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Router>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
