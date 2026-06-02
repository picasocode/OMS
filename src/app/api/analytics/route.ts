import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getSalesReps, getPhysicians, getDiscountCodes } from '@/lib/jotform';
import { requireAuth } from '@/lib/auth';

export const GET = requireAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');

    const [orders, salesReps, physicians, discountCodes] = await Promise.all([
      getOrders({ salesRepId: salesRepId ?? undefined }),
      getSalesReps(),
      getPhysicians(),
      getDiscountCodes(),
    ]);

    // Revenue by rep
    const revenueByRep: Record<string, { name: string; revenue: number; margin: number; orderCount: number }> = {};
    for (const order of orders) {
      const rep = salesReps.find((r) => r.id === order.salesRepId);
      const repId = order.salesRepId;
      if (!revenueByRep[repId]) {
        revenueByRep[repId] = { name: rep?.name ?? 'Unknown', revenue: 0, margin: 0, orderCount: 0 };
      }
      revenueByRep[repId].revenue += order.total ?? 0;
      revenueByRep[repId].margin += order.marginTotal ?? 0;
      revenueByRep[repId].orderCount += 1;
    }

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    }

    // Revenue by month
    const revenueByMonth: Record<string, number> = {};
    for (const order of orders) {
      const month = new Date(order.createdAt).toISOString().substring(0, 7);
      revenueByMonth[month] = (revenueByMonth[month] || 0) + (order.total ?? 0);
    }

    // Product line mix
    const productMix: Record<string, number> = {};
    for (const order of orders) {
      for (const item of order.items ?? []) {
        // productLine stored in item or we'll tag as Unknown
        const line = (item as { productLine?: string }).productLine ?? 'Unknown';
        productMix[line] = (productMix[line] || 0) + item.sellPrice * item.quantity;
      }
    }

    // Top physicians by revenue
    const physicianRevenue: Record<string, { name: string; practice: string; revenue: number }> = {};
    for (const order of orders) {
      const phy = physicians.find((p) => p.id === order.physicianId);
      const phyId = order.physicianId;
      if (!physicianRevenue[phyId]) {
        physicianRevenue[phyId] = {
          name: phy?.name ?? 'Unknown',
          practice: phy?.practiceName ?? '',
          revenue: 0,
        };
      }
      physicianRevenue[phyId].revenue += order.total ?? 0;
    }
    const topPhysicians = Object.values(physicianRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Discount usage
    const discountUsage = discountCodes.map((dc) => {
      const usageCount = orders.reduce(
        (count, o) => count + (o.discounts ?? []).filter((d) => d.discountCodeId === dc.id).length,
        0
      );
      return { ...dc, _count: { orderDiscounts: usageCount } };
    });

    return NextResponse.json({
      revenueByRep: Object.values(revenueByRep),
      ordersByStatus,
      revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })),
      productMix: Object.entries(productMix).map(([line, revenue]) => ({ line, revenue })),
      topPhysicians,
      discountUsage,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}, ['admin']);
