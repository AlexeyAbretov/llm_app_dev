# AGENTS.md — инструкции для AI-агента

## Проект

Локальный каталог объектов: upload фото → LLM (title + description) → MongoDB → text search.

## Документы

| Файл | Содержание |
|------|------------|
| [docs/CONSTITUTION.md](docs/CONSTITUTION.md) | Принципы, архитектура, API, schema |
| [docs/MVP_PLAN.md](docs/MVP_PLAN.md) | Этапы каталога (`stage/N-…`) |
| [docs/AGENT_PIPELINE.md](docs/AGENT_PIPELINE.md) | Контракт агентного пайплайна |
| [docs/AGENT_PIPELINE_PLAN.md](docs/AGENT_PIPELINE_PLAN.md) | Этапы пайплайна (`pipeline/N-…`) |
| [.cursor/rules/](.cursor/rules/) | Правила для Cursor |

## Быстрый старт для агента

1. Прочитать `docs/CONSTITUTION.md` — понять scope и ограничения
2. Каталог: `docs/MVP_PLAN.md`. Пайплайн агентов: `docs/AGENT_PIPELINE_PLAN.md`. Не смешивать треки в одной ветке.
3. Ветка от `main`: `stage/N-...` (каталог) или `pipeline/N-...` (процесс)
4. Реализовать только текущий этап, не забегая вперёд
5. Push ветки → проверить чеклист → **ждать подтверждения** перед merge в `main`

## Git-workflow

- Один этап каталога = одна ветка `stage/…`; один этап пайплайна = `pipeline/…`
- Merge в `main` **только после явного подтверждения** пользователя
- Подробнее: [CONSTITUTION.md §3](docs/CONSTITUTION.md#3-git-workflow)

## Команды (будут добавлены при scaffold)

```bash
docker compose up -d mongo     # MongoDB
ollama serve                   # Ollama (на хосте, нужен GPU)
npm run dev                    # frontend + backend
npm run dev:backend            # только backend
npm run dev:frontend           # только frontend
docker compose -f docker-compose.pipeline.yml up --build   # оркестратор, :3020/health
```

## Железо

- RTX 4060 Laptop 8 GB — модели 7B, обработка по одной задаче
- Ollama на хосте (не в Docker) для доступа к GPU
