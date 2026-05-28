## Тест-план + звіт (Unit): реєстрація/авторизація/рекомендації

### 1. Мета
Перевірити коректність базових модулів рекомендаційного скорингу та ваг (без HTTP та без БД-інтеграції).

### 2. Обсяг
- `server/src/lib/recWeights.ts`
- `server/src/lib/hybridRecScore.ts`

### 3. Поза обсягом
Маршрути API, SQLite, зовнішній OpenLibrary `fetch`.

### 4. Ризики
- Зміна бізнес-логіки нормалізації/ваг може змінити очікувані числові результати.

### 5. Підхід
- Використати `vitest`.
- Перевірки детерміновані, без випадковості та мережі.

### 6. Тест-кейси (посилання на вимоги)
- **TC-U-REC-001** (TR-U-REC-001): `sanitizeRecWeights` clamps/rounds/defaults.
- **TC-U-REC-002** (TR-U-REC-002): `normalizedRecWeights` sum≈1 та fallback 0.25.
- **TC-U-REC-003** (TR-U-REC-003): `featuredRawMetrics` overlap/author/collab.
- **TC-U-REC-004** (TR-U-REC-004): `scoreFeaturedCandidatePool` сортування.

### 7. Процедура запуску
З каталогу `server/`:

```bash
npm run test:unit
```

### 8. Звіт про виконання (заповнюється після прогону)
- **Дата/час**: 2026-05-28
- **Оточення**: Node.js v22.22.0 (ABI/modules=127), Vitest v3.2.4
- **Результат**: PASS
- **Деталі**:
  - `test/unit/recWeights.test.ts`: PASS (3 тести)
  - `test/unit/hybridRecScore.test.ts`: PASS (2 тести)

