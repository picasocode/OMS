import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, stripInternalPricing } from '@/lib/auth';

// GET products - All authenticated users (strip internal pricing for sales_rep)
export const GET = requireAuth(async (_request: NextRequest, user) => {
  try {
    const products = await db.product.findMany({
      where: { active: true },
      include: { tiers: { orderBy: { minQty: 'asc' } } },
      orderBy: { productLine: 'asc' },
    });

    return NextResponse.json(stripInternalPricing(products, user.role));
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
});

// POST create product - Admin only
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { name, sku, productLine, buyPrice, sellPrice, unit } = body;

    if (!name || !sku || sellPrice === undefined) {
      return NextResponse.json({ error: 'Name, SKU, and sell price are required' }, { status: 400 });
    }

    // Check if SKU already exists
    const existing = await db.product.findUnique({ where: { sku } });
    if (existing) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
    }

    const product = await db.product.create({
      data: {
        name,
        sku,
        productLine: productLine || 'Other',
        buyPrice: buyPrice || 0,
        sellPrice,
        unit: unit || 'each',
      },
      include: { tiers: { orderBy: { minQty: 'asc' } } },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'product_created',
        entity: 'product',
        entityId: product.id,
        salesRepId: null,
        details: JSON.stringify({ name, sku, createdBy: user.email }),
      },
    });

    return NextResponse.json(stripInternalPricing(product, user.role), { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}, ['admin']); // Admin only
