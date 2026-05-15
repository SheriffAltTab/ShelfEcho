import db from '../db.js';
import { filterAndNormalizeSubjects } from './subjects.js';
import { getRecWeights, normalizedRecWeights } from './recWeights.js';

export type RecommendationSignal = 'genre' | 'author' | 'subject' | 'collaborative';

export interface RecommendationBook {
  key: string;
  title: string;
  author: string;
  coverId?: number | null;
  subjects?: string[];
  description?: string;
  ratingsAverage?: number;
  ratingsCount?: number;
  primarySignal?: RecommendationSignal;
  explanationTags?: string[];
  whyThisBook?: string;
  hybridScore?: number;
}

interface CandidateBook {
  key: string;
  title: string;
  author: string;
  coverId?: number | null;
  subjects: string[];
  signals: Record<RecommendationSignal, number>;
  signalLabels: Partial<Record<RecommendationSignal, string>>;
  collaborativeCount?: number;
}

interface UserPreferenceProfile {
  favoriteGenres: string[];
  favoriteGenreSet: Set<string>;
  authors: Map<string, { label: string; score: number }>;
  subjectScores: Map<string, number>;
  subjectSet: Set<string>;
  sourceBooks: Array<{ key: string; title: string; author: string; coverId?: number | null; status: string }>;
  excludedKeys: Set<string>;
}

export interface ScoredRecommendation {
  book: CandidateBook;
  metrics: Record<RecommendationSignal, number>;
  contributions: Record<RecommendationSignal, number>;
  score: number;
  primarySignal: RecommendationSignal;
  explanationTags: string[];
  whyThisBook: string;
}

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const EXTERNAL_CACHE_TTL_MS = 10 * 60 * 1000;
const RECOMMENDATION_CACHE_TTL_MS = 90 * 1000;
const subjectBooksCache = new Map<string, CacheEntry<RecommendationBook[]>>();
const authorBooksCache = new Map<string, CacheEntry<RecommendationBook[]>>();
const detailCache = new Map<string, CacheEntry<RecommendationBook>>();
const scoredPoolCache = new Map<string, CacheEntry<ScoredRecommendation[]>>();
let recommendationCacheVersion = 1;

const GENERIC_SUBJECTS = new Set([
  'fiction',
  'nonfiction',
  'non-fiction',
  'literature',
  'english literature',
  'english language',
  'fiction in english',
]);

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttlMs = EXTERNAL_CACHE_TTL_MS): T {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  return data;
}

export function invalidateRecommendationCache(): void {
  recommendationCacheVersion += 1;
  scoredPoolCache.clear();
}

export function clearRecommendationCaches(): void {
  invalidateRecommendationCache();
  subjectBooksCache.clear();
  authorBooksCache.clear();
  detailCache.clear();
}

function normalizeKey(key: string): string {
  return String(key || '').replace(/^\//, '');
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function toOLSubject(subject: string): string {
  return subject.toLowerCase().trim().replace(/\s+/g, '_');
}

function safeJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function parsePagination(query: { page?: unknown; pageSize?: unknown }, defaults = { page: 0, pageSize: 8, maxPageSize: 24 }) {
  const page = Math.max(0, Number.parseInt(String(query.page ?? defaults.page), 10) || 0);
  const pageSize = Math.min(
    defaults.maxPageSize,
    Math.max(1, Number.parseInt(String(query.pageSize ?? defaults.pageSize), 10) || defaults.pageSize),
  );
  return { page, pageSize };
}

export function parseRecommendationPagination(query: { page?: unknown; pageSize?: unknown }) {
  return parsePagination(query);
}

export function parseExcludeQuery(query: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const push = (s: string) => {
    const t = normalizeKey(s).trim();
    if (t) out.add(t);
  };
  const raw = query.exclude;
  if (raw === undefined || raw === null) return out;
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === 'string') {
        if (x.includes(',')) x.split(',').forEach(push);
        else push(x);
      }
    }
    return out;
  }
  if (typeof raw === 'string') {
    if (raw.includes(',')) raw.split(',').forEach(push);
    else push(raw);
  }
  return out;
}

async function getBookSubjects(bookKey: string): Promise<string[]> {
  const normalizedKey = normalizeKey(bookKey);
  const cached = db.prepare('SELECT subjects FROM subjects_cache WHERE book_key = ?').get(normalizedKey) as
    | { subjects: string }
    | undefined;
  if (cached) return filterAndNormalizeSubjects(safeJsonArray(cached.subjects));

  try {
    const res = await fetch(`https://openlibrary.org/${normalizedKey}.json`);
    if (!res.ok) return [];
    const data = await res.json() as { subjects?: string[] };
    const subjects = filterAndNormalizeSubjects((data.subjects || []).slice(0, 30));
    db.prepare('INSERT OR REPLACE INTO subjects_cache (book_key, subjects) VALUES (?, ?)').run(normalizedKey, JSON.stringify(subjects));
    return subjects;
  } catch {
    return [];
  }
}

async function fetchBooksForSubject(subject: string, limit = 28): Promise<RecommendationBook[]> {
  const slug = toOLSubject(subject);
  const cacheKey = `subject:${slug}:${limit}`;
  const cached = getCached(subjectBooksCache, cacheKey);
  if (cached) return cached;

  try {
    const url = `https://openlibrary.org/subjects/${encodeURIComponent(slug)}.json?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return setCached(subjectBooksCache, cacheKey, []);
    const data = await res.json() as { works?: any[] };
    const normalizedSubject = filterAndNormalizeSubjects([subject])[0] || normalizeText(subject);
    const books = (data.works || [])
      .map((w: any) => ({
        key: normalizeKey(w.key || ''),
        title: String(w.title || ''),
        author: String(w.authors?.[0]?.name || 'Unknown Author'),
        coverId: w.cover_id ?? null,
        subjects: [...new Set([...filterAndNormalizeSubjects(w.subject || []), normalizedSubject])],
      }))
      .filter((b) => b.key && b.title);
    return setCached(subjectBooksCache, cacheKey, books);
  } catch {
    return setCached(subjectBooksCache, cacheKey, []);
  }
}

async function fetchBooksForAuthor(author: string, limit = 24): Promise<RecommendationBook[]> {
  const normalizedAuthor = normalizeText(author);
  const cacheKey = `author:${normalizedAuthor}:${limit}`;
  const cached = getCached(authorBooksCache, cacheKey);
  if (cached) return cached;

  try {
    const fields = 'key,title,author_name,cover_i,subject,ratings_average,ratings_count';
    const url = `https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=${limit}&fields=${encodeURIComponent(fields)}`;
    const res = await fetch(url);
    if (!res.ok) return setCached(authorBooksCache, cacheKey, []);
    const data = await res.json() as { docs?: any[] };
    const books = (data.docs || [])
      .map((doc: any) => {
        const authors = Array.isArray(doc.author_name) ? doc.author_name.map(String) : [];
        const matchedAuthor = authors.find((a: string) => normalizeText(a) === normalizedAuthor) || authors[0] || author;
        return {
          key: normalizeKey(doc.key || ''),
          title: String(doc.title || ''),
          author: matchedAuthor,
          coverId: doc.cover_i ?? null,
          subjects: filterAndNormalizeSubjects(doc.subject || []),
          ratingsAverage: Number(doc.ratings_average) || 0,
          ratingsCount: Number(doc.ratings_count) || 0,
        };
      })
      .filter((b) => b.key && b.title);
    return setCached(authorBooksCache, cacheKey, books);
  } catch {
    return setCached(authorBooksCache, cacheKey, []);
  }
}

async function enrichBook(book: CandidateBook): Promise<RecommendationBook> {
  const key = normalizeKey(book.key);
  const cached = getCached(detailCache, key);
  if (cached) return cached;

  try {
    const detailsRes = await fetch(`https://openlibrary.org/${key}.json`);
    if (!detailsRes.ok) throw new Error('details fetch failed');
    const details = await detailsRes.json() as any;
    const description = typeof details.description === 'string'
      ? details.description
      : details.description?.value || '';
    const subjects = filterAndNormalizeSubjects(details.subjects || book.subjects || []);

    let ratingsAverage = 0;
    let ratingsCount = 0;
    try {
      const ratingsRes = await fetch(`https://openlibrary.org/${key}/ratings.json`);
      if (ratingsRes.ok) {
        const ratings = await ratingsRes.json() as any;
        ratingsAverage = Number(ratings.summary?.average) || 0;
        ratingsCount = Number(ratings.summary?.count) || 0;
      }
    } catch {
      // Ratings are helpful, not required.
    }

    const enriched: RecommendationBook = {
      key,
      title: book.title,
      author: book.author,
      coverId: book.coverId ?? details.covers?.[0] ?? null,
      description: description.slice(0, 500),
      subjects,
      ratingsAverage,
      ratingsCount,
    };
    return setCached(detailCache, key, enriched);
  } catch {
    return {
      key,
      title: book.title,
      author: book.author,
      coverId: book.coverId ?? null,
      description: '',
      subjects: book.subjects || [],
      ratingsAverage: 0,
      ratingsCount: 0,
    };
  }
}

function getExcludedKeys(userId: number): Set<string> {
  const rows = db.prepare(`
    SELECT book_key FROM reading_list WHERE user_id = ?
    UNION
    SELECT book_key FROM favorites WHERE user_id = ?
    UNION
    SELECT book_key FROM not_interested WHERE user_id = ?
  `).all(userId, userId, userId) as Array<{ book_key: string }>;
  return new Set(rows.map((r) => normalizeKey(r.book_key)));
}

async function getUserPreferenceProfile(userId: number): Promise<UserPreferenceProfile> {
  const user = db.prepare('SELECT favorite_genres FROM users WHERE id = ?').get(userId) as { favorite_genres?: string } | undefined;
  const favoriteGenres = safeJsonArray(user?.favorite_genres || '[]');
  const favoriteGenreSet = new Set(favoriteGenres.map(normalizeText));

  const readingRows = db.prepare(`
    SELECT book_key, title, author, cover_id, status, subjects, created_at
    FROM reading_list
    WHERE user_id = ?
    ORDER BY CASE status WHEN 'read' THEN 1 WHEN 'reading' THEN 2 WHEN 'want' THEN 3 END, created_at DESC
    LIMIT 40
  `).all(userId) as any[];

  const favoriteRows = db.prepare(`
    SELECT book_key, title, author, cover_id, created_at
    FROM favorites
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(userId) as any[];

  const sourceBooks = readingRows.map((row) => ({
    key: normalizeKey(row.book_key),
    title: String(row.title || ''),
    author: String(row.author || 'Unknown Author'),
    coverId: row.cover_id ?? null,
    status: String(row.status || 'want'),
  }));

  const authors = new Map<string, { label: string; score: number }>();
  const bumpAuthor = (author: string, weight: number) => {
    const norm = normalizeText(author);
    if (!norm || norm === 'unknown author') return;
    const prev = authors.get(norm);
    authors.set(norm, { label: prev?.label || author, score: (prev?.score || 0) + weight });
  };
  for (const row of readingRows) bumpAuthor(String(row.author || ''), row.status === 'want' ? 0.35 : 1);
  for (const row of favoriteRows) bumpAuthor(String(row.author || ''), 0.8);

  const subjectScores = new Map<string, number>();
  const bumpSubject = (subject: string, weight: number) => {
    const norm = normalizeText(subject);
    if (!norm || GENERIC_SUBJECTS.has(norm)) return;
    subjectScores.set(norm, (subjectScores.get(norm) || 0) + weight);
  };

  const booksToAnalyze = readingRows.slice(0, 12);
  await Promise.all(booksToAnalyze.map(async (row) => {
    const localSubjects = filterAndNormalizeSubjects(safeJsonArray(row.subjects));
    const subjects = localSubjects.length > 0 ? localSubjects : await getBookSubjects(row.book_key);
    const weight = row.status === 'want' ? 0.45 : 1;
    for (const subject of subjects.slice(0, 12)) bumpSubject(subject, weight);
  }));

  return {
    favoriteGenres,
    favoriteGenreSet,
    authors,
    subjectScores,
    subjectSet: new Set(subjectScores.keys()),
    sourceBooks,
    excludedKeys: getExcludedKeys(userId),
  };
}

function emptySignals(): Record<RecommendationSignal, number> {
  return { genre: 0, author: 0, subject: 0, collaborative: 0 };
}

function upsertCandidate(
  candidates: Map<string, CandidateBook>,
  book: RecommendationBook,
  signal: RecommendationSignal,
  strength: number,
  label: string,
  collaborativeCount?: number,
): void {
  const key = normalizeKey(book.key);
  if (!key || !book.title) return;
  const existing = candidates.get(key);
  const subjects = filterAndNormalizeSubjects(book.subjects || []);
  if (!existing) {
    candidates.set(key, {
      key,
      title: book.title,
      author: book.author || 'Unknown Author',
      coverId: book.coverId ?? null,
      subjects,
      signals: { ...emptySignals(), [signal]: Math.max(0, Math.min(1, strength)) },
      signalLabels: { [signal]: label },
      collaborativeCount,
    });
    return;
  }
  existing.coverId = existing.coverId ?? book.coverId ?? null;
  existing.subjects = [...new Set([...existing.subjects, ...subjects])];
  const nextStrength = Math.max(existing.signals[signal], Math.max(0, Math.min(1, strength)));
  existing.signals[signal] = nextStrength;
  if (!existing.signalLabels[signal]) existing.signalLabels[signal] = label;
  if (collaborativeCount !== undefined) existing.collaborativeCount = Math.max(existing.collaborativeCount || 0, collaborativeCount);
}

function collaborativeCandidates(userId: number): Array<RecommendationBook & { collaborativeScore: number; userCount: number }> {
  const userBookKeys = db.prepare('SELECT book_key FROM reading_list WHERE user_id = ?').all(userId) as Array<{ book_key: string }>;
  if (userBookKeys.length === 0) return [];
  const myKeys = userBookKeys.map((b) => b.book_key);
  const placeholders = myKeys.map(() => '?').join(',');

  const similarUsers = db.prepare(`
    SELECT user_id, COUNT(*) as common_books
    FROM reading_list
    WHERE user_id != ? AND book_key IN (${placeholders})
    GROUP BY user_id
    ORDER BY common_books DESC
    LIMIT 30
  `).all(userId, ...myKeys) as Array<{ user_id: number; common_books: number }>;
  if (similarUsers.length === 0) return [];

  const similarUserIds = similarUsers.map((u) => u.user_id);
  const similarUserScore = new Map(similarUsers.map((u) => [u.user_id, Number(u.common_books) || 1]));
  const userPlaceholders = similarUserIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT book_key, title, author, cover_id, user_id
    FROM reading_list
    WHERE user_id IN (${userPlaceholders}) AND user_id != ?
  `).all(...similarUserIds, userId) as any[];

  const merged = new Map<string, RecommendationBook & { weightedCount: number; userCount: number }>();
  for (const row of rows) {
    const key = normalizeKey(row.book_key);
    const weight = similarUserScore.get(row.user_id) || 1;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, {
        key,
        title: String(row.title || ''),
        author: String(row.author || 'Unknown Author'),
        coverId: row.cover_id ?? null,
        subjects: [],
        weightedCount: weight,
        userCount: 1,
      });
    } else {
      prev.weightedCount += weight;
      prev.userCount += 1;
    }
  }

  const max = Math.max(...[...merged.values()].map((r) => r.weightedCount), 1);
  return [...merged.values()]
    .sort((a, b) => b.weightedCount - a.weightedCount)
    .slice(0, 80)
    .map((r) => ({
      key: r.key,
      title: r.title,
      author: r.author,
      coverId: r.coverId,
      subjects: r.subjects,
      collaborativeScore: r.weightedCount / max,
      userCount: r.userCount,
    }));
}

async function buildCandidatePool(userId: number, profile: UserPreferenceProfile): Promise<CandidateBook[]> {
  const candidates = new Map<string, CandidateBook>();

  const genreInputs = profile.favoriteGenres.length > 0
    ? profile.favoriteGenres.slice(0, 6)
    : ['Fantasy', 'Science Fiction', 'Mystery'];
  await Promise.all(genreInputs.map(async (genre) => {
    const books = await fetchBooksForSubject(genre, 30);
    for (const book of books) upsertCandidate(candidates, book, 'genre', profile.favoriteGenres.length > 0 ? 1 : 0.35, genre);
  }));

  const subjects = [...profile.subjectScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxSubjectScore = Math.max(...subjects.map(([, score]) => score), 1);
  await Promise.all(subjects.map(async ([subject, score]) => {
    const books = await fetchBooksForSubject(subject, 24);
    for (const book of books) upsertCandidate(candidates, book, 'subject', Math.max(0.2, score / maxSubjectScore), subject);
  }));

  const authors = [...profile.authors.values()].sort((a, b) => b.score - a.score).slice(0, 6);
  const maxAuthorScore = Math.max(...authors.map((a) => a.score), 1);
  await Promise.all(authors.map(async (author) => {
    const books = await fetchBooksForAuthor(author.label, 24);
    for (const book of books) upsertCandidate(candidates, book, 'author', Math.max(0.4, author.score / maxAuthorScore), author.label);
  }));

  for (const book of collaborativeCandidates(userId)) {
    upsertCandidate(candidates, book, 'collaborative', book.collaborativeScore, `${book.userCount} similar reader${book.userCount === 1 ? '' : 's'}`, book.userCount);
  }

  return [...candidates.values()].filter((book) => !profile.excludedKeys.has(normalizeKey(book.key)));
}

function overlapScore(candidateSubjects: string[], preferenceSet: Set<string>): number {
  if (candidateSubjects.length === 0 || preferenceSet.size === 0) return 0;
  const normalizedSubjects = new Set(candidateSubjects.map(normalizeText));
  let matches = 0;
  for (const subject of normalizedSubjects) {
    if (preferenceSet.has(subject)) matches += 1;
  }
  return Math.min(1, matches / Math.max(1, Math.min(normalizedSubjects.size, preferenceSet.size)));
}

function primaryFromContributions(contributions: Record<RecommendationSignal, number>): RecommendationSignal {
  let best: RecommendationSignal = 'genre';
  let bestValue = -1;
  for (const signal of ['genre', 'author', 'subject', 'collaborative'] as RecommendationSignal[]) {
    if (contributions[signal] > bestValue) {
      best = signal;
      bestValue = contributions[signal];
    }
  }
  return best;
}

function firstMatchingSubject(candidateSubjects: string[], preferenceSet: Set<string>): string | null {
  for (const subject of candidateSubjects) {
    if (preferenceSet.has(normalizeText(subject))) return subject;
  }
  return null;
}

function buildWhyThisBook(
  book: CandidateBook,
  profile: UserPreferenceProfile,
  primarySignal: RecommendationSignal,
): string {
  if (primarySignal === 'author') {
    const author = profile.authors.get(normalizeText(book.author))?.label || book.signalLabels.author || book.author;
    return `Based on your favorite authors, especially ${author}.`;
  }
  if (primarySignal === 'genre') {
    const genre = firstMatchingSubject(book.subjects, profile.favoriteGenreSet) || book.signalLabels.genre;
    return genre ? `Based on your favorite genre: ${genre}.` : 'Based on your favorite genres.';
  }
  if (primarySignal === 'subject') {
    const subject = firstMatchingSubject(book.subjects, profile.subjectSet) || book.signalLabels.subject;
    return subject ? `Because your shelf often includes ${subject}.` : 'Because it shares subjects with books on your shelf.';
  }
  return book.collaborativeCount
    ? `Readers with similar shelves picked this (${book.collaborativeCount} matching readers).`
    : 'Readers with similar shelves enjoyed this.';
}

function buildExplanationTags(
  book: CandidateBook,
  profile: UserPreferenceProfile,
  contributions: Record<RecommendationSignal, number>,
  primarySignal: RecommendationSignal,
): string[] {
  const tags: string[] = [];
  const max = Math.max(...Object.values(contributions), 1e-9);
  const threshold = max * 0.18;
  const add = (signal: RecommendationSignal, tag: string) => {
    if (contributions[signal] >= threshold && !tags.includes(tag)) tags.push(tag);
  };

  add('genre', firstMatchingSubject(book.subjects, profile.favoriteGenreSet) || book.signalLabels.genre || 'Genre match');
  add('author', `Author: ${profile.authors.get(normalizeText(book.author))?.label || book.signalLabels.author || book.author}`);
  add('subject', firstMatchingSubject(book.subjects, profile.subjectSet) || book.signalLabels.subject || 'Similar subjects');
  add('collaborative', 'Readers like you');

  if (tags.length === 0) {
    if (primarySignal === 'genre') tags.push('Genre match');
    if (primarySignal === 'author') tags.push(`Author: ${book.author}`);
    if (primarySignal === 'subject') tags.push('Similar subjects');
    if (primarySignal === 'collaborative') tags.push('Readers like you');
  }
  return tags.slice(0, 4);
}

function stableJitter(key: string, seed: string): number {
  const input = `${seed}:${key}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function scoreCandidates(candidates: CandidateBook[], profile: UserPreferenceProfile, seed = ''): ScoredRecommendation[] {
  const weights = normalizedRecWeights(getRecWeights());
  const scored = candidates.map((book) => {
    const metrics: Record<RecommendationSignal, number> = {
      genre: Math.max(book.signals.genre, overlapScore(book.subjects, profile.favoriteGenreSet)),
      author: Math.max(book.signals.author, profile.authors.has(normalizeText(book.author)) ? 1 : 0),
      subject: Math.max(book.signals.subject, overlapScore(book.subjects, profile.subjectSet)),
      collaborative: book.signals.collaborative,
    };
    const contributions: Record<RecommendationSignal, number> = {
      genre: weights.g * metrics.genre,
      author: weights.a * metrics.author,
      subject: weights.s * metrics.subject,
      collaborative: weights.c * metrics.collaborative,
    };
    const score = contributions.genre + contributions.author + contributions.subject + contributions.collaborative;
    const primarySignal = primaryFromContributions(contributions);
    return {
      book,
      metrics,
      contributions,
      score,
      primarySignal,
      explanationTags: buildExplanationTags(book, profile, contributions, primarySignal),
      whyThisBook: buildWhyThisBook(book, profile, primarySignal),
    };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    const coverDelta = Number(Boolean(b.book.coverId)) - Number(Boolean(a.book.coverId));
    if (coverDelta !== 0) return coverDelta;
    return stableJitter(b.book.key, seed) - stableJitter(a.book.key, seed);
  });
  return scored;
}

function recommendationMeta(
  book: RecommendationBook,
  primarySignal: RecommendationSignal,
  explanationTags: string[],
  whyThisBook: string,
  hybridScore: number,
): RecommendationBook {
  return {
    key: normalizeKey(book.key),
    title: book.title,
    author: book.author,
    coverId: book.coverId ?? null,
    description: book.description || '',
    subjects: book.subjects || [],
    ratingsAverage: book.ratingsAverage || 0,
    ratingsCount: book.ratingsCount || 0,
    primarySignal,
    explanationTags,
    whyThisBook,
    hybridScore,
  };
}

async function getScoredPool(userId: number, refreshKey = ''): Promise<ScoredRecommendation[]> {
  const weights = getRecWeights();
  const cacheKey = [
    recommendationCacheVersion,
    userId,
    weights.genre_weight,
    weights.author_weight,
    weights.subject_weight,
    weights.collaborative_weight,
    refreshKey ? `refresh:${refreshKey}` : 'stable',
  ].join(':');
  const cached = getCached(scoredPoolCache, cacheKey);
  if (cached) return cached;

  const profile = await getUserPreferenceProfile(userId);
  const candidates = await buildCandidatePool(userId, profile);
  const scored = scoreCandidates(candidates, profile, refreshKey);
  return setCached(scoredPoolCache, cacheKey, scored, RECOMMENDATION_CACHE_TTL_MS);
}

export async function getFeaturedRecommendations(
  userId: number,
  options: { page: number; pageSize: number; exclude?: Set<string>; refreshKey?: string },
) {
  const profile = await getUserPreferenceProfile(userId);
  const scoredPool = await getScoredPool(userId, options.refreshKey || '');
  const excluded = new Set([...profile.excludedKeys, ...(options.exclude || new Set<string>())]);
  const filtered = scoredPool.filter((row) => !excluded.has(normalizeKey(row.book.key)));
  const start = options.page * options.pageSize;
  const pageRows = filtered.slice(start, start + options.pageSize);

  const books: RecommendationBook[] = [];
  const batchSize = 4;
  for (let i = 0; i < pageRows.length; i += batchSize) {
    const chunk = pageRows.slice(i, i + batchSize);
    const enriched = await Promise.all(chunk.map(async (row) => {
      const book = await enrichBook(row.book);
      return recommendationMeta(book, row.primarySignal, row.explanationTags, row.whyThisBook, row.score);
    }));
    books.push(...enriched);
  }

  return {
    books,
    page: options.page,
    pageSize: options.pageSize,
    total: filtered.length,
    hasMore: start + options.pageSize < filtered.length,
  };
}

export async function getCollaborativeRecommendations(userId: number, options: { page: number; pageSize: number }) {
  const profile = await getUserPreferenceProfile(userId);
  const candidates = new Map<string, CandidateBook>();
  for (const book of collaborativeCandidates(userId)) {
    upsertCandidate(candidates, book, 'collaborative', book.collaborativeScore, `${book.userCount} similar reader${book.userCount === 1 ? '' : 's'}`, book.userCount);
  }

  const rows = scoreCandidates([...candidates.values()].filter((book) => !profile.excludedKeys.has(book.key)), profile);
  const start = options.page * options.pageSize;
  const pageRows = rows.slice(start, start + options.pageSize);
  return {
    books: pageRows.map((row) => recommendationMeta(row.book, row.primarySignal, row.explanationTags, row.whyThisBook, row.score)),
    page: options.page,
    pageSize: options.pageSize,
    total: rows.length,
    hasMore: start + options.pageSize < rows.length,
  };
}

export async function getContentBasedRecommendations(userId: number, options: { page: number; pageSize: number }) {
  const profile = await getUserPreferenceProfile(userId);
  const sections: Array<{
    sourceBook: { key: string; title: string; author: string; coverId?: number | null };
    books: RecommendationBook[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }> = [];

  for (const sourceBook of profile.sourceBooks.slice(0, 5)) {
    const subjects = (await getBookSubjects(sourceBook.key))
      .filter((subject) => !GENERIC_SUBJECTS.has(normalizeText(subject)))
      .slice(0, 3);
    if (subjects.length === 0) continue;

    const candidates = new Map<string, CandidateBook>();
    await Promise.all(subjects.map(async (subject, index) => {
      const books = await fetchBooksForSubject(subject, 20);
      for (const book of books) upsertCandidate(candidates, book, 'subject', index === 0 ? 1 : 0.75, subject);
    }));

    const rows = scoreCandidates([...candidates.values()].filter((book) => !profile.excludedKeys.has(book.key)), profile);
    if (rows.length === 0) continue;
    const start = options.page * options.pageSize;
    sections.push({
      sourceBook: {
        key: sourceBook.key,
        title: sourceBook.title,
        author: sourceBook.author,
        coverId: sourceBook.coverId,
      },
      books: rows.slice(start, start + options.pageSize).map((row) => recommendationMeta(row.book, row.primarySignal, row.explanationTags, row.whyThisBook, row.score)),
      page: options.page,
      pageSize: options.pageSize,
      total: rows.length,
      hasMore: start + options.pageSize < rows.length,
    });
    if (sections.length >= 2) break;
  }

  return { sections, page: options.page, pageSize: options.pageSize };
}
