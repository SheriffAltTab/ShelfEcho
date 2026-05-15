import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import { invalidateRecommendationCache } from '../lib/recommendationEngine.js';

export const favoritesRouter = Router();

favoritesRouter.use(authMiddleware);

favoritesRouter.get('/', (req: AuthRequest, res: Response) => {
  const favorites = db.prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC').all(req.userId!);
  res.json({ favorites });
});

favoritesRouter.post('/', (req: AuthRequest, res: Response) => {
  const { bookKey, title, author, coverId } = req.body;

  if (!bookKey || !title) {
    res.status(400).json({ error: 'bookKey and title are required' });
    return;
  }

  try {
    db.prepare('INSERT INTO favorites (user_id, book_key, title, author, cover_id) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId!, bookKey, title, author || '', coverId || null);
    invalidateRecommendationCache();
    res.status(201).json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Already in favorites' });
      return;
    }
    throw err;
  }
});

// Use query param: DELETE /favorites/item?key=works/OL123W
favoritesRouter.delete('/item', (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND book_key = ?').run(req.userId!, bookKey);
  invalidateRecommendationCache();
  res.json({ success: true });
});

// Use query param: GET /favorites/check?key=works/OL123W
favoritesRouter.get('/check', (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  const fav = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND book_key = ?').get(req.userId!, bookKey);
  res.json({ isFavorite: !!fav });
});
