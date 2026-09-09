# Changelog

## 1.0.0 — 2026-09-09

Первый релиз каталога объектов. MVP (этапы 0–11) завершён; [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) заморожен.

### Возможности

- Загрузка одного фото (JPEG, PNG, WebP, до 10 МБ) → async-пайплайн LangGraph
- Vision LLM (`qwen2.5vl:7b`): заголовок, описание и теги на русском
- Embeddings (`nomic-embed-text`) по скрытому английскому `embedText`
- Каталог с пагинацией, карточка объекта, текстовый hybrid-поиск (перевод запроса `qwen2.5:0.5b`)
- Фото в GridFS (MongoDB Docker volume); скрипт миграции legacy `disk` → GridFS
- Healthcheck: MongoDB + три модели Ollama

### Локальный запуск

См. [README.md](README.md). Demo: upload → LLM → каталог → поиск → detail.
