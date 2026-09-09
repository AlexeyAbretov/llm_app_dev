# Каталог объектов (LLM)

Локальное веб-приложение: загрузка фото → LLM генерирует заголовок и описание → MongoDB → текстовый поиск по каталогу.

## Требования

| Компонент | Версия / примечание |
|-----------|---------------------|
| **Node.js** | ≥ 20 |
| **Docker** | для MongoDB (`docker compose`) |
| **Ollama** | на хосте (не в Docker), нужен GPU; [ollama.com](https://ollama.com) |
| **GPU** | рекомендуется 8 GB VRAM (RTX 4060 и аналоги) |

Модели Ollama (скачать один раз):

```bash
ollama pull qwen2.5vl:7b
ollama pull nomic-embed-text
ollama pull qwen2.5:0.5b
```

## Быстрый старт

```bash
# 1. Зависимости
npm install
cp .env.example .env

# 2. MongoDB
docker compose up -d mongo

# 3. Ollama (в отдельном терминале, на хосте)
ollama serve

# 4. Приложение (frontend :5173 + backend :3001)
npm run dev
```

Откройте http://localhost:5173 — в шапке индикатор «Система готова», если MongoDB и Ollama доступны.

### Проверка health

```bash
curl -s http://localhost:3001/api/health | jq
# { "status": "ok", "mongo": true, "ollama": true }
```

`ollama: true` — Ollama отвечает и модели `qwen2.5vl:7b`, `nomic-embed-text` и `qwen2.5:0.5b` скачаны.

## Демо-сценарий MVP

1. **Загрузить** — страница «Загрузить», drag-and-drop фото (JPEG/PNG/WebP, до 10 МБ)
2. **Дождаться LLM** — статус `pending` → `processing` → `ready` (обычно ≤ 60 с)
3. **Каталог** — карточка с заголовком, тегами и превью
4. **Поиск** — ввести запрос (например, «ваза»), результат в top-5
5. **Детали** — клик по карточке → полное фото и описание

## Команды разработки

```bash
npm run dev              # backend + frontend
npm run dev:backend      # только API :3001
npm run dev:frontend     # только UI :5173 (proxy /api → backend)

# Тесты backend (см. AGENTS.md)
npm run test:api -w @llm-app/backend           # без MongoDB/Ollama
npm run test:catalog-repo -w @llm-app/backend # нужен MongoDB
npm run test:ollama -w @llm-app/backend        # нужен ollama serve + test.jpg
npm run test:pipeline -w @llm-app/backend      # MongoDB + Ollama для happy path
```

## Стек

React + TypeScript · Node.js + Fastify + LangGraph.js · Ollama · MongoDB

## Документация

- [Конституция проекта](docs/CONSTITUTION.md) — принципы, стек, критерии готовности MVP (§9)
- [План MVP](docs/MVP_PLAN.md) — этапы каталога (`stage/N-…`)
- [AGENTS.md](AGENTS.md) — команды и инструкции для AI-агента
