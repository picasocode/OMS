import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, stripInternalPricing } from '@/lib/auth';

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');

    // Sales reps can only see their own dashboard data
    const effectiveRepId = user.role === 'sales_rep' ? user.id : salesRepId;

    const orderWhere: Record<string, unknown> = {};
    if (effectiveRepId) orderWhere.salesRepId = effectiveRepId;

    const orders = await db.order.findMany({
      where: orderWhere,
      select: { total: true, marginTotal: true, status: true },
    });

    const totalRevenue = orders.reduce((sum: number, o: { total: number }) => sum + o.total, 0);
    const totalMargin = orders.reduce((sum: number, o: { marginTotal: number }) => sum + o.marginTotal, 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    const recentOrders = await db.order.findMany({
      where: orderWhere,
      include: {
        physician: true,
        salesRep: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    }

    // For sales reps, strip internal pricing from recent orders
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
