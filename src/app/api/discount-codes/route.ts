import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDiscountCodes, createDiscountCode } from '@/lib/jotform';

export const GET = requireAuth(async () => {
  try {
    const codes = await getDiscountCodes();
    return NextResponse.json(codes);
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return NextResponse.json({ error: 'Failed to fetch discount codes' }, { status: 500 });
  }
}, ['admin']);

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { code, description, type, value, productLine, expiresAt, maxUses, stackable, isMarkup } = body;

    if (!code || !type || value === undefined) {
      return NextResponse.json({ error: 'Code, type, and value are required' }, { status: 400 });
    }

    const existing = (await getDiscountCodes()).find(
      (c) => c.code?.toUpperCase() === code.toUpperCase()
    );
    if (existing) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }

    const discount = await createDiscountCode({
      code: code.toUpperCase(),
      description: description || null,
      type,
      value,
      productLine: productLine || null,
      expiresAt: expiresAt || null,
      maxUses: maxUses || null,
      currentUses: 0,
      stackable: stackable ?? false,
      active: true,
      isMarkup: isMarkup ?? false,
      createdBy: user.email,
    });

    return NextResponse.json(discount, { status: 201 });
  } catch (error) {
    console.error('Error creating discount code:', error);
    return NextResponse.json({ error: 'Failed to create discount code' }, { status: 500 });
  }
}, ['admin']);
