import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import { filterAndNormalizeSubjects } from '../lib/subjects.js';
import { getRecWeights, normalizedRecWeights } from '../lib/recWeights.js';
import {
  parseExcludeQuery,
  scoreFeaturedCandidatePool,
  sortContentBasedBooks,
} from '../lib/hybridRecScore.js';

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

/** Normalized collaborative popularity by book_key (0..1) for hybrid scoring */
function getCollaborativeScoreMap(userId: number): Map<string, number> {
  const userBookKeys = db.prepare('SELECT book_key FROM reading_list WHERE user_id = ?').all(userId) as any[];
  if (userBookKeys.length === 0) return new Map();
  const myKeys = userBookKeys.map((b: any) => b.book_key);
  const placeholders = myKeys.map(() => '?').join(',');
  const similarUsers = db.prepare(`
    SELECT user_id, COUNT(*) as common_books
    FROM reading_list
    WHERE user_id != ? AND book_key IN (${placeholders})
    GROUP BY user_id
    ORDER BY common_books DESC
    LIMIT 20
  `).all(userId, ...myKeys) as any[];
  if (similarUsers.length === 0) return new Map();
  const similarUserIds = similarUsers.map((u: any) => u.user_id);
  const userPlaceholders = similarUserIds.map(() => '?').join(',');
  const candidateBooks = db.prepare(`
    SELECT book_key, COUNT(DISTINCT user_id) as user_count
    FROM reading_list
    WHERE user_id IN (${userPlaceholders}) AND user_id != ?
    GROUP BY book_key
    ORDER BY user_count DESC
    LIMIT 80
  `).all(...similarUserIds, userId) as any[];
  let maxC = 0;
  for (const row of candidateBooks) maxC = Math.max(maxC, row.user_count || 0);
  const map = new Map<string, number>();
  for (const row of candidateBooks) {
    const k = String(row.book_key).replace(/^\//, '');
    map.set(k, maxC > 0 ? (row.user_count || 0) / maxC : 0);
  }
  return map;
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

  const globalSubjectUnion = new Set<string>();
  for (const g of favoriteGenres) globalSubjectUnion.add(g.toLowerCase().trim());
  for (const v of bookSubjectsMap.values()) {
    for (const s of v.subjects) globalSubjectUnion.add(s.toLowerCase().trim());
  }

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
      const nw = normalizedRecWeights(getRecWeights());
      const sortedBooks = sortContentBasedBooks(recommendedBooks, nw, favSet, globalSubjectUnion);
      sections.push({
        sourceBook: {
          key: book.book_key,
          title: book.title,
          author: book.author,
          coverId: book.cover_id,
        },
        books: sortedBooks.slice(0, 10),
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
  }

  const nw = normalizedRecWeights(getRecWeights());
  const userAuthors = new Set(
    (db.prepare("SELECT DISTINCT lower(author) as a FROM reading_list WHERE user_id = ? AND author IS NOT NULL AND trim(author) != ''").all(userId) as any[])
      .map((r: any) => String(r.a || '').trim())
      .filter(Boolean),
  );
  const maxU = Math.max(...result.map((r) => r.userCount || 0), 1);
  result.sort((a, b) => {
    const sa = nw.c * ((a.userCount || 0) / maxU) + nw.a * (userAuthors.has(String(a.author).toLowerCase().trim()) ? 1 : 0);
    const sb = nw.c * ((b.userCount || 0) / maxU) + nw.a * (userAuthors.has(String(b.author).toLowerCase().trim()) ? 1 : 0);
    return sb - sa;
  });

  const top = result.slice(0, 10);

  res.json({ books: top });
});

async function enrichFeaturedBook(
  book: RecBook,
): Promise<{
  key: string;
  title: string;
  author: string;
  coverId: number | null | undefined;
  description: string;
  subjects: string[];
  ratingsAverage: number;
  ratingsCount: number;
} | null> {
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
    return {
      key: normalizedKey,
      title: book.title,
      author: book.author,
      coverId: book.coverId,
      description: description.slice(0, 500),
      subjects: bookSubjects,
      ratingsAverage,
      ratingsCount,
    };
  } catch {
    return null;
  }
}

// ─── Featured recommendation (top pick) ───────────────────────────────

recommendationsRouter.get('/featured', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const page = Math.max(0, parseInt(String(req.query.page ?? '0'), 10) || 0);
  const pageSize = Math.min(20, Math.max(1, parseInt(String(req.query.pageSize ?? '8'), 10) || 8));
  const excludeClient = parseExcludeQuery(req.query as Record<string, unknown>);

  const user = db.prepare('SELECT favorite_genres FROM users WHERE id = ?').get(userId) as any;
  const favoriteGenres: string[] = JSON.parse(user?.favorite_genres || '[]');
  const favSet = new Set(favoriteGenres.map((g: string) => g.toLowerCase().trim()));

  const userBooks = db.prepare(`
    SELECT book_key, author FROM reading_list
    WHERE user_id = ? AND status IN ('read', 'reading')
    ORDER BY created_at DESC LIMIT 5
  `).all(userId) as any[];

  const excludedKeys = getUserExcludedKeys(userId);
  const collabMap = getCollaborativeScoreMap(userId);

  const userAuthors = new Set(
    (db.prepare("SELECT DISTINCT lower(author) as a FROM reading_list WHERE user_id = ? AND author IS NOT NULL AND trim(author) != ''").all(userId) as any[])
      .map((r: any) => String(r.a || '').trim())
      .filter(Boolean),
  );

  const fromBooks: string[] = [];
  const userSubjectUnion = new Set<string>(favSet);
  for (const book of userBooks.slice(0, 3)) {
    const subjects = await getBookSubjects(book.book_key);
    const filtered = subjects.filter(
      (s: string) => !['fiction', 'nonfiction', 'literature', 'english literature', 'fiction in english'].includes(s.toLowerCase()),
    );
    fromBooks.push(...filtered.slice(0, 2));
    for (const s of subjects) userSubjectUnion.add(s.toLowerCase().trim());
  }
  const favSlugs = favoriteGenres.slice(0, 4).map(toOLSubject);
  let subjectsToTry = [...new Set([...favSlugs, ...fromBooks.map(toOLSubject)])];
  if (subjectsToTry.length === 0) {
    subjectsToTry = ['fantasy', 'science_fiction', 'mystery'];
  }

  const candidateMap = new Map<string, { book: RecBook; subject: string }>();

  for (const subject of subjectsToTry) {
    const books = await fetchBooksForSubject(subject, 25);
    for (const b of books) {
      const nk = b.key.replace(/^\//, '');
      if (excludedKeys.has(nk) || !b.coverId) continue;
      if (!candidateMap.has(nk)) candidateMap.set(nk, { book: b, subject });
    }
  }

  const nw = normalizedRecWeights(getRecWeights());
  const candidateRows = [...candidateMap.values()];
  const scoredPool = scoreFeaturedCandidatePool(
    candidateRows,
    nw,
    favoriteGenres,
    favSet,
    userSubjectUnion,
    userAuthors,
    collabMap,
  );

  const mergedExclude = new Set<string>([...excludedKeys, ...excludeClient]);
  const filtered = scoredPool.filter((row) => !mergedExclude.has(row.book.key.replace(/^\//, '')));

  const start = page * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const enriched: Array<Record<string, unknown> | null> = [];
  const batchSize = 3;
  for (let i = 0; i < slice.length; i += batchSize) {
    const chunk = slice.slice(i, i + batchSize);
    const part = await Promise.all(
      chunk.map(async (row) => {
        const base = await enrichFeaturedBook(row.book);
        if (!base) return null;
        return {
          ...base,
          primarySignal: row.primarySignal,
          explanationTags: row.explanationTags,
          hybridScore: row.finalScore,
        };
      }),
    );
    enriched.push(...part);
  }
  const books = enriched.filter((x): x is NonNullable<typeof x> => x != null);

  res.json({
    books,
    page,
    pageSize,
    hasMore: start + pageSize < filtered.length,
  });
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
