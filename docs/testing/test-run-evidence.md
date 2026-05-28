## Evidence: automated test runs (for diploma report)

### Environment
- **Node.js**: v22.22.0 (ABI/modules=127)
- **Vitest**: v3.2.4
- **OS**: Windows 10

### Unit suite
- **Command**: `npm run test:unit` (from `server/`)
- **Result**: PASS
- **Summary**: 2 test files, 5 tests passed

### Integration suite
- **Command**:
  - `npm run doctor`
  - `npm run test:integration`
- **Result**: PASS
- **Summary**: 1 test file, 2 tests passed

### Notes (important for reproducibility)
- Проєкт використовує `better-sqlite3` (нативний модуль). Якщо встановлювати залежності однією версією Node.js, а запускати іншою — можливий `ERR_DLOPEN_FAILED` через різний `NODE_MODULE_VERSION`.
- Для перевірки середовища додано команду `npm run doctor` у `server/`.

