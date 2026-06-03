import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../config/env.js';
import { upsertGoogleUser } from './googleUserUpsert.js';

export interface GoogleAuthUser {
  userId: number;
  created?: boolean;
}

export function googleRedirectUri(): string {
  return env.google.redirectUri;
}

export function registerGooglePassportStrategy(): void {
  const clientID = env.google.clientId;
  const clientSecret = env.google.clientSecret;

  if (!clientID || !clientSecret) {
    console.warn('[google-oauth] Google OAuth is disabled because GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.');
    return;
  }

  console.log('[google-oauth] Registering strategy with redirectUri:', googleRedirectUri());

  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: googleRedirectUri(),
        scope: ['profile', 'email'],
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          console.log('[google-oauth] Google profile received:', { id: profile.id, email: profile.emails?.[0]?.value });
          const email = profile.emails?.[0]?.value;
          const sub = profile.id;
          const picture = profile.photos?.[0]?.value;
          if (!email || !sub) {
            console.error('[google-oauth] Missing email or sub in profile');
            done(new Error('Google profile missing email'));
            return;
          }
          const result = upsertGoogleUser({
            sub,
            email,
            name: profile.displayName || email.split('@')[0] || 'Reader',
            picture: picture || undefined,
          });
          if (!result) {
            console.error('[google-oauth] upsertGoogleUser returned null');
            done(new Error('Could not sign in with Google'));
            return;
          }
          console.log('[google-oauth] User authenticated:', { userId: result.row.id, created: result.created });
          done(null, { userId: result.row.id as number, created: result.created } satisfies GoogleAuthUser);
        } catch (e) {
          console.error('[google-oauth] Error in strategy:', e);
          done(e as Error);
        }
      },
    ),
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return env.google.configured;
}
