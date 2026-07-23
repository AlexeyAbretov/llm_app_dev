# AGENTS.md — инструкции для AI-агента

## Проект

Локальный каталог объектов: upload фото → LLM (title + description) → MongoDB → text search.

## Документы

| Файл | Содержание |
|------|------------|
| [docs/CONSTITUTION.md](docs/CONSTITUTION.md) | Принципы, архитектура, API, schema |
| [docs/MVP_PLAN.md](docs/MVP_PLAN.md) | 10 этапов реализации с чеклистами |
| [.cursor/rules/](.cursor/rules/) | Правила для Cursor |

## Быстрый старт для агента

1. Прочитать `docs/CONSTITUTION.md` — понять scope и ограничения
2. Открыть `docs/MVP_PLAN.md` — найти текущий незавершённый этап
3. Реализовать только текущий этап, не забегая вперёд
4. Проверить чеклист этапа перед переходом к следующему

## Команды (будут добавлены при scaffold)

```bash
docker compose up -d mongo     # MongoDB
ollama serve                   # Ollama (на хосте, нужен GPU)
npm run dev                    # frontend + backend
npm run dev:backend            # только backend
npm run dev:frontend           # только frontend
```

## Железо

- RTX 4060 Laptop 8 GB — модели 7B, обработка по одной задаче
- Ollama на хосте (не в Docker) для доступа к GPU
