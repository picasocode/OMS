import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET analytics - Admin only
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');

    const orderWhere: Record<string, unknown> = {};
    if (salesRepId) orderWhere.salesRepId = salesRepId;

    const orders = await db.order.findMany({
      where: orderWhere,
      include: {
        items: { include: { product: true } },
        salesRep: true,
      },
    });

    // Revenue by rep
    const revenueByRep: Record<string, { name: string; revenue: number; margin: number; orderCount: number }> = {};
    for (const order of orders) {
      const repId = order.salesRepId;
      if (!revenueByRep[repId]) {
        revenueByRep[repId] = { name: order.salesRep?.name ?? 'Unknown', revenue: 0, margin: 0, orderCount: 0 };
      }
      revenueByRep[repId].revenue += order.total;
      revenueByRep[repId].margin += order.marginTotal;
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
      revenueByMonth[month] = (revenueByMonth[month] || 0) + order.total;
    }

    // Product mix
    const productMix: Record<string, number> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const line = item.product?.productLine ?? 'Unknown';
        productMix[line] = (productMix[line] || 0) + item.sellPrice * item.quantity;
      }
    }

    // Top physicians
    const physicianRevenue: Record<string, { name: string; practice: string; revenue: number }> = {};
    for (const order of orders) {
      const phyId = order.physicianId;
      if (!physicianRevenue[phyId]) {
        const phy = await db.physician.findUnique({ where: { id: phyId } });
        physicianRevenue[phyId] = { name: phy?.name ?? 'Unknown', practice: phy?.practiceName ?? '', revenue: 0 };
      }
      physicianRevenue[phyId].revenue += order.total;
    }
    const topPhysicians = Object.values(physicianRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Discount code usage
    const discountUsage = await db.discountCode.findMany({
      include: { _count: { select: { orderDiscounts: true } } },
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
}, ['admin']); // Admin only
