import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET single sales rep - Admin only
export const GET = requireAuth(async (_request: NextRequest, _user, { params }) => {
  try {
    const { id } = await params;
    const rep = await db.salesRep.findUnique({
      where: { id },
      include: {
        physicians: { include: { _count: { select: { orders: true } } } },
        orders: {
          include: { physician: true, items: { include: { product: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!rep) {
      return NextResponse.json({ error: 'Sales rep not found' }, { status: 404 });
    }

    const allOrders = await db.order.findMany({
      where: { salesRepId: id },
      select: { total: true, marginTotal: true },
    });
    const totalRevenue = allOrders.reduce((sum: number, o: { total: number }) => sum + o.total, 0);
    const totalMargin = allOrders.reduce((sum: number, o: { marginTotal: number }) => sum + o.marginTotal, 0);

    // Strip password from response
    const { password: _, ...safeRep } = rep;
    return NextResponse.json({ ...safeRep, totalRevenue, totalMargin });
  } catch (error) {
    console.error('Error fetching sales rep:', error);
    return NextResponse.json({ error: 'Failed to fetch sales rep' }, { status: 500 });
  }
}, ['admin']); // Admin only

// PATCH update sales rep - Admin only
export const PATCH = requireAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, territory, password, active } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (territory !== undefined) updateData.territory = territory;
    if (password !== undefined && password !== '') updateData.password = password;
    if (active !== undefined) updateData.active = active;

    const rep = await db.salesRep.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'sales_rep_updated',
        entity: 'sales_rep',
        entityId: id,
        salesRepId: null,
        details: JSON.stringify({ updatedBy: user.email, fields: Object.keys(updateData) }),
      },
    });

    // Strip password from response
    const { password: _, ...safeRep } = rep;
    return NextResponse.json(safeRep);
  } catch (error) {
    console.error('Error updating sales rep:', error);
    return NextResponse.json({ error: 'Failed to update sales rep' }, { status: 500 });
  }
}, ['admin']); // Admin only

// DELETE sales rep - Admin only
export const DELETE = requireAuth(async (_request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;

    // Prevent deleting yourself
    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Check if rep has orders
    const orderCount = await db.order.count({ where: { salesRepId: id } });
    if (orderCount > 0) {
      await db.salesRep.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({ message: 'Sales rep deactivated (has existing orders)' });
    }

    await db.salesRep.delete({ where: { id } });
    return NextResponse.json({ message: 'Sales rep deleted' });
  } catch (error) {
    console.error('Error deleting sales rep:', error);
    return NextResponse.json({ error: 'Failed to delete sales rep' }, { status: 500 });
  }
}, ['admin']); // Admin only
