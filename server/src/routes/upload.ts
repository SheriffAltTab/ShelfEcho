import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware, type AuthRequest } from '../middleware.js';
import type { Response } from 'express';
import db from '../db.js';
import crypto from 'crypto';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Go up from routes/ → src/ → server/ then into uploads/
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = crypto.randomUUID() + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const uploadRouter = Router();

uploadRouter.post('/avatar', authMiddleware, upload.single('avatar'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  // Delete old avatar file if exists
  const oldUser = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.userId!) as any;
  if (oldUser?.avatar?.startsWith('/uploads/')) {
    const oldFilename = oldUser.avatar.replace('/uploads/', '');
    const oldPath = path.join(uploadsDir, oldFilename);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId!);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as any;
  res.json({
    avatarUrl,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboarded: !!user.onboarded,
      avatar: user.avatar,
      favoriteGenres: JSON.parse(user.favorite_genres || '[]'),
      readingGoal: user.reading_goal,
      createdAt: user.created_at,
    },
  });
});
