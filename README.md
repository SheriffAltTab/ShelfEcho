## Зміст

- [ShelfEcho](#shelfecho)
- [Основні можливості](#основні-можливості)
- [Технології](#технології)
- [Архітектура](#архітектура)
- [Рекомендаційний рушій](#рекомендаційний-рушій)
- [Ролі](#ролі)
- [Змінні середовища](#змінні-середовища)
  - [Налаштування CloudFlare](#налаштування-cloudflare)
  - [Важливі headers](#важливі-headers)
- [Локальний запуск](#локальний-запуск)
- [Скрипти](#скрипти)
- [База даних](#база-даних)
- [API огляд](#api-огляд)
- [Видалення акаунта](#видалення-акаунта)
- [Деплой](#деплой)
- [Продуктивність](#продуктивність)
- [Перевірка](#перевірка)
- [Ліцензія](#ліцензія)


Проєкт написаний на TypeScript і складається з React/Vite фронтенду та Express/Node.js бекенду із SQLite. Продакшн-деплой виконується через GitHub Actions на AWS/EC2 або сумісний SSH-хост без хардкоду секретів.

## Основні можливості

- Реєстрація, вхід, JWT-сесії, підтвердження email і скидання пароля.
- OAuth-вхід через Google із офіційною кнопкою Google.
- Онбординг із вибором улюблених жанрів і річної читацької цілі.
- Пошук книжок, сторінки деталей, сторінки авторів і інтеграція з OpenLibrary.
- Особиста бібліотека зі статусами `want`, `reading`, `read`, прогресом, сторінками й рейтингом.
- Обрані книжки, коментарі, оцінки, спойлер-позначки та скарги.
- Публічні профілі користувачів із ролями й досягненнями.
- Вкладка Discover із гібридною системою рекомендацій і поясненням “Why this book?”.
- Адмін-панель із дашбордом, аналітикою, модерацією, керуванням користувачами та налаштуванням ваг рекомендацій.
- Повний “Right to be Forgotten”: користувач або модератор може видалити акаунт, а персональні дані стираються каскадно.

## Технології

Фронтенд:

- React 19
- Vite 7
- TypeScript
- React Router
- Framer Motion
- Recharts
- Lucide React
- Tailwind CSS 4
- Axios

Бекенд:

- Node.js
- Express 5
- TypeScript
- better-sqlite3
- JWT
- bcryptjs
- Passport Google OAuth 2.0
- Nodemailer
- Multer

Інфраструктура:

- SQLite у режимі WAL
- GitHub Actions
- SSH-деплой через `appleboy/ssh-action`
- CloudFlare для CDN, DDoS-захисту та SSL/TLS
- PM2 для запуску API на сервері

## Архітектура

```
ShelfEcho/
├─ src/                         # React застосунок
│  ├─ app/                       # маршрути, глобальні стилі
│  ├─ pages/                     # сторінки: auth, discover, admin, profile тощо
│  ├─ features/                  # auth, recommendations, favorites, comments
│  ├─ entities/                  # типи користувача й книжки
│  └─ shared/                    # API-клієнт, UI, конфігурація, утиліти
├─ server/
│  ├─ src/
│  │  ├─ routes/                 # Express маршрути
│  │  ├─ lib/                    # пошта, Google OAuth, рекомендації, видалення акаунтів
│  │  ├─ config/env.ts           # типізована runtime-конфігурація
│  │  ├─ db.ts                   # SQLite schema + міграції + індекси
│  │  └─ index.ts                # ініціалізація API
│  ├─ uploads/                   # локальні аватари
│  └─ shelfecho.db               # SQLite база
└─ .github/workflows/deploy.yml  # продакшн-деплой
```

## Рекомендаційний рушій

Discover використовує гібридну вагову систему. Адміністратор задає 4 ваги від `0` до `100`:

- Genre Weight
- Author Weight
- Subject Weight
- Collaborative Weight

Бекенд нормалізує ваги так, щоб їхня сума дорівнювала `1`. Для кожної книжки рахуються 4 сигнали:

- `genre`: збіг із улюбленими жанрами користувача;
- `author`: збіг із авторами, яких користувач читав або додавав в обране;
- `subject`: схожі теми з книжок на полиці;
- `collaborative`: книжки від читачів із подібними полицями.

Фінальна оцінка:

```
score =
  normalizedGenreWeight * genreScore +
  normalizedAuthorWeight * authorScore +
  normalizedSubjectWeight * subjectScore +
  normalizedCollaborativeWeight * collaborativeScore
```

Кандидати збираються з кількох джерел: OpenLibrary subjects, OpenLibrary author search, локальні reading-list/favorites дані та collaborative SQL-запити. Результати кешуються на короткий час, а кеш рекомендацій інвалідовується після:

- зміни ваг у адмін-панелі;
- оновлення жанрів користувача;
- додавання, оновлення або видалення книжок у reading list;
- зміни favorites;
- позначки `Not Interested`;
- видалення акаунта;
- ручного `Clear Cache` в адмін-панелі.

API також повертає `primarySignal`, `explanationTags`, `whyThisBook` і `hybridScore`, тому UI показує пояснення на кшталт “Based on your favorite authors”.

## Ролі

- `user`: звичайний користувач.
- `moderator`: модерація скарг, блокування та видалення звичайних користувачів.
- `content_manager`: статистика, системне здоров’я, налаштування рекомендацій.
- `superadmin`: повний доступ, включно зі зміною ролей.

Перший користувач автоматично стає `superadmin`, якщо у базі ще немає superadmin.

## Змінні середовища

| Змінна | Опис |
| --- | --- |
| `NODE_ENV` | `development` або `production` |
| `PORT` | порт API, типово `3001` |
| `BIND_HOST` | адреса bind для Express, типово `0.0.0.0` |
| `FRONTEND_URL` | URL фронтенду для CORS, email-посилань і OAuth redirect |
| `JWT_SECRET` | секрет для JWT |
| `EMAIL_FROM` | адреса відправника листів |
| `GMAIL_USER` | Gmail-акаунт для Nodemailer |
| `GMAIL_APP_PASSWORD` | Gmail App Password |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | callback URL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | альтернативний SMTP-провайдер замість Gmail |

GitHub Secrets для деплою:

| Secret | Для чого |
| --- | --- |
| `HOST` | SSH-хост AWS/EC2 |
| `USERNAME` | SSH-користувач |
| `SSH_KEY` | приватний SSH-ключ |
| `JWT_SECRET` | production JWT secret |
| `EMAIL_FROM` | email відправника |
| `GMAIL_USER` | Gmail SMTP користувач |
| `GMAIL_APP_PASSWORD` | Gmail App Password |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback |

## CloudFlare

Проєкт використовує CloudFlare для покращення продуктивності та безпеки:

- **CDN**: Розподіл статичного контенту (CSS, JS, зображення) по глобальній мережі
- **DDoS-захист**: Автоматичний захист від DDoS-атак
- **SSL/TLS**: Безкоштовний SSL-сертифікат з автоматичним оновленням
- **Кешування**: Автоматичне кешування статичних ресурсів
- **Firewall**: WAF (Web Application Firewall) для блокування шкідливих запитів
- **Analytics**: Детальна статистика трафіку та продуктивності

### Важливі headers

CloudFlare передає додаткові headers для ідентифікації трафіку:

- `CF-RAY`: Унікальний ідентифікатор запиту
- `CF-Connecting-IP`: Справжня IP-адреса клієнта (замість IP CloudFlare)
- `CF-IPCountry`: Країна клієнта
- `CF-Visitor`: Інформація про протокол (HTTP/HTTPS)

Бекенд включає middleware, що автоматично встановлює `req.clientIp` на справжню IP клієнта (з `CF-Connecting-IP` якщо доступний, інакше `req.ip`). Оригінальна IP CloudFlare зберігається в `req.cloudflareIp`.

## Локальний запуск

Встановлення залежностей у корені та в бекенді:

```powershell
npm install
cd server
npm install
cd ..
```

Запуск у режимі розробки:

```powershell
npm run dev
```

Окремо:

```powershell
npm run dev:client
npm run dev:server
```

## База даних

SQLite створюється автоматично у `server/shelfecho.db`. Основні таблиці:

- `users`
- `favorites`
- `reading_list`
- `comments`
- `not_interested`
- `subjects_cache`
- `user_achievements`
- `comment_reports`
- `search_logs`
- `settings`

`initDB()` створює таблиці, виконує легкі міграції та додає індекси для гарячих запитів: reading list, favorites, comments, reports, search logs і users.

## API огляд

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`

User:

- `PUT /api/user/onboard`
- `PUT /api/user/profile`
- `DELETE /api/user/account`
- `GET /api/user/stats`
- `POST /api/user/achievements/sync`
- `GET /api/user/:id/profile`
- `GET /api/user/genre-breakdown`

Recommendations:

- `GET /api/recommendations/featured?page=0&pageSize=8`
- `GET /api/recommendations/content-based?page=0&pageSize=10`
- `GET /api/recommendations/collaborative?page=0&pageSize=10`
- `POST /api/recommendations/not-interested`
- `GET /api/recommendations/not-interested`

Admin:

- `GET /api/admin/rec-weights`
- `PUT /api/admin/rec-weights`
- `POST /api/admin/cache/clear`
- `GET /api/admin/users?page=0&pageSize=20&q=...`
- `DELETE /api/admin/users/:id`
- `PUT /api/admin/users/:id/block`
- `PUT /api/admin/users/:id/role`
- `GET /api/admin/users/:id/activity`
- `GET /api/admin/moderation/reports`
- `PUT /api/admin/moderation/:commentId`
- `GET /api/admin/search-analytics`

Books:

- `GET /api/books/search`
- `GET /api/books/details`
- `GET /api/books/trending`
- `GET /api/books/subject/:subject`
- `GET /api/books/popular-now`
- `GET /api/books/author-info`

## Видалення акаунта

Self-service видалення доступне у профілі користувача через Settings. Адмінське видалення доступне в `Community & Moderation > Users`.

Після підтвердження:

- видаляється запис `users`;
- каскадно стираються reading list, favorites, comments, reports, achievements і not interested;
- вручну очищається `search_logs`, бо це аналітична таблиця без FK;
- локальний аватар із `server/uploads` видаляється, якщо він належить застосунку;
- JWT стає недійсним, бо користувача більше немає в базі.

## Деплой

Workflow `.github/workflows/deploy.yml` запускається при push у `master`:

1. Підключається до хоста через SSH.
2. Оновлює код із `origin/master`.
3. Створює `.env` для фронтенду.
4. Встановлює залежності та збирає фронтенд.
5. Створює `server/.env` із GitHub Secrets.
6. Збирає бекенд.
7. Перезапускає PM2 процес `shelfecho`.

Перед деплоєм необхідно додати всі GitHub Secrets із розділу “Змінні середовища”.

## Продуктивність

- Рекомендації кешуються коротким TTL і не перераховуються повністю на кожен запит.
- OpenLibrary subject/author/details відповіді кешуються у пам’яті, а subjects книжок додатково зберігаються в SQLite.
- Discover endpoints підтримують server-side pagination.
- Admin users list використовує server-side pagination і search.
- SQLite має індекси для найчастіших запитів.
- Discover Refresh передає `refresh` ключ і виключає поточні книжки, тому користувач отримує новий набір із того самого вагового рушія.
- Якщо продакшн-сайт показує попередження про «Protected Audience API is deprecated», це, швидше за все, викликано Cloudflare / Cloudflare Insights, а не вашим React-кодом.

## Перевірка

```powershell
cd server
npm.cmd run build
cd ..
npm.cmd run build
```
