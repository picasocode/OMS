import { NextRequest, NextResponse } from 'next/server';
import {
  getOrders, enrichOrders, createOrder, getLastOrderNumber,
  getPhysicianById, getProductsByIds, getDiscountCodeByCode,
  incrementDiscountUsage, JFOrderItem, JFOrderDiscount,
} from '@/lib/jotform';
import { requireAuth, stripInternalPricing, enforceRepOwnership } from '@/lib/auth';

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const salesRepId = searchParams.get('salesRepId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const effectiveRepId = user.role === 'sales_rep' ? user.id : salesRepId ?? undefined;

    const orders = await getOrders({
      salesRepId: effectiveRepId,
      status: status ?? undefined,
      search: search ?? undefined,
    });

    const enriched = await enrichOrders(orders);
    return NextResponse.json(stripInternalPricing(enriched, user.role));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
});

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const rawBody = await request.json();
    const body = enforceRepOwnership(user, rawBody);

    const physicianId = body.physicianId as string;
    const salesRepId = body.salesRepId as string;
    const items = body.items as { productId: string; quantity: number }[];
    const discountCodes = body.discountCodes as string[];
    const deliveryDate = (body.deliveryDate as string) || null;
    const notes = (body.notes as string) || null;

    // Sales rep can only create orders for their own physicians
    if (user.role === 'sales_rep') {
      const physician = await getPhysicianById(physicianId);
      if (physician && physician.salesRepId !== user.id) {
        return NextResponse.json(
          { error: 'You can only create orders for your own physicians' },
          { status: 403 }
        );
      }
    }

    // Load products for pricing
    const productIds = items.map((i) => i.productId);
    const products = await getProductsByIds(productIds);

    // Calculate line items with tier pricing
    let subtotal = 0;
    let buyTotal = 0;
    const orderItems: JFOrderItem[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      let sellPrice = product.sellPrice;
      let tierLabel: string | null = null;

      if (product.tiers && product.tiers.length > 0) {
        const tier = product.tiers.find(
          (t) => item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty)
        );
        if (tier) {
          sellPrice = tier.unitPrice;
          tierLabel = tier.label;
        }
      }

      subtotal += sellPrice * item.quantity;
      buyTotal += product.buyPrice * item.quantity;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        buyPrice: product.buyPrice,
        sellPrice,
        margin: sellPrice - product.buyPrice,
        tierLabel,
      });
    }

    // Calculate discounts
    let discountTotal = 0;
    const appliedDiscounts: JFOrderDiscount[] = [];

    if (discountCodes && discountCodes.length > 0) {
      for (const code of discountCodes) {
        const dc = await getDiscountCodeByCode(code);
        if (!dc || !dc.active) continue;

        let applicableSubtotal = subtotal;
        if (dc.productLine) {
          applicableSubtotal = 0;
          for (const oi of orderItems) {
            const prod = products.find((p) => p.id === oi.productId);
            if (prod && prod.productLine === dc.productLine) {
              applicableSubtotal += oi.sellPrice * oi.quantity;
            }
          }
        }

        let appliedValue = 0;
        if (dc.type === 'percentage') {
          appliedValue = dc.isMarkup
            ? -(applicableSubtotal * (dc.value / 100))
            : applicableSubtotal * (dc.value / 100);
        } else if (dc.type === 'fixed') {
          appliedValue = dc.value;
        }

        discountTotal += appliedValue;
        appliedDiscounts.push({ discountCodeId: dc.id, appliedValue });
        await incrementDiscountUsage(dc.id);
      }
    }

    const total = subtotal - discountTotal;
    const marginTotal = total - buyTotal;

    const lastNum = await getLastOrderNumber();
    const orderNumber = `BIO-${lastNum + 1}`;

    const order = await createOrder({
      orderNumber,
      physicianId,
      salesRepId,
      status: 'order_placed',
      subtotal,
      discountTotal,
      shippingCost: 0,
      total,
      buyTotal,
      marginTotal,
      deliveryDate,
      notes,
      items: orderItems,
      discounts: appliedDiscounts,
      approvedAt: null,
      paidAt: null,
      shippedAt: null,
    });

    // Return enriched order
    const { enrichOrder } = await import('@/lib/jotform');
    const enriched = await enrichOrder(order);
    return NextResponse.json(stripInternalPricing(enriched, user.role), { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
});
