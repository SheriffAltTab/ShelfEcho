import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, roleMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import { cache as booksCache } from './books.js';
import { getRecWeights, setRecWeights } from '../lib/recWeights.js';
import { clearRecommendationCaches, invalidateRecommendationCache } from '../lib/recommendationEngine.js';
import { deleteUserAccount } from '../lib/accountDeletion.js';

export const adminRouter = Router();
adminRouter.use(authMiddleware);

// ─── Dashboard Statistics ──────────────────────────────────────────────
// Access: superadmin, content_manager

adminRouter.get('/stats/registrations', roleMiddleware('superadmin', 'content_manager'), (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM users
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all() as any[];
  res.json({ registrations: rows });
});

adminRouter.get('/stats/top-want', roleMiddleware('superadmin', 'content_manager'), (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT book_key, title, author, cover_id, COUNT(*) as count
    FROM reading_list WHERE status = 'want'
    GROUP BY book_key
    ORDER BY count DESC
    LIMIT 10
  `).all() as any[];
  res.json({ books: rows });
});

adminRouter.get('/stats/genre-distribution', roleMiddleware('superadmin', 'content_manager'), (_req: AuthRequest, res: Response) => {
  const users = db.prepare('SELECT favorite_genres FROM users WHERE onboarded = 1').all() as any[];
  const genreCount: Record<string, number> = {};
  for (const u of users) {
    const genres: string[] = JSON.parse(u.favorite_genres || '[]');
    for (const g of genres) {
      genreCount[g] = (genreCount[g] || 0) + 1;
    }
  }
  const sorted = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, c]) => sum + c, 0);
  res.json({
    genres: sorted.map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    })),
  });
});

// ─── Recommendation Engine Tuning ────────────────────────────────────
// Access: superadmin, content_manager

adminRouter.get('/rec-weights', roleMiddleware('superadmin', 'content_manager'), (_req: AuthRequest, res: Response) => {
  res.json({ weights: getRecWeights() });
});

adminRouter.put('/rec-weights', roleMiddleware('superadmin', 'content_manager'), (req: AuthRequest, res: Response) => {
  const { weights } = req.body;
  if (!weights) { res.status(400).json({ error: 'weights required' }); return; }
  const saved = setRecWeights(weights);
  invalidateRecommendationCache();
  res.json({ success: true, weights: saved });
});

adminRouter.get('/simulate/:userId', roleMiddleware('superadmin', 'content_manager'), (req: AuthRequest, res: Response) => {
  const targetId = parseInt(req.params.userId as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: 'Invalid userId' }); return; }

  const user = db.prepare('SELECT id, name, favorite_genres FROM users WHERE id = ?').get(targetId) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const favoriteGenres: string[] = JSON.parse(user.favorite_genres || '[]');

  const readingList = db.prepare(`
    SELECT book_key, title, author, status FROM reading_list WHERE user_id = ?
    ORDER BY CASE status WHEN 'read' THEN 1 WHEN 'reading' THEN 2 WHEN 'want' THEN 3 END, created_at DESC
    LIMIT 10
  `).all(targetId) as any[];

  // Collaborative: find similar users
  const userBookKeys = db.prepare('SELECT book_key FROM reading_list WHERE user_id = ?').all(targetId) as any[];
  const myKeys = userBookKeys.map((b: any) => b.book_key);
  let similarUsers: any[] = [];
  if (myKeys.length > 0) {
    const placeholders = myKeys.map(() => '?').join(',');
    similarUsers = db.prepare(`
      SELECT user_id, COUNT(*) as common_books FROM reading_list
      WHERE user_id != ? AND book_key IN (${placeholders})
      GROUP BY user_id ORDER BY common_books DESC LIMIT 5
    `).all(targetId, ...myKeys) as any[];
  }

  const weights = getRecWeights();

  res.json({
    user: { id: user.id, name: user.name },
    favoriteGenres,
    readingList: readingList.map((b: any) => ({ title: b.title, author: b.author, status: b.status })),
    similarUsers: similarUsers.map((u: any) => ({ userId: u.user_id, commonBooks: u.common_books })),
    weights,
    explanation: {
      genres: `User has ${favoriteGenres.length} favorite genres: ${favoriteGenres.join(', ') || 'none'}`,
      readingList: `User has ${readingList.length} books in reading list (showing top 10)`,
      collaborative: `Found ${similarUsers.length} similar users based on shared books`,
      weights: `Current weights: genre=${weights.genre_weight}, author=${weights.author_weight}, subject=${weights.subject_weight}, collaborative=${weights.collaborative_weight}`,
    },
  });
});

adminRouter.post('/cache/clear', roleMiddleware('superadmin', 'content_manager'), (_req: AuthRequest, res: Response) => {
  // Clear in-memory books cache
  booksCache.clear();
  clearRecommendationCaches();
  // Clear subjects_cache in DB
  db.prepare('DELETE FROM subjects_cache').run();
  res.json({ success: true, message: 'All caches cleared' });
});

// ─── Community & Moderation ──────────────────────────────────────────
// Access: superadmin, moderator

adminRouter.get('/moderation/queue', roleMiddleware('superadmin', 'moderator'), (_req: AuthRequest, res: Response) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.status = 'pending'
    ORDER BY c.created_at DESC
  `).all() as any[];
  res.json({ comments });
});

adminRouter.put('/moderation/:commentId', roleMiddleware('superadmin', 'moderator'), (req: AuthRequest, res: Response) => {
  const { commentId } = req.params;
  const { action } = req.body; // approve, reject, force_spoiler

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId) as any;
  if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }

  if (action === 'approve') {
    db.prepare("UPDATE comments SET status = 'approved' WHERE id = ?").run(commentId);
  } else if (action === 'reject') {
    db.prepare("UPDATE comments SET status = 'rejected' WHERE id = ?").run(commentId);
  } else if (action === 'force_spoiler') {
    db.prepare("UPDATE comments SET has_spoiler = 1 WHERE id = ?").run(commentId);
  } else if (action === 'delete') {
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  } else {
    res.status(400).json({ error: 'Invalid action (approve, reject, force_spoiler, delete)' }); return;
  }

  res.json({ success: true });
});

adminRouter.get('/moderation/reports', roleMiddleware('superadmin', 'moderator'), (_req: AuthRequest, res: Response) => {
  const reports = db.prepare(`
    SELECT r.*, c.text as comment_text, c.book_key, c.rating as comment_rating, c.has_spoiler,
           u.name as reporter_name, cu.name as comment_user_name
    FROM comment_reports r
    JOIN comments c ON r.comment_id = c.id
    JOIN users u ON r.user_id = u.id
    JOIN users cu ON c.user_id = cu.id
    ORDER BY r.created_at DESC
  `).all() as any[];
  res.json({ reports });
});

// ─── User Management ──────────────────────────────────────────────────
// Access: superadmin, moderator

adminRouter.get('/users', roleMiddleware('superadmin', 'moderator'), (req: AuthRequest, res: Response) => {
  const page = Math.max(0, parseInt(String(req.query.page ?? '0'), 10) || 0);
  const pageSize = Math.min(100, Math.max(5, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const offset = page * pageSize;

  let users: any[];
  let total: number;
  if (q) {
    const numericQ = parseInt(q, 10);
    if (!Number.isNaN(numericQ) && String(numericQ) === q) {
      users = db.prepare(
        'SELECT id, name, email, avatar, role, blocked, created_at, google_id FROM users WHERE id = ? ORDER BY id ASC LIMIT ? OFFSET ?',
      ).all(numericQ, pageSize, offset) as any[];
      total = (db.prepare('SELECT COUNT(*) as count FROM users WHERE id = ?').get(numericQ) as any).count;
    } else {
      const pattern = `%${q}%`;
      users = db.prepare(
        'SELECT id, name, email, avatar, role, blocked, created_at, google_id FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY id ASC LIMIT ? OFFSET ?',
      ).all(pattern, pattern, pageSize, offset) as any[];
      total = (db.prepare('SELECT COUNT(*) as count FROM users WHERE name LIKE ? OR email LIKE ?').get(pattern, pattern) as any).count;
    }
  } else {
    users = db.prepare(
      'SELECT id, name, email, avatar, role, blocked, created_at, google_id FROM users ORDER BY id ASC LIMIT ? OFFSET ?',
    ).all(pageSize, offset) as any[];
    total = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  }

  res.json({ users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

adminRouter.get('/users/search', roleMiddleware('superadmin', 'moderator'), (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  let users;
  const numericQ = parseInt(q, 10);
  if (!isNaN(numericQ)) {
    users = db.prepare('SELECT id, name, email, avatar, role, blocked, created_at, google_id FROM users WHERE id = ?').all(numericQ);
  } else {
    users = db.prepare("SELECT id, name, email, avatar, role, blocked, created_at, google_id FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 20")
      .all(`%${q}%`, `%${q}%`);
  }
  res.json({ users });
});

adminRouter.get('/users/:id/activity', roleMiddleware('superadmin', 'moderator'), (req: AuthRequest, res: Response) => {
  const targetId = parseInt(req.params.id as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const user = db.prepare('SELECT id, name, email, avatar, role, blocked, created_at FROM users WHERE id = ?').get(targetId) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const comments = db.prepare('SELECT id, book_key, text, rating, has_spoiler, status, created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(targetId);
  const readingList = db.prepare('SELECT book_key, title, author, status, created_at FROM reading_list WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(targetId);
  const favorites = db.prepare('SELECT book_key, title, author, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(targetId);
  const searches = db.prepare('SELECT query, results_count, created_at FROM search_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(targetId);

  res.json({ user, comments, readingList, favorites, searches });
});

adminRouter.put('/users/:id/block', roleMiddleware('superadmin', 'moderator'), (req: AuthRequest, res: Response) => {
  const targetId = parseInt(req.params.id as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const { blocked } = req.body;
  db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, targetId);
  res.json({ success: true });
});

adminRouter.put('/users/:id/role', roleMiddleware('superadmin'), (req: AuthRequest, res: Response) => {
  const targetId = parseInt(req.params.id as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const { role } = req.body;
  if (!['user', 'moderator', 'content_manager', 'superadmin'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' }); return;
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
  res.json({ success: true });
});

// ─── Search Analytics (System Health) ────────────────────────────────
// Access: superadmin, content_manager

adminRouter.delete('/users/:id', roleMiddleware('superadmin', 'moderator'), async (req: AuthRequest, res: Response) => {
  const targetId = parseInt(req.params.id as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: 'Invalid id' }); return; }
  if (targetId === req.userId) {
    res.status(400).json({ error: 'Use profile settings to delete your own account.' });
    return;
  }

  try {
    await deleteUserAccount({
      targetUserId: targetId,
      actorUserId: req.userId!,
      actorRole: req.userRole || 'user',
    });
    invalidateRecommendationCache();
    res.json({ success: true });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to delete account' });
  }
});

adminRouter.get('/search-analytics', roleMiddleware('superadmin', 'content_manager'), (_req: AuthRequest, res: Response) => {
  const zeroResults = db.prepare(`
    SELECT query, COUNT(*) as search_count, MAX(created_at) as last_searched
    FROM search_logs WHERE results_count = 0
    GROUP BY LOWER(query)
    ORDER BY search_count DESC
    LIMIT 50
  `).all() as any[];
  res.json({ zeroResults });
});
