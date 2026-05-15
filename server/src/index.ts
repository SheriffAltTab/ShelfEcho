import { env, validateRuntimeEnv } from './config/env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
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
import { registerGooglePassportStrategy } from './lib/passportGoogle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

validateRuntimeEnv();

const app = express();
const PORT = env.port;
const HOST = env.bindHost;

const allowedOrigins = [
  'https://shelfecho.site',
  'https://www.shelfecho.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (env.frontendUrl) allowedOrigins.push(env.frontendUrl);

app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin) ? (origin || true) : false) }));
app.use(express.json());
app.use(passport.initialize());

registerGooglePassportStrategy();

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
