# Шаг 2. Поднять Supabase на российском сервере

Выполняется после того, как сервер арендован и есть SSH-доступ.
Все команды — на сервере под пользователем с `sudo`.

Дальше по тексту:
- `db.precettore.ru` — поддомен, указывающий A-записью на IP сервера;
- `precettore.ru` — сам сайт (пока на Vercel).

---

## 2.1 Базовая подготовка

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw rsync
```

Docker (официальный репозиторий, не `apt install docker.io` — там старая версия):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Файрвол — наружу открыты только SSH и HTTPS. Порты Postgres (5432) и Kong (8000)
снаружи закрыты: к базе ходят через Caddy по TLS, а к Postgres — через SSH-туннель.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

---

## 2.2 Зеркало Docker Hub

Docker Hub лимитирует анонимные загрузки по IP и на облачных адресах отдаёт
`429 Too Many Requests` — стек из десяти образов скачать не удастся. Помогает
зеркало провайдера (заодно трафик не уходит за пределы РФ):

```bash
sudo mkdir -p /etc/docker
echo '{ "registry-mirrors": ["https://dockerhub.timeweb.cloud"] }' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
docker info | grep -A2 "Registry Mirrors"
```

---

## 2.3 Стек Supabase

```bash
sudo mkdir -p /opt && cd /opt
git clone --depth 1 https://github.com/supabase/supabase
mkdir -p /opt/precettore-db
cp -r /opt/supabase/docker/. /opt/precettore-db/
cd /opt/precettore-db
cp .env.example .env
chmod 600 .env
```

Секреты генерирует штатный скрипт — он заполняет `JWT_SECRET`, `ANON_KEY`,
`SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `DASHBOARD_PASSWORD`, `VAULT_ENC_KEY`,
`PG_META_CRYPTO_KEY`, `SECRET_KEY_BASE`, `REALTIME_DB_ENC_KEY`:

```bash
sh utils/generate-keys.sh --update-env
```

`POOLER_TENANT_ID` он не трогает — задать вручную.

### Что дописать в `.env`

```ini
# Порядок файлов важен: наш override идёт ПОСЛЕДНИМ, см. 2.4
COMPOSE_FILE=docker-compose.yml:docker-compose.caddy.yml:docker-compose.override.yml

SUPABASE_PUBLIC_URL=https://db.precettore.ru
# ВНИМАНИЕ: с суффиксом /auth/v1 — так в актуальном .env.example,
# эта переменная идёт в GoTrue и как GOTRUE_JWT_ISSUER
API_EXTERNAL_URL=https://db.precettore.ru/auth/v1
SITE_URL=https://precettore.ru
ADDITIONAL_REDIRECT_URLS=https://precettore.ru,http://localhost:5174
PROXY_DOMAIN=db.precettore.ru
POOLER_TENANT_ID=precettore
DASHBOARD_USERNAME=precettore
STUDIO_DEFAULT_ORGANIZATION=Precettore
STUDIO_DEFAULT_PROJECT=precettore

# Пока SMTP не подключён — иначе регистрация репетитора зависнет
# в ожидании письма, которое некому отправить
ENABLE_EMAIL_AUTOCONFIRM=true

# --- почта: GoTrue шлёт не напрямую, а через локальный релей, см. 2.6 ---
SMTP_HOST=host.docker.internal
SMTP_PORT=587
SMTP_USER=precettore@inbox.ru
SMTP_PASS=<пароль для внешних приложений, НЕ пароль от почты>
SMTP_SENDER_NAME=Precettore
SMTP_ADMIN_EMAIL=precettore@inbox.ru
```

### Русские письма

Базовый compose не задаёт ни темы, ни шаблоны — по умолчанию GoTrue шлёт
английское «Reset Your Password». Дописать в `docker-compose.override.yml`:

```yaml
  auth:
    environment:
      GOTRUE_MAILER_SUBJECTS_RECOVERY: "Precettore — сброс пароля"
      GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "Precettore — подтверждение адреса"
      GOTRUE_MAILER_SUBJECTS_INVITE: "Precettore — приглашение"
      GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE: "Precettore — смена адреса"
      GOTRUE_MAILER_TEMPLATES_RECOVERY: "https://db.precettore.ru/email/recovery.html"
```

Шаблон GoTrue умеет брать **только по HTTP-адресу**, а весь домен, кроме
API-путей, закрыт basic-аутентификацией панели Studio — оттуда GoTrue файл не
скачает. Поэтому в `volumes/proxy/caddy/Caddyfile` добавлен отдельный маршрут
**до** общего `handle`:

```
    handle_path /email/* {
        root * /etc/caddy/email
        file_server
    }
```

Сам шаблон — [email/recovery.html](email/recovery.html), кладётся в
`volumes/proxy/caddy/email/`. Внутри только вёрстка, ничего приватного.
Подстановки GoTrue: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .SiteURL }}`,
`{{ .Email }}`.

⚠️ Caddy **не перечитывает** смонтированный Caddyfile сам — после правки нужен
`docker compose restart caddy`, иначе маршрут молча отдаёт 401 от Studio.

⚠️ Когда SMTP появится, сверить `ENABLE_EMAIL_AUTOCONFIRM` с настройкой
облачного проекта. Расхождение ломает регистрацию новых репетиторов, и это
заметно не сразу.

---

## 2.4 Порты: Docker обходит ufw

Docker вставляет свои правила в iptables **раньше** ufw, поэтому опубликованный
на `0.0.0.0` порт доступен из интернета несмотря на `ufw default deny`. В
штатном `docker-compose.yml` так публикуются Postgres (5432) и пулер (6543) —
сервисом `supavisor`, — а также Kong (8000).

Лечится не файрволом, а привязкой к localhost. Создать
`/opt/precettore-db/docker-compose.override.yml`:

```yaml
services:
  supavisor:
    ports: !override
      - "127.0.0.1:5432:5432"
      - "127.0.0.1:6543:6543"
  kong:
    ports: !override
      - "127.0.0.1:8000:8000"
```

Файл должен идти в `COMPOSE_FILE` **последним**: `docker-compose.caddy.yml`
сбрасывает порты Kong (`ports: !reset []`), а нам нужен локальный 8000 для
миграции Storage и отладки с хоста.

Проверка после запуска — наружу не должно смотреть ничего, кроме SSH:

```bash
ss -tlnp | grep -vE '127.0.0.1|\[::1\]'
```

---

## 2.5 Запуск и TLS

Caddy не нужно ставить в систему: в репозитории есть готовый оверлей
`docker-compose.caddy.yml` — он снимает публикацию портов Kong, поднимает Caddy
на 80/443, сам выпускает и продлевает сертификат Let's Encrypt по `PROXY_DOMAIN`
и закрывает Studio basic-аутентификацией из `DASHBOARD_USERNAME`/`PASSWORD`.
API-пути (`/auth/v1/*`, `/rest/v1/*`, `/realtime/v1/*`, `/storage/v1/*`,
`/functions/v1/*`) идут к Kong без basic-auth, всё остальное — к Studio с ним.

**A-запись `db` должна уже резолвиться до первого запуска Caddy** — неудачные
попытки выпуска жгут лимит Let's Encrypt. Проверить у авторитетного сервера,
а не через кеш:

```bash
dig @ns1.reg.ru db.precettore.ru A +short
```

```bash
cd /opt/precettore-db
docker compose pull
docker compose up -d
docker compose ps        # все сервисы должны быть healthy
docker compose logs caddy | grep -i "certificate obtained"
```

### Проверка снаружи

```bash
ANON=$(ssh precettore-db 'grep "^ANON_KEY=" /opt/precettore-db/.env | cut -d= -f2')
curl -s -o /dev/null -w "%{http_code}\n" https://db.precettore.ru/storage/v1/bucket \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"       # 200
curl -s -o /dev/null -w "%{http_code}\n" https://db.precettore.ru/   # 401 — Studio под паролем
```

> `GET /rest/v1/` отдаёт **403 и это норма**: корневой OpenAPI-эндпоинт в
> Supabase намеренно разрешён только группе `admin` (см. комментарий в
> `volumes/api/kong.yml`). Проверять надо запрос к конкретной таблице —
> на несуществующую придёт 404, что означает «дошло до PostgREST».

## 2.6 Почта: релей вместо прямой отправки

GoTrue **не может** отправлять письма напрямую из своей сети. Диагностика
30.07.2026:

| Откуда | Куда | Результат |
|---|---|---|
| хост | `smtp.mail.ru` по IPv6 | стабильно работает |
| хост | оба IPv4 mail.ru | то проходит, то таймаут |
| контейнер | IPv6 | `Network unreachable` — IPv6 в Docker нет |
| контейнер | IPv4 | таймаут вслед за хостом |
| контейнер | HTTPS (443) | работает |

То есть у mail.ru надёжен только IPv6, а контейнерам он недоступен — GoTrue
отваливался с `504 request_timeout` ровно через 10 секунд. Проверены и отброшены:
порты 25/465/587, MTU, правила ufw и iptables.

Решение — релей `boky/postfix` с `network_mode: host` (см.
[docker-compose.override.yml](docker-compose.override.yml)). GoTrue отдаёт письмо
ему на `host.docker.internal:587`, релей отправляет наружу по IPv6. Очередь
Postfix заодно переживает моменты недоступности mail.ru: GoTrue сразу получает
`200`, доставка идёт асинхронно.

Нужны два точечных правила ufw — обращение из docker-сети к порту на хосте
попадает под `default deny`:

```bash
sudo ufw allow from 172.17.0.0/16 to any port 587 proto tcp comment "SMTP relay from docker"
sudo ufw allow from 172.18.0.0/16 to any port 587 proto tcp comment "SMTP relay from docker"
sudo ufw reload
```

Проверка доставки:

```bash
ANON=$(ssh precettore-db 'grep "^ANON_KEY=" /opt/precettore-db/.env | cut -d= -f2')
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://db.precettore.ru/auth/v1/recover \
  -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"<ваш ящик>"}'   # 200
ssh precettore-db 'cd /opt/precettore-db && docker compose logs smtp-relay | grep status='
# ожидаем: status=sent (250 OK ...)
```

`200` от GoTrue означает только «письмо принято релеем» — доставку смотреть
в логе релея. Если письмо застряло: `docker compose exec smtp-relay postqueue -p`,
форсировать `postqueue -f`.

---

## 2.7 Доступ к Studio и Postgres

Studio открывается на `https://db.precettore.ru/` под логином и паролем из
`.env` (`grep DASHBOARD /opt/precettore-db/.env`). Там же SQL Editor.

К Postgres напрямую — SSH-туннелем, порт снаружи закрыт:

```bash
ssh -N -L 5432:127.0.0.1:5432 precettore-db
```

---

## 2.8 Бэкапы

Снапшот виртуальной машины у провайдера — включить, но его недостаточно:
снапшот работающей БД не гарантирует консистентность. Нужен `pg_dump` по расписанию.

`/opt/precettore-db/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
DIR=/var/backups/precettore
VOLUMES=/opt/precettore-db/volumes
mkdir -p "$DIR"
STAMP=$(date +%F-%H%M)

# 1. База — ежедневно, 14 копий. Дамп маленький (текст), место не съест.
#    ВАЖНО: под supabase_admin, а не postgres. postgres в self-hosted Supabase
#    не суперюзер, и снятый им дамп неполон — при восстановлении получаем 200+
#    ошибок «must be able to SET ROLE supabase_admin / supabase_auth_admin /
#    supabase_storage_admin». Данные при этом доезжают, но поднять инстанс с
#    нуля таким бэкапом нельзя. Под supabase_admin — 0 ошибок (проверено).
docker compose exec -T db pg_dump -U supabase_admin -d postgres --clean --if-exists \
  < /dev/null | gzip > "$DIR/db-$STAMP.sql.gz"
find "$DIR" -name 'db-*.sql.gz' -mtime +14 -delete

# 2. Файлы Storage — зеркало, а НЕ ежедневный архив. Полный tar фотографий
#    решений каждую ночь × 14 дней означает 14-кратный объём Storage на том же
#    диске: при 5 ГБ файлов это 70 ГБ и переполнение 80-гигабайтного диска.
#    rsync переносит только изменившееся и держит одну копию.
rsync -a --delete "$VOLUMES/storage/" "$DIR/storage-current/"

# 3. Архив Storage — раз в неделю (по воскресеньям), держим 2 копии.
if [ "$(date +%u)" = "7" ]; then
  tar czf "$DIR/storage-$STAMP.tar.gz" -C "$VOLUMES" storage
  ls -1t "$DIR"/storage-*.tar.gz | tail -n +3 | xargs -r rm --
fi
```

Потолок по месту получается примерно «объём Storage × 3» вместо × 14.
Следить всё равно: `df -h /` в чеклисте приёмки.

```bash
chmod +x /opt/precettore-db/backup.sh
LINE="0 4 * * * /opt/precettore-db/backup.sh >> /var/log/precettore-backup.log 2>&1"
{ crontab -l 2>/dev/null | grep -v 'precettore-db/backup.sh' || true; echo "$LINE"; } | crontab -
crontab -l
```

> `|| true` здесь не для красоты: на пустом кроне `crontab -l | grep` возвращает
> код 1, и при `set -e` строка не дописывается — крон молча остаётся пустым.

**Бэкап без проверенного восстановления бэкапом не является.** Проверка —
обязательный пункт приёмки ([03-acceptance.md](03-acceptance.md)):

```bash
cd /opt/precettore-db
BK=$(ls -1t /var/backups/precettore/db-*.sql.gz | head -1)
docker compose exec -T db psql -U supabase_admin -d postgres -c "create database restore_test" < /dev/null
gunzip -c "$BK" | docker compose exec -T db psql -U supabase_admin -d restore_test -q 2>&1 | grep -c "^ERROR"
# ожидаем 0; затем сверить счётчики и удалить restore_test
```

Копию бэкапов держать вне этого сервера (объектное хранилище того же
российского провайдера) — иначе потеря ВМ означает потерю и данных, и бэкапов.
