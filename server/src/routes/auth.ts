import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db.js';
import { generateToken, authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/mail.js';
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleAuthUrl,
  verifyGoogleState,
} from '../lib/googleAuth.js';

export const authRouter = Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${Number(process.env.PORT) || 3001}/api/auth/google/callback`
  ).replace(/\/$/, '');
}

function mapPublicUser(user: Record<string, unknown>) {
  return {
    id: user.id as number,
    name: user.name as string,
    email: user.email as string,
    onboarded: !!user.onboarded,
    avatar: (user.avatar as string) || '',
    favoriteGenres: JSON.parse((user.favorite_genres as string) || '[]') as string[],
    readingGoal: user.reading_goal as number,
    role: (user.role as string) || 'user',
    ...(user.created_at ? { createdAt: String(user.created_at) } : {}),
  };
}

authRouter.get('/google', (_req, res) => {
  try {
    const url = googleAuthUrl(googleRedirectUri());
    res.redirect(302, url);
  } catch (e) {
    console.error('[auth/google]', e);
    res.status(503).json({ error: 'Google sign-in is not configured' });
  }
});

authRouter.get('/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const err = typeof req.query.error === 'string' ? req.query.error : '';

  const failRedirect = (msg: string) => {
    res.redirect(302, `${FRONTEND_URL}/auth?error=${encodeURIComponent(msg)}`);
  };

  if (err || !code) {
    failRedirect(err || 'Google sign-in was cancelled');
    return;
  }
  if (!verifyGoogleState(state)) {
    failRedirect('Invalid OAuth state');
    return;
  }

  try {
    const redirectUri = googleRedirectUri();
    const { access_token } = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleProfile(access_token);

    const existingByGoogle = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub) as
      | Record<string, unknown>
      | undefined;
    let row = existingByGoogle;

    if (!row) {
      const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email) as
        | Record<string, unknown>
        | undefined;
      if (byEmail) {
        db.prepare(
          'UPDATE users SET google_id = ?, is_active = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
        ).run(profile.sub, byEmail.id);
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id) as Record<string, unknown>;
      } else {
        const randomPw = crypto.randomBytes(32).toString('hex');
        const hashedPassword = bcrypt.hashSync(randomPw, 12);
        const ins = db
          .prepare(
            `INSERT INTO users (name, email, password, onboarded, is_active, google_id)
             VALUES (?, ?, ?, 0, 1, ?)`,
          )
          .run(profile.name || profile.email.split('@')[0], profile.email, hashedPassword, profile.sub);
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(ins.lastInsertRowid) as Record<string, unknown>;
      }
    }

    if (!row) {
      failRedirect('Could not create account');
      return;
    }

    if (Number(row.blocked) === 1) {
      failRedirect('Account is blocked');
      return;
    }

    db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(row.id);

    const token = generateToken(row.id as number);
    res.redirect(302, `${FRONTEND_URL}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error('[auth/google/callback]', e);
    failRedirect('Google sign-in failed');
  }
});

authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = bcrypt.hashSync(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO users (name, email, password, onboarded, is_active, email_verification_token, email_verification_expires)
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
    ).run(name, email, hashedPassword, verifyToken, expires);

    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(verifyToken)}`;
    await sendVerificationEmail(email, verifyUrl);

    res.status(201).json({
      needsVerification: true,
      message: 'Account created. Check your email to verify your address before signing in.',
    });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!user || typeof user.password !== 'string') {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (Number(user.blocked) === 1) {
    res.status(403).json({ error: 'Account is blocked' });
    return;
  }

  if (Number(user.is_active) === 0) {
    res.status(403).json({ error: 'Please verify your email address before signing in.' });
    return;
  }

  const token = generateToken(user.id as number);

  res.json({
    token,
    user: mapPublicUser(user),
  });
});

authRouter.get('/verify-email', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    res.status(400).json({ error: 'Verification token is required' });
    return;
  }

  const user = db
    .prepare(
      'SELECT * FROM users WHERE email_verification_token = ? AND (email_verification_expires IS NULL OR email_verification_expires > ?)',
    )
    .get(token, new Date().toISOString()) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired verification link' });
    return;
  }

  db.prepare(
    'UPDATE users SET is_active = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
  ).run(user.id);

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown>;
  const jwt = generateToken(fresh.id as number);
  res.json({ token: jwt, user: mapPublicUser(fresh) });
});

authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body as { email?: string };
  const generic = { message: 'If an account exists for that email, you will receive reset instructions shortly.' };

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim()) as Record<string, unknown> | undefined;
  if (!user || Number(user.blocked) === 1) {
    res.json(generic);
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?').run(
    resetToken,
    expires,
    user.id,
  );

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
  await sendPasswordResetEmail(email.trim(), resetUrl);

  res.json(generic);
});

authRouter.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token and new password are required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const user = db
    .prepare(
      'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires IS NOT NULL AND password_reset_expires > ?',
    )
    .get(token, new Date().toISOString()) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset link' });
    return;
  }

  const hashed = bcrypt.hashSync(newPassword, 12);
  db.prepare(
    'UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
  ).run(hashed, user.id);

  res.json({ message: 'Password updated. You can sign in with your new password.' });
});

authRouter.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: mapPublicUser(user) });
});
