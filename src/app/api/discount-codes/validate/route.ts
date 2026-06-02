import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDiscountCodeByCode } from '@/lib/jotform';

export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const { code, subtotal, productLines } = await request.json();

    const dc = await getDiscountCodeByCode(code);

    if (!dc) {
      return NextResponse.json({ valid: false, error: 'Invalid discount code' });
    }
    if (!dc.active) {
      return NextResponse.json({ valid: false, error: 'Discount code is inactive' });
    }
    if (dc.expiresAt && new Date(dc.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Discount code has expired' });
    }
    if (dc.maxUses && dc.currentUses >= dc.maxUses) {
      return NextResponse.json({ valid: false, error: 'Discount code has reached its usage limit' });
    }
    if (dc.productLine && productLines && !productLines.includes(dc.productLine)) {
      return NextResponse.json({
        valid: false,
        error: `Code only applies to ${dc.productLine} products`,
      });
    }

    const applicableSubtotal = subtotal;
    let discountAmount = 0;
    if (dc.type === 'percentage') {
      discountAmount = dc.isMarkup
        ? -(applicableSubtotal * (dc.value / 100))
        : applicableSubtotal * (dc.value / 100);
    } else if (dc.type === 'fixed') {
      discountAmount = dc.value;
    }

    return NextResponse.json({ valid: true, discountAmount, isMarkup: dc.isMarkup, discountCode: dc });
  } catch (error) {
    console.error('Error validating discount code:', error);
    return NextResponse.json({ valid: false, error: 'Failed to validate code' }, { status: 500 });
  }
});
