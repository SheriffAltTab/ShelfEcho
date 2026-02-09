import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'shelfecho.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDB() {
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
  `);

  // Migrations for existing DBs
  const cols = db.prepare("PRAGMA table_info(reading_list)").all() as any[];
  const colNames = cols.map((c: any) => c.name);
  if (!colNames.includes('total_pages')) {
    db.exec('ALTER TABLE reading_list ADD COLUMN total_pages INTEGER DEFAULT 0');
  }
  if (!colNames.includes('pages_read')) {
    db.exec('ALTER TABLE reading_list ADD COLUMN pages_read INTEGER DEFAULT 0');
  }
}

export default db;
