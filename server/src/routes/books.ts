import { Router } from 'express';
import { filterAndNormalizeSubjects } from '../lib/subjects.js';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const booksRouter = Router();

// Simple in-memory cache with TTL (exported for admin cache-clear)
export const cache = new Map<string, { data: any; expires: number }>();

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any, ttlMs = 10 * 60 * 1000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// Search books via OpenLibrary API
booksRouter.get('/search', async (req, res) => {
  const { q, page = '1', limit = '20', sort } = req.query;

  if (!q) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  try {
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    let url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q as string)}&offset=${offset}&limit=${limit}`;
    if (sort === 'rating') {
      url += '&sort=rating';
    }
    const response = await fetch(url);
    const data = await response.json();

    const books = data.docs.map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      authors: doc.author_name || [],
      authorKey: doc.author_key?.[0] ? `authors/${doc.author_key[0]}` : null,
      coverId: doc.cover_i,
      firstPublishYear: doc.first_publish_year,
      subjects: filterAndNormalizeSubjects(doc.subject || []),
      ratingsAverage: doc.ratings_average || 0,
      editionCount: doc.edition_count || 0,
      pageCount: doc.number_of_pages_median || 0,
    }));

    const total = data.numFound || 0;

    // Log search for analytics
    try {
      const authHeader = req.headers.authorization;
      let userId: number | null = null;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const jwt = await import('jsonwebtoken');
          const decoded = jwt.default.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'shelfecho-secret-key-change-in-production') as any;
          userId = decoded.userId;
        } catch { /* ignore */ }
      }
      db.prepare('INSERT INTO search_logs (user_id, query, results_count) VALUES (?, ?, ?)')
        .run(userId, q, total);
    } catch { /* ignore logging errors */ }

    res.json({ total, books });
  } catch (error) {
    console.error('OpenLibrary search error:', error);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

// Get book details from OpenLibrary — uses query param ?key=works/OL123W
booksRouter.get('/details', async (req, res) => {
  const workId = req.query.key as string;

  if (!workId) {
    res.status(400).json({ error: 'Query parameter "key" is required' });
    return;
  }

  const cacheKey = `details:${workId}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const workUrl = `https://openlibrary.org/${workId.replace(/^\//, '')}.json`;
    const workRes = await fetch(workUrl);
    const work = await workRes.json();

    // Get author info
    let authorName = 'Unknown Author';
    let authorKey = '';
    if (work.authors && work.authors.length > 0) {
      const aKey = work.authors[0].author?.key || work.authors[0].key;
      if (aKey) {
        authorKey = aKey.replace(/^\//, '');
        try {
          const authorRes = await fetch(`https://openlibrary.org${aKey}.json`);
          const author = await authorRes.json();
          authorName = author.name || 'Unknown Author';
        } catch { /* ignore */ }
      }
    }

    // Get ratings
    let ratingsAverage = 0;
    let ratingsCount = 0;
    try {
      const ratingsRes = await fetch(`https://openlibrary.org/${workId.replace(/^\//, '')}/ratings.json`);
      const ratings = await ratingsRes.json();
      ratingsAverage = ratings.summary?.average || 0;
      ratingsCount = ratings.summary?.count || 0;
    } catch { /* ignore */ }

    const description = typeof work.description === 'string'
      ? work.description
      : work.description?.value || '';

    const result = {
      key: work.key,
      title: work.title,
      author: authorName,
      authorKey,
      description,
      subjects: filterAndNormalizeSubjects(work.subjects || []),
      coverId: work.covers?.[0],
      firstPublishDate: work.first_publish_date || '',
      ratingsAverage,
      ratingsCount,
    };

    setCache(cacheKey, result, 5 * 60 * 1000);
    res.json(result);
  } catch (error) {
    console.error('OpenLibrary details error:', error);
    res.status(500).json({ error: 'Failed to get book details' });
  }
});

// Get trending/popular books (cached 10 min)
booksRouter.get('/trending', async (_req, res) => {
  const cacheKey = 'trending';
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const url = 'https://openlibrary.org/trending/daily.json?limit=20';
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[books/trending] OpenLibrary returned ${response.status}: ${response.statusText}`);
      res.status(502).json({ error: `OpenLibrary error: ${response.statusText}` });
      return;
    }
    
    const data = await response.json();

    const books = (data.works || []).map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      coverId: doc.cover_i,
      firstPublishYear: doc.first_publish_year,
    }));

    const result = { books };
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('[books/trending] Error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to get trending books' });
  }
});

// Get books by subject (cached 10 min)
booksRouter.get('/subject/:subject', async (req, res) => {
  const { subject } = req.params;
  const { limit = '10' } = req.query;

  const cacheKey = `subject:${subject}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}`;
    const response = await fetch(url);
    const data = await response.json();

    const books = (data.works || []).map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      author: doc.authors?.[0]?.name || 'Unknown Author',
      coverId: doc.cover_id,
      firstPublishYear: doc.first_publish_year,
      subjects: filterAndNormalizeSubjects(doc.subject || []),
    }));

    const result = { books, name: data.name };
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('OpenLibrary subject error:', error);
    res.status(500).json({ error: 'Failed to get books by subject' });
  }
});

// Popular books from recent reading_list + favorites activity (last 30 days)
const POPULAR_NOW_CACHE_TTL_MS = 90 * 1000;

booksRouter.get('/popular-now', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = 'popular-now:global';
    const cached = getCached(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const rows = db.prepare(`
      WITH rl AS (
        SELECT book_key, title, author, cover_id, COUNT(*) AS n
        FROM reading_list
        WHERE datetime(created_at) >= datetime('now', '-30 days')
        GROUP BY book_key
      ),
      fv AS (
        SELECT book_key, title, author, cover_id, COUNT(*) AS n
        FROM favorites
        WHERE datetime(created_at) >= datetime('now', '-30 days')
        GROUP BY book_key
      ),
      merged AS (
        SELECT book_key, title, author, cover_id, n FROM rl
        UNION ALL
        SELECT book_key, title, author, cover_id, n FROM fv
      )
      SELECT book_key, MAX(title) AS title, MAX(author) AS author, MAX(cover_id) AS cover_id, SUM(n) AS interactions
      FROM merged
      GROUP BY book_key
      ORDER BY interactions DESC
      LIMIT 20
    `).all() as any[];

    const books = rows.map((r) => ({
      key: String(r.book_key).replace(/^\//, ''),
      title: r.title || 'Unknown',
      author: r.author || 'Unknown Author',
      coverId: r.cover_id ?? null,
      subjects: [] as string[],
      ratingsAverage: 0,
      editionCount: 0,
      pageCount: 0,
    }));

    const payload = { books };
    setCache(cacheKey, payload, POPULAR_NOW_CACHE_TTL_MS);
    res.json(payload);
  } catch (e) {
    console.error('popular-now error', e);
    res.json({ books: [] });
  }
});

// Get author info + their books from OpenLibrary
booksRouter.get('/author-info', async (req: AuthRequest, res: Response) => {
  const authorKey = req.query.key as string;
  if (!authorKey) { res.status(400).json({ error: 'key is required' }); return; }

  const cacheKey = `author:${authorKey}`;
  const cached = getCached(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const authorRes = await fetch(`https://openlibrary.org/${authorKey}.json`);
    const author = await authorRes.json();

    const bio = typeof author.bio === 'string' ? author.bio : author.bio?.value || '';
    const photoId = author.photos?.[0];

    const worksRes = await fetch(`https://openlibrary.org/${authorKey}/works.json?limit=50`);
    const worksData = await worksRes.json();

    const books = (worksData.entries || []).map((w: any) => ({
      key: w.key?.replace(/^\//, '') || '',
      title: w.title || '',
      coverId: w.covers?.[0] || null,
      firstPublishYear: w.first_publish_date || '',
    }));

    const result = {
      key: authorKey,
      name: author.name || 'Unknown Author',
      bio,
      photoId,
      birthDate: author.birth_date || '',
      books,
      totalWorks: worksData.size || books.length,
    };

    setCache(cacheKey, result, 10 * 60 * 1000);
    res.json(result);
  } catch (error) {
    console.error('OpenLibrary author error:', error);
    res.status(500).json({ error: 'Failed to get author info' });
  }
});
