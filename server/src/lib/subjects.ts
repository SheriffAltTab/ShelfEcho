/**
 * Site-wide genre whitelist. Only these main + secondary genres are used (book pages, favorites, recommendations).
 * Comma-separated tags from Open Library are split; only whitelisted parts are kept; display is title-case, deduped.
 */

const ALLOWED_LOWER = new Set<string>([
  // Main
  'arts', 'fiction', 'science & mathematics', 'business & finance',
  "children's", 'history', 'health & wellness', 'biography', 'social sciences',
  // Arts
  'architecture', 'art instruction', 'art history', 'dance', 'design', 'fashion', 'film',
  'graphic design', 'music', 'music theory', 'painting', 'photography',
  // Fiction
  'fantasy', 'historical fiction', 'horror', 'humor', 'literature', 'magic',
  'mystery and detective stories', 'plays', 'poetry', 'romance', 'science fiction',
  'short stories', 'thriller', 'young adult',
  // Science & Mathematics
  'biology', 'chemistry', 'mathematics', 'physics', 'programming',
  // Business & Finance
  'management', 'entrepreneurship', 'business economics', 'business success', 'finance',
  // Children's
  'kids books', 'stories in rhyme', 'baby books', 'bedtime books', 'picture books',
  // History
  'ancient civilization', 'archaeology', 'anthropology', 'world war ii', 'social life and customs',
  // Health & Wellness
  'cooking', 'cookbooks', 'mental health', 'exercise', 'nutrition', 'self-help',
  // Biography
  'autobiographies', 'history', 'politics and government', 'women', 'kings and rulers', 'composers', 'artists',
  // Social Sciences
  'anthropology', 'religion', 'political science', 'psychology',
  // API variants (underscore / alternate forms)
  'science_fiction', 'historical_fiction', 'young_adult', 'world_war_ii', 'social_sciences',
  'business_&_finance', 'health_&_wellness', 'science_&_mathematics',
]);

const CANONICAL: Record<string, string> = {
  'science_fiction': 'science fiction',
  'historical_fiction': 'historical fiction',
  'young_adult': 'young adult',
  'world_war_ii': 'world war ii',
  'social_sciences': 'social sciences',
};

function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/_/g, ' ')
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      const lower = word.toLowerCase();
      if (lower === '&' || lower === 'and' || lower === 'or' || lower === 'in' || lower === 'by') return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllowed(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase().replace(/_/g, ' ');
  if (ALLOWED_LOWER.has(lower)) return true;
  const beforeParen = lower.split('(')[0].trim();
  if (ALLOWED_LOWER.has(beforeParen)) return true;
  const base = beforeParen.split(',')[0].trim();
  return ALLOWED_LOWER.has(base);
}

function canonicalKey(lower: string): string {
  return CANONICAL[lower] ?? lower;
}

export function filterAndNormalizeSubjects(rawSubjects: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of rawSubjects) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      if (!part) continue;
      const partBase = part.split('(')[0].trim();
      if (!partBase) continue;
      const lower = partBase.toLowerCase().replace(/_/g, ' ');
      const key = canonicalKey(lower);
      if (seen.has(key)) continue;
      if (!isAllowed(partBase)) continue;
      seen.add(key);
      out.push(toTitleCase(key));
    }
  }
  return out;
}
