import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, enforceRepOwnership } from '@/lib/auth';
import {
  getPhysicians, createPhysician, getSalesRepById, getOrders,
} from '@/lib/jotform';

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');
    const effectiveRepId = user.role === 'sales_rep' ? user.id : salesRepId ?? undefined;

    const physicians = await getPhysicians(effectiveRepId);
    const allOrders = await getOrders();

    const enriched = await Promise.all(
      physicians.map(async (p) => {
        const rep = await getSalesRepById(p.salesRepId);
        const orderCount = allOrders.filter((o) => o.physicianId === p.id).length;
        return {
          ...p,
          salesRep: rep ? { id: rep.id, name: rep.name, email: rep.email } : null,
          _count: { orders: orderCount },
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error fetching physicians:', error);
    return NextResponse.json({ error: 'Failed to fetch physicians' }, { status: 500 });
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const rawBody = await request.json();
    const body = enforceRepOwnership(user, rawBody);

    const physician = await createPhysician({
      name: body.name as string,
      practiceName: body.practiceName as string,
      email: (body.email as string) || null,
      phone: (body.phone as string) || null,
      street: (body.street as string) || null,
      city: (body.city as string) || null,
      state: (body.state as string) || null,
      zip: (body.zip as string) || null,
      salesRepId: body.salesRepId as string,
      active: true,
    });

    return NextResponse.json(physician, { status: 201 });
  } catch (error) {
    console.error('Error creating physician:', error);
    return NextResponse.json({ error: 'Failed to create physician' }, { status: 500 });
  }
});
