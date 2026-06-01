'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const COLORS = ['#2563EB', '#60A5FA', '#4A90D9', '#7BC67E', '#E8A838', '#9B59B6'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipFormatter = (value: any) => formatCurrency(Number(value));

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsView() {
  const { selectedRepFilter } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', selectedRepFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedRepFilter) params.set('salesRepId', selectedRepFilter);
      return fetch(`/api/analytics?${params}`).then((r) => r.json());
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const revenueByRep = data?.revenueByRep ?? [];
  const ordersByStatus = Object.entries(data?.ordersByStatus ?? {}).map(([name, value]) => ({ name: name.replace('_', ' '), value: value as number }));
  const revenueByMonth = [...(data?.revenueByMonth ?? [])].sort((a: { month: string }, b: { month: string }) => a.month.localeCompare(b.month));
  const productMix = data?.productMix ?? [];
  const topPhysicians = data?.topPhysicians ?? [];

  const statusColors: Record<string, string> = {
    order_placed: '#3B82F6',
    order_approved: '#F97316',
    paid: '#22C55E',
    shipped: '#8B5CF6',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-[#052093]">Analytics</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Rep */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" /> Revenue by Sales Rep
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByRep.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByRep}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="margin" fill="#60A5FA" radius={[4, 4, 0, 0]} name="Margin" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-600" /> Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${value ?? 0}`}
                    dataKey="value"
                  >
                    {ordersByStatus.map((entry, index) => (
                      <Cell key={index} fill={statusColors[entry.name] ?? COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" /> Revenue Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} dot={{ r: 4, fill: '#2563EB' }} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Product Mix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" /> Product Mix (Revenue)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productMix.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={productMix}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ line, percent }: { line?: string; percent?: number }) => `${line ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    dataKey="revenue"
                    nameKey="line"
                  >
                    {productMix.map((_entry: { line: string; revenue: number }, index: number) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={tooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Physicians */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" /> Top Physicians by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPhysicians.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topPhysicians} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
