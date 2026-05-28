/**
 * Модуль для роботи з базою даних SQLite
 * Містить ініціалізацію БД, створення таблиць та міграції
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Шлях до файлу бази даних
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SHELFECHO_DB_PATH?.trim() || path.join(__dirname, '..', 'shelfecho.db');

// Створюємо з'єднання з БД
const db = new Database(dbPath);

// Включаємо WAL режим для кращої продуктивності та надійності
db.pragma('journal_mode = WAL');
// Включаємо перевірку foreign keys
db.pragma('foreign_keys = ON');

/**
 * Допоміжна функція для додавання колонки до таблиці, якщо вона не існує
 * @param tableName - Назва таблиці
 * @param columnName - Назва колонки
 * @param columnDefinition - SQL визначення колонки
 */
function addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  const colNames = cols.map((c: any) => c.name);
  if (!colNames.includes(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

/**
 * Ініціалізує базу даних: створює таблиці, виконує міграції та індекси
 */
export function initDB() {
  // Створюємо основні таблиці
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      onboarded INTEGER DEFAULT 0,
      favorite_genres TEXT DEFAULT '[]',
      reading_goal INTEGER DEFAULT 12,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_key TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      cover_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, book_key)
    );

    CREATE TABLE IF NOT EXISTS reading_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_key TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      cover_id INTEGER,
      status TEXT DEFAULT 'want' CHECK(status IN ('reading', 'want', 'read')),
      progress INTEGER DEFAULT 0,
      total_pages INTEGER DEFAULT 0,
      pages_read INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, book_key)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_key TEXT NOT NULL,
      text TEXT NOT NULL,
      rating INTEGER DEFAULT 0 CHECK(rating >= 0 AND rating <= 5),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, book_key)
    );

    CREATE TABLE IF NOT EXISTS not_interested (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_key TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      cover_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, book_key)
    );

    CREATE TABLE IF NOT EXISTS subjects_cache (
      book_key TEXT PRIMARY KEY,
      subjects TEXT NOT NULL DEFAULT '[]',
      cached_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Міграції для таблиці reading_list
  addColumnIfNotExists('reading_list', 'total_pages', 'total_pages INTEGER DEFAULT 0');
  addColumnIfNotExists('reading_list', 'pages_read', 'pages_read INTEGER DEFAULT 0');
  addColumnIfNotExists('reading_list', 'subjects', "subjects TEXT DEFAULT '[]'");

  // Міграції для таблиці users
  addColumnIfNotExists('users', 'completed_from_want_list', 'completed_from_want_list INTEGER DEFAULT 0');
  addColumnIfNotExists('users', 'role', "role TEXT DEFAULT 'user'");
  addColumnIfNotExists('users', 'blocked', 'blocked INTEGER DEFAULT 0');
  addColumnIfNotExists('users', 'is_active', 'is_active INTEGER DEFAULT 1');
  addColumnIfNotExists('users', 'email_verification_token', 'email_verification_token TEXT');
  addColumnIfNotExists('users', 'email_verification_expires', 'email_verification_expires TEXT');
  addColumnIfNotExists('users', 'password_reset_token', 'password_reset_token TEXT');
  addColumnIfNotExists('users', 'password_reset_expires', 'password_reset_expires TEXT');
  addColumnIfNotExists('users', 'google_id', 'google_id TEXT');

  // Міграції для таблиці comments
  addColumnIfNotExists('comments', 'has_spoiler', 'has_spoiler INTEGER DEFAULT 0');
  addColumnIfNotExists('comments', 'status', "status TEXT DEFAULT 'approved'");

  // Створюємо додаткові таблиці
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      comment_id INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('spam', 'spoiler', 'offensive', 'other')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      UNIQUE(user_id, comment_id)
    );

    CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      query TEXT NOT NULL,
      results_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Ініціалізуємо стандартні налаштування рекомендацій, якщо вони відсутні
  const recWeights = db.prepare("SELECT key FROM settings WHERE key = 'rec_weights'").get();
  if (!recWeights) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      'rec_weights',
      JSON.stringify({ genre_weight: 50, author_weight: 50, subject_weight: 50, collaborative_weight: 50 })
    );
  }

  // Робимо першого користувача супер-адміном, якщо немає інших супер-адмінів
  const hasSuperAdmin = db.prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1").get();
  if (!hasSuperAdmin) {
    const firstUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as any;
    if (firstUser) {
      db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(firstUser.id);
    }
  }

  // Створюємо індекси для оптимізації запитів
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reading_list_user_id ON reading_list(user_id);
    CREATE INDEX IF NOT EXISTS idx_reading_list_book_key ON reading_list(book_key);
    CREATE INDEX IF NOT EXISTS idx_reading_list_user_book ON reading_list(user_id, book_key);
    CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_book_key ON favorites(book_key);
    CREATE INDEX IF NOT EXISTS idx_not_interested_user_id ON not_interested(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_book_key ON comments(book_key);
    CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON comment_reports(comment_id);
    CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  `);
}

export default db;
