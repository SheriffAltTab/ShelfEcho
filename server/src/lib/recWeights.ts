import db from '../db.js';

export interface RecWeights {
  genre_weight: number;
  author_weight: number;
  subject_weight: number;
  collaborative_weight: number;
}

const DEFAULT: RecWeights = {
  genre_weight: 50,
  author_weight: 50,
  subject_weight: 50,
  collaborative_weight: 50,
};

function clampWeight(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function sanitizeRecWeights(input: unknown): RecWeights {
  const w = (input && typeof input === 'object' ? input : {}) as Partial<RecWeights>;
  return {
    genre_weight: clampWeight(w.genre_weight, DEFAULT.genre_weight),
    author_weight: clampWeight(w.author_weight, DEFAULT.author_weight),
    subject_weight: clampWeight(w.subject_weight, DEFAULT.subject_weight),
    collaborative_weight: clampWeight(w.collaborative_weight, DEFAULT.collaborative_weight),
  };
}

export function getRecWeights(): RecWeights {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'rec_weights'").get() as { value?: string } | undefined;
  if (!row?.value) return { ...DEFAULT };
  try {
    return sanitizeRecWeights(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT };
  }
}

export function setRecWeights(weights: unknown): RecWeights {
  const sanitized = sanitizeRecWeights(weights);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('rec_weights', ?)").run(JSON.stringify(sanitized));
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('rec_weights_updated_at', ?)").run(new Date().toISOString());
  return sanitized;
}

/** Normalize admin weights to sum to 1 for linear combination */
export function normalizedRecWeights(w: RecWeights): { g: number; a: number; s: number; c: number } {
  const sum = w.genre_weight + w.author_weight + w.subject_weight + w.collaborative_weight;
  if (sum <= 0) return { g: 0.25, a: 0.25, s: 0.25, c: 0.25 };
  return {
    g: w.genre_weight / sum,
    a: w.author_weight / sum,
    s: w.subject_weight / sum,
    c: w.collaborative_weight / sum,
  };
}
