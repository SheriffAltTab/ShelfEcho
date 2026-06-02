import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import { validateRuntimeEnv } from './config/env.js';
import passport from 'passport';
import { registerGooglePassportStrategy } from './lib/passportGoogle.js';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/user.js';
import { favoritesRouter } from './routes/favorites.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { booksRouter } from './routes/books.js';
import { readingListRouter } from './routes/readingList.js';
import { commentsRouter } from './routes/comments.js';
import { uploadRouter } from './routes/upload.js';
import { quotesRouter } from './routes/quotes.js';
import { adminRouter } from './routes/admin.js';

export function createApp(_options?: { scheduleQuotes?: boolean }) {
  validateRuntimeEnv();
  initDB();

  // Register passport strategies (Google OAuth)
  registerGooglePassportStrategy();

  const app = express();

  // Initialize passport
  app.use(passport.initialize());

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/user', userRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/reading-list', readingListRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/quotes', quotesRouter);
  app.use('/api/admin', adminRouter);

  return app;
}

