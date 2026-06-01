import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, stripInternalPricing, enforceRepOwnership, requireOwnershipOrAdmin } from '@/lib/auth';

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Sales reps can only see their own orders
    const effectiveRepId = user.role === 'sales_rep' ? user.id : salesRepId;

    const where: Record<string, unknown> = {};
    if (effectiveRepId) where.salesRepId = effectiveRepId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { physician: { name: { contains: search, mode: 'insensitive' } } },
        { physician: { practiceName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orders = await db.order.findMany({
      where,
      include: {
        physician: true,
        salesRep: true,
        items: { include: { product: true } },
        discounts: { include: { discountCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(stripInternalPricing(orders, user.role));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const rawBody = await request.json();
    // Enforce that sales reps can only create orders for themselves
    const body = enforceRepOwnership(user, rawBody);
    const physicianId = body.physicianId as string;
    const salesRepId = body.salesRepId as string;
    const items = body.items as { productId: string; quantity: number }[];
    const discountCodes = body.discountCodes as string[];
    const deliveryDate = body.deliveryDate as string | undefined;
    const notes = body.notes as string | undefined;

    // Sales rep can only create orders for their own physicians
    if (user.role === 'sales_rep') {
      const physician = await db.physician.findUnique({ where: { id: physicianId } });
      if (physician && physician.salesRepId !== user.id) {
        return NextResponse.json({ error: 'You can only create orders for your own physicians' }, { status: 403 });
      }
    }

    // Get products for pricing
    const productIds: string[] = items.map((item) => item.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } }, include: { tiers: true } });

    // Calculate order totals with tier pricing
    let subtotal = 0;
    let buyTotal = 0;
    const orderItems: { productId: string; quantity: number; buyPrice: number; sellPrice: number; margin: number; tierLabel: string | null }[] = [];

    for (const item of items) {
      const product = products.find((p: { id: string }) => p.id === item.productId);
      if (!product) continue;

      let sellPrice = product.sellPrice;
      let tierLabel: string | null = null;

      // Apply tier pricing for products with tiers
      if (product.tiers.length > 0) {
        const applicableTier = product.tiers.find(
          (tier: { minQty: number; maxQty: number | null }) => item.quantity >= tier.minQty && (tier.maxQty === null || item.quantity <= tier.maxQty)
        );
        if (applicableTier) {
          sellPrice = applicableTier.unitPrice;
          tierLabel = applicableTier.label;
        }
      }

      const lineTotal = sellPrice * item.quantity;
      const lineBuyTotal = product.buyPrice * item.quantity;
      subtotal += lineTotal;
      buyTotal += lineBuyTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        buyPrice: product.buyPrice,
        sellPrice,
        margin: sellPrice - product.buyPrice,
        tierLabel,
      });
    }

    // Calculate discounts
    let discountTotal = 0;
    const appliedDiscounts: { discountCodeId: string; appliedValue: number }[] = [];

    if (discountCodes && discountCodes.length > 0) {
      for (const code of discountCodes) {
        const discountCode = await db.discountCode.findFirst({
          where: { code: code, active: true },
        });
        if (!discountCode) continue;

        let applicableSubtotal = subtotal;
        if (discountCode.productLine) {
          applicableSubtotal = 0;
          for (const oi of orderItems) {
            const prod = products.find((p: { id: string }) => p.id === oi.productId);
            if (prod && prod.productLine === discountCode.productLine) {
              applicableSubtotal += oi.sellPrice * oi.quantity;
            }
          }
        }

        let appliedValue = 0;
        if (discountCode.type === 'percentage') {
          if (discountCode.isMarkup) {
            appliedValue = -(applicableSubtotal * (discountCode.value / 100));
          } else {
            appliedValue = applicableSubtotal * (discountCode.value / 100);
          }
        } else if (discountCode.type === 'fixed') {
          appliedValue = discountCode.value;
        }

        discountTotal += appliedValue;
        appliedDiscounts.push({ discountCodeId: discountCode.id, appliedValue });

        // Update discount usage
        await db.discountCode.update({
          where: { id: discountCode.id },
          data: { currentUses: { increment: 1 } },
        });
      }
    }

    const shippingCost = 0;
    const total = subtotal - discountTotal + shippingCost;
    const marginTotal = total - buyTotal;

    // Generate order number — sort numerically by extracting the integer part
    const lastOrder = await db.order.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const nextNum = lastOrder ? parseInt(lastOrder.orderNumber.replace('BIO-', '')) + 1 : 1001;
    const orderNumber = `BIO-${nextNum}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        physicianId,
        salesRepId,
        status: 'order_placed',
        subtotal,
        discountTotal,
        shippingCost,
        total,
        buyTotal,
        marginTotal,
        deliveryDate,
        notes,
        items: { create: orderItems },
        discounts: { create: appliedDiscounts },
      },
      include: {
        physician: true,
        salesRep: true,
        items: { include: { product: true } },
        discounts: { include: { discountCode: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'order_created',
        entity: 'order',
        entityId: order.id,
        salesRepId: user.id === 'admin' ? null : user.id,
        details: JSON.stringify({ orderNumber, createdBy: user.email }),
      },
    });

    return NextResponse.json(stripInternalPricing(order, user.role), { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
});
