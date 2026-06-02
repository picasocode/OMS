import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, stripInternalPricing } from '@/lib/auth';
import { updateProduct } from '@/lib/jotform';

export const PATCH = requireAuth(async (request: NextRequest, user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const product = await updateProduct(id, body);
    return NextResponse.json(stripInternalPricing(product, user.role));
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}, ['admin']);

export const DELETE = requireAuth(async (_request: NextRequest, _user, context) => {
  try {
    const { id } = await context.params;
    await updateProduct(id, { active: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}, ['admin']);
