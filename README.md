# ShelfEcho

**ShelfEcho** — веб-додаток для ведення особистої бібліотеки, списків читання, відгуків та рекомендацій книг. Користувачі реєструються, обирають улюблені жанри, додають книги в «Читаю» / «Хочу прочитати» / «Прочитано», залишають коментарі та рейтинги, отримують персональні рекомендації. Для адміністраторів є панель зі статистикою, модерацією коментарів та налаштуваннями системи.

**Сайт задеплоєний через AWS.**  
**Домен:** [shelfecho.site](https://shelfecho.site)

---

## Зміст

- [Стек технологій](#стек-технологій)
- [Логіка системи](#логіка-системи)
- [Ієрархія файлів](#ієрархія-файлів)
- [Розробка](#розробка)
- [Деплой](#деплой)

---

## Стек технологій

### Frontend (корінь проєкту)

| Технологія | Призначення |
|------------|-------------|
| **React 19** | UI та компонентна модель |
| **TypeScript** | Типізація |
| **Vite 7** | Збірка, dev-сервер, HMR |
| **React Router 7** | Маршрутизація (SPA) |
| **Tailwind CSS 4** | Стилі (utility-first) |
| **Axios** | HTTP-клієнт до API |
| **Framer Motion** | Анімації |
| **Recharts** | Графіки (адмінка, статистика) |
| **Lucide React** | Іконки |

### Backend (`server/`)

| Технологія | Призначення |
|------------|-------------|
| **Node.js** | Середовище виконання |
| **Express 5** | HTTP API |
| **TypeScript** | Типізація |
| **better-sqlite3** | База даних SQLite |
| **bcryptjs** | Хешування паролів |
| **jsonwebtoken** | JWT для авторизації |
| **multer** | Завантаження файлів (аватарки) |
| **cors** | CORS для запитів з фронту |
| **dotenv** | Змінні середовища |

### Зовнішні джерела даних

- **Open Library API** — пошук книг, обкладинки, опис, автор, жанри (subjects). Використовується тільки на бекенді; фронт отримує вже оброблені дані через власне API.

---

## Логіка системи

### Авторизація та користувачі

- **Реєстрація / вхід** — email + пароль; пароль зберігається як bcrypt-хеш. Після успішної реєстрації користувач потрапляє на **онбординг** (вибір улюблених жанрів та цілі читання на рік).
- **JWT** — після логіну/реєстрації сервер повертає токен; фронт зберігає його в `localStorage` і додає в заголовок `Authorization` для захищених запитів.
- **Ролі** — у БД є поле `role`: `user`, `moderator`, `content_manager`, `superadmin`. Перший зареєстрований користувач автоматично стає `superadmin`. Доступ до адмін-панелі перевіряється на бекенді та на фронті (приховані маршрути/меню).

### Книги

- Книги **не зберігаються в БД** як каталог. Дані беруться з **Open Library** (пошук, деталі книги, автор, тренди, за жанром). Бекенд кешує лише `subjects` (жанри) для книг у списку читання в таблиці `subjects_cache`.
- Користувач може: шукати книги, переглядати сторінку книги, додавати в обране, в список читання (статуси: «Хочу прочитати», «Читаю», «Прочитано» з прогресом і рейтингом), залишати один коментар і рейтинг на книгу, позначати «Не цікаво» для рекомендацій.

### Списки та коментарі

- **Favorites** — улюблені книги (таблиця `favorites`).
- **Reading list** — список читання зі статусами, прогресом (сторінки), рейтингом (таблиця `reading_list`).
- **Comments** — один коментар на користувача на книгу; підтримка позначки «спойлер» (`has_spoiler`), модерація (статус `pending` / `approved`), скарги (таблиця `comment_reports`).
- **Not interested** — книги, від яких користувач відмовився для рекомендацій.

### Рекомендації

- Рекомендації будуються на бекенді на основі: жанрів користувача, авторів з прочитаних книг, subjects з Open Library, налаштувань ваг у таблиці `settings` (ключ `rec_weights`). Адмін може змінювати ваги через панель.

### Адмін-панель

- Доступна лише для ролей з достатніми правами (перевірка на бекенді).
- Функції: статистика (користувачі, реєстрації, коментарі), модерація коментарів (черга на схвалення, спойлери, скарги), управління користувачами (блокування, ролі), налаштування ваг рекомендацій, аналітика пошуку (таблиця `search_logs`), нульові результати пошуку.

### Пошук та аналітика

- Пошук книг виконується через Open Library; запити та кількість результатів логуються в `search_logs` (опційно з `user_id`). Використовується для аналітики та покращення підказок.

---

## Ієрархія файлів

Структура наближена до **Feature-Sliced Design**: розділення на шари за типами модулів та аліаси імпортів `@/...`.

```
ShelfEcho/
├── index.html
├── package.json              # Фронт: залежності, скрипти (dev, build, lint)
├── vite.config.ts            # Vite: alias @ → src, proxy /api, /uploads на бекенд
├── tsconfig.json / tsconfig.app.json
├── vercel.json               # Rewrites для SPA на Vercel (якщо використовується)
│
├── src/                      # Frontend
│   ├── main.tsx              # Точка входу, рендер App
│   ├── app/
│   │   ├── App.tsx           # AuthProvider + AppRouter
│   │   └── routes/
│   │       └── AppRouter.tsx # Маршрути, ProtectedRoute, AuthRoute, OnboardingRoute
│   │
│   ├── pages/                # Сторінки (одна сторінка — один маршрут)
│   │   ├── auth/ui/AuthPage.tsx
│   │   ├── onboarding/ui/OnboardingPage.tsx
│   │   ├── home/ui/HomePage.tsx
│   │   ├── book-details/ui/BookDetailsPage.tsx
│   │   ├── my-books/ui/MyBooksPage.tsx
│   │   ├── profile/ui/ProfilePage.tsx
│   │   ├── search/ui/SearchPage.tsx
│   │   ├── discover/ui/DiscoverPage.tsx
│   │   ├── author/ui/AuthorPage.tsx
│   │   ├── user-profile/ui/UserProfilePage.tsx
│   │   └── admin/ui/AdminPage.tsx
│   │
│   ├── features/             # Фічі з власним станом/API
│   │   └── auth/
│   │       ├── api/authApi.ts
│   │       └── model/authContext.tsx
│   │
│   ├── entities/             # Бізнес-сутності (типи, базові дані)
│   │   └── user/model/types.ts
│   │
│   ├── shared/               # Спільний код
│   │   ├── api/apiClient.ts  # Axios instance, baseURL, interceptors (token, 401)
│   │   ├── ui/               # Button, Badge, BookCard, ErrorBoundary, ShelfEchoLogo, BookDescription
│   │   ├── lib/               # formatBookDescription, bookKeys
│   │   └── config/            # genreHierarchy, інші константи
│   │
│   └── widgets/
│       └── layout/ui/Layout.tsx  # Шапка, навігація, контент
│
└── server/                   # Backend
    ├── package.json
    ├── tsconfig.json
    ├── shelfecho.db          # SQLite (не комітити в публічний репо)
    ├── DEPLOY.md             # Інструкція з розгортання бекенду (Railway, Render)
    ├── src/
    │   ├── index.ts          # Express app, CORS, mount роутів, initDB
    │   ├── db.ts             # Підключення SQLite, initDB (таблиці, міграції)
    │   ├── middleware.ts     # JWT authMiddleware, перевірка ролей
    │   ├── lib/subjects.ts   # Робота з subjects/subjects_cache
    │   ├── routes/
    │   │   ├── auth.ts       # POST /register, /login; GET /me
    │   │   ├── books.ts      # Пошук, деталі, тренди, за жанром, автор
    │   │   ├── favorites.ts
    │   │   ├── readingList.ts
    │   │   ├── comments.ts   # CRUD, спойлери, скарги
    │   │   ├── user.ts       # Профіль, онбординг, статистика, досягнення
    │   │   ├── upload.ts     # Завантаження аватарки
    │   │   ├── recommendations.ts
    │   │   └── admin.ts     # Статистика, модерація, користувачі, налаштування
    │   └── uploads/          # Завантажені аватарки (файли)
    └── dist/                 # Збірка TS (node dist/index.js)
```

### Основні таблиці БД (server)

- **users** — id, name, email, password, avatar, onboarded, favorite_genres, reading_goal, role, blocked, completed_from_want_list, created_at
- **favorites** — user_id, book_key, title, author, cover_id
- **reading_list** — user_id, book_key, title, author, cover_id, status (reading/want/read), progress, total_pages, pages_read, rating, subjects
- **comments** — user_id, book_key, text, rating, has_spoiler, status (pending/approved)
- **comment_reports** — user_id, comment_id, reason
- **not_interested** — user_id, book_key
- **subjects_cache** — book_key, subjects (JSON)
- **user_achievements** — user_id, achievement_id
- **search_logs** — user_id, query, results_count
- **settings** — key-value (наприклад rec_weights)

---

## Розробка

### Вимоги

- Node.js 18+
- npm або аналог

### Встановлення та запуск

1. Клонувати репозиторій.
2. У **корені проєкту** (фронт):
   ```bash
   npm install
   ```
3. У **server/** (бекенд):
   ```bash
   cd server && npm install
   cd ..
   ```
4. Запуск фронту та бекенду одночасно з кореня:
   ```bash
   npm run dev
   ```
   - Фронт: [http://localhost:5173](http://localhost:5173) (Vite).
   - Бекенд: [http://localhost:3001](http://localhost:3001). Vite проксує `/api` та `/uploads` на `localhost:3001`, тому в dev не потрібно вказувати `VITE_API_URL`.

Окремі команди:

- Тільки фронт: `npm run dev:client`
- Тільки бекенд: `npm run dev:server`
- Збірка фронту: `npm run build`
- Лінт: `npm run lint`

### Змінні середовища

**Frontend (Vite)**

- `VITE_API_URL` — базовий URL API для продакшену (наприклад `https://api.shelfecho.site` або `https://xxx.railway.app/api`). Якщо не задано, використовується відносний шлях `/api`. Можна вказувати з або без суфікса `/api` — клієнт при потребі допише `/api`.

**Backend (server/)**

- `PORT` — порт сервера (за замовчуванням 3001).
- `HOST` — хост (за замовчуванням 0.0.0.0 для хмарного деплою).
- `FRONTEND_URL` — додатковий дозволений origin для CORS (наприклад `https://shelfecho.site`).

Файл `server/.env` можна використовувати для локальної розробки (dotenv підхоплює його автоматично).

---

## Деплой

- **Сайт задеплоєний через AWS.**  
- **Домен:** [shelfecho.site](https://shelfecho.site)

Фронт і бекенд розгортаються окремо:

- **Фронт** — статична збірка (Vite): збирається в `dist/`, файли роздаються через хостинг (у вашому випадку інфраструктура AWS). Домен shelfecho.site вказує на цей фронт.
- **Бекенд** — Node.js (Express) та SQLite. Його потрібно розмістити на окремому сервісі (наприклад Compute Engine, Cloud Run, або Railway/Render). Детальні кроки для розгортання бекенду (Railway, Render, змінні, підключення фронту) описані в ** [server/DEPLOY.md](server/DEPLOY.md)**.

Після розгортання бекенду на продакшені в конфігурації фронту (збірка для AWS) потрібно вказати змінну `VITE_API_URL` на URL вашого API (наприклад `https://api.shelfecho.site` або окремий домен/сервіс), щоб логін, реєстрація та всі запити йшли на живий бекенд.

---

## Ліцензія та авторство

Проєкт приватний. Всі права захищені.
