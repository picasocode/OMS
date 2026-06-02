import { NextRequest, NextResponse } from 'next/server';
import { getOrders, enrichOrders } from '@/lib/jotform';
import { requireAuth, stripInternalPricing } from '@/lib/auth';

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');

    const effectiveRepId = user.role === 'sales_rep' ? user.id : salesRepId ?? undefined;

    const allOrders = await getOrders({ salesRepId: effectiveRepId });

    const totalRevenue = allOrders.reduce((s, o) => s + (o.total ?? 0), 0);
    const totalMargin = allOrders.reduce((s, o) => s + (o.marginTotal ?? 0), 0);
    const orderCount = allOrders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    for (const o of allOrders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    }

    // Recent 5 orders — enriched with physician and salesRep
    const recentRaw = allOrders.slice(0, 5);
    const recentOrders = await enrichOrders(recentRaw);

    const responseData = {
      totalRevenue,
      totalMargin: user.role === 'admin' ? totalMargin : undefined,
      orderCount,
      avgOrderValue,
      ordersByStatus,
      recentOrders: stripInternalPricing(recentOrders, user.role),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
});
