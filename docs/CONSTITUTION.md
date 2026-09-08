# Конституция проекта: Каталог объектов

> Версия: 1.5 · Дата: 2026-09-08

## 1. Миссия

Локальное веб-приложение-каталог: пользователь загружает фото объекта, система автоматически генерирует заголовок и описание на русском языке, сохраняет данные в MongoDB, после чего по каталогу можно искать объекты текстовым запросом (keyword + semantic).

## 2. Неизменяемые принципы

| # | Принцип | Пояснение |
|---|-----------|-----------|
| P1 | **Локальность продукта** | Каталог, фото, MongoDB, Ollama и GPU работают на машине разработчика. Нет облачных LLM API для продукта. |
| P1a | **Процесс разработки** | GitHub и Cursor Cloud допустимы для issues/PR и агентов пайплайна. Код клонируется на VM Cursor. Runtime каталога и деплой остаются локальными. См. [AGENT_PIPELINE.md](./AGENT_PIPELINE.md). |
| P2 | **Русский язык** | UI, карточки (`title`, `description`, `tags`) и промпты vision — русский. Исключение: скрытое `embedText` и перевод поискового запроса — английский (nomic); в API и UI не отдаём. |
| P3 | **JavaScript end-to-end** | Backend и orchestration на Node.js. Python не используем. |
| P4 | **Простота MVP** | Сначала работающий happy path. Фичи вне scope MVP — в backlog, не в код. |
| P5 | **Async-by-default** | Vision LLM медленная (~10–30 с). Обработка асинхронная, UI показывает статус. |
| P6 | **Один GPU, последовательно** | RTX 4060 8 GB — vision и перевод запроса не параллелить (mutex). |
| P7 | **Типобезопасность** | TypeScript на фронте. Общие типы в `shared/`. Backend — TypeScript или JSDoc + Zod. |
| P8 | **Минимальный diff** | Каждый PR/шаг решает одну задачу. Без over-engineering. |
| P9 | **Ветка на этап** | Каталог — `stage/N-…`, пайплайн — `pipeline/N-…`. Merge в `main` только после явного подтверждения пользователя. |

## 3. Git-workflow

### 3.1 Основные правила

- **`main`** — стабильная ветка; только проверенный и подтверждённый код
- **Один этап = одна ветка** — каталог: `stage/N-…`; пайплайн: `pipeline/N-…`; не смешивать в одной ветке
- **Merge только после подтверждения** — агент/разработчик не мержит в `main` без явного «ок» от пользователя
- **Следующий этап** — новая ветка от актуального `main` (после merge предыдущего)

### 3.2 Именование веток

Каталог (MVP продукта):

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

Агентный пайплайн (процесс GitHub + Cursor + локальный деплой):

```
pipeline/<номер>-<краткое-имя>
```

Таблица этапов: [AGENT_PIPELINE_PLAN.md](./AGENT_PIPELINE_PLAN.md).

### 3.3 Жизненный цикл этапа

```
main ──► stage/N-... или pipeline/N-... ──► коммиты ──► push ──► проверка
                                                              │
                                                    подтверждение пользователя
                                                              │
                                                              ▼
                                                    merge в main ──► push main
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

1. Все пункты **«Проверка»** текущего этапа из [MVP_PLAN.md](./MVP_PLAN.md) или [AGENT_PIPELINE_PLAN.md](./AGENT_PIPELINE_PLAN.md) выполнены
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
│             Vision:  qwen2.5vl:7b               │
│             Embed:   nomic-embed-text             │
│             Translate: qwen2.5:0.5b (поиск)     │
├─────────────────────────────────────────────────┤
│  DB:        MongoDB 7 (local, порт 27017)       │
│  Files:     GridFS или uploads/ на диске        │
└─────────────────────────────────────────────────┘
```

### Ограничения железа

- **GPU:** NVIDIA RTX 4060 Laptop, 8 GB VRAM
- **Модели:** только 7B-класс в квантизации (Q4/Q5)
- **Очередь:** одна GPU-задача chat (vision / translate) за раз (mutex)

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
| **qwen2.5vl:7b** | Multimodal (vision) в библиотеке Ollama; наследник снятого `qwen2-vl:7b`; русский; 7B в Q4 на 8 GB VRAM; нужен Ollama ≥ 0.7.0 | llava:7b — слабее с русским; llama3.2-vision:11b — впритык по VRAM; GPT-4V API — облако; модели 13B+ — OOM на RTX 4060 Laptop |
| **nomic-embed-text** | 768 dims, быстрая (~1 с), доступна в Ollama; префиксы `search_document:` / `search_query:`; эмбеддим английский `embedText`, не русские карточки | sentence-transformers — отдельный Python runtime; OpenAI embeddings — облако; CLIP embeddings — другой semantic space, хуже для text search |
| **qwen2.5:0.5b** | Перевод поискового запроса RU→EN (~0.5B, мало VRAM). Не 7B vision на каждый поиск | Перевод 7B vision — слишком дорого; без перевода nomic плохо матчит русский запрос с английским `embedText` |
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
         → Ollama vision → { title, description, tags, embedText }
         → Ollama embed(embedText) → float[]
         → update doc (status: ready)
     ← 202 Accepted { id, status }

User → GET /api/items/:id (polling пока processing)
     ← { id, title, description, tags, imageUrl, status }
```

### 6.3 Поток данных: поиск

```
User → GET /api/search?q=красная ваза
     → translate q RU→EN (qwen2.5:0.5b; английский запрос не трогаем)
     → embed English query (nomic search_query:)
     → cosine similarity vs catalog embeddings (без min-max по cosine)
     → $text по исходному RU и по English; merge keyword (max score)
     → hybrid: 0.7 * cosine + 0.3 * min-max($text)
     ← [{ item, score }, ...]   // item без embedding и embedText
```

### 6.4 LangGraph pipeline (узлы)

| Узел | Вход | Выход | Retry |
|------|------|-------|-------|
| `validate` | file buffer | ok / error | — |
| `saveImage` | buffer | imagePath, imageId | — |
| `visionLLM` | imagePath | title, description, tags, embedText | 2× |
| `parseResponse` | raw LLM text | validated JSON | 1× |
| `embed` | embedText (EN) | float[] | 2× |
| `saveDB` | all fields | mongoId | — |

### 6.5 MongoDB: коллекция `catalog_items`

```typescript
interface CatalogItem {
  _id: ObjectId;
  title: string;          // RU, для UI
  description: string;    // RU, для UI
  tags: string[];         // RU, для UI
  embedText: string;      // EN, скрыто; nomic + $text; в API не отдаём
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
- `{ title: 'text', description: 'text', tags: 'text', embedText: 'text' }` (`default_language: 'none'`)
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

## 8. Промпт vision LLM (v5)

```
Ты заполняешь карточку объекта в каталоге. На входе картинка. Описывай ОБЪЕКТ (вещь, существо, растение, место), не кадр.

Верни только JSON:
{
  "title": "русский заголовок до 80 символов",
  "description": "2–4 предложения по-русски про объект",
  "tags": ["тег1", "тег2", "тег3"],
  "embedText": "English search text: class, type, distinctive features"
}

title, description, tags — только русский. Факты об объекте: тип, цвет, материал, форма. Не описывай съёмку.
embedText — только английский, для поиска. Класс (animal, person, building, plant, vessel, clothing) + конкретный тип (house, macaque, …) + признаки. Без photo/image/close-up.

Запрещено везде: изображение, фото, фотография, снимок, кадр, крупный план, photo, photograph, image, close-up.

Плохо: "Изображение обезьяны. Фотография сделана в крупном плане."
Хорошо: {"title":"Макака с красными губами","description":"Макака с ярко-красными губами и янтарными глазами. Шерсть серо-коричневая, морда вытянута вперёд.","tags":["макака","обезьяна","животные","губы"],"embedText":"macaque monkey animal bright red lips amber eyes grey-brown fur"}

tags: 3–7 существительных в нижнем регистре.
Ответ: только JSON, без markdown.
```

## 9. Критерии готовности MVP

- [ ] `docker compose up` поднимает MongoDB
- [ ] Ollama с `qwen2.5vl:7b`, `nomic-embed-text` и `qwen2.5:0.5b` отвечает на `/api/health` (health проверяет Ollama; translate — для поиска)
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

- [MVP Plan](./MVP_PLAN.md) — пошаговый план каталога
- [Агентный пайплайн](./AGENT_PIPELINE.md) — контракт процесса
- [Запуск пайплайна](./AGENT_PIPELINE_SETUP.md) — с нуля: Docker, ключи, labels
- [План пайплайна](./AGENT_PIPELINE_PLAN.md) — этапы `pipeline/N-…`
- [LangGraph.js](https://langchain-ai.github.io/langgraphjs/)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
