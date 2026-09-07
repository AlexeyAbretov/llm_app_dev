# Каталог объектов (LLM)

Локальное веб-приложение: загрузка фото → LLM генерирует заголовок и описание → MongoDB → текстовый поиск по каталогу.

## Документация

- [Конституция проекта](docs/CONSTITUTION.md) — принципы, стек, архитектура
- [План MVP](docs/MVP_PLAN.md) — этапы каталога (`stage/N-…`)
- [Агентный пайплайн](docs/AGENT_PIPELINE.md) — контракт: GitHub, роли, апрув, UI
- [Запуск пайплайна с нуля](docs/AGENT_PIPELINE_SETUP.md) — Docker, ключи, labels, проверка
- [План пайплайна](docs/AGENT_PIPELINE_PLAN.md) — этапы `pipeline/N-…`

## Оркестратор пайплайна

Пошагово: [docs/AGENT_PIPELINE_SETUP.md](docs/AGENT_PIPELINE_SETUP.md).

```powershell
copy pipeline\.env.example pipeline\.env
# вписать GITHUB_TOKEN и CURSOR_API_KEY в pipeline/.env
docker compose -f docker-compose.pipeline.yml up --build -d
# http://127.0.0.1:3020/health
```

## Стек

React + TypeScript · Node.js + Fastify + LangGraph.js · Ollama · MongoDB

## Статус

🚧 В разработке — документация и план MVP готовы, код в процессе.
