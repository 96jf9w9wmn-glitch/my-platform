# Шаг 3–4. Перенос данных и переключение фронтенда

Что переносим:

| Что | Как | Чем |
|---|---|---|
| Роли БД | дамп ролей | `scripts/dump-cloud.sh` |
| Схема `public` (таблицы, вьюхи, RPC, триггеры) | дамп схемы | `scripts/dump-cloud.sh` |
| Данные `public` | дамп данных | `scripts/dump-cloud.sh` |
| Пользователи `auth.users` (репетиторы) | дамп схемы `auth`, только данные | `scripts/dump-cloud.sh` |
| Бакеты и файлы Storage | копирование через API | `scripts/migrate-storage.mjs` |
| Публикация Realtime | вручную, п. 3.5 | — |

На этой машине не установлены `psql`/`pg_dump`/`docker`, поэтому дамп снимаем
**с нового сервера** — там уже есть Postgres нужной версии внутри стека, и
проблемы «pg_dump 14 не читает базу 17» не возникает.

## Три грабли, на которые наступили (учтены в скриптах)

**1. Supabase Cloud отдаёт direct connection только по IPv6.** Выделенный IPv4 —
платный add-on. У хоста Timeweb IPv6 есть, но у контейнеров Docker по умолчанию
нет: изнутри стека получаем `Network is unreachable`. Поэтому `pg_dump` идёт
через `docker run --rm --network host <образ базы>`, а не `docker compose exec db`.
Покупать IPv4 add-on не нужно — сначала проверьте IPv6 с сервера:

```bash
curl -6 -s -o /dev/null -w '%{http_code}\n' https://api64.ipify.org
```

**2. `CREATE SCHEMA public;` в дампе.** В свежей базе Supabase схема уже есть
вместе с грантами для `anon`/`authenticated`/`service_role`. Без замены на
`IF NOT EXISTS` вся транзакция откатывается на первой строке.

**3. `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`.** В self-hosted Supabase
роль `postgres` **не суперюзер** — суперюзер только `supabase_admin`, поэтому
менять его дефолтные привилегии postgres не может. Заливать под `supabase_admin`
нельзя: он стал бы владельцем `SECURITY DEFINER` функций (`student_login` и
остальных), и они исполнялись бы с правами суперюзера. Эти 12 строк
отфильтрованы — базовый стек настраивает такие привилегии сам.

---

## 3.1 Подготовка

Понадобятся две строки подключения и два service-ключа.

**Со старого (облачного) Supabase** — Dashboard → Project Settings:
- `Database → Connection string → URI` (пароль базы; если забыт — там же сбрасывается);
- `API → service_role key`.

**С нового сервера** — из `/opt/precettore-db/.env`:
- `POSTGRES_PASSWORD` (подключение — `postgresql://postgres:<пароль>@127.0.0.1:5432/postgres`);
- `SERVICE_ROLE_KEY`.

Положить их на сервере в `/opt/precettore-db/migrate.env` (файл с правами 600,
в репозиторий не коммитить):

```ini
CLOUD_DB_URL=postgresql://postgres.<ref>:<пароль>@aws-0-<region>.pooler.supabase.com:5432/postgres
LOCAL_DB_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres
```

```bash
chmod 600 /opt/precettore-db/migrate.env
```

> Для дампа брать **прямое** подключение (порт 5432), а не transaction-пулер
> (6543): через пулер `pg_dump` работает некорректно.

## 3.2 Объявить простой

Перенос делается при остановленной записи, иначе данные, добавленные во время
дампа, потеряются. Реально это 20–40 минут. Порядок: предупредить учеников →
снять дамп → залить → переключить фронт.

## 3.3 Снять дамп с облака

Скопировать на сервер каталог `supabase/selfhost/scripts/` из репозитория и:

```bash
cd /opt/precettore-db
bash scripts/dump-cloud.sh
```

Скрипт создаст `dump/roles.sql`, `dump/schema.sql`, `dump/data.sql`,
`dump/auth_users.sql` и напечатает размеры — пустой файл здесь означает, что
что-то не выгрузилось, и это надо разобрать до заливки.

## 3.4 Залить в новую базу

```bash
bash scripts/restore-selfhost.sh
```

Скрипт заливает в порядке роли → схема → данные `public` → пользователи `auth`,
каждый файл одной транзакцией с `ON_ERROR_STOP=1`: при первой же ошибке всё
откатывается, вместо наполовину залитой базы.

Что важно понимать про пароли:

- **Репетитор.** `auth.users.encrypted_password` — самодостаточный bcrypt-хэш,
  он переезжает и продолжает работать. Но `JWT_SECRET` на новом сервере другой,
  поэтому **все текущие сессии инвалидируются — репетитору нужно войти заново.**
- **Ученики.** Их пароли лежат в `student_accounts` (bcrypt через `pgcrypto`,
  `supabase/auth_hardening.sql`) и переезжают вместе с данными `public`.
  Проверить, что расширение `pgcrypto` в новой базе установлено — иначе
  `student_login` упадёт:

```sql
create extension if not exists pgcrypto with schema extensions;
```

## 3.5 Включить Realtime на нужной таблице

Живой чат подписан на `postgres_changes` по `public.chat_messages`
([src/pages/Chat.jsx:115](src/pages/Chat.jsx:115), а также App/StudentDashboard/ParentDashboard).
Без публикации сообщения будут приходить только после перезагрузки страницы —
и это легко не заметить при беглой проверке.

```sql
-- в SQL Editor новой базы
alter publication supabase_realtime add table public.chat_messages;
select * from pg_publication_tables where pubname = 'supabase_realtime';
```

Доска (`Board.jsx`) использует `broadcast` и `presence` — они идут через
Realtime-сервер и публикации не требуют.

## 3.6 Перенести файлы Storage

Строки `storage.objects` без самих файлов бесполезны, поэтому бакеты и файлы
копируются через API — скриптом с любой машины, где есть Node:

```bash
CLOUD_URL=https://<ref>.supabase.co \
CLOUD_SERVICE_KEY=<service_role старого> \
LOCAL_URL=https://db.precettore.ru \
LOCAL_SERVICE_KEY=<SERVICE_ROLE_KEY нового> \
node supabase/selfhost/scripts/migrate-storage.mjs
```

Скрипт создаёт бакеты с теми же настройками публичности, обходит все папки
рекурсивно и печатает итог «скопировано / пропущено / ошибок». Запускать можно
повторно — уже перенесённые файлы пропускаются по размеру.

> Бакеты `homework` и `variants` останутся публичными — такими же, как сейчас.
> Их закрытие (подписанные URL) — отдельная задача, см.
> [../rls_migration_plan.md](../rls_migration_plan.md).

## 3.7 Выполнить недовыполненные миграции

По [CLAUDE.md](../../CLAUDE.md) в облачной базе так и не выполнены несколько
SQL-файлов. Новая база — правильный момент их накатить, но **по одному, с
проверкой**, а не пачкой:

- `supabase/auth_hardening.sql` — если применялся в облаке, он уже в дампе; если
  нет, накатить и **сразу задеплоить фронт** (старый билд читает колонку `pass_word`);
- `supabase/variant_part2.sql` — часть 2 варианта ОГЭ;
- `supabase/homework_timer.sql` — таймер ДЗ;
- `supabase/board_snapshots.sql` — история досок;
- `supabase/finance.sql` — расходы и налог.

Проверить, что уже есть в дампе, до накатывания:

```bash
grep -c "create table public.board_snapshots" dump/schema.sql
```

---

## 4. Переключить фронтенд

Ключ и адрес уже вынесены в переменные окружения
([src/supabase.js](../../src/supabase.js)), поэтому переключение — это смена
двух значений, без правки кода.

Локально, в `.env.local`:

```ini
VITE_SUPABASE_URL=https://db.precettore.ru
VITE_SUPABASE_ANON_KEY=<ANON_KEY из /opt/precettore-db/.env>
```

В проде (Vercel) — те же две переменные для окружения Production, затем
передеплой. **Порядок важен: сначала переменные, потом деплой** — иначе сборка
упадёт на явной проверке в `src/supabase.js`. Это сделано намеренно: лучше
падение на сборке, чем молчаливый деплой, который ходит в старую базу.

Старый облачный проект **не удалять минимум две недели** — это точка отката.
