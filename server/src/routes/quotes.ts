import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const quotesRouter = Router();
quotesRouter.use(authMiddleware);

quotesRouter.get('/daily', async (_req: AuthRequest, res: Response) => {
  const MS_DAY = 24 * 60 * 60 * 1000;
  try {
    const cacheRow = db.prepare("SELECT value FROM settings WHERE key = 'daily_quote_cache'").get() as { value?: string } | undefined;
    const timeRow = db.prepare("SELECT value FROM settings WHERE key = 'daily_quote_fetched_at'").get() as { value?: string } | undefined;
    if (cacheRow?.value && timeRow?.value) {
      const fetched = new Date(timeRow.value).getTime();
      if (!Number.isNaN(fetched) && Date.now() - fetched < MS_DAY) {
        res.json(JSON.parse(cacheRow.value));
        return;
      }
    }

    const zenRes = await fetch('https://zenquotes.io/api/today');
    if (!zenRes.ok) throw new Error('zenquotes failed');
    const arr = (await zenRes.json()) as { q: string; a: string }[];
    const first = arr?.[0];
    const payload = {
      quote: first?.q || 'Reading is dreaming with open eyes.',
      author: first?.a || 'Unknown',
    };
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_quote_cache', ?)").run(JSON.stringify(payload));
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_quote_fetched_at', ?)").run(new Date().toISOString());
    res.json(payload);
  } catch {
    const fallback = { quote: 'A reader lives a thousand lives before he dies.', author: 'George R.R. Martin' };
    res.json(fallback);
  }
});
