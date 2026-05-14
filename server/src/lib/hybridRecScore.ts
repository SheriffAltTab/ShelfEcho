/**
 * Hybrid recommendation scoring: raw metrics → min–max normalize within the
 * candidate pool → weighted sum using admin rec_weights (already normalized to sum 1).
 */

export type PrimarySignal = 'genre' | 'subject' | 'author' | 'collaborative';

export interface HybridRecBook {
  key: string;
  title: string;
  author: string;
  subjects?: string[];
}

export interface FeaturedRawMetrics {
  genreOverlap: number;
  subjectOverlap: number;
  authorMatch: number;
  collaborative: number;
}

export interface FeaturedScoredRow {
  book: HybridRecBook;
  subject: string;
  raw: FeaturedRawMetrics;
  normalized: FeaturedRawMetrics;
  finalScore: number;
  primarySignal: PrimarySignal;
  explanationTags: string[];
  contrib: Record<PrimarySignal, number>;
}

function normKey(k: string): string {
  return k.replace(/^\//, '');
}

/** Raw overlaps for one candidate (same semantics as legacy hybridFeaturedScore). */
export function featuredRawMetrics(
  book: HybridRecBook,
  favSet: Set<string>,
  userSubjectUnion: Set<string>,
  userAuthors: Set<string>,
  collabMap: Map<string, number>,
): FeaturedRawMetrics {
  const subs = (book.subjects || []).map((s) => s.toLowerCase().trim());
  const genreOverlap = subs.length === 0 ? 0 : subs.filter((s) => favSet.has(s)).length / subs.length;
  const subjectOverlap = subs.length === 0 ? 0 : subs.filter((s) => userSubjectUnion.has(s)).length / subs.length;
  const authorMatch = userAuthors.has(String(book.author).toLowerCase().trim()) ? 1 : 0;
  const collaborative = collabMap.get(normKey(book.key)) ?? 0;
  return { genreOverlap, subjectOverlap, authorMatch, collaborative };
}

function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 1e-12) {
    return values.map((v) => (v > 0 ? 1 : 0));
  }
  return values.map((v) => (v - min) / span);
}

function argmaxContrib(c: Record<PrimarySignal, number>): PrimarySignal {
  let best: PrimarySignal = 'genre';
  let v = -1;
  (['genre', 'subject', 'author', 'collaborative'] as const).forEach((k) => {
    if (c[k] > v) {
      v = c[k];
      best = k;
    }
  });
  return best;
}

function firstMatchingGenreLabel(book: HybridRecBook, favoriteGenres: string[], favSet: Set<string>): string | null {
  for (const s of book.subjects || []) {
    const sl = s.toLowerCase().trim();
    if (!favSet.has(sl)) continue;
    const exact = favoriteGenres.find((fg) => fg.toLowerCase().trim() === sl);
    return exact || s;
  }
  return null;
}

function buildExplanationTags(
  book: HybridRecBook,
  favoriteGenres: string[],
  favSet: Set<string>,
  contrib: Record<PrimarySignal, number>,
  primary: PrimarySignal,
): string[] {
  const maxC = Math.max(...Object.values(contrib), 1e-9);
  const threshold = 0.15 * maxC;
  const tags: string[] = [];
  const push = (cond: boolean, label: string) => {
    if (cond && !tags.includes(label)) tags.push(label);
  };
  push(contrib.genre >= threshold, (() => {
    const g = firstMatchingGenreLabel(book, favoriteGenres, favSet);
    return g ? `Genre: ${g}` : 'Genre match';
  })());
  push(contrib.subject >= threshold, 'Similar subjects');
  push(contrib.author >= threshold, 'Author you read');
  push(contrib.collaborative >= threshold, 'Readers like you');
  if (tags.length === 0) {
    if (primary === 'genre') tags.push('Genre match');
    else if (primary === 'subject') tags.push('Similar subjects');
    else if (primary === 'author') tags.push('Author you read');
    else tags.push('Readers like you');
  }
  return tags;
}

/**
 * Score all candidates, sort by final hybrid score descending.
 */
export function scoreFeaturedCandidatePool(
  rows: Array<{ book: HybridRecBook; subject: string }>,
  nw: { g: number; a: number; s: number; c: number },
  favoriteGenres: string[],
  favSet: Set<string>,
  userSubjectUnion: Set<string>,
  userAuthors: Set<string>,
  collabMap: Map<string, number>,
): FeaturedScoredRow[] {
  const withRaw = rows.map(({ book, subject }) => ({
    book,
    subject,
    raw: featuredRawMetrics(book, favSet, userSubjectUnion, userAuthors, collabMap),
  }));

  const gN = minMaxNormalize(withRaw.map((r) => r.raw.genreOverlap));
  const sN = minMaxNormalize(withRaw.map((r) => r.raw.subjectOverlap));
  const aN = minMaxNormalize(withRaw.map((r) => r.raw.authorMatch));
  const cN = minMaxNormalize(withRaw.map((r) => r.raw.collaborative));

  const scored: FeaturedScoredRow[] = withRaw.map((row, i) => {
    const normalized: FeaturedRawMetrics = {
      genreOverlap: gN[i] ?? 0,
      subjectOverlap: sN[i] ?? 0,
      authorMatch: aN[i] ?? 0,
      collaborative: cN[i] ?? 0,
    };
    const contrib: Record<PrimarySignal, number> = {
      genre: nw.g * normalized.genreOverlap,
      subject: nw.s * normalized.subjectOverlap,
      author: nw.a * normalized.authorMatch,
      collaborative: nw.c * normalized.collaborative,
    };
    const finalScore = contrib.genre + contrib.subject + contrib.author + contrib.collaborative;
    const primarySignal = argmaxContrib(contrib);
    const explanationTags = buildExplanationTags(row.book, favoriteGenres, favSet, contrib, primarySignal);
    return {
      book: row.book,
      subject: row.subject,
      raw: row.raw,
      normalized,
      finalScore,
      primarySignal,
      explanationTags,
      contrib,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored;
}

/** Re-order content-based candidates using the same hybrid normalisation (genre + subject; author/collab neutral). */
export function sortContentBasedBooks<T extends HybridRecBook>(
  books: T[],
  nw: { g: number; a: number; s: number; c: number },
  favSet: Set<string>,
  userSubjectUnion: Set<string>,
): T[] {
  if (books.length === 0) return books;
  const rows = books.map((b) => ({ book: b as HybridRecBook, subject: '' }));
  const scored = scoreFeaturedCandidatePool(rows, nw, [], favSet, userSubjectUnion, new Set(), new Map());
  return scored.map((s) => s.book as T);
}

/** Parse ?exclude=k1&exclude=k2 or ?exclude=k1,k2 */
export function parseExcludeQuery(query: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const push = (s: string) => {
    const t = s.replace(/^\//, '').trim();
    if (t) out.add(t);
  };
  const raw = query.exclude;
  if (raw === undefined || raw === null) return out;
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === 'string') {
        if (x.includes(',')) x.split(',').forEach((p) => push(p));
        else push(x);
      }
    }
    return out;
  }
  if (typeof raw === 'string') {
    if (raw.includes(',')) raw.split(',').forEach((p) => push(p));
    else push(raw);
  }
  return out;
}
