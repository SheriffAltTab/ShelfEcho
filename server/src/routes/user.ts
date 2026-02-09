import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const userRouter = Router();

userRouter.put('/onboard', authMiddleware, (req: AuthRequest, res: Response) => {
  const { favoriteGenres, readingGoal } = req.body;

  db.prepare('UPDATE users SET onboarded = 1, favorite_genres = ?, reading_goal = ? WHERE id = ?')
    .run(JSON.stringify(favoriteGenres || []), readingGoal || 12, req.userId!);

  res.json({ success: true });
});

userRouter.put('/profile', authMiddleware, (req: AuthRequest, res: Response) => {
  const { name, avatar, favoriteGenres, readingGoal, email, currentPassword, newPassword } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
  if (favoriteGenres !== undefined) { updates.push('favorite_genres = ?'); values.push(JSON.stringify(favoriteGenres)); }
  if (readingGoal !== undefined) { updates.push('reading_goal = ?'); values.push(readingGoal); }

  // Email change
  if (email !== undefined) {
    const currentUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId!) as any;
    if (email !== currentUser.email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.userId!);
      if (emailExists) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
      updates.push('email = ?');
      values.push(email);
    }
  }

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to change password' });
      return;
    }
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.userId!) as any;
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      res.status(403).json({ error: 'Current password is incorrect' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }
    updates.push('password = ?');
    values.push(bcrypt.hashSync(newPassword, 12));
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(req.userId!);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as any;
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
    },
  });
});

userRouter.get('/stats', authMiddleware, (req: AuthRequest, res: Response) => {
  const totalBooks = db.prepare('SELECT COUNT(*) as count FROM reading_list WHERE user_id = ?').get(req.userId!) as any;
  const readBooks = db.prepare("SELECT COUNT(*) as count FROM reading_list WHERE user_id = ? AND status = 'read'").get(req.userId!) as any;
  const readingBooks = db.prepare("SELECT COUNT(*) as count FROM reading_list WHERE user_id = ? AND status = 'reading'").get(req.userId!) as any;
  const wantBooks = db.prepare("SELECT COUNT(*) as count FROM reading_list WHERE user_id = ? AND status = 'want'").get(req.userId!) as any;
  const reviews = db.prepare('SELECT COUNT(*) as count FROM comments WHERE user_id = ?').get(req.userId!) as any;
  const favorites = db.prepare('SELECT COUNT(*) as count FROM favorites WHERE user_id = ?').get(req.userId!) as any;

  // Monthly reading stats (books marked as 'read' per month)
  const monthlyReading = db.prepare(`
    SELECT
      strftime('%m', created_at) as month,
      COUNT(*) as count
    FROM reading_list
    WHERE user_id = ? AND status = 'read'
    GROUP BY strftime('%m', created_at)
    ORDER BY month
  `).all(req.userId!) as any[];

  res.json({
    totalBooks: totalBooks.count,
    readBooks: readBooks.count,
    readingBooks: readingBooks.count,
    wantBooks: wantBooks.count,
    reviews: reviews.count,
    favorites: favorites.count,
    monthlyReading: monthlyReading.map((m: any) => ({
      month: m.month,
      count: m.count,
    })),
  });
});

// Subjects that are too generic or not actual genres — skip them for Genre Breakdown
const SKIP_SUBJECTS = new Set([
  'fiction', 'nonfiction', 'non-fiction', 'literature', 'english literature',
  'english language', 'english fiction', 'fiction in english', 'gift books',
  'open library staff picks', 'accessible book', 'protected daisy',
  'in library', 'internet archive wishlist', 'large type books',
  'lending library', 'overdrive', 'ficción', 'romans, nouvelles',
  'telephone directories',
]);

/** Check if a subject looks like an actual genre rather than noise */
function isGenreLike(subject: string): boolean {
  const lower = subject.toLowerCase().trim();
  // Skip if in the blocklist
  if (SKIP_SUBJECTS.has(lower)) return false;
  // Skip subjects that look like classification codes (e.g. "823/.912", "Pr6039...")
  if (/^\d|^[A-Z]{1,2}\d/.test(subject.trim())) return false;
  // Skip subjects that contain "(fictitious character)"
  if (lower.includes('fictitious character')) return false;
  // Skip subjects that contain "(imaginary place)"
  if (lower.includes('imaginary place')) return false;
  // Skip long translated library classification strings
  if (lower.length > 60) return false;
  return true;
}

// GET /user/genre-breakdown — real genre data from books the user read/is reading
userRouter.get('/genre-breakdown', authMiddleware, async (req: AuthRequest, res: Response) => {
  // Get book keys for read + reading books
  const books = db.prepare(`
    SELECT book_key, title FROM reading_list
    WHERE user_id = ? AND status IN ('read', 'reading')
  `).all(req.userId!) as any[];

  if (books.length === 0) {
    res.json({ genres: [] });
    return;
  }

  // Fetch subjects for each book from OpenLibrary
  const genreCount: Record<string, number> = {};

  for (const { book_key, title } of books) {
    try {
      const key = book_key.replace(/^\//, '');
      const response = await fetch(`https://openlibrary.org/${key}.json`);
      const data = await response.json();
      const allSubjects = (data.subjects || []) as string[];

      // Filter to genre-like subjects, skip book's own title, then take first 3
      const bookTitleLower = (title || '').toLowerCase();
      const genreSubjects = allSubjects
        .filter((s: string) => {
          const trimmed = s.trim();
          if (!trimmed) return false;
          // Skip the book's own title as a subject
          if (trimmed.toLowerCase() === bookTitleLower) return false;
          return isGenreLike(trimmed);
        })
        .slice(0, 3);

      for (const s of genreSubjects) {
        const genre = s.trim();
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      }
    } catch { /* skip */ }
  }

  // Sort by count descending and take top 8
  const sorted = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const total = sorted.reduce((sum, [, count]) => sum + count, 0);

  res.json({
    genres: sorted.map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    })),
  });
});
