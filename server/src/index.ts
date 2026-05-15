/**
 * Головний файл сервера ShelfEcho
 * Ініціалізує Express додаток, налаштовує middleware, маршрути та базу даних
 */

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

// Отримуємо директорію поточного файлу для роботи з статичними файлами
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Перевіряємо наявність всіх необхідних змінних середовища
validateRuntimeEnv();

// Створюємо Express додаток
const app = express();
const PORT = env.port;
const HOST = env.bindHost;

// Дозволені origins для CORS
const allowedOrigins = [
  'https://shelfecho.site',
  'https://www.shelfecho.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Додаємо динамічний origin з конфігурації, якщо вказано
if (env.frontendUrl) allowedOrigins.push(env.frontendUrl);

// Налаштовуємо CORS з перевіркою дозволених origins
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin) ? (origin || true) : false)
}));

/**
 * Middleware для отримання справжньої IP-адреси клієнта через CloudFlare
 * CloudFlare передає оригінальну IP в заголовку CF-Connecting-IP
 */
app.use((req, res, next) => {
  const cfConnectingIp = req.headers['cf-connecting-ip'] as string;
  if (cfConnectingIp) {
    // Зберігаємо оригінальну IP CloudFlare в окремому полі
    (req as any).cloudflareIp = req.ip;
    // Встановлюємо справжню IP клієнта
    (req as any).clientIp = cfConnectingIp;
  } else {
    (req as any).clientIp = req.ip;
  }
  next();
});

// Парсимо JSON тіла запитів
app.use(express.json());

// Ініціалізуємо Passport для аутентифікації
app.use(passport.initialize());

// Реєструємо стратегію Google OAuth
registerGooglePassportStrategy();

// Налаштовуємо статичні файли для аватарів користувачів
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Ініціалізуємо базу даних
initDB();

// Підключаємо всі API маршрути
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

// Запускаємо сервер
app.listen(PORT, HOST, () => {
  console.log(`ShelfEcho server running on http://${HOST}:${PORT}`);
});
