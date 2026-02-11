# Розгортання бекенду ShelfEcho

Бекенд — Express + SQLite. Нижче варіанти розгортання та підключення фронту на Vercel.

---

## 1. Railway (рекомендовано)

1. Зареєструйтесь на [railway.app](https://railway.app) (є безкоштовний план).
2. **New Project** → **Deploy from GitHub repo** → оберіть репозиторій ShelfEcho.
3. У проєкті натисніть **Add Service** → **GitHub Repo** знову (або один сервіс уже створений).
4. У налаштуваннях сервісу:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. **Settings** → **Networking** → **Generate Domain** — з’явиться URL типу `https://shelfecho-production-xxxx.up.railway.app`.
6. Скопіюйте цей URL **з шляхом `/api`** (наприклад `https://shelfecho-production-xxxx.up.railway.app/api`).

**Підключення фронту на Vercel:**

- У проєкті фронту на Vercel: **Settings** → **Environment Variables**.
- Додайте змінну:
  - **Name:** `VITE_API_URL`
  - **Value:** `https://ваш-домен.railway.app/api` (ваш URL з кроку 6, без слеша в кінці).
- Збережіть і зробіть **Redeploy** фронту.

Після цього логін і реєстрація будуть йти на бекенд на Railway.

---

## 2. Render

1. Зареєструйтесь на [render.com](https://render.com).
2. **New** → **Web Service** → підключіть GitHub-репозиторій ShelfEcho.
3. Налаштування:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (або платний для постійного диску).
4. **Create Web Service**. Отримаєте URL типу `https://shelfecho-xxxx.onrender.com`.
5. API для фронту: `https://shelfecho-xxxx.onrender.com/api`.

**Увага:** на безкоштовному плані Render “засинає” після неактивності; перший запит після цього може тривати 30–60 с.

**Підключення фронту:** так само додайте на Vercel змінну `VITE_API_URL` = `https://ваш-сервіс.onrender.com/api` і передеплойте фронт.

---

## 3. Змінні середовища бекенду (за потреби)

У Railway/Render у сервісі бекенду можна додати:

| Змінна   | Опис                          | За замовчуванням   |
|----------|--------------------------------|--------------------|
| `PORT`   | Порт (зазвичай задає хмара)   | 3001               |
| `HOST`   | Хост для listen                | 0.0.0.0            |

SQLite зберігає дані у файлі `shelfecho.db` у корені `server/`. На Railway/Render файлова система часто тимчасова — після перезапуску дані можуть зникати. Для постійних даних на Railway можна додати **Volume** і змонтувати його в каталог, де лежить `shelfecho.db` (деталі в їхній документації).

---

## Перевірка

- Відкрийте у браузері: `https://ваш-бекенд-url/api/books` (або інший публічний ендпоінт). Має повернутися JSON, а не HTML.
- Після встановлення `VITE_API_URL` на Vercel і редеплою спробуйте увійти або зареєструватися на shelfecho.vercel.app.
