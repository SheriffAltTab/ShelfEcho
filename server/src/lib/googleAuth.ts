import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'shelfecho-secret-key-change-in-production';

export function googleAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  const state = jwt.sign({ r: crypto.randomBytes(16).toString('hex') }, JWT_SECRET, { expiresIn: '15m' });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function verifyGoogleState(state: string): boolean {
  try {
    jwt.verify(state, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || 'token exchange failed');
  return { access_token: data.access_token };
}

export async function fetchGoogleProfile(accessToken: string): Promise<{
  sub: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { sub: string; email: string; name: string; picture?: string };
  if (!data.sub || !data.email) throw new Error('Invalid Google profile');
  return data;
}
