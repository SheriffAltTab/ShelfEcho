import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const commentsRouter = Router();

// Trigger words — comments containing these go to pending status
const TRIGGER_WORDS = [
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'crap',
  'spam', 'buy now', 'click here', 'free money',
];

function containsTriggerWord(text: string): boolean {
  const lower = text.toLowerCase();
  return TRIGGER_WORDS.some((w) => lower.includes(w));
}

function commentToJson(c: any) {
  return {
    id: c.id,
    user_id: c.user_id,
    book_key: c.book_key,
    text: c.text,
    rating: c.rating,
    has_spoiler: !!c.has_spoiler,
    status: c.status || 'approved',
    user_name: c.user_name,
    user_avatar: c.user_avatar,
    user_role: c.user_role || 'user',
    created_at: c.created_at,
  };
}

// GET /comments?key=works/OL123W
commentsRouter.get('/', (req, res) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.book_key = ? AND (c.status = 'approved' OR c.status IS NULL)
    ORDER BY c.created_at DESC
  `).all(bookKey);

  res.json({ comments: comments.map(commentToJson) });
});

// POST /comments?key=works/OL123W — one review per user per book (upsert)
commentsRouter.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const bookKey = req.query.key as string;
  if (!bookKey) { res.status(400).json({ error: 'key is required' }); return; }
  const { text, rating, hasSpoiler } = req.body;

  if (!text) {
    res.status(400).json({ error: 'Comment text is required' });
    return;
  }

  const spoiler = hasSpoiler ? 1 : 0;
  const status = containsTriggerWord(text) ? 'pending' : 'approved';

  // Check if user already has a review for this book
  const existing = db.prepare('SELECT id FROM comments WHERE user_id = ? AND book_key = ?')
    .get(req.userId!, bookKey) as any;

  if (existing) {
    db.prepare("UPDATE comments SET text = ?, rating = ?, has_spoiler = ?, status = ?, created_at = datetime('now') WHERE id = ?")
      .run(text, rating || 0, spoiler, status, existing.id);

    const user = db.prepare('SELECT name, avatar, role FROM users WHERE id = ?').get(req.userId!) as any;
    res.json({
      comment: {
        id: existing.id,
        user_id: req.userId,
        book_key: bookKey,
        text,
        rating: rating || 0,
        has_spoiler: !!spoiler,
        status,
        user_name: user.name,
        user_avatar: user.avatar,
        user_role: user.role || 'user',
        created_at: new Date().toISOString(),
      },
      updated: true,
    });
    return;
  }

  const result = db.prepare('INSERT INTO comments (user_id, book_key, text, rating, has_spoiler, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.userId!, bookKey, text, rating || 0, spoiler, status);

  const user = db.prepare('SELECT name, avatar, role FROM users WHERE id = ?').get(req.userId!) as any;

  res.status(201).json({
    comment: {
      id: result.lastInsertRowid,
      user_id: req.userId,
      book_key: bookKey,
      text,
      rating: rating || 0,
      has_spoiler: !!spoiler,
      status,
      user_name: user.name,
      user_avatar: user.avatar,
      user_role: user.role || 'user',
      created_at: new Date().toISOString(),
    },
  });
});

// PUT /comments/:id — edit own review
commentsRouter.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { text, rating, hasSpoiler } = req.body;

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
  if (text !== undefined) {
    updates.push('text = ?'); values.push(text);
    if (containsTriggerWord(text)) {
      updates.push('status = ?'); values.push('pending');
    }
  }
  if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }
  if (hasSpoiler !== undefined) { updates.push('has_spoiler = ?'); values.push(hasSpoiler ? 1 : 0); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE comments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT name, avatar, role FROM users WHERE id = ?').get(req.userId!) as any;
  const updated = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as any;

  res.json({
    comment: commentToJson({ ...updated, user_name: user.name, user_avatar: user.avatar, user_role: user.role }),
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

// POST /comments/:id/report — report a comment
commentsRouter.post('/:id/report', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !['spam', 'spoiler', 'offensive', 'other'].includes(reason)) {
    res.status(400).json({ error: 'Valid reason is required (spam, spoiler, offensive, other)' });
    return;
  }

  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(id) as any;
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  try {
    db.prepare('INSERT INTO comment_reports (user_id, comment_id, reason) VALUES (?, ?, ?)')
      .run(req.userId!, id, reason);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'You already reported this comment' });
      return;
    }
    throw err;
  }
});
