import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, stripInternalPricing } from '@/lib/auth';
import { getProducts, createProduct } from '@/lib/jotform';

export const GET = requireAuth(async (_request: NextRequest, user) => {
  try {
    const products = await getProducts();
    return NextResponse.json(stripInternalPricing(products, user.role));
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const { name, sku, productLine, buyPrice, sellPrice, unit, tiers } = body;

    if (!name || !sku || sellPrice === undefined) {
      return NextResponse.json({ error: 'Name, SKU, and sell price are required' }, { status: 400 });
    }

    const existing = (await getProducts()).find((p) => p.sku === sku);
    if (existing) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
    }

    const product = await createProduct({
      name,
      sku,
      productLine: productLine || 'Other',
      buyPrice: buyPrice ?? 0,
      sellPrice,
      unit: unit || 'each',
      tiers: tiers || [],
      active: true,
    });

    return NextResponse.json(stripInternalPricing(product, user.role), { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}, ['admin']);
