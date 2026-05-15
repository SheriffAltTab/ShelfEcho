import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db.js';

export interface GoogleProfileInput {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Create or link a user from Google profile (Passport or manual OAuth).
 * Returns DB row or null if blocked / failure.
 */
export function upsertGoogleUser(profile: GoogleProfileInput): { row: Record<string, unknown>; created: boolean } | null {
  const existingByGoogle = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub) as
    | Record<string, unknown>
    | undefined;
  let row = existingByGoogle;
  let created = false;

  const avatar = typeof profile.picture === 'string' && profile.picture.trim() ? profile.picture.trim() : null;

  if (!row) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email) as
      | Record<string, unknown>
      | undefined;
    if (byEmail) {
      const updateFields = [
        'google_id = ?',
        'is_active = 1',
        'email_verification_token = NULL',
        'email_verification_expires = NULL',
      ];
      const params: any[] = [profile.sub];
      if (avatar && !(byEmail.avatar as string)) {
        updateFields.push('avatar = ?');
        params.push(avatar);
      }
      params.push(byEmail.id);
      db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id) as Record<string, unknown>;
    } else {
      const randomPw = crypto.randomBytes(32).toString('hex');
      const hashedPassword = bcrypt.hashSync(randomPw, 12);
      const ins = db
        .prepare(
          `INSERT INTO users (name, email, password, onboarded, is_active, google_id, avatar)
           VALUES (?, ?, ?, 0, 1, ?, ?)`,
        )
        .run(profile.name || profile.email.split('@')[0], profile.email, hashedPassword, profile.sub, avatar || '');
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(ins.lastInsertRowid) as Record<string, unknown>;
      created = true;
    }
  }

  if (!row) return null;
  if (Number(row.blocked) === 1) return null;

  if (avatar && !row.avatar) {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, row.id);
  }

  db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(row.id);
  return { row: db.prepare('SELECT * FROM users WHERE id = ?').get(row.id) as Record<string, unknown>, created };
}
