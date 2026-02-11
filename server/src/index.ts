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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`ShelfEcho server running on http://localhost:${PORT}`);
});
