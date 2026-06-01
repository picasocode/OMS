import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET discount codes - Admin only
export const GET = requireAuth(async () => {
  try {
    const codes = await db.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orderDiscounts: true } } },
    });

    return NextResponse.json(codes);
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return NextResponse.json({ error: 'Failed to fetch discount codes' }, { status: 500 });
  }
}, ['admin']); // Admin only

// POST create discount code - Admin only
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { code, description, type, value, productLine, expiresAt, maxUses, stackable, isMarkup, createdBy } = body;

    const discountCode = await db.discountCode.create({
      data: {
        code,
        description,
        type,
        value,
        productLine,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses,
        stackable: stackable ?? false,
        isMarkup: isMarkup ?? false,
        createdBy: user.email,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'discount_code_created',
        entity: 'discount_code',
        entityId: discountCode.id,
        salesRepId: null,
        details: JSON.stringify({ code, createdBy: user.email }),
      },
    });

    return NextResponse.json(discountCode, { status: 201 });
  } catch (error) {
    console.error('Error creating discount code:', error);
    return NextResponse.json({ error: 'Failed to create discount code' }, { status: 500 });
  }
}, ['admin']); // Admin only
