import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import type { UserRole } from '../middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');

export interface DeleteAccountOptions {
  targetUserId: number;
  actorUserId: number;
  actorRole: UserRole;
  selfService?: boolean;
}

export interface DeleteAccountResult {
  deletedUserId: number;
}

function localUploadPath(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  const match = avatar.match(/\/uploads\/([^/?#]+)/);
  if (!match?.[1]) return null;
  const resolved = path.resolve(uploadsDir, path.basename(match[1]));
  return resolved.startsWith(uploadsDir) ? resolved : null;
}

async function deleteAvatarIfLocal(avatar: string | null | undefined): Promise<void> {
  const filePath = localUploadPath(avatar);
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // Missing files should not block account erasure.
  }
}

function ensureAdminCanDeleteTarget(targetRole: UserRole, actorRole: UserRole, targetUserId: number, actorUserId: number): void {
  if (actorRole === 'moderator' && targetRole !== 'user') {
    throw Object.assign(new Error('Moderators can delete user accounts only'), { statusCode: 403 });
  }

  if (targetRole === 'superadmin') {
    const superadminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'").get() as { count: number };
    if (superadminCount.count <= 1 && targetUserId !== actorUserId) {
      throw Object.assign(new Error('Cannot delete the last superadmin account'), { statusCode: 409 });
    }
  }
}

export async function deleteUserAccount(options: DeleteAccountOptions): Promise<DeleteAccountResult> {
  const target = db.prepare('SELECT id, role, avatar FROM users WHERE id = ?').get(options.targetUserId) as
    | { id: number; role: UserRole | null; avatar: string | null }
    | undefined;

  if (!target) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const targetRole = (target.role || 'user') as UserRole;
  if (!options.selfService) {
    ensureAdminCanDeleteTarget(targetRole, options.actorRole, target.id, options.actorUserId);
  }

  const erase = db.transaction((userId: number) => {
    db.prepare('DELETE FROM search_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  erase(target.id);

  await deleteAvatarIfLocal(target.avatar);

  return { deletedUserId: target.id };
}
