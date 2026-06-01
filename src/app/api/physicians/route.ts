import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, enforceRepOwnership, requireOwnershipOrAdmin } from '@/lib/auth';

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');

    // Sales reps can only see their own physicians
    const effectiveRepId = user.role === 'sales_rep' ? user.id : salesRepId;

    const where: Record<string, unknown> = {};
    if (effectiveRepId) where.salesRepId = effectiveRepId;

    const physicians = await db.physician.findMany({
      where,
      include: {
        salesRep: true,
        _count: { select: { orders: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(physicians);
  } catch (error) {
    console.error('Error fetching physicians:', error);
    return NextResponse.json({ error: 'Failed to fetch physicians' }, { status: 500 });
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const rawBody = await request.json();
    // Sales reps can only create physicians assigned to themselves
    const body = enforceRepOwnership(user, rawBody);
    const name = body.name as string;
    const practiceName = body.practiceName as string;
    const email = body.email as string | undefined;
    const phone = body.phone as string | undefined;
    const street = body.street as string | undefined;
    const city = body.city as string | undefined;
    const state = body.state as string | undefined;
    const zip = body.zip as string | undefined;
    const salesRepId = body.salesRepId as string;

    const physician = await db.physician.create({
      data: { name, practiceName, email, phone, street, city, state, zip, salesRepId },
      include: { salesRep: true },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'physician_created',
        entity: 'physician',
        entityId: physician.id,
        salesRepId: user.id === 'admin' ? null : user.id,
        details: JSON.stringify({ name, createdBy: user.email }),
      },
    });

    return NextResponse.json(physician, { status: 201 });
  } catch (error) {
    console.error('Error creating physician:', error);
    return NextResponse.json({ error: 'Failed to create physician' }, { status: 500 });
  }
});
