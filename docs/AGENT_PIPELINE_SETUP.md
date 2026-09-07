# Запуск агентного пайплайна с нуля

Контракт (роли, labels): [AGENT_PIPELINE.md](./AGENT_PIPELINE.md).  
Этапы разработки: [AGENT_PIPELINE_PLAN.md](./AGENT_PIPELINE_PLAN.md).

Сейчас из коробки поднимаются **P0–P3**: оркестратор в Docker, поллинг GitHub, Cursor Cloud **аналитик**, метки `ready-for-dev` / `needs-human`. Разработчик, тесты, релиз и локальный деплой каталога — ещё не в коде.

Каталог объектов (Ollama, MongoDB) **не нужен**, чтобы запустить оркестратор.

---

## Что должно получиться

1. Контейнер слушает `http://127.0.0.1:3020/health` → `{"status":"ok"}`.
2. На GitHub создаёте issue с labels `feature` (или `bug`) **и** `needs-plan`.
3. В течение ~30 с оркестратор стартует Cursor Cloud, пишет комментарий с `agentId` / `runId`.
4. После ответа аналитика снимается `needs-plan`, ставится `ready-for-dev` или `needs-human`.

Повторный полл ту же пару `(issue, analyst)` не запускает — состояние в volume `jobs.json`.

---

## 0. Требования

- Docker Desktop (Windows) или Docker Engine + Compose v2.
- Репозиторий на **вашем** GitHub (owner), не только collaborator. Cloud Agents видят репо через GitHub App владельца. Сейчас в примере: `AlexeyAbretov/llm_app_dev`, ветка `main`.
- Аккаунт Cursor, у которого в Cloud Agents в **Default Repository** виден этот репо.
- Регион, где Cursor Cloud Agents разрешены (иначе `Cursor is not available in your region`).
- Исходящий HTTPS с машины: `api.github.com`, API Cursor. Входящий туннель не нужен.

---

## 1. Клон и ветка

```powershell
git clone https://github.com/AlexeyAbretov/llm_app_dev.git
cd llm_app_dev
git checkout main
```

Код оркестратора: `pipeline/`, compose: `docker-compose.pipeline.yml`.

---

## 2. Labels на GitHub

Issues → Labels. Создайте, если нет (имена **точно** такие):

| Имя | Зачем |
|-----|--------|
| `bug` | тип |
| `feature` | тип |
| `needs-plan` | очередь аналитика |
| `ready-for-dev` | план принят |
| `needs-human` | стоп автоматики |
| `p0` … `p3` | приоритет (по желанию) |

Без `ready-for-dev` / `needs-human` API постановки меток вернёт ошибку.

Шаблон issue: `.github/ISSUE_TEMPLATE/task.yml` (ставит `needs-plan`; `feature`/`bug` всё равно поставьте вручную).

---

## 3. GitHub PAT (`GITHUB_TOKEN`)

Это **секрет токена**, не номер issue.

1. GitHub (тот же owner, что у репо) → Settings → Developer settings → **Personal access tokens** → Fine-grained.
2. Resource owner — владелец репо. Repository access — **Only select** → `llm_app_dev`.
3. Repository permissions: **Issues → Read and write**. Metadata — Read.
4. Скопируйте значение (`github_pat_...`).

Проверка (токен только в своём терминале):

```powershell
gh api repos/AlexeyAbretov/llm_app_dev/issues/1/comments -f body="test"
```

`403 Resource not accessible by personal access token` = нет Issues **Write** или токен от другого аккаунта / не тот репозиторий.

---

## 4. Cursor API (`CURSOR_API_KEY`)

Не страница Integrations (GitHub/Linear). Ключ:

**[cursor.com/dashboard/api](https://cursor.com/dashboard/api)** → API Keys → New API Key.

В `.env` — **значение** (`crsr_...` или `cursor_...`), не отображаемое имя ключа.

Тот же аккаунт Cursor:

1. [Integrations](https://cursor.com/dashboard/integrations) → **Connect GitHub** аккаунтом **владельца** репо.
2. GitHub App Cursor: доступ к `llm_app_dev` (All или Only select).
3. Cloud Agents → Default Repository — репо в списке. Чужие репы, где вы только collaborator, **не появятся**.

`CURSOR_MODEL` по умолчанию `composer-2.5` (как в `.env.example`).

---

## 5. Файл `.env` в корне репозитория

Compose подставляет `GITHUB_TOKEN` и остальные из **корня** проекта (файл `.env` рядом с `docker-compose.pipeline.yml`). Файл `pipeline/.env` **перебивается** пустыми значениями, если в корне нет переменных.

```powershell
copy pipeline\.env.example .env
```

Заполните:

```
GITHUB_TOKEN=<секрет PAT>
GITHUB_REPO=AlexeyAbretov/llm_app_dev
CURSOR_API_KEY=<секрет ключа Cursor>
CURSOR_REPO_URL=https://github.com/AlexeyAbretov/llm_app_dev
CURSOR_STARTING_REF=main
```

`.env` в git не коммитить (уже в `.gitignore`).

Если репозиторий или ветка другие — поменяйте `GITHUB_REPO`, `CURSOR_REPO_URL`, `CURSOR_STARTING_REF` (имя ветки должно существовать на GitHub).

---

## 6. Запуск Docker

Из корня репозитория:

```powershell
docker compose -f docker-compose.pipeline.yml up --build -d
```

Проверка:

```powershell
# PowerShell
Invoke-RestMethod http://127.0.0.1:3020/health
docker compose -f docker-compose.pipeline.yml logs -f orchestrator
```

Ожидаемые логи без issue: `poll tick`, без `GITHUB_TOKEN or GITHUB_REPO empty`.

После правки `.env`:

```powershell
docker compose -f docker-compose.pipeline.yml up -d --force-recreate
```

Остановка:

```powershell
docker compose -f docker-compose.pipeline.yml down
```

Volume `llm_app_dev_pipeline_data` хранит `jobs.json` (очередь). `down` его **не** удаляет.

---

## 7. Первая задача

1. New issue, шаблон «Задача пайплайна» или вручную.
2. Labels: **`feature` или `bug`** + **`needs-plan`**. Одного `needs-plan` недостаточно.
3. Описание: цель и критерий готовности (для проверки «вне MVP» напишите авторизацию / поиск по фото).
4. Ждите ≤ `POLL_INTERVAL_MS` (по умолчанию 30 с).

В логах: `cursor agent starting` → `cursor run started` (есть `agentId` `bc-…`) → `cursor run finished` → `labels: -needs-plan +ready-for-dev` или `+needs-human`.

В issue — комментарии пайплайна и (обычно) план от агента. В Cursor Web агенты SDK: Filter → Source → **SDK**.

---

## 8. Сброс очереди (`jobs.json`)

Одна пара `(номер issue, роль analyst)` запускается один раз. Чтобы прогнать ту же issue снова:

```powershell
docker compose -f docker-compose.pipeline.yml exec orchestrator rm -f /data/jobs.json
```

Или volume:

```powershell
docker compose -f docker-compose.pipeline.yml down
docker volume rm llm_app_dev_pipeline_data
docker compose -f docker-compose.pipeline.yml up -d
```

Пока висит `needs-plan`, после сброса аналитик стартует снова. Чтобы не жечь квоту Cursor — снимите `needs-plan`.

Очередь — **все** открытые issue с `needs-plan` (не фильтр GitHub `since`). Если агент «не видит» задачу с нужными labels, не обязательно трогать `jobs.json`: достаточно следующего тика после пересборки с этим поведением.

---

## 9. Частые ошибки

| Симптом | Что делать |
|---------|------------|
| `poll skip: GITHUB_TOKEN or GITHUB_REPO empty` | Ключи в **корневом** `.env`, затем `--force-recreate` |
| `GitHub comment 403` / labels 403 | PAT: Issues **Read and write**, owner = текущий репо |
| `Cursor is not available in your region` | Cloud Agents недоступны с этого IP/аккаунта; оркестратор тут ни при чём |
| `Failed to verify existence of branch 'main'` | Ветка есть на GitHub; Cursor GitHub App видит **этот** репо (owner, не collaborator) |
| `resource_exhausted` retryable=true | Лимит Cloud Agents / Usage; подождать, не чистить `jobs.json` в цикле |
| Агент не стартует, только `needs-plan` | Добавьте `feature` или `bug` |
| Метка не ставится, label 404/422 | Создайте `ready-for-dev` и `needs-human` в репо |
| Повторно не берёт issue | Так задумано, если job уже есть; сброс `jobs.json` |
| Issue с `feature`+`needs-plan` «не подхватывается» | Старый баг: фильтр `since`. Нужна версия без `since` + пересборка compose. Не обязательно комментировать issue |
| `agentId` пустой, сразу `cursor run failed` | Смотреть текст `Ошибка:` в комментарии issue или `exec cat /data/jobs.json` |

---

## 10. Что ещё не запускается

- Разработчик (PR), тестировщик, релиз-менеджер, локальный deployer каталога.
- UI оркестратора.
- Каталог: `docker compose up` MongoDB / `ollama serve` — отдельный трек, [MVP_PLAN.md](./MVP_PLAN.md).

Промпты ролей: `pipeline/prompts/`.
