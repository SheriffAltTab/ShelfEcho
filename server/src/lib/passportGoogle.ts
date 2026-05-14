import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { upsertGoogleUser } from './googleUserUpsert.js';

export interface GoogleAuthUser {
  userId: number;
}

export function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${Number(process.env.PORT) || 3001}/api/auth/google/callback`
  ).replace(/\/$/, '');
}

/** Register Google OAuth strategy when credentials are present. */
export function registerGooglePassportStrategy(): void {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientID || !clientSecret) {
    console.warn('⚠️ ПОПЕРЕДЖЕННЯ: Google OAuth НЕ налаштовано! Відсутні GOOGLE_CLIENT_ID або GOOGLE_CLIENT_SECRET у файлі .env.');
    return; // Залишаємо early return, але тепер ми хоча б побачимо причину в логах
  }

  passport.use(
    'google', // Явно вказуємо ім'я стратегії
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
          if (!email || !sub) {
            done(new Error('Google profile missing email'));
            return;
          }
          const row = upsertGoogleUser({
            sub,
            email,
            name: profile.displayName || email.split('@')[0] || 'Reader',
          });
          if (!row) {
            done(new Error('Could not sign in with Google'));
            return;
          }
          done(null, { userId: row.id as number } satisfies GoogleAuthUser);
        } catch (e) {
          done(e as Error);
        }
      },
    ),
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}