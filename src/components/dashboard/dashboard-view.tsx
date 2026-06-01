'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, ShoppingCart, TrendingUp, BarChart3, PlusCircle, Package } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

const STATUS_LABELS: Record<string, string> = {
  order_placed: 'Order Placed',
  order_approved: 'Order Approved',
  paid: 'Paid',
  shipped: 'Shipped',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    order_placed: 'bg-blue-100 text-blue-700',
    order_approved: 'bg-orange-100 text-orange-700',
    paid: 'bg-emerald-100 text-emerald-700',
    shipped: 'bg-purple-100 text-purple-700',
  };
  return (
    <Badge className={`${colors[status] ?? 'bg-gray-100 text-gray-700'} border-0`}>
      {STATUS_LABELS[status] ?? status.replace('_', ' ')}
    </Badge>
  );
}

export default function DashboardView() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { selectedRepFilter, setSelectedRepFilter, setCurrentView, setSelectedOrderId } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', selectedRepFilter, user?.id],
    queryFn: () => {
      const params = new URLSearchParams();
      if (user?.role === 'sales_rep') {
        params.set('salesRepId', user.id);
      } else if (selectedRepFilter) {
        params.set('salesRepId', selectedRepFilter);
      }
      return fetch(`/api/dashboard?${params}`).then((r) => r.json());
    },
  });

  const { data: reps } = useQuery({
    queryKey: ['sales-reps'],
    queryFn: () => fetch('/api/sales-reps').then((r) => r.json()),
    enabled: isAdmin,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-[#052093] rounded-full" />
      </div>
    );
  }

  // Admin sees revenue/margin, sales rep does not
  const stats = isAdmin
    ? [
        { title: 'Total Orders', value: data?.orderCount ?? 0, icon: <ShoppingCart className="h-5 w-5" />, color: 'bg-[#052093]/5 text-[#052093]' },
        { title: 'Revenue', value: formatCurrency(data?.totalRevenue ?? 0), icon: <DollarSign className="h-5 w-5" />, color: 'bg-[#052093]/5 text-[#052093]' },
        { title: 'Margin', value: formatCurrency(data?.totalMargin ?? 0), icon: <TrendingUp className="h-5 w-5" />, color: 'bg-[#052093]/5 text-[#052093]' },
        { title: 'Avg Order Value', value: formatCurrency(data?.avgOrderValue ?? 0), icon: <BarChart3 className="h-5 w-5" />, color: 'bg-[#052093]/5 text-[#052093]' },
      ]
    : [
        { title: 'My Orders', value: data?.orderCount ?? 0, icon: <ShoppingCart className="h-5 w-5" />, color: 'bg-[#052093]/5 text-[#052093]' },
        { title: 'Avg Order Value', value: formatCurrency(data?.avgOrderValue ?? 0), icon: <BarChart3 className="h-5 w-5" />, color: 'bg-[#052093]/5 text-[#052093]' },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#052093]" style={{ fontFamily: 'var(--font-heading)' }}>Dashboard</h2>
          <p className="text-[#6B7280] text-sm mt-0.5">Welcome back, {user?.name?.split(' ')[0]}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Select
              value={selectedRepFilter ?? 'all'}
              onValueChange={(v) => {
                const newFilter = (v ?? 'all') === 'all' ? null : v;
                setSelectedRepFilter(newFilter);
              }}
            >
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue placeholder="Filter by Rep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps?.map((rep: { id: string; name: string }) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setCurrentView('new-order')} className="bg-[#FF9700] hover:bg-[#e88800] text-white font-semibold">
            <PlusCircle className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#656565]">{stat.title}</p>
                  <p className="text-2xl font-bold text-[#111827] mt-1">{stat.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.color}`}>{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Admin-only profitability section */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#052093]">Profitability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const marginPct = (data?.totalRevenue ?? 0) > 0 ? ((data?.totalMargin ?? 0) / (data?.totalRevenue ?? 0)) * 100 : 0;
                return (
                  <>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-600">{marginPct.toFixed(1)}%</p>
                      <p className="text-sm text-[#656565] mt-1">Overall Margin</p>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#656565]">Revenue</span>
                        <span className="font-medium">{formatCurrency(data?.totalRevenue ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#656565]">Margin</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(data?.totalMargin ?? 0)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#052093]">Orders by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(data?.ordersByStatus ?? {}).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
                    <StatusBadge status={status} />
                    <span className="text-lg font-semibold">{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Orders */}
      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base text-[#052093]">Recent Orders</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setCurrentView('orders')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {(data?.recentOrders ?? []).length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[#656565]">No orders yet. Create your first order!</p>
              <Button className="mt-3 bg-[#FF9700] hover:bg-[#e88800] text-white font-semibold" onClick={() => setCurrentView('new-order')}>
                <PlusCircle className="h-4 w-4 mr-2" /> New Order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Physician</TableHead>
                    {isAdmin && <TableHead>Sales Rep</TableHead>}
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recentOrders ?? []).map((order: {
                    id: string; orderNumber: string; physician: { name: string }; salesRep?: { name: string };
                    total: number; status: string; createdAt: string;
                  }) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <TableCell className="font-medium text-[#111827]">{order.orderNumber}</TableCell>
                      <TableCell className="text-[#656565]">{order.physician?.name}</TableCell>
                      {isAdmin && <TableCell className="text-[#656565]">{order.salesRep?.name}</TableCell>}
                      <TableCell>{formatCurrency(order.total)}</TableCell>
                      <TableCell><StatusBadge status={order.status} /></TableCell>
                      <TableCell className="text-[#656565]">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
