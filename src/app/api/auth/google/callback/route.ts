import { jwtVerify, createRemoteJWKSet } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { createSession, type SessionUser } from '@/lib/auth';
import { getSalesRepByEmail } from '@/lib/jotform';

const ADMIN_EMAIL = 'admin@biomedic.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

interface GoogleTokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleProfile {
  email?: string;
  email_verified?: boolean;
  name?: string;
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL('/', request.url);
  url.searchParams.set('authError', message);
  return NextResponse.redirect(url);
}

async function exchangeCodeForToken(request: NextRequest, code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: 'missing_config', error_description: 'Google login is not configured' };
  }

  const redirectUri = new URL('/api/auth/google/callback', request.url).toString();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  return response.json();
}

async function verifyGoogleProfile(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return {};

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    audience: clientId,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });

  return {
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

async function findUserByGoogleEmail(email: string, name?: string): Promise<SessionUser | null> {
  if (email.toLowerCase() === ADMIN_EMAIL) {
    return {
      id: 'admin',
      name: name || 'Admin User',
      email: ADMIN_EMAIL,
      role: 'admin',
      territory: null,
    };
  }

  const rep = await getSalesRepByEmail(email);
  if (!rep || rep.active === false) return null;

  return {
    id: rep.id,
    name: rep.name,
    email: rep.email,
    role: 'sales_rep',
    territory: rep.territory ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const oauthError = request.nextUrl.searchParams.get('error');

    if (oauthError) return redirectWithError(request, 'Google sign-in was cancelled');
    if (!code) return redirectWithError(request, 'Google sign-in failed');

    const tokenResponse = await exchangeCodeForToken(request, code);
    if (!tokenResponse.id_token) {
      return redirectWithError(request, tokenResponse.error_description || 'Google sign-in failed');
    }

    const profile = await verifyGoogleProfile(tokenResponse.id_token);
    if (!profile.email || !profile.email_verified) {
      return redirectWithError(request, 'Google account email could not be verified');
    }

    const user = await findUserByGoogleEmail(profile.email, profile.name);
    if (!user) {
      return redirectWithError(request, 'No active account exists for that Google email');
    }

    const token = await createSession(user);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google auth error:', error);
    return redirectWithError(request, 'Google sign-in failed');
  }
}
