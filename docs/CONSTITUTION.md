# Конституция проекта: Каталог объектов

> Версия: 1.2 · Дата: 2026-07-23

## 1. Миссия

Локальное веб-приложение-каталог: пользователь загружает фото объекта, система автоматически генерирует заголовок и описание на русском языке, сохраняет данные в MongoDB, после чего по каталогу можно искать объекты текстовым запросом (keyword + semantic).

## 2. Неизменяемые принципы

| # | Прinciple | Пояснение |
|---|-----------|-----------|
| P1 | **Локальность** | Все компоненты работают на машине разработчика. Нет облачных API, нет отправки данных наружу. |
| P2 | **Русский язык** | UI, промпты LLM, генерируемый контент — только русский. |
| P3 | **JavaScript end-to-end** | Backend и orchestration на Node.js. Python не используем. |
| P4 | **Простота MVP** | Сначала работающий happy path. Фичи вне scope MVP — в backlog, не в код. |
| P5 | **Async-by-default** | Vision LLM медленная (~10–30 с). Обработка асинхронная, UI показывает статус. |
| P6 | **Один GPU, последовательно** | RTX 4060 8 GB — vision и embedding не запускаем параллельно. |
| P7 | **Типобезопасность** | TypeScript на фронте. Общие типы в `shared/`. Backend — TypeScript или JSDoc + Zod. |
| P8 | **Минимальный diff** | Каждый PR/шаг решает одну задачу. Без over-engineering. |
| P9 | **Ветка на этап** | Каждый этап MVP — отдельная git-ветка. Merge в `main` только после явного подтверждения пользователя. |

## 3. Git-workflow

### 3.1 Основные правила

- **`main`** — стабильная ветка; только проверенный и подтверждённый код
- **Один этап MVP = одна ветка** — вся работа этапа ведётся только в ней
- **Merge только после подтверждения** — агент/разработчик не мержит в `main` без явного «ок» от пользователя
- **Следующий этап** — новая ветка от актуального `main` (после merge предыдущего)

### 3.2 Именование веток

```
stage/<номер>-<краткое-имя>
```

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

### 3.3 Жизненный цикл этапа

```
main ──► stage/N-... ──► коммиты ──► push ──► проверка чеклиста
                                              │
                                    подтверждение пользователя
                                              │
                                              ▼
                                    merge в main ──► push main
                                              │
                                              ▼
                                    stage/N+1-... (от main)
```

### 3.4 Команды (шаблон)

```bash
# Начало этапа N
git checkout main
git pull origin main
git checkout -b stage/N-short-name

# Работа на этапе — один или несколько коммитов
git add .
git commit -m "feat(stage-N): описание"
git push -u origin stage/N-short-name

# После подтверждения пользователя
git checkout main
git pull origin main
git merge stage/N-short-name
git push origin main

# Опционально: удалить ветку этапа
git branch -d stage/N-short-name
git push origin --delete stage/N-short-name
```

### 3.5 Критерий merge

Merge в `main` допустим когда:

1. Все пункты **«Проверка»** текущего этапа из [MVP_PLAN.md](./MVP_PLAN.md) выполнены
2. Пользователь явно подтвердил: «мержим», «этап готов», «ok» и т.п.
3. Нет незакоммиченных изменений

## 4. Scope MVP

### В scope

- Загрузка одного изображения (JPEG, PNG, WebP)
- LangGraph.js-пайплайн: validate → save → vision → embed → save DB
- Карточка объекта: фото, заголовок, описание, теги, дата
- Каталог (grid/list) с пагинацией
- Текстовый поиск: keyword (`$text`) + semantic (cosine similarity по embedding)
- Async-статусы: `pending` → `processing` → `ready` | `failed`
- Docker Compose: MongoDB + Ollama (опционально для dev)

### Вне scope MVP (backlog)

- Поиск по загруженному фото
- Batch upload
- Редактирование title/description в UI
- Авторизация и multi-user
- Atlas Vector Search / отдельный vector DB
- Мобильное приложение
- Экспорт / импорт каталога

## 5. Технологический стек

```
┌─────────────────────────────────────────────────┐
│  Frontend:  React 18 + TypeScript + Vite        │
│             TanStack Query, React Router        │
│             Tailwind CSS                        │
├─────────────────────────────────────────────────┤
│  Backend:   Node.js + Fastify                   │
│             LangGraph.js (@langchain/langgraph) │
│             Zod (валидация)                     │
├─────────────────────────────────────────────────┤
│  AI:        Ollama (localhost:11434)            │
│             Vision:  qwen2-vl:7b                │
│             Embed:   nomic-embed-text             │
├─────────────────────────────────────────────────┤
│  DB:        MongoDB 7 (local, порт 27017)       │
│  Files:     GridFS или uploads/ на диске        │
└─────────────────────────────────────────────────┘
```

### Ограничения железа

- **GPU:** NVIDIA RTX 4060 Laptop, 8 GB VRAM
- **Модели:** только 7B-класс в квантизации (Q4/Q5)
- **Очередь:** одна vision-задача за раз (mutex/semaphore)

### 5.1 Обоснование выбора технологий

Для каждого компонента — зачем выбран, какие альтернативы рассматривались и почему отклонены.

#### Frontend

| Технология | Почему выбрана | Альтернативы и почему нет |
|------------|---------------|---------------------------|
| **React 18** | Самая распространённая UI-библиотека; огромная экосистема; хорошо работает с async/polling через TanStack Query | Vue/Svelte — меньше готовых решений под наш стек; Angular — избыточен для MVP |
| **TypeScript** | Единый язык с backend; типы ловят ошибки на этапе компиляции; общие типы с `shared/` без дублирования | Plain JS — быстрее старт, но больше runtime-багов при росте API-контракта |
| **Vite** | Мгновенный HMR, быстрая сборка, минимальный конфиг | CRA — deprecated; Webpack — медленнее dev-сборка без выигрыша для нас |
| **TanStack Query** | Кэш, polling (`refetchInterval`), dedup запросов — идеально для async-обработки LLM (статусы `processing`) | Redux/Zustand для server state — лишний boilerplate; SWR — слабее экосистема mutations |
| **React Router** | Стандарт де-факто для SPA; declarative routing, lazy loading страниц | TanStack Router — меньше community; file-based routing (Next.js) — SSR не нужен для local app |
| **Tailwind CSS** | Utility-first: быстрая вёрстка grid/list/upload без написания CSS-файлов | MUI — тяжелее bundle, «material»-look; CSS Modules — медленнее итерации UI |

#### Backend

| Технология | Почему выбрана | Альтернативы и почему нет |
|------------|---------------|---------------------------|
| **Node.js** | Один язык (JS/TS) на фронте и бэке; LangGraph.js нативно на Node; async I/O для upload + LLM polling | Python — отличный для ML, но пользователь выбрал JS end-to-end; Deno/Bun — меньше совместимости с LangChain-экосистемой |
| **Fastify** | Быстрее Express; встроенная JSON-schema валидация; `@fastify/multipart` для upload; низкий overhead | Express — медленнее, устаревший DX; NestJS — over-engineering для MVP; Hono — молодой, меньше plugin-экосистема |
| **LangGraph.js** | Явный граф с узлами, conditional edges, retry — pipeline upload→vision→embed→save сложнее простого `await`-chain; state machine из коробки; визуализация потока | Plain async functions — retry/error handling размазывается; Temporal/Inngest — внешние зависимости, overkill для local MVP; Python LangGraph — другой runtime |
| **Zod** | Runtime-валидация env, LLM JSON, API input/output; infer TypeScript types из schema | Joi/Yup — хуже TS inference; class-validator — нужны декораторы, тяжелее |
| **TypeScript (backend)** | Типы shared с frontend; автокомплит в IDE; меньше ошибок при работе с MongoDB documents | Plain JS + JSDoc — допустимо, но хуже DX при росте проекта |

#### AI / ML

| Технология | Почему выбрана | Альтернативы и почему нет |
|------------|---------------|---------------------------|
| **Ollama** | Простейший запуск локальных LLM; REST API из Node; управление моделями (`pull`); GPU из коробки на Windows | LM Studio — нет headless API для automation; llama.cpp напрямую — больше низкоуровневой работы; OpenAI/Claude API — нарушает принцип локальности (P1) |
| **qwen2-vl:7b** | Multimodal (vision); хорошо понимает русский; 7B в Q4 помещается в 8 GB VRAM (~5–6 GB); адекватное качество title/description | llava:7b — слабее с русским; llama3.2-vision:11b — впритык по VRAM на 8 GB; GPT-4V API — облако; модели 13B+ — OOM на RTX 4060 Laptop |
| **nomic-embed-text** | 768 dims, быстрая (~1 с), доступна в Ollama; одна инфраструктура (Ollama) для vision и embed | sentence-transformers — отдельный Python runtime; OpenAI embeddings — облако; CLIP embeddings — другой semantic space, хуже для text search |
| **Ollama на хосте (не Docker)** | Docker на Windows не пробрасывает GPU в контейнер без WSL2 + NVIDIA toolkit; Ollama natively видит RTX 4060 | Ollama in Docker — сложная GPU-настройка; CPU-only — vision 2–5 мин вместо 10–30 с |

#### Хранение данных

| Технология | Почему выбрана | Альтернативы и почему нет |
|------------|---------------|---------------------------|
| **MongoDB 7** | Document model идеален для catalog items (вложенный image, tags, embedding); `$text` search из коробки; локальный запуск одной командой | PostgreSQL + pgvector — мощнее для relational, но schema migrations тяжелее для MVP; SQLite — нет `$text` на arrays, слабее для catalog; JSON-файлы — нет индексов, нет search |
| **Embedding в документе** | Простота: один запрос → все данные; cosine в Node достаточно до ~10k объектов | Отдельный vector DB (Qdrant, Chroma) — лишний сервис для MVP; MongoDB Atlas Vector Search — облако, нарушает P1 |
| **uploads/ на диске** | Простейший вариант для MVP; Fastify static раздаёт файлы; не нужен GridFS driver | GridFS — оправдан при >16 MB файлах или репликации; S3/MinIO — overkill для local single-user |
| **Docker Compose (только MongoDB)** | Воспроизводимое окружение БД; один `docker compose up`; volume для persistence | MongoDB installed locally — работает, но сложнее onboarding; cloud MongoDB — нарушает P1 |

#### Инфраструктура проекта

| Технология | Почему выбрана | Альтернативы и почему нет |
|------------|---------------|---------------------------|
| **Monorepo (npm workspaces)** | `shared/types` без publish; одна `npm install`; согласованные версии | Отдельные repos — overhead для solo/small project; Turborepo/Nx — overkill на 3 пакета |
| **shared/** | Единый контракт `CatalogItem`, `ProcessingStatus` для frontend и backend; изменение в одном месте | Codegen из OpenAPI — позже, если API усложнится; дублирование типов — рассинхрон |

#### Паттерны и подходы

| Решение | Почему выбрано | Альтернативы и почему нет |
|---------|---------------|---------------------------|
| **Async pipeline + polling** | Vision LLM 10–30 с; HTTP upload не может блокироваться; UI показывает прогресс | SSE/WebSocket — сложнее; sync response — timeout, плохой UX |
| **Hybrid search (0.7 semantic + 0.3 keyword)** | Semantic находит «красный сосуд» → «ваза»; keyword ловит точные совпадения в title | Только `$text` — не понимает синонимы; только vector — промахивается по exact match |
| **In-memory queue** | Одна GPU, одна задача; не нужен Redis/Bull для MVP | Bull + Redis — лишняя зависимость; cron — не event-driven |
| **JSON parse + retry (не structured output)** | Ollama structured output нестабилен между моделями; Zod + retry покрывает 95% случаев | Function calling — не все local models поддерживают; regex-only — хрупко |

## 6. Архитектура

### 6.1 Структура monorepo

```
llm_app_dev/
├── frontend/          # React + TS (Vite)
├── backend/           # Node.js + Fastify + LangGraph.js
├── shared/            # Общие TypeScript-типы и константы
├── docs/              # Документация (этот файл, MVP plan)
├── docker-compose.yml
└── .cursor/rules/     # Правила для AI-агента
```

### 6.2 Поток данных: загрузка

```
User → POST /api/items (multipart)
     → save file + create doc (status: pending)
     → enqueue LangGraph job (status: processing)
         → validate image
         → Ollama vision → { title, description, tags }
         → Ollama embed  → float[]
         → update doc (status: ready)
     ← 202 Accepted { id, status }

User → GET /api/items/:id (polling пока processing)
     ← { id, title, description, tags, imageUrl, status }
```

### 6.3 Поток данных: поиск

```
User → GET /api/search?q=красная ваза
     → embed query (Ollama nomic-embed-text)
     → cosine similarity vs catalog embeddings
     → merge с $text score (hybrid, вес 0.7/0.3)
     ← [{ item, score }, ...]
```

### 6.4 LangGraph pipeline (узлы)

| Узел | Вход | Выход | Retry |
|------|------|-------|-------|
| `validate` | file buffer | ok / error | — |
| `saveImage` | buffer | imagePath, imageId | — |
| `visionLLM` | imagePath | title, description, tags | 2× |
| `parseResponse` | raw LLM text | validated JSON | 1× |
| `embed` | title+desc+tags | float[] | 2× |
| `saveDB` | all fields | mongoId | — |

### 6.5 MongoDB: коллекция `catalog_items`

```typescript
interface CatalogItem {
  _id: ObjectId;
  title: string;
  description: string;
  tags: string[];
  image: {
    storage: 'gridfs' | 'disk';
    ref: string;          // GridFS id или относительный path
    mime: string;
    originalName: string;
  };
  embedding: number[];    // 768 dims (nomic-embed-text)
  status: 'pending' | 'processing' | 'ready' | 'failed';
  error?: string;
  llm: {
    visionModel: string;
    embedModel: string;
    promptVersion: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Индексы:**
- `{ title: 'text', description: 'text', tags: 'text' }`
- `{ status: 1, createdAt: -1 }`
- `{ createdAt: -1 }`

## 7. API контракт (MVP)

| Method | Path | Описание |
|--------|------|----------|
| `POST` | `/api/items` | Upload image → `{ id, status }` |
| `GET` | `/api/items/:id` | Получить объект |
| `GET` | `/api/items` | Список (`?page=1&limit=20`) |
| `GET` | `/api/search` | Поиск (`?q=...&limit=20`) |
| `GET` | `/api/health` | Healthcheck (mongo + ollama) |

## 8. Промпт vision LLM (v1)

```
Ты — помощник для каталога объектов. Посмотри на изображение и верни JSON:

{
  "title": "краткий заголовок до 80 символов",
  "description": "описание объекта в 2–4 предложениях",
  "tags": ["тег1", "тег2", "тег3"]
}

Правила:
- Язык: только русский
- title — конкретный, без «изображение» / «фото»
- tags — 3–7 существительных в нижнем регистре
- Ответ: только JSON, без markdown
```

## 9. Критерии готовности MVP

- [ ] `docker compose up` поднимает MongoDB
- [ ] Ollama с `qwen2-vl:7b` и `nomic-embed-text` отвечает на `/api/health`
- [ ] Upload фото → через ≤60 с объект в статусе `ready` с осмысленным title/description
- [ ] Каталог показывает все `ready` объекты
- [ ] Поиск «ваза» находит загруженную вазу в top-5
- [ ] При ошибке LLM объект переходит в `failed` с сообщением
- [ ] Frontend на русском, без английских placeholder-текстов

## 10. Решения, которые сознательно отложены

| Решение | Почему отложено |
|---------|-----------------|
| Vector index в MongoDB | Cosine в Node достаточно до ~10k объектов |
| Очередь (Bull/Redis) | In-memory queue достаточно для MVP |
| Auth | Single-user local app |
| Image resize | Добавим если LLM будет падать на больших файлах |
| Structured output API Ollama | JSON-парсинг с retry проще для старта |

## 11. Ссылки

- [MVP Plan](./MVP_PLAN.md) — пошаговый план реализации
- [LangGraph.js](https://langchain-ai.github.io/langgraphjs/)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
