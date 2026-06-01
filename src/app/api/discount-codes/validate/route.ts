import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST validate discount code - Any authenticated user (used during order creation)
export const POST = requireAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const { code, subtotal, productLines } = body;

    const discountCode = await db.discountCode.findFirst({
      where: { code, active: true },
    });

    if (!discountCode) {
      return NextResponse.json({ valid: false, error: 'Invalid or inactive discount code' });
    }

    // Check expiry
    if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Discount code has expired' });
    }

    // Check max uses
    if (discountCode.maxUses !== null && discountCode.currentUses >= discountCode.maxUses) {
      return NextResponse.json({ valid: false, error: 'Discount code has reached maximum uses' });
    }

    // Check product line restriction
    if (discountCode.productLine && productLines && !productLines.includes(discountCode.productLine)) {
      return NextResponse.json({ valid: false, error: `Code only applies to ${discountCode.productLine} products` });
    }

    let discountAmount = 0;
    if (discountCode.type === 'percentage') {
      discountAmount = subtotal * (discountCode.value / 100);
    } else if (discountCode.type === 'fixed') {
      discountAmount = discountCode.value;
    }

    if (discountCode.isMarkup) {
      discountAmount = -discountAmount;
    }

    return NextResponse.json({
      valid: true,
      discountCode,
      discountAmount,
      isMarkup: discountCode.isMarkup,
    });
  } catch (error) {
    console.error('Error validating discount code:', error);
    return NextResponse.json({ error: 'Failed to validate discount code' }, { status: 500 });
  }
});
