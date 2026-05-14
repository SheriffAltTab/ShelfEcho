import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { authRouter } from './routes/auth.js';
import { booksRouter } from './routes/books.js';
import { favoritesRouter } from './routes/favorites.js';
import { commentsRouter } from './routes/comments.js';
import { readingListRouter } from './routes/readingList.js';
import { userRouter } from './routes/user.js';
import { uploadRouter } from './routes/upload.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { adminRouter } from './routes/admin.js';
import { quotesRouter } from './routes/quotes.js';

import 'dotenv/config';
import passport from 'passport';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = [
  'https://shelfecho.site',
  'https://www.shelfecho.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin) ? (origin || true) : false) }));
app.use(express.json());
app.use(passport.initialize());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

initDB();

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/reading-list', readingListRouter);
app.use('/api/user', userRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/quotes', quotesRouter);

app.listen(PORT, HOST, () => {
  console.log(`ShelfEcho server running on http://${HOST}:${PORT}`);
});
