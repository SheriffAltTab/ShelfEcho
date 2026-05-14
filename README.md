# ShelfEcho

**ShelfEcho** — повноцінний застосунок для читачів: особиста бібліотека, списки «Хочу / Читаю / Прочитано», обране, коментарі з модерацією, пошук через Open Library, персональні рекомендації з гібридним скорингом та адмін-панель з налаштуванням ваг рекомендацій.

Публічний сайт: [shelfecho.site](https://shelfecho.site)  
Репозиторій: React (Vite) + Express + SQLite; продакшен орієнтований на **AWS**.

---

## Зміст

1. [Стек технологій](#1-стек-технологій)  
2. [Швидкий старт (локально)](#2-швидкий-старт-локально)  
3. [Змінні середовища](#3-змінні-середовища)  
4. [Gmail і пароль додатка (App Password)](#4-gmail-і-пароль-додатка-app-password)  
5. [Google OAuth (Passport)](#5-google-oauth-passport)  
6. [Гібридний рушій рекомендацій](#6-гібридний-рушій-рекомендацій)  
7. [Discover: оновлення та пояснення](#7-discover-оновлення-та-пояснення)  
8. [Кеш і продуктивність](#8-кеш-і-продуктивність)  
9. [Структура репозиторію](#9-структура-репозиторію)  
10. [Огляд API](#10-огляд-api)  
11. [Деплой на AWS (коротко)](#11-деплой-на-aws-коротко)  

---

## 1. Стек технологій

| Шар | Технології |
|-----|------------|
| **Фронтенд** | React 19, TypeScript, Vite 7, React Router 7, Tailwind CSS 4, Axios, Framer Motion, Recharts (адмінка) |
| **Бекенд** | Node.js, Express 5, TypeScript, better-sqlite3, bcryptjs, jsonwebtoken, multer, **Passport** + **passport-google-oauth20**, Nodemailer |
| **Дані книг** | Open Library API (пошук, обкладинки, subjects); локальний кеш subjects у SQLite |

---

## 2. Швидкий старт (локально)

**Вимоги:** Node.js 18+.

```bash
git clone <repo-url>
cd ShelfEcho
npm install
cd server && npm install && cd ..
npm run dev
```

- Фронт: [http://localhost:5173](http://localhost:5173)  
- API: [http://localhost:3001](http://localhost:3001) — у режимі розробки Vite проксує `/api` та `/uploads` на бекенд, тому `VITE_API_URL` часто не потрібен.

Окремі скрипти: `npm run dev:client`, `npm run dev:server`, `npm run build`, `npm run lint`.

Шаблон змінних для API: [server/.env.example](server/.env.example). Скопіюйте в `server/.env` і заповніть секрети.

---

## 3. Змінні середовища

### Фронтенд (корінь, опційно `.env`)

| Змінна | Опис |
|--------|------|
| `VITE_API_URL` | Базовий URL API у продакшені (наприклад `https://shelfecho.site/api` або `https://api.example.com`). Можна з суфіксом `/api` або без — клієнт нормалізує `baseURL`. |

### Бекенд (`server/.env`)

Див. повний перелік у [server/.env.example](server/.env.example): `JWT_SECRET`, `FRONTEND_URL`, **Google OAuth**, **Gmail або SMTP**, `PORT`, `HOST`.

---

## 4. Gmail і пароль додатка (App Password)

Щоб надсилати листи підтвердження та скидання пароля через **Gmail** (наприклад `sheriffalttab@gmail.com`):

1. Увійдіть у [Google Обліковий запис](https://myaccount.google.com/) → **Безпека**.  
2. Увімкніть **Двоетапну перевірку** (2-Step Verification) — без неї App Password недоступні.  
3. **Безпека** → **Паролі додатків** (App passwords) → створіть пароль для типу **Пошта** / пристрій «Інший».  
4. Скопіюйте **16-символьний** пароль (пробіли можна ігнорувати).  
5. У `server/.env` встановіть:

```env
GMAIL_USER=sheriffalttab@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=sheriffalttab@gmail.com
```

**Чому не звичайний пароль від Gmail?** Google забороняє використовувати основний пароль облікового запису для SMTP-клієнтів; дозволені лише **OAuth2 для пошти** або **пароль додатка** після увімкнення 2FA.

Альтернатива: будь-який SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) — наприклад **Amazon SES**.

Реалізація в коді: [server/src/lib/mail.ts](server/src/lib/mail.ts) — пріоритет має пара `GMAIL_USER` + `GMAIL_APP_PASSWORD` (транспорт `smtp.gmail.com:465`), інакше використовується загальний SMTP.

---

## 5. Google OAuth (Passport)

У проєкті використовується **Express**, а не Next.js — тому **NextAuth.js тут не застосовується**. Вхід через Google реалізовано через **Passport** і стратегію `passport-google-oauth20`.

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID** → тип **Web application**.  
2. У полі **Authorized redirect URIs** додайте **точно** той самий URL, що й `GOOGLE_REDIRECT_URI` у `.env` (локально часто `http://localhost:3001/api/auth/google/callback`).  
3. Скопіюйте **Client ID** та **Client secret** у `GOOGLE_CLIENT_ID` та `GOOGLE_CLIENT_SECRET`.

Маршрути: `GET /api/auth/google` (редирект на Google), `GET /api/auth/google/callback` (обробка, редирект на фронт з JWT у фрагменті `#token=...`).

Код: [server/src/lib/passportGoogle.ts](server/src/lib/passportGoogle.ts), [server/src/routes/auth.ts](server/src/routes/auth.ts), [server/src/index.ts](server/src/index.ts) (`passport.initialize()`).

Якщо змінні Google не задані, `GET /api/auth/google` повертає `503` з повідомленням про відсутність конфігурації.

---

## 6. Гібридний рушій рекомендацій

Чотири ваги з адмін-панелі зберігаються в SQLite (`settings.rec_weights`): **genre**, **subject**, **author**, **collaborative**. Після кожного збереження в адмінці наступний запит до API вже читає **актуальні** значення з бази (окремого кешу відповіді рекомендацій немає).

### Математика (featured / Discover)

1. Для кожного кандидата в пулі обчислюються **сирі** метрики (перетин subjects з улюбленими жанрами, перетин з subject-профілем користувача, збіг автора, collaborative score).  
2. У межах **одного запиту** застосовується **min–max нормалізація** кожної метрики по всьому пулу кандидатів → значення в діапазоні приблизно `[0, 1]`.  
3. Підсумковий бал:  
   `final = w_g·n_g + w_s·n_s + w_a·n_a + w_c·n_c`,  
   де `(w_g, w_s, w_a, w_c)` — нормалізовані ваги з адмінки (сума = 1).

Реалізація: [server/src/lib/hybridRecScore.ts](server/src/lib/hybridRecScore.ts), використання в [server/src/routes/recommendations.ts](server/src/routes/recommendations.ts).  
Блок «Because you liked…» сортується через ту ж нормалізацію (`sortContentBasedBooks`).

---

## 7. Discover: оновлення та пояснення

- Кнопка **Refresh** надсилає новий запит з параметром **`exclude`** — список ключів книг, які вже показані в каруселі, щоб бекенд повернув **наступну** найкращу порцію без повторів.  
- Для кожної книги API повертає **`primarySignal`** (який внесок найбільший) і масив **`explanationTags`** (короткі мітки на кшталт «Genre: Fantasy», «Readers like you»).

Фронтенд: [src/pages/discover/ui/DiscoverPage.tsx](src/pages/discover/ui/DiscoverPage.tsx), клієнт: [src/features/recommendations/api/recommendationsApi.ts](src/features/recommendations/api/recommendationsApi.ts).

---

## 8. Кеш і продуктивність

| Що | Поведінка |
|----|-----------|
| **GET /api/books/popular-now** | In-memory TTL ~90 с ([server/src/routes/books.ts](server/src/routes/books.ts)) |
| **GET /api/quotes/daily** | Кеш 24 год у `settings` + короткий in-memory шар ([server/src/routes/quotes.ts](server/src/routes/quotes.ts)) |
| **Тренди / subject / details** | Існуючий TTL-кеш у `books` роутері |
| **SQLite** | Індекси на `reading_list`, `favorites`, `not_interested`, `comments` тощо — [server/src/db.ts](server/src/db.ts) |
| **Featured enrichment** | Open Library запити обмежені батчами по 3 паралельно |
| **Фронт** | `React.lazy` для **Admin** та **Discover** ([src/app/routes/AppRouter.tsx](src/app/routes/AppRouter.tsx)); обкладинки на Discover з `loading="lazy"` |

---

## 9. Структура репозиторію

```
ShelfEcho/
├── src/                 # React SPA (сторінки, features, entities, shared, widgets)
├── server/src/          # Express API, db.ts, middleware, routes, lib/
├── server/.env.example  # Шаблон конфігурації API
└── package.json         # Кореневі скрипти та залежності фронту
```

Аліас імпортів: `@/` → `src/`.

---

## 10. Огляд API

Усі захищені маршрути (крім логіну/реєстрації) очікують заголовок `Authorization: Bearer <jwt>`.

| Префікс | Призначення |
|---------|-------------|
| `/api/auth/*` | Реєстрація, логін, `me`, Google, verify-email, forgot/reset password |
| `/api/books/*` | Пошук, деталі, trending, subject, **popular-now** |
| `/api/recommendations/*` | **featured** (параметри `page`, `pageSize`, `exclude`), content-based, collaborative, not-interested |
| `/api/quotes/daily` | Цитата дня |
| `/api/favorites`, `/reading-list`, `/comments`, `/user`, `/upload` | Основна логіка користувача |
| `/api/admin/*` | Статистика, модерація, користувачі, **rec-weights** |

---

## 11. Деплой на AWS (коротко)

- **Статика:** збірка Vite → **S3** + **CloudFront** (SPA: помилка 404 → `index.html` за потреби).  
- **API:** **EC2** / **ECS Fargate** (довгоживучий Node-процес).  
- **SQLite:** придатний для одного інстансу з диском (EBS); для кількох реплік потрібен спільний диск (**EFS**) або **RDS**.  
- **Секрети:** **AWS Secrets Manager** або **SSM Parameter Store**.  
- **Пошта:** **SES** (або Gmail для невеликих обсягів з App Password).

---

## Ліцензія

Приватний проєкт. Усі права захищені.
