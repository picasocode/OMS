import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateSalesRep } from '@/lib/jotform';

function withoutPassword<T extends { password?: string }>(rep: T): Omit<T, 'password'> {
  const safeRep = { ...rep };
  delete safeRep.password;
  return safeRep;
}

export const PATCH = requireAuth(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const rep = await updateSalesRep(id, {
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      territory: body.territory || null,
      ...(body.password ? { password: body.password } : {}),
    });
    return NextResponse.json(withoutPassword(rep));
  } catch (error) {
    console.error('Error updating sales rep:', error);
    return NextResponse.json({ error: 'Failed to update sales rep' }, { status: 500 });
  }
}, ['admin']);

export const DELETE = requireAuth(async (_request: NextRequest, _user, context) => {
  try {
    const { id } = await context.params;
    await updateSalesRep(id, { active: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sales rep:', error);
    return NextResponse.json({ error: 'Failed to delete sales rep' }, { status: 500 });
  }
}, ['admin']);
