import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSalesReps, getSalesRepByEmail, createSalesRep, getOrders } from '@/lib/jotform';

function withoutPassword<T extends { password?: string }>(rep: T): Omit<T, 'password'> {
  const safeRep = { ...rep };
  delete safeRep.password;
  return safeRep;
}

export const GET = requireAuth(async () => {
  try {
    const reps = await getSalesReps();
    const allOrders = await getOrders();

    const repsWithStats = reps.map((rep) => {
      const repOrders = allOrders.filter((o) => o.salesRepId === rep.id);
      const totalRevenue = repOrders.reduce((s, o) => s + (o.total ?? 0), 0);
      const totalMargin = repOrders.reduce((s, o) => s + (o.marginTotal ?? 0), 0);
      const safeRep = withoutPassword(rep);
      return {
        ...safeRep,
        totalRevenue,
        totalMargin,
        _count: { physicians: 0, orders: repOrders.length },
      };
    });

    return NextResponse.json(repsWithStats);
  } catch (error) {
    console.error('Error fetching sales reps:', error);
    return NextResponse.json({ error: 'Failed to fetch sales reps' }, { status: 500 });
  }
}, ['admin']);

export const POST = requireAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, email, phone, territory, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const existing = await getSalesRepByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const rep = await createSalesRep({
      name,
      email,
      password,
      phone: phone || null,
      territory: territory || null,
      active: true,
    });

    const safeRep = withoutPassword(rep);
    return NextResponse.json(
      { ...safeRep, totalRevenue: 0, totalMargin: 0, _count: { physicians: 0, orders: 0 } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating sales rep:', error);
    return NextResponse.json({ error: 'Failed to create sales rep' }, { status: 500 });
  }
}, ['admin']);
