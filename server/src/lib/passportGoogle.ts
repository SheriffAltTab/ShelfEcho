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
          const email = profile.emails?.[0]?.value;
          const sub = profile.id;
          const picture = profile.photos?.[0]?.value;
          if (!email || !sub) {
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
            done(new Error('Could not sign in with Google'));
            return;
          }
          done(null, { userId: result.row.id as number, created: result.created } satisfies GoogleAuthUser);
        } catch (e) {
          done(e as Error);
        }
      },
    ),
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return env.google.configured;
}
