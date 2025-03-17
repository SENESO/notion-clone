import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const AuthLayout = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Notion Clone</h1>
          <p className="text-muted-foreground">Your connected workspace</p>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
