# Каталог объектов (LLM)

Локальное веб-приложение: загрузка фото → LLM генерирует заголовок и описание → MongoDB → текстовый поиск по каталогу.

## Документация

- [Конституция проекта](docs/CONSTITUTION.md) — принципы, стек, архитектура
- [План MVP](docs/MVP_PLAN.md) — этапы каталога (`stage/N-…`)
- [Агентный пайплайн](docs/AGENT_PIPELINE.md) — контракт: GitHub, роли, апрув, UI
- [План пайплайна](docs/AGENT_PIPELINE_PLAN.md) — этапы `pipeline/N-…`

## Оркестратор пайплайна

```bash
copy pipeline\.env.example pipeline\.env   # Windows
docker compose -f docker-compose.pipeline.yml up --build
# http://127.0.0.1:3020/health
```

## Стек

React + TypeScript · Node.js + Fastify + LangGraph.js · Ollama · MongoDB

## Статус

🚧 В разработке — документация и план MVP готовы, код в процессе.
