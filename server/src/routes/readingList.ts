import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const readingListRouter = Router();

readingListRouter.use(authMiddleware);

readingListRouter.get('/', (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  let query = 'SELECT * FROM reading_list WHERE user_id = ?';
  const params: any[] = [req.userId!];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const books = db.prepare(query).all(...params);
  res.json({ books });
});

readingListRouter.post('/', (req: AuthRequest, res: Response) => {
  const { bookKey, title, author, coverId, status = 'want' } = req.body;

  if (!bookKey || !title) {
    res.status(400).json({ error: 'bookKey and title are required' });
    return;
  }

  try {
    db.prepare('INSERT INTO reading_list (user_id, book_key, title, author, cover_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.userId!, bookKey, title, author || '', coverId || null, status);
    res.status(201).json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      db.prepare('UPDATE reading_list SET status = ? WHERE user_id = ? AND book_key = ?')
        .run(status, req.userId!, bookKey);
      res.json({ success: true, updated: true });
      return;
    }
    throw err;
  }
});

// PUT /reading-list/item?key=works/OL123W
readingListRouter.put('/item', (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  const { status, progress, rating, totalPages, pagesRead } = req.body;

  const updates: string[] = [];
  const values: any[] = [];

  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (progress !== undefined) { updates.push('progress = ?'); values.push(progress); }
  if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }
  if (totalPages !== undefined) { updates.push('total_pages = ?'); values.push(totalPages); }
  if (pagesRead !== undefined) { updates.push('pages_read = ?'); values.push(pagesRead); }

  // Auto-calculate progress from pages
  if (pagesRead !== undefined || totalPages !== undefined) {
    const existing = db.prepare('SELECT total_pages, pages_read FROM reading_list WHERE user_id = ? AND book_key = ?')
      .get(req.userId!, bookKey) as any;
    const tp = totalPages ?? existing?.total_pages ?? 0;
    const pr = pagesRead ?? existing?.pages_read ?? 0;
    if (tp > 0) {
      const pct = Math.min(100, Math.round((pr / tp) * 100));
      updates.push('progress = ?');
      values.push(pct);
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(req.userId!, bookKey);
  db.prepare(`UPDATE reading_list SET ${updates.join(', ')} WHERE user_id = ? AND book_key = ?`).run(...values);

  const item = db.prepare('SELECT * FROM reading_list WHERE user_id = ? AND book_key = ?').get(req.userId!, bookKey);
  res.json({ success: true, item });
});

// DELETE /reading-list/item?key=works/OL123W
readingListRouter.delete('/item', (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  db.prepare('DELETE FROM reading_list WHERE user_id = ? AND book_key = ?').run(req.userId!, bookKey);
  res.json({ success: true });
});

// GET /reading-list/check?key=works/OL123W
readingListRouter.get('/check', (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  const entry = db.prepare('SELECT status, progress, total_pages, pages_read FROM reading_list WHERE user_id = ? AND book_key = ?')
    .get(req.userId!, bookKey) as any;
  res.json({
    inList: !!entry,
    status: entry?.status || null,
    progress: entry?.progress || 0,
    totalPages: entry?.total_pages || 0,
    pagesRead: entry?.pages_read || 0,
  });
});
