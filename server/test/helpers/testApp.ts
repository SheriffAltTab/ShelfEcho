import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import type { Express } from 'express';
import { vi } from 'vitest';

export async function createTestApp(): Promise<{ app: Express; dbPath: string }> {
  process.env.NODE_ENV = 'test';
  const dbPath = path.join(os.tmpdir(), `shelfecho-test-${randomUUID()}.db`);
  process.env.SHELFECHO_DB_PATH = dbPath;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  vi.resetModules();
  const { createApp } = await import('../../src/app.js');
  const app = createApp({ scheduleQuotes: false });
  return { app, dbPath };
}

