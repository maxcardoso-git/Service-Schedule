import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

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
        path: '/',
        element: <div className="p-8 text-2xl font-semibold">Dashboard</div>,
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
