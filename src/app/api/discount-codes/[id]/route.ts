import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateDiscountCode } from '@/lib/jotform';

export const PATCH = requireAuth(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await updateDiscountCode(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating discount code:', error);
    return NextResponse.json({ error: 'Failed to update discount code' }, { status: 500 });
  }
}, ['admin']);
