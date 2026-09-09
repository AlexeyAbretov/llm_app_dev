# AGENTS.md — инструкции для AI-агента

## Проект

Локальный каталог объектов: upload фото → LLM (title + description) → MongoDB → text search.

## Документы

| Файл | Содержание |
|------|------------|
| [docs/CONSTITUTION.md](docs/CONSTITUTION.md) | Принципы, архитектура, API, schema |
| [docs/MVP_PLAN.md](docs/MVP_PLAN.md) | Этапы каталога (`stage/N-…`) |
| [.cursor/rules/](.cursor/rules/) | Правила для Cursor |

## Быстрый старт для агента

1. Прочитать `docs/CONSTITUTION.md` — понять scope и ограничения
2. Каталог: `docs/MVP_PLAN.md`
3. Ветка от `main`: `stage/N-...`
4. Реализовать только текущий этап, не забегая вперёд
5. Push ветки → проверить чеклист → **ждать подтверждения** перед merge в `main`

## Git-workflow

- Один этап = одна ветка `stage/…`
- Merge в `main` **только после явного подтверждения** пользователя
- Подробнее: [CONSTITUTION.md §3](docs/CONSTITUTION.md#3-git-workflow)

## Команды

Пререквизиты (один раз):

```bash
npm install
cp .env.example .env
ollama pull qwen2.5vl:7b
ollama pull nomic-embed-text
ollama pull qwen2.5:0.5b       # перевод поискового запроса RU→EN
```

```bash
docker compose up -d mongo     # MongoDB
ollama serve                   # Ollama (на хосте, нужен GPU)
npm run dev                    # frontend + backend
npm run dev:backend            # только backend
npm run test:catalog-repo -w @llm-app/backend   # проверка CatalogRepository (нужен MongoDB)
npm run test:ollama -w @llm-app/backend         # Ollama vision/embed + parser (нужен ollama serve; test.jpg для E2E)
npm run test:ollama-health -w @llm-app/backend # checkHealth() с моком /api/tags (без Ollama)
npm run test:pipeline -w @llm-app/backend       # LangGraph pipeline (нужен MongoDB; для happy path — Ollama + test.jpg)
npm run test:api -w @llm-app/backend            # REST API items/search (inject + моки, без MongoDB)
npm run test:ollama-health -w @llm-app/backend  # checkHealth с моком fetch (без Ollama)
npm run reembed-catalog -w @llm-app/backend     # пересчитать embedding из embedText (нужны MongoDB + ollama)
npm run dev:frontend             # только frontend (Vite :5173, proxy /api → :3001)
```

## Железо

- RTX 4060 Laptop 8 GB — модели 7B, обработка по одной задаче
- Ollama на хосте (не в Docker) для доступа к GPU
