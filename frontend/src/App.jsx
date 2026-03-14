import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/admin/Dashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function AppInitializer() {
  const initFromToken = useAuthStore((s) => s.initFromToken);

  useEffect(() => {
    initFromToken();
  }, [initFromToken]);

  return null;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            element: <Dashboard />,
          },
          {
            element: <ProtectedRoute roles={['ADMIN']} />,
            children: [
              {
                path: '/admin/users',
                element: <div className="p-4 text-lg font-medium">Users (coming soon)</div>,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInitializer />
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
