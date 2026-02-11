import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken, authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const authRouter = Router();

authRouter.post('/register', (req, res) => {
  const { name, email, password } = req.body;

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
  const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hashedPassword);
  const token = generateToken(result.lastInsertRowid as number);

  res.status(201).json({
    token,
    user: {
      id: result.lastInsertRowid,
      name,
      email,
      onboarded: false,
      avatar: '',
      favoriteGenres: [],
      readingGoal: 12,
      role: 'user',
    },
  });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: 'Account is blocked' });
    return;
  }

  const token = generateToken(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboarded: !!user.onboarded,
      avatar: user.avatar,
      favoriteGenres: JSON.parse(user.favorite_genres || '[]'),
      readingGoal: user.reading_goal,
      role: user.role || 'user',
    },
  });
});

authRouter.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboarded: !!user.onboarded,
      avatar: user.avatar,
      favoriteGenres: JSON.parse(user.favorite_genres || '[]'),
      readingGoal: user.reading_goal,
      createdAt: user.created_at,
      role: user.role || 'user',
    },
  });
});
