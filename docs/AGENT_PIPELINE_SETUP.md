# Запуск агентного пайплайна с нуля

Контракт (роли, labels): [AGENT_PIPELINE.md](./AGENT_PIPELINE.md).  
Этапы разработки: [AGENT_PIPELINE_PLAN.md](./AGENT_PIPELINE_PLAN.md).

Сейчас из коробки поднимаются **P0–P7**: оркестратор, роли Cloud до релиз-менеджера, локальный **deployer** (поллинг published Release). UI оркестратора и цикл QA (P8) — позже.

Каталог объектов (Ollama, MongoDB) **не нужен**, чтобы запустить оркестратор.

---

## Что должно получиться

1. Контейнер слушает `http://127.0.0.1:3020/health` → `{"status":"ok"}`.
2. На GitHub создаёте issue с labels `feature` (или `bug`) **и** `needs-plan`.
3. В течение ~30 с оркестратор стартует Cursor Cloud, пишет комментарий с `agentId` / `runId`.
4. После ответа аналитика: комментарий со статусом, **отдельный комментарий с текстом плана**, снимается `needs-plan`, ставится `ready-for-dev` или `needs-human`.
5. На `ready-for-dev` стартует разработчик (`in-dev`). После открытого PR `Fixes #N` — `in-qa` (не merge в `main`).
6. На `in-qa` стартует тестировщик (ревью ветки PR). CI: workflow `.github/workflows/ci.yml`, job `ci`.
7. На `qa-passed` стартует релиз-менеджер → draft Release, assignee owner, request review, `ready-for-release`. Publish / merge — после вашей метки `release-approved`, вручную.
8. После **Publish** Release (не draft) локальный `deployer` пишет статус в тело Release и labels `deployed` / `deploy-failed` (по умолчанию `DEPLOY_MODE=stub`).

Повторный полл ту же пару `(issue, role)` не запускает — состояние в volume `jobs.json`. Деплои — в `deploys.json` того же volume.

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
| `ready-for-dev` | план принят, очередь разработчика |
| `in-dev` | разработчик работает |
| `in-qa` | PR ждёт QA или исправления дефектов |
| `qa-in-progress` | тестировщик работает |
| `qa-passed` | QA успешно пройден |
| `ready-for-release` | RM собрал draft, ждёт апрув |
| `release-approved` | человек разрешил merge/Publish (ставит вручную) |
| `deployed` | локальный деплой успешен |
| `deploy-failed` | локальный деплой упал |
| `needs-human` | стоп автоматики |
| `p0` … `p3` | приоритет (по желанию) |

Без этих имён API постановки меток вернёт ошибку.

Шаблон issue: `.github/ISSUE_TEMPLATE/task.yml` (ставит `needs-plan`; `feature`/`bug` всё равно поставьте вручную).

---

## 3. GitHub PAT (`GITHUB_TOKEN`)

Это **секрет токена**, не номер issue.

1. GitHub (тот же owner, что у репо) → Settings → Developer settings → **Personal access tokens** → Fine-grained.
2. Resource owner — владелец репо. Repository access — **Only select** → `llm_app_dev`.
3. Repository permissions: **Issues → Read and write**, **Pull requests → Read and write** (request review), **Contents → Read and write** (draft Releases). Metadata — Read.
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

## 5. Файл `pipeline/.env`

Оркестратор берёт секреты **только** из `pipeline/.env`. Корневой `.env` — каталог (Mongo, Ollama, `PORT=3001`), Compose его в контейнер оркестратора не подставляет.

```powershell
copy pipeline\.env.example pipeline\.env
```

Заполните:

```
GITHUB_TOKEN=<секрет PAT>
GITHUB_REPO=AlexeyAbretov/llm_app_dev
CURSOR_API_KEY=<секрет ключа Cursor>
CURSOR_REPO_URL=https://github.com/AlexeyAbretov/llm_app_dev
CURSOR_STARTING_REF=main
```

`pipeline/.env` и корневой `.env` в git не коммитить (уже в `.gitignore`).

Если репозиторий или ветка другие — поменяйте `GITHUB_REPO`, `CURSOR_REPO_URL`, `CURSOR_STARTING_REF` (имя ветки должно существовать на GitHub).

Если ключи раньше лежали в корневом `.env` — перенесите `GITHUB_*` и `CURSOR_*` в `pipeline/.env` и удалите их из корня.

---

## 6. Запуск Docker

Из корня репозитория:

```powershell
docker compose -f docker-compose.pipeline.yml up --build -d
```

Проверка:

```powershell
Invoke-RestMethod http://127.0.0.1:3020/health
Invoke-RestMethod http://127.0.0.1:3021/health
docker compose -f docker-compose.pipeline.yml logs -f orchestrator
docker compose -f docker-compose.pipeline.yml logs -f deployer
```

Ожидаемые логи орка без issue: `poll tick`. Deployer: `deploy poll tick`, без `GITHUB_TOKEN or GITHUB_REPO empty`.

У `orchestrator` **нет** docker.sock. Проверка (должен упасть / не видеть демон):

```powershell
docker compose -f docker-compose.pipeline.yml exec orchestrator docker ps
```

У `deployer` sock есть; при `DEPLOY_MODE=compose` он делает `docker compose -f docker-compose.yml up -d` в `/workspace` (корень репо). По умолчанию `DEPLOY_MODE=stub` — только запись в GitHub без `compose up`.

После **Publish** Release (не draft, можно pre-release): в теле Release блок с `<!-- pipeline:deploy:… -->`, на open issues с `ready-for-release`/`release-approved` — `deployed` или `deploy-failed`.

После правки `pipeline/.env`:

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

В логах аналитика: `cursor agent starting` → `cursor run started` (есть `agentId` `bc-…`) → `cursor run finished` → `labels: -needs-plan +ready-for-dev` или `+needs-human`.

Дальше, если стоит `ready-for-dev` и нет открытого PR: `labels: +in-dev` → разработчик → `labels: … +in-qa` или `+needs-human`. Не вешайте `ready-for-dev` сразу на все MVP-issues: разработчик будет кодить каждую.

На `in-qa` с открытым PR: `-in-qa +qa-in-progress` → `role: tester`. Тестировщик возвращает `PIPELINE_BUG_ISSUES`; оркестратор ставит перечисленным issues `bug` + `needs-plan` и возвращает родителя в `in-qa`. Без дефектов: `-qa-in-progress +qa-passed`. Нет маркера, ошибка маркировки или ошибка агента: `+needs-human`. Без PR: `skip tester: no open Fixes PR`.

На `qa-passed`: `role: release-manager`. Агент отдаёт `PIPELINE_RELEASE_TAG`, `PIPELINE_PR_NUMBERS`, блок changelog и `PIPELINE_LABELS`. Оркестратор создаёт/обновляет **draft** Release, назначает owner, просит review на PR, ставит `ready-for-release`. Publish и merge в `main` оркестратор **не** делает. Апрув: вручную label `release-approved`, затем Publish Release / merge PR руками. Сбой протокола или GitHub API → `+needs-human`.

В issue — комментарии пайплайна и (обычно) план от агента. В Cursor Web агенты SDK: Filter → Source → **SDK**.

CI на каждый PR: `.github/workflows/ci.yml`, check **`ci`**. Чтобы красный CI блокировал merge в `main`: GitHub → Settings → Rules → Rulesets (required status check `ci`). Пока ruleset не включён, merge руками всё равно возможен.

---

## 8. Сброс очереди (`jobs.json`)

Пара `(номер issue, роль)` запускается один раз. Чтобы прогнать ту же issue снова:

```powershell
docker compose -f docker-compose.pipeline.yml exec orchestrator rm -f /data/jobs.json
```

Или volume:

```powershell
docker compose -f docker-compose.pipeline.yml down
docker volume rm llm_app_dev_pipeline_data
docker compose -f docker-compose.pipeline.yml up -d
```

После сброса: аналитик снова при `needs-plan`, разработчик — при `ready-for-dev`, тестировщик — при `in-qa`, RM — при `qa-passed` без `ready-for-release`. Чтобы не жечь квоту — снимите эти метки.

Очередь — открытые issue с `needs-plan`, `ready-for-dev`, `in-qa` или `qa-passed` (не фильтр GitHub `since`).

---

## 9. Частые ошибки

| Симптом | Что делать |
|---------|------------|
| `poll skip: GITHUB_TOKEN or GITHUB_REPO empty` | Ключи в **`pipeline/.env`**, не в корневом `.env`; затем `--force-recreate` |
| `getaddrinfo ENOTFOUND api.github.com` | DNS в контейнере (Docker Desktop). Тик пропускается, следующий полл повторит. В compose заданы `8.8.8.8` / `1.1.1.1`; пересобрать: `up -d --force-recreate`. Если в стеке `listNeedsPlan` — старый образ, нужен `--build` с ветки P4 |
| `GitHub comment 403` / labels 403 | PAT: Issues **Read and write**, owner = текущий репо |
| `GitHub pulls 403` | PAT: **Pull requests → Read** (проверка `Fixes #N`); для RM — **Read and write** |
| `GitHub create draft release 403` | PAT: **Contents → Read and write** |
| `Cursor is not available in your region` | Cloud Agents недоступны с этого IP/аккаунта; оркестратор тут ни при чём |
| `Failed to verify existence of branch 'main'` | Ветка есть на GitHub; Cursor GitHub App видит **этот** репо (owner, не collaborator) |
| `resource_exhausted` retryable=true | Лимит Cloud Agents / Usage; подождать, не чистить `jobs.json` в цикле |
| Агент не стартует, только `needs-plan` | Добавьте `feature` или `bug` |
| Метка не ставится, label 404/422 | Создайте `ready-for-dev`, `needs-human`, `in-dev`, `in-qa`, `qa-in-progress`, `qa-passed`, `ready-for-release`, `release-approved`, `deployed`, `deploy-failed` в репо |
| Повторно не берёт issue | Так задумано, если job уже есть; сброс `jobs.json` |
| Issue с `feature`+`needs-plan` «не подхватывается» | Старый баг: фильтр `since`. Нужна версия без `since` + пересборка compose. Не обязательно комментировать issue |
| `agentId` пустой, сразу `cursor run failed` | Смотреть текст `Ошибка:` в комментарии issue или `exec cat /data/jobs.json` |

---

## 10. Что ещё не запускается

- UI оркестратора.
- Автоmerge / авто-Publish после `release-approved`.
- Цикл QA / fix-round (P8).
- Полноценный checkout tag + app-контейнер каталога (сейчас stub или только mongo compose).
- Каталог: Ollama на хосте — [MVP_PLAN.md](./MVP_PLAN.md).

Промпты ролей: `pipeline/prompts/`.
