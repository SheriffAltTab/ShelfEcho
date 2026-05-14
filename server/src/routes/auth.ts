import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db.js';
import { generateToken, authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/mail.js';
import passport from 'passport';
import { isGoogleOAuthConfigured } from '../lib/passportGoogle.js';

export const authRouter = Router();

// Змінено на функцію: тепер змінна .env зчитується в правильний момент
function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
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

authRouter.get('/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    res.status(503).json({ error: 'Google sign-in is not configured' });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

authRouter.get(
  '/google/callback',
  (req, res, next) => {
    // Обгортаємо виклик, щоб використати правильну URL під час помилки
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${getFrontendUrl()}/auth?error=google_sign_in_failed`,
    })(req, res, next);
  },
  (req, res) => {
    const user = req.user as { userId?: number } | undefined;
    if (!user?.userId) {
      res.redirect(302, `${getFrontendUrl()}/auth?error=google_no_user`);
      return;
    }
    const token = generateToken(user.userId);
    res.redirect(302, `${getFrontendUrl()}/auth/callback#token=${encodeURIComponent(token)}`);
  },
);

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

    const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(verifyToken)}`;
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

  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
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