import { Router } from 'express';
import type { Response } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import {
  getCollaborativeRecommendations,
  getContentBasedRecommendations,
  getFeaturedRecommendations,
  invalidateRecommendationCache,
  parseExcludeQuery,
  parseRecommendationPagination,
} from '../lib/recommendationEngine.js';

export const recommendationsRouter = Router();
recommendationsRouter.use(authMiddleware);

recommendationsRouter.get('/content-based', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = parseRecommendationPagination(req.query);
    const payload = await getContentBasedRecommendations(req.userId!, { page, pageSize });
    res.json(payload);
  } catch (err) {
    console.error('content-based recommendations error', err);
    res.status(500).json({ error: 'Failed to build recommendations' });
  }
});

recommendationsRouter.get('/collaborative', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = parseRecommendationPagination(req.query);
    const payload = await getCollaborativeRecommendations(req.userId!, { page, pageSize });
    res.json(payload);
  } catch (err) {
    console.error('collaborative recommendations error', err);
    res.status(500).json({ error: 'Failed to build recommendations' });
  }
});

recommendationsRouter.get('/featured', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = parseRecommendationPagination(req.query);
    const exclude = parseExcludeQuery(req.query as Record<string, unknown>);
    const refreshKey = typeof req.query.refresh === 'string' ? req.query.refresh : '';
    const payload = await getFeaturedRecommendations(req.userId!, { page, pageSize, exclude, refreshKey });
    res.json(payload);
  } catch (err) {
    console.error('featured recommendations error', err);
    res.status(500).json({ error: 'Failed to build recommendations' });
  }
});

recommendationsRouter.post('/not-interested', (req: AuthRequest, res: Response) => {
  const { bookKey, title, author, coverId } = req.body;

  if (!bookKey || !title) {
    res.status(400).json({ error: 'bookKey and title are required' });
    return;
  }

  try {
    db.prepare('INSERT OR IGNORE INTO not_interested (user_id, book_key, title, author, cover_id) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId!, bookKey, title, author || '', coverId || null);
    invalidateRecommendationCache();
    res.json({ success: true });
  } catch (err) {
    console.error('not-interested error', err);
    res.status(500).json({ error: 'Failed to mark as not interested' });
  }
});

recommendationsRouter.get('/not-interested', (req: AuthRequest, res: Response) => {
  const items = db.prepare('SELECT book_key FROM not_interested WHERE user_id = ?')
    .all(req.userId!) as Array<{ book_key: string }>;
  res.json({ keys: items.map((i) => i.book_key) });
});
