import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, stripInternalPricing, requireOwnershipOrAdmin } from '@/lib/auth';

export const GET = requireAuth(async (_request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        physician: true,
        salesRep: true,
        items: { include: { product: true } },
        discounts: { include: { discountCode: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Sales reps can only view their own orders
    if (!requireOwnershipOrAdmin(user, order.salesRepId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(stripInternalPricing(order, user.role));
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
});

export const PATCH = requireAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Sales reps can only update their own orders
    if (!requireOwnershipOrAdmin(user, order.salesRepId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Role-based status transition rules:
    // - Sales reps can only create orders (order_placed) — they CANNOT approve, mark paid, or ship
    // - Only admin can advance status: order_placed -> order_approved -> paid -> shipped
    if (status && status !== order.status) {
      if (user.role === 'sales_rep') {
        // Sales reps cannot change order status at all
        return NextResponse.json({ error: 'Only admin can change order status (approve, mark paid, ship)' }, { status: 403 });
      }

      // Validate status transition order for admin
      const validTransitions: Record<string, string> = {
        order_placed: 'order_approved',
        order_approved: 'paid',
        paid: 'shipped',
      };

      const expectedNext = validTransitions[order.status];
      if (expectedNext && status !== expectedNext) {
        return NextResponse.json({ error: `Invalid status transition. Expected: ${expectedNext}` }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'order_approved') updateData.approvedAt = new Date();
      if (status === 'paid') updateData.paidAt = new Date();
      if (status === 'shipped') updateData.shippedAt = new Date();
    }

    const updated = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        physician: true,
        salesRep: true,
        items: { include: { product: true } },
        discounts: { include: { discountCode: true } },
      },
    });

    // Audit log
    if (status) {
      await db.auditLog.create({
        data: {
          action: 'order_status_changed',
          entity: 'order',
          entityId: id,
          salesRepId: user.id === 'admin' ? null : user.id,
          details: JSON.stringify({ from: order.status, to: status, changedBy: user.email }),
        },
      });
    }

    return NextResponse.json(stripInternalPricing(updated, user.role));
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
});
