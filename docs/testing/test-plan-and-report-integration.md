## Тест-план + звіт (Integration): реєстрація/авторизація/рекомендації

### 1. Мета
Перевірити взаємодію HTTP API + SQLite + auth middleware + рекомендаційний модуль у зв’язці.

### 2. Обсяг
- Реєстрація/логін email+password (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`)
- Онбординг жанрів (`/api/user/onboard`)
- Favorites (`/api/favorites`)
- Featured recommendations (`/api/recommendations/featured`)

### 3. Ключові обмеження для локального тестування
- **Email-підтвердження вимкнене в тестах**: у `NODE_ENV=test` реєстрація одразу активує акаунт і не потребує SMTP.
- **Інтернет не потрібен**: OpenLibrary `fetch` мокаються, щоб рекомендації були стабільні.

### 4. Дані
- Користувач: `test@example.com` / `password123`
- Онбординг жанри: `Fantasy`, `Mystery`
- Favorites: 10 книг (умовний набір `Romance`)

### 5. Тест-кейси
- **TC-I-AUTH-001** (TR-I-AUTH-001/002/003): register → login → me.
- **TC-I-REC-001** (TR-I-REC-001): після онбордингу featured recommendations мають перетин subjects з жанрами онбордингу.
- **TC-I-REC-002** (TR-I-REC-002): після додавання 10 Favorites featured recommendations змінюються.

### 6. Процедура запуску
З каталогу `server/`:

```bash
npm run doctor
npm run test:integration
```

### 7. Звіт про виконання (заповнюється після прогону)
- **Дата/час**: 2026-05-28
- **Оточення**: Node.js v22.22.0 (ABI/modules=127), Vitest v3.2.4
- **Результат**: PASS
- **Фактичні кроки**:
  - Запуск `vitest` integration suite: PASS (2 тести)
  - Перевірка, що SMTP не потрібен (test runtime): PASS (`NODE_ENV=test` реєструє активний акаунт без SMTP)
  - Перевірка, що мережа не використовується (мок fetch): PASS (OpenLibrary `fetch` замокано в `test/helpers/openLibraryMock.ts`)

