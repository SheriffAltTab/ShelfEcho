import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';

export const quotesRouter = Router();
quotesRouter.use(authMiddleware);

const QUOTE_MEMORY_TTL_MS = 60_000;
const MS_DAY = 24 * 60 * 60 * 1000;
const DAILY_QUOTE_CACHE_KEY = 'daily_quote_cache';
const DAILY_QUOTE_FETCHED_AT_KEY = 'daily_quote_fetched_at';

type DailyQuote = { quote: string; author: string };
let quoteMemory: { payload: DailyQuote; at: number } | null = null;

function getKyivTimeParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset',
  });

  const parts = formatter.formatToParts(date);
  const result = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
    offsetMinutes: 0,
  };

  for (const part of parts) {
    switch (part.type) {
      case 'year':
        result.year = Number(part.value);
        break;
      case 'month':
        result.month = Number(part.value);
        break;
      case 'day':
        result.day = Number(part.value);
        break;
      case 'hour':
        result.hour = Number(part.value);
        break;
      case 'minute':
        result.minute = Number(part.value);
        break;
      case 'second':
        result.second = Number(part.value);
        break;
      case 'timeZoneName': {
        const match = part.value.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
        if (match) {
          const sign = match[1].startsWith('-') ? -1 : 1;
          result.offsetMinutes = sign * (Math.abs(Number(match[1])) * 60 + Number(match[2] ?? 0));
        }
        break;
      }
    }
  }

  return result;
}

function kyivLocalToUtcMillis(year: number, month: number, day: number, hour: number, minute: number) {
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getKyivTimeParts(new Date(utcMillis)).offsetMinutes;
    const corrected = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60_000;
    if (corrected === utcMillis) break;
    utcMillis = corrected;
  }
  return utcMillis;
}

function getNextKyivTriggerMs(hour: number, minute: number) {
  const now = new Date();
  const kyivNow = getKyivTimeParts(now);

  let targetYear = kyivNow.year;
  let targetMonth = kyivNow.month;
  let targetDay = kyivNow.day;

  let nextRun = kyivLocalToUtcMillis(targetYear, targetMonth, targetDay, hour, minute);
  if (nextRun <= now.getTime()) {
    const todayKyivMidnightUtc = kyivLocalToUtcMillis(targetYear, targetMonth, targetDay, 0, 0);
    const tomorrowUtc = new Date(todayKyivMidnightUtc + MS_DAY);
    const tomorrowKyiv = getKyivTimeParts(tomorrowUtc);
    targetYear = tomorrowKyiv.year;
    targetMonth = tomorrowKyiv.month;
    targetDay = tomorrowKyiv.day;
    nextRun = kyivLocalToUtcMillis(targetYear, targetMonth, targetDay, hour, minute);
  }

  return Math.max(0, nextRun - now.getTime());
}

export async function refreshDailyQuoteCache(): Promise<DailyQuote> {
  const zenRes = await fetch('https://zenquotes.io/api/today');
  if (!zenRes.ok) throw new Error('zenquotes failed');
  const arr = (await zenRes.json()) as { q: string; a: string }[];
  const first = arr?.[0];
  const payload: DailyQuote = {
    quote: first?.q || 'Reading is dreaming with open eyes.',
    author: first?.a || 'Unknown',
  };

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(DAILY_QUOTE_CACHE_KEY, JSON.stringify(payload));
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(DAILY_QUOTE_FETCHED_AT_KEY, new Date().toISOString());
  return payload;
}

export function scheduleDailyKyivQuoteRefresh(hour: number, minute: number) {
  const scheduleNext = () => {
    const delayMs = getNextKyivTriggerMs(hour, minute);
    setTimeout(async () => {
      try {
        const payload = await refreshDailyQuoteCache();
        console.log(`Daily quote refreshed at Europe/Kyiv ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`, payload);
      } catch (error) {
        console.error('Failed to refresh daily quote at scheduled Kyiv time:', error);
      } finally {
        scheduleNext();
      }
    }, delayMs);
  };

  scheduleNext();
}

quotesRouter.get('/daily', async (_req: AuthRequest, res: Response) => {
  try {
    if (quoteMemory && Date.now() - quoteMemory.at < QUOTE_MEMORY_TTL_MS) {
      res.json(quoteMemory.payload);
      return;
    }

    const cacheRow = db.prepare("SELECT value FROM settings WHERE key = 'daily_quote_cache'").get() as { value?: string } | undefined;
    const timeRow = db.prepare("SELECT value FROM settings WHERE key = 'daily_quote_fetched_at'").get() as { value?: string } | undefined;
    if (cacheRow?.value && timeRow?.value) {
      const fetched = new Date(timeRow.value).getTime();
      if (!Number.isNaN(fetched) && Date.now() - fetched < MS_DAY) {
        const payload = JSON.parse(cacheRow.value) as DailyQuote;
        quoteMemory = { payload, at: Date.now() };
        res.json(payload);
        return;
      }
    }

    const payload = await refreshDailyQuoteCache();
    quoteMemory = { payload, at: Date.now() };
    res.json(payload);
  } catch {
    const fallback = { quote: 'A reader lives a thousand lives before he dies.', author: 'George R.R. Martin' };
    quoteMemory = { payload: fallback, at: Date.now() };
    res.json(fallback);
  }
});
