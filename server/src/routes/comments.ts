import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const commentsRouter = Router();

// GET /comments?key=works/OL123W
commentsRouter.get('/', (req, res) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.book_key = ?
    ORDER BY c.created_at DESC
  `).all(bookKey);

  res.json({ comments });
});

// POST /comments?key=works/OL123W — one review per user per book (upsert)
commentsRouter.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  const { text, rating } = req.body;

  if (!text) {
    res.status(400).json({ error: 'Comment text is required' });
    return;
  }

  // Check if user already has a review for this book
  const existing = db.prepare('SELECT id FROM comments WHERE user_id = ? AND book_key = ?')
    .get(req.userId!, bookKey) as any;

  if (existing) {
    // Update existing review
    db.prepare('UPDATE comments SET text = ?, rating = ?, created_at = datetime(\'now\') WHERE id = ?')
      .run(text, rating || 0, existing.id);

    const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.userId!) as any;
    res.json({
      comment: {
        id: existing.id,
        user_id: req.userId,
        book_key: bookKey,
        text,
        rating: rating || 0,
        user_name: user.name,
        user_avatar: user.avatar,
        created_at: new Date().toISOString(),
      },
      updated: true,
    });
    return;
  }

  const result = db.prepare('INSERT INTO comments (user_id, book_key, text, rating) VALUES (?, ?, ?, ?)')
    .run(req.userId!, bookKey, text, rating || 0);

  const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.userId!) as any;

  res.status(201).json({
    comment: {
      id: result.lastInsertRowid,
      user_id: req.userId,
      book_key: bookKey,
      text,
      rating: rating || 0,
      user_name: user.name,
      user_avatar: user.avatar,
      created_at: new Date().toISOString(),
    },
  });
});

// PUT /comments/:id — edit own review
commentsRouter.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { text, rating } = req.body;

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as any;
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }
  if (comment.user_id !== req.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const updates: string[] = [];
  const values: any[] = [];
  if (text !== undefined) { updates.push('text = ?'); values.push(text); }
  if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE comments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(req.userId!) as any;
  const updated = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as any;

  res.json({
    comment: {
      id: updated.id,
      user_id: updated.user_id,
      book_key: updated.book_key,
      text: updated.text,
      rating: updated.rating,
      user_name: user.name,
      user_avatar: user.avatar,
      created_at: updated.created_at,
    },
  });
});

commentsRouter.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const comment = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(id) as any;

  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (comment.user_id !== req.userId) {
    res.status(403).json({ error: 'Not authorized to delete this comment' });
    return;
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  res.json({ success: true });
});
