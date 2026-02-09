import { Router } from 'express';

export const booksRouter = Router();

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();

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
  const { q, page = '1', limit = '20' } = req.query;

  if (!q) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  try {
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q as string)}&offset=${offset}&limit=${limit}`;
    const response = await fetch(url);
    const data = await response.json();

    const books = data.docs.map((doc: any) => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      authors: doc.author_name || [],
      coverId: doc.cover_i,
      firstPublishYear: doc.first_publish_year,
      subjects: (doc.subject || []).slice(0, 5),
      ratingsAverage: doc.ratings_average || 0,
      editionCount: doc.edition_count || 0,
      pageCount: doc.number_of_pages_median || 0,
    }));

    res.json({
      total: data.numFound,
      books,
    });
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
    if (work.authors && work.authors.length > 0) {
      const authorKey = work.authors[0].author?.key || work.authors[0].key;
      if (authorKey) {
        try {
          const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`);
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
      description,
      subjects: (work.subjects || []).slice(0, 8),
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
    console.error('OpenLibrary trending error:', error);
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
      subjects: (doc.subject || []).slice(0, 5),
    }));

    const result = { books, name: data.name };
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('OpenLibrary subject error:', error);
    res.status(500).json({ error: 'Failed to get books by subject' });
  }
});
