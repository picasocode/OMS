import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// PATCH update discount code - Admin only
export const PATCH = requireAuth(async (request: NextRequest, user, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const { active, code, description, type, value, productLine, expiresAt, maxUses, stackable, isMarkup } = body;

    const updateData: Record<string, unknown> = {};
    if (active !== undefined) updateData.active = active;
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (value !== undefined) updateData.value = value;
    if (productLine !== undefined) updateData.productLine = productLine;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (maxUses !== undefined) updateData.maxUses = maxUses;
    if (stackable !== undefined) updateData.stackable = stackable;
    if (isMarkup !== undefined) updateData.isMarkup = isMarkup;

    const discountCode = await db.discountCode.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'discount_code_updated',
        entity: 'discount_code',
        entityId: id,
        salesRepId: null,
        details: JSON.stringify({ updatedBy: user.email, fields: Object.keys(updateData) }),
      },
    });

    return NextResponse.json(discountCode);
  } catch (error) {
    console.error('Error updating discount code:', error);
    return NextResponse.json({ error: 'Failed to update discount code' }, { status: 500 });
  }
}, ['admin']); // Admin only
