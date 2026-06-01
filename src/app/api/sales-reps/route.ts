import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET sales reps - Admin only
export const GET = requireAuth(async (_request: NextRequest, user) => {
  try {
    const reps = await db.salesRep.findMany({
      where: { active: true },
      include: {
        _count: { select: { physicians: true, orders: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get revenue for each rep
    const repsWithRevenue = await Promise.all(
      reps.map(async (rep) => {
        const orders = await db.order.findMany({
          where: { salesRepId: rep.id },
          select: { total: true, marginTotal: true },
        });
        const totalRevenue = orders.reduce((sum: number, o: { total: number }) => sum + o.total, 0);
        const totalMargin = orders.reduce((sum: number, o: { marginTotal: number }) => sum + o.marginTotal, 0);
        // Strip password from response
        const { password: _, ...safeRep } = rep;
        return { ...safeRep, totalRevenue, totalMargin };
      })
    );

    return NextResponse.json(repsWithRevenue);
  } catch (error) {
    console.error('Error fetching sales reps:', error);
    return NextResponse.json({ error: 'Failed to fetch sales reps' }, { status: 500 });
  }
}, ['admin']); // Admin only

// POST create sales rep - Admin only
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { name, email, phone, territory, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await db.salesRep.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const rep = await db.salesRep.create({
      data: { name, email, phone: phone || null, territory: territory || null, password },
      include: { _count: { select: { physicians: true, orders: true } } },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'sales_rep_created',
        entity: 'sales_rep',
        entityId: rep.id,
        salesRepId: null,
        details: JSON.stringify({ name, email, createdBy: user.email }),
      },
    });

    // Strip password from response
    const { password: _, ...safeRep } = rep;
    return NextResponse.json({ ...safeRep, totalRevenue: 0, totalMargin: 0 }, { status: 201 });
  } catch (error) {
    console.error('Error creating sales rep:', error);
    return NextResponse.json({ error: 'Failed to create sales rep' }, { status: 500 });
  }
}, ['admin']); // Admin only
