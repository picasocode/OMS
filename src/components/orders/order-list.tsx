'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, PlusCircle, Package } from 'lucide-react';

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

export default function OrderList() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { selectedRepFilter, setSelectedOrderId, setCurrentView } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', user?.id, selectedRepFilter, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (user?.role === 'sales_rep') {
        params.set('salesRepId', user.id);
      } else if (selectedRepFilter) {
        params.set('salesRepId', selectedRepFilter);
      }
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      return fetch(`/api/orders?${params}`).then((r) => r.json());
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#052093]">{isAdmin ? 'All Orders' : 'My Orders'}</h2>
        <Button onClick={() => setCurrentView('new-order')} className="bg-[#FF9700] hover:bg-[#e88800] text-white font-semibold h-8">
          <PlusCircle className="h-4 w-4 mr-1" /> New Order
        </Button>
      </div>

      {/* Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#656565]" />
              <Input
                placeholder="Search by order # or physician..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="order_placed">Order Placed</SelectItem>
                <SelectItem value="order_approved">Order Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-[#052093] rounded-full" />
            </div>
          ) : (orders ?? []).length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[#656565]">No orders found</p>
              <Button className="mt-3 bg-[#FF9700] hover:bg-[#e88800] text-white font-semibold" onClick={() => setCurrentView('new-order')}>
                <PlusCircle className="h-4 w-4 mr-2" /> Create Order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Physician</TableHead>
                    <TableHead className="hidden md:table-cell">Products</TableHead>
                    {isAdmin && <TableHead className="hidden lg:table-cell">Sales Rep</TableHead>}
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders ?? []).map((order: {
                    id: string; orderNumber: string; physician: { name: string }; items: { product: { name: string }; quantity: number }[];
                    total: number; status: string; createdAt: string; salesRep?: { name: string };
                  }) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedOrderId(order.id)}>
                      <TableCell className="font-medium text-[#111827]">{order.orderNumber}</TableCell>
                      <TableCell className="text-[#656565]">{order.physician?.name}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate text-sm text-[#656565]">
                        {order.items?.map((i) => `${i.quantity}x ${i.product?.name}`).join(', ')}
                      </TableCell>
                      {isAdmin && <TableCell className="hidden lg:table-cell text-[#656565]">{order.salesRep?.name}</TableCell>}
                      <TableCell>{formatCurrency(order.total)}</TableCell>
                      <TableCell><StatusBadge status={order.status} /></TableCell>
                      <TableCell className="hidden sm:table-cell text-[#656565]">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
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
