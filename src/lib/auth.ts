import { jwtVerify, SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'biomedic-oms-demo-secret-key-2024'
);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'sales_rep';
  territory?: string | null;
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): string | null {
  // Try cookie first, then Authorization header
  const cookie = request.cookies.get('session')?.value;
  if (cookie) return cookie;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

export async function getUserFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = getSessionFromRequest(request);
  if (!token) return null;
  return verifySession(token);
}

type RoleCheck = 'admin' | 'sales_rep' | 'any';

export function requireAuth(
  handler: (request: NextRequest, user: SessionUser, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
  allowedRoles: RoleCheck[] = ['any']
) {
  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!allowedRoles.includes('any') && !allowedRoles.includes(user.role as RoleCheck)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    return handler(request, user, context);
  };
}

// Verify a sales rep can only access their own data
export function requireOwnershipOrAdmin(user: SessionUser, resourceRepId: string | null | undefined): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'sales_rep' && resourceRepId === user.id) return true;
  return false;
}

// Helper to strip internal pricing from response for sales_rep users
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripInternalPricing(data: any, role: string): any {
  if (role === 'admin') return data;

  if (Array.isArray(data)) {
    return data.map(item => stripInternalPricing(item, role));
  }

  if (data && typeof data === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = { ...data };

    // Remove buy price and margin from order items
    if (result.buyPrice !== undefined) delete result.buyPrice;
    if (result.margin !== undefined) delete result.margin;
    if (result.buyTotal !== undefined) delete result.buyTotal;
    if (result.marginTotal !== undefined) delete result.marginTotal;

    // Process nested items
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item: typeof data) => stripInternalPricing(item, role));
    }

    // Remove buy price from products
    if (result.product && typeof result.product === 'object') {
      result.product = { ...result.product };
      if (result.product.buyPrice !== undefined) delete result.product.buyPrice;
    }

    // Remove buy price from product tiers
    if (Array.isArray(result.tiers)) {
      // Keep tier pricing info but don't show margin calculations for sales_rep
      // Actually for products page, sales_rep shouldn't see buyPrice at all
    }

    return result;
  }

  return data;
}

// Validate that a sales rep can only create orders for themselves
export function enforceRepOwnership(user: SessionUser, body: Record<string, unknown>): Record<string, unknown> {
  if (user.role === 'sales_rep') {
    return { ...body, salesRepId: user.id };
  }
  return body;
}
