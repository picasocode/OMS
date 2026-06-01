import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, stripInternalPricing } from '@/lib/auth';

// PATCH update product - Admin only
export const PATCH = requireAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { buyPrice, sellPrice, name, sku, productLine, unit, active } = body;

    const updateData: Record<string, unknown> = {};
    if (buyPrice !== undefined) updateData.buyPrice = buyPrice;
    if (sellPrice !== undefined) updateData.sellPrice = sellPrice;
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku;
    if (productLine !== undefined) updateData.productLine = productLine;
    if (unit !== undefined) updateData.unit = unit;
    if (active !== undefined) updateData.active = active;

    const product = await db.product.update({
      where: { id },
      data: updateData,
      include: { tiers: { orderBy: { minQty: 'asc' } } },
    });

    // Audit log for pricing changes
    if (buyPrice !== undefined || sellPrice !== undefined) {
      await db.auditLog.create({
        data: {
          action: 'pricing_changed',
          entity: 'product',
          entityId: id,
          salesRepId: null,
          details: JSON.stringify({ buyPrice, sellPrice, changedBy: user.email }),
        },
      });
    }

    return NextResponse.json(stripInternalPricing(product, user.role));
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}, ['admin']); // Admin only

// DELETE product - Admin only
export const DELETE = requireAuth(async (_request: NextRequest, _user, { params }) => {
  try {
    const { id } = await params;

    // Check if product has order items
    const orderItemCount = await db.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      await db.product.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({ message: 'Product deactivated (has existing orders)' });
    }

    await db.tier.deleteMany({ where: { productId: id } });
    await db.product.delete({ where: { id } });
    return NextResponse.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}, ['admin']); // Admin only
