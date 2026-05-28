import db from '../db.js';
import { DEFAULT_REC_WEIGHTS, normalizedRecWeights, sanitizeRecWeights, type RecWeights } from './recWeightsCore.js';

export function getRecWeights(): RecWeights {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'rec_weights'").get() as { value?: string } | undefined;
  if (!row?.value) return { ...DEFAULT_REC_WEIGHTS };
  try {
    return sanitizeRecWeights(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_REC_WEIGHTS };
  }
}

export function setRecWeights(weights: unknown): RecWeights {
  const sanitized = sanitizeRecWeights(weights);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('rec_weights', ?)").run(JSON.stringify(sanitized));
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('rec_weights_updated_at', ?)").run(new Date().toISOString());
  return sanitized;
}
export { normalizedRecWeights, sanitizeRecWeights };
export type { RecWeights };
