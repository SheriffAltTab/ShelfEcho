import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import { filterAndNormalizeSubjects } from '../lib/subjects.js';

/**
 * RECOMMENDATION SYSTEM — INFLUENCE OF GENRES
 * ------------------------------------------
 * 1) Featured (top pick)
 *    - Subjects to try are built in order: [favorite genres first, then subjects from recently read books].
 *    - Among candidate books, we prefer those whose subjects overlap with the user's favorite genres.
 * 2) Content-Based ("Because you liked X")
 *    - Uses subjects from the user's reading list. Subjects that match the user's favorite genres
 *      are preferred when choosing which subject to query (so "Because you liked" rows align with tastes).
 * 3) Collaborative ("Readers like you")
 *    - Based only on similar users' books; genre preferences indirectly affect which users are "similar"
 *      (users with same books often share genre tastes).
 * 4) Not Interested
 *    - Books marked "Not Interested" are excluded from all recommendation endpoints.
 */

export const recommendationsRouter = Router();
recommendationsRouter.use(authMiddleware);

// ─── Helpers ───────────────────────────────────────────────────────────

/** Get subjects for a book — uses local cache, falls back to OpenLibrary API */
async function getBookSubjects(bookKey: string): Promise<string[]> {
  const normalizedKey = bookKey.replace(/^\//, '');

  // Check cache
  const cached = db.prepare('SELECT subjects FROM subjects_cache WHERE book_key = ?')
    .get(normalizedKey) as any;
  if (cached) {
    try {
      const parsed = JSON.parse(cached.subjects) as string[];
      return Array.isArray(parsed) ? filterAndNormalizeSubjects(parsed) : [];
    } catch { return []; }
  }

  // Fetch from OpenLibrary
  try {
    const res = await fetch(`https://openlibrary.org/${normalizedKey}.json`);
    const data = await res.json();
    const raw = ((data.subjects || []) as string[]).slice(0, 20);
    const subjects = filterAndNormalizeSubjects(raw);

    db.prepare('INSERT OR REPLACE INTO subjects_cache (book_key, subjects) VALUES (?, ?)')
      .run(normalizedKey, JSON.stringify(subjects));

    return subjects;
  } catch {
    return [];
  }
}

/** Get books the user has interacted with (reading list + not interested) */
function getUserExcludedKeys(userId: number): Set<string> {
  const readingBooks = db.prepare('SELECT book_key FROM reading_list WHERE user_id = ?')
    .all(userId) as any[];
  const notInterestedBooks = db.prepare('SELECT book_key FROM not_interested WHERE user_id = ?')
    .all(userId) as any[];

  const keys = new Set<string>();
  for (const b of readingBooks) keys.add(b.book_key.replace(/^\//, ''));
  for (const b of notInterestedBooks) keys.add(b.book_key.replace(/^\//, ''));
  return keys;
}

interface RecBook {
  key: string;
  title: string;
  author: string;
  coverId?: number | null;
  subjects?: string[];
}

/** Normalize genre for OpenLibrary subject API (e.g. "Science Fiction" → "science_fiction") */
function toOLSubject(genre: string): string {
  return genre.toLowerCase().trim().replace(/\s+/g, '_');
}

/** Fetch books for a subject from OpenLibrary Subjects API (cached) */
async function fetchBooksForSubject(subject: string, limit = 20): Promise<RecBook[]> {
  try {
    const slug = toOLSubject(subject);
    const url = `https://openlibrary.org/subjects/${encodeURIComponent(slug)}.json?limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();

    return (data.works || []).map((w: any) => ({
      key: w.key?.replace(/^\//, '') || '',
      title: w.title || '',
      author: w.authors?.[0]?.name || 'Unknown Author',
      coverId: w.cover_id || null,
      subjects: filterAndNormalizeSubjects(w.subject || []),
    }));
  } catch {
    return [];
  }
}

// ─── Content-Based Filtering ───────────────────────────────────────────

/**
 * For each book in the user's reading list, collect subjects.
 * Find the most common subjects across all user's books.
 * Fetch books from those subjects.
 * Pick a specific book to create "Because you liked [BookName]" sections.
 */
recommendationsRouter.get('/content-based', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const user = db.prepare('SELECT favorite_genres FROM users WHERE id = ?').get(userId) as any;
  const favoriteGenres: string[] = JSON.parse(user?.favorite_genres || '[]');
  const favSet = new Set(favoriteGenres.map((g: string) => g.toLowerCase().trim()));

  // Get user's reading list books (prefer read/reading over want)
  const userBooks = db.prepare(`
    SELECT book_key, title, author, cover_id, status
    FROM reading_list WHERE user_id = ?
    ORDER BY
      CASE status WHEN 'read' THEN 1 WHEN 'reading' THEN 2 WHEN 'want' THEN 3 END,
      created_at DESC
  `).all(userId) as any[];

  if (userBooks.length === 0) {
    res.json({ sections: [] });
    return;
  }

  const excludedKeys = getUserExcludedKeys(userId);

  // Collect subjects from user's books (limit to top 5 books for performance)
  const booksToAnalyze = userBooks.slice(0, 5);
  const bookSubjectsMap: Map<string, { title: string; subjects: string[] }> = new Map();

  await Promise.all(booksToAnalyze.map(async (book: any) => {
    const subjects = await getBookSubjects(book.book_key);
    bookSubjectsMap.set(book.book_key, { title: book.title, subjects });
  }));

  // Build sections: "Because you liked [Book]"
  const sections: Array<{
    sourceBook: { key: string; title: string; author: string; coverId?: number };
    books: RecBook[];
  }> = [];

  // For each analyzed book, find similar books via its top subjects
  for (const book of booksToAnalyze) {
    const entry = bookSubjectsMap.get(book.book_key);
    if (!entry || entry.subjects.length === 0) continue;

    const genericSubjects = new Set([
      'fiction', 'nonfiction', 'non-fiction', 'literature',
      'english literature', 'english language', 'fiction in english',
    ]);
    const specificSubjects = entry.subjects.filter(
      (s: string) => !genericSubjects.has(s.toLowerCase().trim())
    );
    const pool = specificSubjects.length > 0 ? specificSubjects : entry.subjects;
    // Prefer subjects that match user's favorite genres (genre influence)
    const sorted = [...pool].sort((a, b) => {
      const aFav = favSet.has(a.toLowerCase().trim());
      const bFav = favSet.has(b.toLowerCase().trim());
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
    const subjectsToQuery = sorted.slice(0, 2);

    const recommendedBooks: RecBook[] = [];
    const seenKeys = new Set<string>();

    for (const subject of subjectsToQuery) {
      const subjectBooks = await fetchBooksForSubject(subject, 15);
      for (const sb of subjectBooks) {
        const normalizedKey = sb.key.replace(/^\//, '');
        if (!excludedKeys.has(normalizedKey) && !seenKeys.has(normalizedKey)) {
          seenKeys.add(normalizedKey);
          recommendedBooks.push(sb);
        }
        if (recommendedBooks.length >= 10) break;
      }
      if (recommendedBooks.length >= 10) break;
    }

    if (recommendedBooks.length > 0) {
      sections.push({
        sourceBook: {
          key: book.book_key,
          title: book.title,
          author: book.author,
          coverId: book.cover_id,
        },
        books: recommendedBooks.slice(0, 10),
      });
    }

    // Limit to 2 sections
    if (sections.length >= 2) break;
  }

  res.json({ sections });
});

// ─── Collaborative Filtering ──────────────────────────────────────────

/**
 * Find users who share books in their reading lists.
 * The more books in common, the more "similar" they are.
 * Recommend books from similar users that this user hasn't read.
 */
recommendationsRouter.get('/collaborative', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Get this user's book keys
  const userBookKeys = db.prepare('SELECT book_key FROM reading_list WHERE user_id = ?')
    .all(userId) as any[];

  if (userBookKeys.length === 0) {
    res.json({ books: [] });
    return;
  }

  const myKeys = userBookKeys.map((b: any) => b.book_key);
  const excludedKeys = getUserExcludedKeys(userId);

  // Find other users who have at least one book in common
  // Build placeholders for IN clause
  const placeholders = myKeys.map(() => '?').join(',');

  const similarUsers = db.prepare(`
    SELECT user_id, COUNT(*) as common_books
    FROM reading_list
    WHERE user_id != ? AND book_key IN (${placeholders})
    GROUP BY user_id
    ORDER BY common_books DESC
    LIMIT 20
  `).all(userId, ...myKeys) as any[];

  if (similarUsers.length === 0) {
    res.json({ books: [] });
    return;
  }

  // Get books from similar users that this user doesn't have
  const similarUserIds = similarUsers.map((u: any) => u.user_id);
  const userPlaceholders = similarUserIds.map(() => '?').join(',');

  const candidateBooks = db.prepare(`
    SELECT book_key, title, author, cover_id, COUNT(DISTINCT user_id) as user_count
    FROM reading_list
    WHERE user_id IN (${userPlaceholders}) AND user_id != ?
    GROUP BY book_key
    ORDER BY user_count DESC
    LIMIT 30
  `).all(...similarUserIds, userId) as any[];

  // Filter out already known books and map to result format
  const result: Array<{
    key: string;
    title: string;
    author: string;
    coverId: number | null;
    userCount: number;
  }> = [];

  for (const book of candidateBooks) {
    const normalizedKey = book.book_key.replace(/^\//, '');
    if (!excludedKeys.has(normalizedKey)) {
      result.push({
        key: book.book_key,
        title: book.title,
        author: book.author,
        coverId: book.cover_id,
        userCount: book.user_count,
      });
    }
    if (result.length >= 10) break;
  }

  res.json({ books: result });
});

// ─── Featured recommendation (top pick) ───────────────────────────────

recommendationsRouter.get('/featured', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Get user's favorite genres
  const user = db.prepare('SELECT favorite_genres FROM users WHERE id = ?').get(userId) as any;
  const favoriteGenres: string[] = JSON.parse(user?.favorite_genres || '[]');

  // Get user's most-read subjects from their books
  const userBooks = db.prepare(`
    SELECT book_key FROM reading_list
    WHERE user_id = ? AND status IN ('read', 'reading')
    ORDER BY created_at DESC LIMIT 5
  `).all(userId) as any[];

  const excludedKeys = getUserExcludedKeys(userId);

  // Build subjects to try: favorite genres first (strong genre influence), then from read books
  const fromBooks: string[] = [];
  for (const book of userBooks.slice(0, 3)) {
    const subjects = await getBookSubjects(book.book_key);
    const filtered = subjects.filter(
      (s: string) => !['fiction', 'nonfiction', 'literature', 'english literature', 'fiction in english'].includes(s.toLowerCase())
    );
    fromBooks.push(...filtered.slice(0, 2));
  }
  const favSlugs = favoriteGenres.slice(0, 4).map(toOLSubject);
  const subjectsToTry = [...new Set([...favSlugs, ...fromBooks.map(toOLSubject)])];
  if (subjectsToTry.length === 0) {
    subjectsToTry.push('fantasy', 'science_fiction', 'mystery');
  }

  const favSet = new Set(favoriteGenres.map((g: string) => g.toLowerCase().trim()));

  // Find best candidate: prefer books whose subjects overlap with favorite genres
  for (const subject of subjectsToTry) {
    const books = await fetchBooksForSubject(subject, 15);
    const withCover = books.filter(
      (b) => !excludedKeys.has(b.key.replace(/^\//, '')) && b.coverId
    );
    if (withCover.length === 0) continue;

    const scored = withCover.map((book) => {
      const bookSubjects = book.subjects || [];
      const overlap = bookSubjects.filter((s: string) => favSet.has(s.toLowerCase().trim())).length;
      return { book, overlap };
    });
    scored.sort((a, b) => b.overlap - a.overlap);

    for (const { book } of scored) {
      const normalizedKey = book.key.replace(/^\//, '');
      try {
        const detailsRes = await fetch(`https://openlibrary.org/${normalizedKey}.json`);
        const details = await detailsRes.json();
        const description = typeof details.description === 'string'
          ? details.description
          : details.description?.value || '';
        let ratingsAverage = 0;
        let ratingsCount = 0;
        try {
          const ratingsRes = await fetch(`https://openlibrary.org/${normalizedKey}/ratings.json`);
          const ratings = await ratingsRes.json();
          ratingsAverage = ratings.summary?.average || 0;
          ratingsCount = ratings.summary?.count || 0;
        } catch { /* ignore */ }

        const bookSubjects = filterAndNormalizeSubjects(details.subjects || []);
        const matchingGenres = bookSubjects.filter((s: string) =>
          favoriteGenres.some((fg: string) => fg.toLowerCase().trim() === s.toLowerCase().trim())
        );
        const displaySubject = subject.replace(/_/g, ' ');
        const reason =
          matchingGenres.length > 0
            ? null
            : favoriteGenres.length > 0
              ? `Based on your interest in ${displaySubject}`
              : `Based on your interest in ${displaySubject}`;
        res.json({
          book: {
            key: normalizedKey,
            title: book.title,
            author: book.author,
            coverId: book.coverId,
            description: description.slice(0, 500),
            subjects: bookSubjects,
            ratingsAverage,
            ratingsCount,
            reason,
            matchingGenres: matchingGenres.length > 0 ? matchingGenres : undefined,
          },
        });
        return;
      } catch {
        continue;
      }
    }
  }

  res.json({ book: null });
});

// ─── Not Interested ───────────────────────────────────────────────────

recommendationsRouter.post('/not-interested', (req: AuthRequest, res: Response) => {
  const { bookKey, title, author, coverId } = req.body;

  if (!bookKey || !title) {
    res.status(400).json({ error: 'bookKey and title are required' });
    return;
  }

  try {
    db.prepare('INSERT OR IGNORE INTO not_interested (user_id, book_key, title, author, cover_id) VALUES (?, ?, ?, ?, ?)')
      .run(req.userId!, bookKey, title, author || '', coverId || null);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark as not interested' });
  }
});

// ─── Dismiss featured (rotate to next) ────────────────────────────────

recommendationsRouter.get('/not-interested', (req: AuthRequest, res: Response) => {
  const items = db.prepare('SELECT book_key FROM not_interested WHERE user_id = ?')
    .all(req.userId!) as any[];
  res.json({ keys: items.map((i: any) => i.book_key) });
});
