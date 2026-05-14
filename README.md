# ShelfEcho

**ShelfEcho** is a web app for a personal library, reading lists, reviews, and book recommendations. Users sign up, pick favourite genres, manage **Want to read** / **Reading** / **Read**, leave one rating and comment per book, and get personalised recommendations. Administrators get a panel with statistics, comment moderation, user management, and recommendation weight tuning.

**Production:** AWS-hosted static frontend and Node API.  
**Site:** [shelfecho.site](https://shelfecho.site)

---

## Table of contents

- [Stack](#stack)
- [How it works](#how-it-works)
- [Hybrid recommendations](#hybrid-recommendations)
- [Authentication](#authentication)
- [Admin panel](#admin-panel)
- [Repository layout](#repository-layout)
- [Database](#database)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Deployment on AWS](#deployment-on-aws)
- [API overview](#api-overview)
- [License](#license)

---

## Stack

### Frontend (repository root)

| Technology | Role |
|------------|------|
| **React 19** | UI |
| **TypeScript** | Typing |
| **Vite 7** | Build and dev server |
| **React Router 7** | SPA routing |
| **Tailwind CSS 4** | Styling |
| **Axios** | HTTP client |
| **Framer Motion** | Animations |
| **Recharts** | Admin charts |
| **Lucide React** | Icons |

### Backend (`server/`)

| Technology | Role |
|------------|------|
| **Node.js** | Runtime |
| **Express 5** | HTTP API |
| **TypeScript** | Typing |
| **better-sqlite3** | SQLite database |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT sessions |
| **multer** | Avatar uploads |
| **nodemailer** | Transactional email (e.g. AWS SES SMTP) |
| **cors**, **dotenv** | CORS and configuration |

### External data

- **Open Library** — search, covers, work/edition metadata, subjects. Used only on the server; the browser talks to ShelfEcho’s own API.

---

## How it works

### Books

Books are **not** stored as a full catalogue in SQLite. Metadata comes from Open Library; the app stores user-specific rows (favourites, reading list, comments, “not interested”) and caches **subjects** per book key in `subjects_cache`.

### Lists and social

- **Favorites** — `favorites`
- **Reading list** — `reading_list` (status, progress, pages, rating, subjects JSON)
- **Comments** — one per user per book; spoiler flag, moderation status, **comment_reports**
- **Not interested** — excluded from recommendation pools where applicable

### Search analytics

Search queries can be logged to `search_logs` for admin analytics.

---

## Hybrid recommendations

Admin-tunable weights live in `settings` under the key **`rec_weights`** (JSON). The engine reads them via `getRecWeights()` / `normalizedRecWeights()` and combines normalised partial scores (genre overlap, subject overlap, author similarity, collaborative signal) into a **weighted sum**, then sorts candidates.

Featured / discover-style feeds support **pagination** (`page`, `pageSize`) so the client can load carousel “pages” without repeating the same slice.

---

## Authentication

- **Email + password** — register creates an **inactive** account until the user opens the verification link (`/verify-email?token=…` → `GET /api/auth/verify-email`). No JWT is issued until the account is active.
- **Login** — rejected with a clear message if the email is not verified yet (`is_active = 0`) or the user is blocked.
- **Google** — `GET /api/auth/google` redirects to Google; `GET /api/auth/google/callback` exchanges the code, creates or links the user, then redirects to **`FRONTEND_URL/auth/callback#token=…`**
- **Forgot password** — `POST /api/auth/forgot-password`; **reset** — `POST /api/auth/reset-password` with `token` and `newPassword`.
- **JWT** — stored in `localStorage` as `shelfecho_token` and sent as `Authorization: Bearer …` on protected routes.

Configure **SMTP** (e.g. Amazon SES SMTP) and **Google OAuth** using `server/.env.example` as a checklist.

---

## Admin panel

Available only to elevated roles (enforced on the server and reflected in the UI).

- Dashboard statistics  
- Comment moderation (reports, delete, spoiler handling)  
- **Users** list (`GET /api/admin/users`) with client-side search; ban / role controls  
- Recommendation weight sliders (`PUT /api/admin/rec-weights`)  
- Search analytics  

---

## Repository layout

```
ShelfEcho/
├── package.json
├── vite.config.ts          # alias @ → src; dev proxy /api and /uploads → backend
├── .env.example
├── src/                    # React SPA
│   ├── app/                # App shell, routes
│   ├── pages/              # Route-level screens (auth, home, discover, admin, …)
│   ├── features/           # Feature modules (e.g. auth)
│   ├── entities/           # Types and entity-level API helpers
│   ├── shared/             # apiClient, UI kit, config, utilities
│   └── widgets/            # Layout shell
└── server/
    ├── package.json
    ├── .env.example
    ├── src/
    │   ├── index.ts        # Express app, CORS, route mounting
    │   ├── db.ts           # SQLite schema and migrations
    │   ├── middleware.ts   # JWT auth, role checks
    │   ├── lib/            # mail, rec weights, google OAuth helpers, …
    │   └── routes/         # auth, books, favorites, …
    └── uploads/            # Local avatar files (dev / single-instance)
```

---

## Database

Key tables: `users` (roles, `blocked`, `is_active`, verification and reset tokens, optional `google_id`), `favorites`, `reading_list`, `comments`, `comment_reports`, `not_interested`, `subjects_cache`, `user_achievements`, `search_logs`, `settings`.

**SQLite on AWS:** a single EC2/ECS task with a persistent volume (EBS) is straightforward. For multiple API replicas you need a **shared filesystem (EFS)** or migrate to **Amazon RDS** (e.g. PostgreSQL).

---

## Local development

Requirements: **Node.js 18+** and npm.

```bash
npm install
cd server && npm install && cd ..
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)  
- API: [http://localhost:3001](http://localhost:3001) — Vite proxies `/api` and `/uploads` in development, so `VITE_API_URL` is optional locally.

Other scripts: `npm run dev:client`, `npm run dev:server`, `npm run build`, `npm run lint`.

---

## Environment variables

See **`.env.example`** (frontend) and **`server/.env.example`** (API, email, OAuth, JWT).

---

## Deployment on AWS

Typical layout:

1. **Static site** — `npm run build` → upload `dist/` to **Amazon S3** and serve via **CloudFront** (HTTPS, caching, SPA error document → `index.html` if you use client-side routing on unknown paths).
2. **API** — run `node server/dist/index.js` on **EC2**, **ECS/Fargate**, or behind **API Gateway + Lambda** (would require adapter changes; the reference app assumes a long-lived Node process).
3. **Secrets** — prefer **AWS Secrets Manager** or **SSM Parameter Store** instead of committing `.env` files.
4. **Email** — **Amazon SES** (verify domain or addresses; note sandbox limits until production access).

The included GitHub Action (`.github/workflows/deploy.yml`) shows an **SSH pull + build + pm2** pattern on a single host; adjust or replace with OIDC → S3 sync + CloudFront invalidation if you move static hosting to S3.

---

## API overview

| Prefix | Purpose |
|--------|---------|
| `POST /api/auth/register` | Create user; email verification required before login |
| `POST /api/auth/login` | JWT + user |
| `GET /api/auth/me` | Current user (Bearer token) |
| `GET /api/auth/google` | Start Google OAuth |
| `GET /api/auth/google/callback` | Google OAuth callback (redirect) |
| `GET /api/auth/verify-email?token=` | Activate account; returns JWT + user |
| `POST /api/auth/forgot-password` | Send reset email |
| `POST /api/auth/reset-password` | Set new password from token |
| `GET /api/books/...` | Search, details, subjects, popular-now, … |
| `GET /api/quotes/daily` | Quote of the day (cached) |
| `GET /api/recommendations/...` | Featured (paginated), content-based, collaborative |
| `GET/POST …` | `favorites`, `reading-list`, `comments`, `user`, `upload`, `admin` |

All non-auth routes that require a user expect `Authorization: Bearer <jwt>`.

---

## License

Private project. All rights reserved.
 