import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, verifySession } from '@/lib/auth';

const ADMIN_EMAIL = 'admin@biomedic.com';
const ADMIN_PASSWORD = 'BioMedic2024!';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    let user;

    // Check admin credentials
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      user = {
        id: 'admin',
        name: 'Admin User',
        email: ADMIN_EMAIL,
        role: 'admin' as const,
        territory: null,
      };
    } else {
      // Check sales rep credentials
      const rep = await db.salesRep.findUnique({
        where: { email, active: true },
      });

      if (rep && rep.password === password) {
        user = {
          id: rep.id,
          name: rep.name,
          email: rep.email,
          role: 'sales_rep' as const,
          territory: rep.territory,
        };
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create JWT session
    const token = await createSession(user);

    const response = NextResponse.json(user);

    // Set HttpOnly cookie with the JWT
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in auth:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

// GET - Check current session
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await verifySession(token);
    if (!user) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}

// DELETE - Logout (clear session cookie)
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
