# План: агентный пайплайн

> Пошаговая реализация процесса: GitHub → облачные агенты → локальный деплой.  
> Контракт (labels, роли, апрув, UI): [AGENT_PIPELINE.md](./AGENT_PIPELINE.md).

Это **отдельный трек** от MVP каталога. Ветки не пересекаются:

| Трек | Ветки | Документ |
|------|--------|----------|
| Каталог | `stage/N-…` | [MVP_PLAN.md](./MVP_PLAN.md) |
| Пайплайн | `pipeline/N-…` | этот файл |

Merge в `main` — только после явного подтверждения пользователя (как в [CONSTITUTION.md §3](./CONSTITUTION.md#3-git-workflow)).

## Git-workflow пайплайна

1. Перед этапом: `git checkout main` → `git pull` → `git checkout -b pipeline/N-…`
2. Коммиты только в ветке этапа
3. Push → чеклист «Проверка»
4. Merge в `main` по команде «мержим» / «этап готов» / «ok»
5. Следующий этап — новая ветка от обновлённого `main`

| Этап | Ветка |
|------|--------|
| P0 | `pipeline/0-github-contract` |
| P1 | `pipeline/1-orchestrator-skeleton` |
| P2 | `pipeline/2-github-cursor` |
| P3 | `pipeline/3-analyst` |
| P4 | `pipeline/4-developer` |
| P5 | `pipeline/5-tester` |
| P6 | `pipeline/6-release-manager` |
| P7 | `pipeline/7-local-devops` |
| P8 | `pipeline/8-qa-loop` |
| P9 | `pipeline/9-schedule-status` |
| UI | `pipeline/ui-jobs` (после P2, можно параллельно с P3+) |

## Обзор

```
P0  Контракт GitHub + правила агентов     ~2ч
P1  Оркестратор-скелет в Docker           ~3ч
P2  Поллинг GitHub + вызов Cursor Cloud   ~4ч
P3  Аналитик                              ~2ч
P4  Разработчик (PR)                      ~3ч
P5  Тестировщик (CI + агент)              ~3ч
P6  Релиз-менеджер (без автоmerge)        ~2ч
P7  Девопс: deployer + локальный compose  ~3ч
P8  Цикл багов + лимит итераций           ~2ч
P9  Дата релиза (cron) + статусы          ~2ч
UI  Таблица джоб и логи орка              ~3ч  (после P2)
                                        ────
                                        ~29ч
```

Оценка без отладки биллинга Cursor и без полноценного E2E Ollama.

### В scope первой волны

Issue → план → PR → проверка → draft release → апрув человека → tag → локальный `docker compose` каталога. Поллинг GitHub. UI очереди после P2.

### Вне scope первой волны

Публичная Gitea, Cloudflare Tunnel, webhook на оркестратор, автоmerge в `main` без апрува, E2E vision на каждый PR, Slack/Telegram, деплой на VPS, UI каталога в том же приложении что орк.

---

## P0: Контракт GitHub и промпты

**Ветка:** `pipeline/0-github-contract`

**Цель:** GitHub — единственный git remote для агентов; labels и документы совпадают.

### Шаги

1. `origin` = GitHub (уже). Gitea не используется пайплайном.
2. Завести labels из [AGENT_PIPELINE.md](./AGENT_PIPELINE.md) §3.
3. Issue template: цель, критерий готовности, связь с этапом MVP каталога если задача про продукт.
4. Ruleset на `main`: PR обязателен, без force push; required checks — с P5.
5. Документы `AGENT_PIPELINE.md` / этот план (этот этап).
6. Промпты `pipeline/prompts/{analyst,developer,tester,release-manager}.md`.

### Проверка

- [ ] Issue с milestone создаётся, нужные labels есть в репо
- [ ] Прямой push в `main` запрещён (если ruleset уже включён)
- [ ] Документы связаны из README и конституции

---

## P1: Оркестратор в Docker

**Ветка:** `pipeline/1-orchestrator-skeleton`

**Цель:** сервис `pipeline/` (Fastify + TS), compose отдельный от каталога.

### Шаги

1. Каталог `pipeline/` в monorepo (workspaces согласовать с будущими `frontend`/`backend` каталога).
2. `docker-compose.pipeline.yml`: `orchestrator`, **без** docker.sock.
3. `GET /health`.
4. `.env.example`: `GITHUB_TOKEN`, `GITHUB_REPO`, `CURSOR_API_KEY`, интервал поллинга.
5. Структурные логи: `issue`, `role`, `agentId`, `runId`.

### Проверка

- [x] `docker compose -f docker-compose.pipeline.yml up` → `/health` = 200
- [x] Секреты не в git

---

## P2: Поллинг GitHub + Cursor SDK

**Ветка:** `pipeline/2-github-cursor`

**Цель:** только исходящие запросы, без туннеля.

### Шаги

1. Поллинг issues (`since`, фильтр labels).
2. Идемпотентность `(issue, role)` — SQLite/JSON volume или маркер в комментарии `<!-- pipeline:job:... -->`.
3. `@cursor/sdk`: явно `cloud: { repos: [...] }`, не local по умолчанию.
4. Сохранение `agentId` / `runId` в БД и комментарий issue.
5. Различать ошибку старта SDK и `run.status === error`.

### Проверка

- [x] Label `needs-plan` → старт агента, комментарий с id (нужны `GITHUB_TOKEN` и `CURSOR_API_KEY` в `.env`)
- [x] Повторный полл не создаёт второго агента на ту же пару

---

## P3: Аналитик

**Ветка:** `pipeline/3-analyst`

### Шаги

1. Триггер: open issue с `bug` или `feature` **и** `needs-plan`, без `ready-for-dev` / `needs-human`.
2. Промпт: конституция, MVP_PLAN, маркер `PIPELINE_LABELS:` в последней строке.
3. Успех: снять `needs-plan`, поставить `ready-for-dev`. Иначе: снять `needs-plan`, поставить `needs-human` (в т.ч. при ошибке Cursor).

### Проверка

- [x] Тестовая feature → план на русском, `ready-for-dev`
- [x] Задача вне MVP (auth, photo search) → отказ, не реализация

---

## P4: Разработчик

**Ветка:** `pipeline/4-developer`

### Шаги

1. Триггер: `ready-for-dev`, нет открытого PR `Fixes #N`.
2. Ветка `issue/<n>-short`, `autoCreatePR` или PR руками агента.
3. Labels: `in-dev` → после PR `in-qa`.
4. Запрет merge и деплоя в промпте.

Задачи **каталога** по-прежнему идут в `stage/N-…`, если это этап MVP продукта. Пайплайнные баги/фичи продукта после MVP — `issue/<n>-…`. Не смешивать имена веток двух треков без явной пометки в issue.

### Проверка

- [ ] Issue с планом → ветка + PR
- [ ] `main` не изменился
- [ ] Повторный полл не стартует второго разработчика; уже открытый PR → `in-qa` без агента

---

## P5: Тестировщик

**Ветка:** `pipeline/5-tester`

### Шаги

1. GitHub-hosted Actions на PR: lint, `tsc`, unit (когда появятся в каталоге). Required check для `main`.
2. Облачный тестировщик по `in-qa`: diff, чеклист, баг-issues с тем же milestone.
3. E2E Ollama — слот после P7, не в этом этапе.
4. В промпте: не утверждать E2E без локального прогона.

### Проверка

- [ ] Красный CI блокирует merge (после включения ruleset)
- [ ] Дырявый PR → issue от тестировщика → оркестратор ставит `bug` + `needs-plan`
- [ ] `in-qa` без открытого PR не стартует облачного тестировщика
- [ ] Нет `PIPELINE_BUG_ISSUES` / маркировка упала → родительская issue получает `needs-human`

---

## P6: Релиз-менеджер

**Ветка:** `pipeline/6-release-manager`

### Шаги

1. Триггер: milestone готов / `ready-for-release`.
2. Changelog, draft Release, assignee, request review (см. контракт §4).
3. Merge/tag/publish — только после `release-approved` (в MVP пайплайна merge предпочтительно руками).
4. Колонка «ожидает апрува» в UI, если UI уже есть.

### Проверка

- [ ] Без апрува tag и Publish не появляются
- [ ] С апрувом (ручной merge + publish или согласованный автошаг) — Release с телом из issues

---

## P7: Девопс локальный

**Ветка:** `pipeline/7-local-devops`

### Шаги

1. Сервис `deployer` в `docker-compose.pipeline.yml`.
2. Триггер: поллинг latest Release **или** self-hosted runner на `release: published` / tag `v*`.
3. Checkout tag, `docker compose` **каталога** (mongo + app). Ollama в этот compose не класть.
4. Только `deployer` с docker.sock (на Windows — named pipe Docker Desktop).
5. Health → `deployed` / `deploy-failed` и комментарий в Release.
6. Пока каталога нет: заглушка «tag доехал, echo deploy».

### Проверка

- [ ] Тестовый pre-release → лог deployer, статус в GitHub
- [ ] Оркестратор без sock не выполняет `docker ps`

---

## P8: Цикл QA

**Ветка:** `pipeline/8-qa-loop`

### Шаги

1. Баг тестировщика → снова P3–P5.
2. `fix-round: N` в теле issue, максимум 3 → `needs-human`.
3. Не стартовать разработчика без нового плана, если scope бага изменился.

### Проверка

- [ ] Три круга → на четвёртом `needs-human`, разработчик не стартует

---

## P9: Дата релиза и наблюдаемость

**Ветка:** `pipeline/9-schedule-status`

### Шаги

1. Cron оркестратора (~раз в час): due milestone сегодня, есть tag, нет `deployed` → deployer.
2. Дата без tag → комментарий `blocked: no tag`, compose не трогать.
3. Идемпотентный деплой. Кратко в README пайплайна: логи, как остановить полл.

### Проверка

- [ ] Due сегодня без tag → комментарий, без compose
- [ ] С tag → один деплой на несколько тиков cron

---

## UI: очередь джоб и логи

**Ветка:** `pipeline/ui-jobs`  
**После:** P2 (нужны записи джоб). Можно параллельно с P3+.

### Шаги

1. Отдельный сервис `pipeline-ui` (React + Vite + TS + Tailwind), порт ≠ каталог.
2. Таблица: issue, роль, статус (`queued` / `running` / `waiting-approval` / `failed`), ссылки GitHub и Cursor.
3. Лог оркестратора из БД джоб, не сырой `docker logs` как единственный источник.
4. Превью `conversation()` Cursor — опционально по клику; полный транскрипт в Cursor.
5. Апрув релиза не заменяет GitHub (только отображение `waiting-approval`).

### Проверка

- [ ] Джоб с P2 виден в таблице со ссылками
- [ ] UI не торчит наружу без необходимости

---

## Порядок относительно каталога

| Ситуация | Действие |
|----------|----------|
| Нужен работающий каталог | `stage/0`–`stage/10`; P7 — заглушка до compose каталога |
| Нужен процесс агентов | P0–P6 на документационном репо; P7 когда есть compose продукта |
| Параллельно | Не смешивать `stage/*` и `pipeline/*` в одной ветке |

P5/P7 полноценно оживают после scaffold каталога (`stage/0`) и появления тестов.

## Риски

- ПК выключен: PR в облаке возможны, деплой и локальный E2E — нет.
- Windows + docker.sock / named pipe — проверить на P7.
- Два GitHub token: чтение issues vs merge/release.
- Облачный тестировщик без E2E не закрывает vision.

## Backlog пайплайна (не делать без запроса)

- Автоmerge в `main`
- Telegram/почта при `waiting-approval`
- Webhook + туннель вместо поллинга
- Вынос Ollama в Docker / деплой на VPS
