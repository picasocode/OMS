import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updatePhysician, softDeletePhysician } from '@/lib/jotform';

export const PATCH = requireAuth(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const physician = await updatePhysician(id, body);
    return NextResponse.json(physician);
  } catch (error) {
    console.error('Error updating physician:', error);
    return NextResponse.json({ error: 'Failed to update physician' }, { status: 500 });
  }
});

export const DELETE = requireAuth(async (_request: NextRequest, _user, context) => {
  try {
    const { id } = await context.params;
    await softDeletePhysician(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting physician:', error);
    return NextResponse.json({ error: 'Failed to delete physician' }, { status: 500 });
  }
});
