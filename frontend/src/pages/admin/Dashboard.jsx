import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, UserCheck, CreditCard } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';

function StatCard({ title, value, icon: Icon, loading }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-bold">{value ?? '—'}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch('/admin/dashboard/stats'),
  });

  const stats = data?.data;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      {isError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load dashboard stats. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bookings Today"
          value={stats?.todayBookings}
          icon={Calendar}
          loading={isLoading}
        />
        <StatCard
          title="Total Clients"
          value={stats?.totalClients}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="Active Professionals"
          value={stats?.totalProfessionals}
          icon={UserCheck}
          loading={isLoading}
        />
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments}
          icon={CreditCard}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
