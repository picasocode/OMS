import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOwnershipOrAdmin } from '@/lib/auth';

export const PATCH = requireAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check ownership: sales rep can only edit their own physicians
    if (user.role === 'sales_rep') {
      const physician = await db.physician.findUnique({ where: { id } });
      if (!physician || !requireOwnershipOrAdmin(user, physician.salesRepId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      // Sales rep cannot reassign physician to another rep
      if (body.salesRepId && body.salesRepId !== user.id) {
        return NextResponse.json({ error: 'Cannot reassign physician to another rep' }, { status: 403 });
      }
    }

    const physician = await db.physician.update({
      where: { id },
      data: body,
      include: { salesRep: true },
    });

    return NextResponse.json(physician);
  } catch (error) {
    console.error('Error updating physician:', error);
    return NextResponse.json({ error: 'Failed to update physician' }, { status: 500 });
  }
});

export const DELETE = requireAuth(async (_request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;

    // Check ownership: sales rep can only delete their own physicians
    if (user.role === 'sales_rep') {
      const physician = await db.physician.findUnique({ where: { id } });
      if (!physician || !requireOwnershipOrAdmin(user, physician.salesRepId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check if physician has orders
    const orderCount = await db.order.count({ where: { physicianId: id } });
    if (orderCount > 0) {
      await db.physician.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({ message: 'Physician deactivated (has existing orders)' });
    }

    await db.physician.delete({ where: { id } });
    return NextResponse.json({ message: 'Physician deleted' });
  } catch (error) {
    console.error('Error deleting physician:', error);
    return NextResponse.json({ error: 'Failed to delete physician' }, { status: 500 });
  }
});
