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

  // Migrations for existing DBs
  const cols = db.prepare("PRAGMA table_info(reading_list)").all() as any[];
  const colNames = cols.map((c: any) => c.name);
  if (!colNames.includes('total_pages')) {
    db.exec('ALTER TABLE reading_list ADD COLUMN total_pages INTEGER DEFAULT 0');
  }
  if (!colNames.includes('pages_read')) {
    db.exec('ALTER TABLE reading_list ADD COLUMN pages_read INTEGER DEFAULT 0');
  }

  const userCols = db.prepare("PRAGMA table_info(users)").all() as any[];
  const userColNames = userCols.map((c: any) => c.name);
  if (!userColNames.includes('completed_from_want_list')) {
    db.exec('ALTER TABLE users ADD COLUMN completed_from_want_list INTEGER DEFAULT 0');
  }
  if (!userColNames.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  }
  if (!userColNames.includes('blocked')) {
    db.exec('ALTER TABLE users ADD COLUMN blocked INTEGER DEFAULT 0');
  }
  if (!userColNames.includes('is_active')) {
    db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
  }
  if (!userColNames.includes('email_verification_token')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verification_token TEXT');
  }
  if (!userColNames.includes('email_verification_expires')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verification_expires TEXT');
  }
  if (!userColNames.includes('password_reset_token')) {
    db.exec('ALTER TABLE users ADD COLUMN password_reset_token TEXT');
  }
  if (!userColNames.includes('password_reset_expires')) {
    db.exec('ALTER TABLE users ADD COLUMN password_reset_expires TEXT');
  }
  if (!userColNames.includes('google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  }
  const commentCols = db.prepare("PRAGMA table_info(comments)").all() as any[];
  const commentColNames = commentCols.map((c: any) => c.name);
  if (!commentColNames.includes('has_spoiler')) {
    db.exec('ALTER TABLE comments ADD COLUMN has_spoiler INTEGER DEFAULT 0');
  }
  if (!commentColNames.includes('status')) {
    db.exec("ALTER TABLE comments ADD COLUMN status TEXT DEFAULT 'approved'");
  }

  // Reading list: subjects column
  const rlCols = db.prepare("PRAGMA table_info(reading_list)").all() as any[];
  const rlColNames = rlCols.map((c: any) => c.name);
  if (!rlColNames.includes('subjects')) {
    db.exec("ALTER TABLE reading_list ADD COLUMN subjects TEXT DEFAULT '[]'");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      comment_id INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('spam', 'spoiler', 'offensive', 'other')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      UNIQUE(user_id, comment_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS search_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      query TEXT NOT NULL,
      results_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed default recommendation weights if not present
  const recWeights = db.prepare("SELECT key FROM settings WHERE key = 'rec_weights'").get();
  if (!recWeights) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      'rec_weights',
      JSON.stringify({ genre_weight: 50, author_weight: 50, subject_weight: 50, collaborative_weight: 50 })
    );
  }

  // Make first user superadmin if no superadmin exists
  const hasSuperAdmin = db.prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1").get();
  if (!hasSuperAdmin) {
    const firstUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get() as any;
    if (firstUser) {
      db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(firstUser.id);
    }
  }
}

export default db;
