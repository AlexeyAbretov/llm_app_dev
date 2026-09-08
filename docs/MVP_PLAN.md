# MVP Plan: Каталог объектов

> Пошаговый план реализации **каталога**. Каждый этап — отдельная git-ветка `stage/N-…`.  
> Процесс агентов (GitHub, Cursor, локальный деплой): [AGENT_PIPELINE_PLAN.md](./AGENT_PIPELINE_PLAN.md) — ветки `pipeline/N-…`.

## Git-workflow: ветка на этап

> Подробнее: [CONSTITUTION.md §3](./CONSTITUTION.md#3-git-workflow)

1. **Перед этапом N:** `git checkout main && git pull` → `git checkout -b stage/N-...`
2. **Во время этапа:** все коммиты только в ветке этапа
3. **После этапа:** push ветки → прогон чеклиста «Проверка»
4. **Merge в `main`:** только после явного подтверждения пользователя
5. **Следующий этап:** новая ветка от обновлённого `main`

| Этап | Ветка |
|------|-------|
| 0 | `stage/0-infrastructure` |
| 1 | `stage/1-backend-skeleton` |
| 2 | `stage/2-mongodb` |
| 3 | `stage/3-ollama-services` |
| 4 | `stage/4-langgraph-pipeline` |
| 5 | `stage/5-api-endpoints` |
| 6 | `stage/6-frontend-skeleton` |
| 7 | `stage/7-upload-polling` |
| 8 | `stage/8-catalog-detail` |
| 9 | `stage/9-search` |
| 10 | `stage/10-polish` |

**Агент не мержит в `main` без команды пользователя.**

## Обзор этапов

```
Этап 0: Инфраструктура          ████░░░░░░  ~2ч
Этап 1: Backend skeleton        ████░░░░░░  ~2ч
Этап 2: MongoDB + модели        ████░░░░░░  ~2ч
Этап 3: Ollama services         ██████░░░░  ~3ч
Этап 4: LangGraph pipeline      ██████░░░░  ~4ч
Этап 5: API endpoints           ████░░░░░░  ~3ч
Этап 6: Frontend skeleton       ████░░░░░░  ~2ч
Этап 7: Upload + polling        ██████░░░░  ~4ч
Этап 8: Catalog + detail        ████░░░░░░  ~3ч
Этап 9: Search                  ██████░░░░  ~4ч
Этап 10: Polish + healthcheck   ████░░░░░░  ~2ч
                                 ─────────
                                 ~31ч total
```

---

## Этап 0: Инфраструктура и scaffold

**Ветка:** `stage/0-infrastructure`

**Цель:** monorepo, зависимости, docker, env.

### Шаги

1. Инициализировать корневой `package.json` (npm workspaces: `frontend`, `backend`, `shared`)
2. Создать `docker-compose.yml`:
   - `mongo:7` на порту 27017, volume `mongo_data`
   - (Ollama ставится на хост, не в Docker — нужен GPU)
3. Создать `.env.example`:
   ```
   MONGO_URI=mongodb://localhost:27017/catalog
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_VISION_MODEL=qwen2.5vl:7b
   OLLAMA_EMBED_MODEL=nomic-embed-text
   OLLAMA_TRANSLATE_MODEL=qwen2.5:0.5b
   UPLOAD_DIR=./uploads
   PORT=3001
   ```
4. Создать `.gitignore` (node_modules, uploads, .env, dist)
5. Создать `shared/` с базовыми типами (`CatalogItem`, `ProcessingStatus`, API responses)
6. Убедиться что Ollama установлен, скачать модели:
   ```bash
   ollama pull qwen2.5vl:7b
   ollama pull nomic-embed-text
   ollama pull qwen2.5:0.5b
   ```

### Проверка

- [ ] `docker compose up -d mongo` — MongoDB доступна
- [ ] `ollama list` — обе модели скачаны
- [ ] `npm install` в корне без ошибок

---

## Этап 1: Backend skeleton

**Цель:** Fastify-сервер с healthcheck и CORS.

### Шаги

1. Scaffold `backend/`:
   - TypeScript, `tsx` для dev, `tsc` для build
   - Fastify + `@fastify/cors` + `@fastify/multipart`
   - `@fastify/static` для раздачи uploads
2. Структура:
   ```
   backend/src/
     index.ts          # entry point
     config.ts         # env vars (dotenv + Zod)
     plugins/          # mongo, cors
     routes/           # health, items, search
   ```
3. `GET /api/health` → `{ status: 'ok', mongo: bool, ollama: bool }`
4. Dev-скрипт: `npm run dev:backend` (watch mode)

### Проверка

- [x] `curl localhost:3001/api/health` → JSON с mongo/ollama статусами
- [x] Hot reload работает

---

## Этап 2: MongoDB — модели и репозиторий

**Цель:** CRUD для `catalog_items`, индексы.

### Шаги

1. MongoDB plugin для Fastify (singleton client)
2. Repository `CatalogRepository`:
   - `create(data)` → insert со status `pending`
   - `findById(id)`
   - `findAll(page, limit)` → только `ready`, sort by `createdAt desc`
   - `update(id, partial)`
   - `findAllWithEmbeddings()` → для search (только `ready`)
3. При старте сервера — создать text index если не существует
4. Unit-тест или manual script: insert → find → update

### Проверка

- [x] Insert документ через repository
- [x] Text index создан (`db.catalog_items.getIndexes()`)
- [x] Pagination работает

---

## Этап 3: Ollama services

**Цель:** обёртки для vision LLM и embeddings.

### Шаги

1. `services/ollama.ts`:
   - `checkHealth()` → ping `/api/tags`
   - `generateFromImage(imagePath, prompt)` → POST `/api/chat` с image
   - `generateEmbedding(text)` → POST `/api/embeddings`
2. `services/imageStorage.ts`:
   - `save(file)` → сохранить в `uploads/`, вернуть path
   - `getUrl(path)` → URL для frontend
3. Vision prompt v1 (из CONSTITUTION.md)
4. `services/llmParser.ts`:
   - `parseVisionResponse(raw: string)` → `{ title, description, tags }`
   - JSON parse + Zod validate + fallback regex
5. Mutex/semaphore: только одна vision-задача одновременно

### Проверка

- [ ] Тестовый скрипт: положить test.jpg → получить title/description на русском
- [ ] Embedding возвращает массив ~768 float
- [x] Parser корректно обрабатывает JSON с markdown-обёрткой

---

## Этап 4: LangGraph pipeline

**Цель:** orchestration загрузки через LangGraph.js.

### Шаги

1. Установить `@langchain/langgraph`, `@langchain/core`
2. Определить State:
   ```typescript
   interface PipelineState {
     itemId: string;
     imagePath: string;
     title?: string;
     description?: string;
     tags?: string[];
     embedding?: number[];
     error?: string;
     retries: number;
   }
   ```
3. Узлы: `validate` → `saveImage` → `visionLLM` → `parseResponse` → `embed` → `saveDB`
4. Conditional edges: error → retry (max 2) или fail
5. `graph/compile()` → export `runCatalogPipeline(itemId, fileBuffer)`
6. Job runner: простая in-memory очередь (массив + process one at a time)
7. При старте/ошибке — update status в MongoDB

### Проверка

- [ ] Upload test image через pipeline → doc в MongoDB со status `ready` (локально: `test:pipeline` + Ollama + test.jpg)
- [x] При невалидном файле → status `failed`
- [x] Retry срабатывает при битом JSON от LLM (mock в `test:pipeline`)
- [x] В логах видны переходы между узлами

---

## Этап 5: API endpoints

**Цель:** REST API для frontend.

### Шаги

1. `POST /api/items`:
   - multipart, поле `image`
   - validate MIME (jpeg, png, webp), max 10 MB
   - create doc (pending) → enqueue pipeline
   - return `202 { id, status: 'pending' }`
2. `GET /api/items/:id`:
   - return item (без embedding в response)
   - include `imageUrl`
3. `GET /api/items?page=1&limit=20`:
   - paginated list, only `ready`
4. `GET /api/search?q=...&limit=20`:
   - placeholder (реализуем на этапе 9)
5. Error handling: 400, 404, 500 с `{ error: string }`

### Проверка

- [x] `curl -F "image=@test.jpg" localhost:3001/api/items` → 202 (или `npm run test:api`)
- [ ] Polling `GET /api/items/:id` → eventually `ready` (локально с Ollama)
- [x] List endpoint возвращает pagination meta

---

## Этап 6: Frontend skeleton

**Цель:** Vite + React + TS, routing, API client.

### Шаги

1. Scaffold `frontend/`:
   - Vite + React + TypeScript
   - Tailwind CSS
   - React Router v6
   - TanStack Query v5
2. Структура (из CONSTITUTION):
   ```
   frontend/src/
     api/         client.ts, items.ts, search.ts
     types/       re-export from shared
     pages/       UploadPage, CatalogPage, ItemDetailPage, SearchPage
     components/  Layout, ItemCard, ...
     App.tsx
   ```
3. `api/client.ts` — base URL `http://localhost:3001/api`
4. Layout: header + nav (Каталог, Загрузить, Поиск)
5. Placeholder-страницы с русскими заголовками
6. Vite proxy: `/api` → `localhost:3001`

### Проверка

- [x] `npm run dev:frontend` → app на localhost:5173
- [x] Навигация между 4 страницами
- [x] Health endpoint доступен через proxy

---

## Этап 7: Upload + polling

**Цель:** пользователь загружает фото, видит прогресс, результат.

### Шаги

1. `ImageUpload` component:
   - react-dropzone, drag-and-drop
   - preview перед отправкой
   - кнопка «Загрузить»
2. `UploadPage`:
   - on upload → `POST /api/items`
   - redirect или inline polling
3. `ProcessingStatus` component:
   - polling `GET /api/items/:id` каждые 2 с
   - spinner для `pending`/`processing`
   - success → показать title, description, tags
   - error → показать сообщение
4. Hook `useItem(id)` — TanStack Query с `refetchInterval`

### Проверка

- [ ] Drag-and-drop фото → spinner → карточка с LLM-данными
- [ ] При ошибке LLM — красное сообщение
- [ ] Можно загрузить второе фото после первого

---

## Этап 8: Catalog + detail

**Цель:** просмотр всех объектов и детальная страница.

### Шаги

1. `CatalogPage`:
   - grid карточек (responsive: 1/2/3/4 cols)
   - `ItemCard`: thumbnail, title, tags, дата
   - pagination (кнопки или infinite scroll)
   - empty state: «Каталог пуст. Загрузите первый объект.»
2. `ItemDetailPage` (`/items/:id`):
   - полноразмерное фото
   - title, description, tags
   - дата создания
   - back link
3. Hook `useItems(page)` — TanStack Query

### Проверка

- [ ] После загрузки 2–3 объектов — все видны в каталоге
- [ ] Клик по карточке → detail page
- [ ] Pagination работает (>20 объектов)

---

## Этап 9: Search

**Цель:** текстовый hybrid search.

### Шаги

1. Backend `services/search.ts`:
   - перевод запроса RU→EN (`qwen2.5:0.5b`), затем `embedQuery` с префиксом `search_query:`
   - `cosineSimilarity(a, b)` → 0..1, **без** min-max по cosine
   - load all `ready` items with embeddings
   - `$text` по исходному RU и по English (`embedText` в индексе)
   - hybrid merge: `0.7 * cosine + 0.3 * min-max($text)`
   - sort by combined score, return top N
   Карточки: RU `title`/`description`/`tags`; скрытый EN `embedText` для nomic.
2. `GET /api/search?q=...&limit=20` — реализация
3. Frontend `SearchPage`:
   - input + debounce 300ms
   - results list with score indicator
   - empty state: «Ничего не найдено»
   - link to item detail
4. Hook `useSearch(q)`

### Проверка

- [ ] Загрузить «вазу» → поиск «ваза» → top-1 (локально: Ollama + MongoDB + upload)
- [ ] Поиск «керамика» → находит по tags/description (локально)
- [x] Пустой запрос → 400
- [x] Debounce не спамит API (frontend: 300 ms, `enabled` только при непустом q)

---

## Этап 10: Polish + финализация

**Ветка:** `stage/10-polish`

**Цель:** довести MVP до критериев готовности.

### Шаги

1. `GET /api/health` — полная проверка (mongo ping + ollama tags)
2. Resize image перед отправкой в LLM (max 1024px) — если нужно
3. Loading skeletons в catalog/search
4. Error boundaries в React
5. README.md:
   - prerequisites (Node, Docker, Ollama)
   - setup instructions
   - `npm run dev` — запуск всего
6. Финальный прогон по чеклисту из CONSTITUTION.md §9

### Проверка

- [x] Новый разработчик по README поднимает проект за ≤15 мин
- [x] Все пункты §9 CONSTITUTION.md — ✅ (локально: MongoDB + Ollama + demo flow)

---

## Порядок веток и коммитов

Каждый этап — отдельная ветка. Внутри ветки допустимы несколько коммитов.

```
main
 ├── stage/0-infrastructure     → chore: scaffold monorepo + docker + shared types
 ├── stage/1-backend-skeleton    → feat(backend): fastify skeleton + healthcheck
 ├── stage/2-mongodb             → feat(backend): mongo repository + indexes
 ├── stage/3-ollama-services     → feat(backend): ollama vision + embed services
 ├── stage/4-langgraph-pipeline  → feat(backend): langgraph catalog pipeline
 ├── stage/5-api-endpoints       → feat(backend): items API endpoints
 ├── stage/6-frontend-skeleton   → feat(frontend): vite react ts skeleton + routing
 ├── stage/7-upload-polling      → feat(frontend): upload page with polling
 ├── stage/8-catalog-detail      → feat(frontend): catalog + item detail pages
 ├── stage/9-search              → feat: hybrid search (backend + frontend)
 └── stage/10-polish             → docs: README + polish
```

После каждой ветки: **подтверждение → merge в main → push**.

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| qwen2.5vl плохо генерирует JSON | Средняя | parseResponse с retry + regex fallback |
| OOM на 8 GB при vision | Средняя | mutex, одна задача; resize до 1024px |
| Ollama не запущен | Высокая | healthcheck + понятная ошибка в UI |
| Медленный cosine на >5k items | Низкая (MVP) | достаточно для MVP; vector index позже |
| CORS при dev | Средняя | Vite proxy + @fastify/cors |

---

## Definition of Done (MVP)

MVP считается завершённым когда:

1. Все 10 этапов пройдены
2. Чеклист CONSTITUTION.md §9 — полностью зелёный
3. Demo flow работает end-to-end:
   **Upload фото → LLM описание → каталог → поиск → detail page**
4. README позволяет воспроизвести setup
