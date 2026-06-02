import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrder, enrichOrder } from '@/lib/jotform';
import { requireAuth, stripInternalPricing, requireOwnershipOrAdmin } from '@/lib/auth';

const STATUS_TRANSITIONS: Record<string, string> = {
  order_placed: 'order_approved',
  order_approved: 'paid',
  paid: 'shipped',
};

export const GET = requireAuth(async (_request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!requireOwnershipOrAdmin(user, order.salesRepId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const enriched = await enrichOrder(order);
    return NextResponse.json(stripInternalPricing(enriched, user.role));
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

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!requireOwnershipOrAdmin(user, order.salesRepId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (status && status !== order.status) {
      if (user.role === 'sales_rep') {
        return NextResponse.json(
          { error: 'Only admin can change order status' },
          { status: 403 }
        );
      }
      const expectedNext = STATUS_TRANSITIONS[order.status];
      if (expectedNext && status !== expectedNext) {
        return NextResponse.json(
          { error: `Invalid status transition. Expected: ${expectedNext}` },
          { status: 400 }
        );
      }
    }

    const updateData: Partial<typeof order> = {};
    if (status) {
      updateData.status = status;
      if (status === 'order_approved') updateData.approvedAt = new Date().toISOString();
      if (status === 'paid') updateData.paidAt = new Date().toISOString();
      if (status === 'shipped') updateData.shippedAt = new Date().toISOString();
    }

    const updated = await updateOrder(id, updateData);
    const enriched = await enrichOrder(updated);
    return NextResponse.json(stripInternalPricing(enriched, user.role));
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
});
