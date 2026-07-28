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

## 2.2 Стек Supabase

```bash
sudo mkdir -p /opt && cd /opt
git clone --depth 1 https://github.com/supabase/supabase
mkdir -p /opt/precettore-db
cp -r supabase/docker/* /opt/precettore-db/
cp supabase/docker/.env.example /opt/precettore-db/.env
cd /opt/precettore-db
```

Сгенерировать секреты (скрипт кладёт `JWT_SECRET`, ключи и пароли в `.env`):

```bash
sh utils/generate-keys.sh
sh utils/add-new-auth-keys.sh
```

> Если скриптов в вашей версии репозитория нет — секреты генерируются вручную:
> `openssl rand -base64 48` для каждого из `POSTGRES_PASSWORD`, `JWT_SECRET`,
> `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `REALTIME_DB_ENC_KEY`, `PG_META_CRYPTO_KEY`,
> а `ANON_KEY`/`SERVICE_ROLE_KEY` — JWT, подписанные `JWT_SECRET`
> (генератор есть в документации Supabase по self-hosting).

### Что дописать в `.env` руками

```ini
# --- адреса ---
SUPABASE_PUBLIC_URL=https://db.precettore.ru
API_EXTERNAL_URL=https://db.precettore.ru
SITE_URL=https://precettore.ru
ADDITIONAL_REDIRECT_URLS=https://precettore.ru,http://localhost:5174

# --- панель Studio (наружу НЕ выставляем, см. 2.4) ---
DASHBOARD_USERNAME=<свой логин>
DASHBOARD_PASSWORD=<длинный пароль с буквами, не только цифры>

# --- почта: без неё не работает сброс пароля репетитора ---
SMTP_HOST=<smtp вашего российского провайдера>
SMTP_PORT=465
SMTP_USER=<ящик>
SMTP_PASS=<пароль приложения>
SMTP_SENDER_NAME=Precettore
SMTP_ADMIN_EMAIL=<ящик>
```

⚠️ Проверить **до** запуска: в облачном проекте подтверждение e-mail при
регистрации репетитора было включено или выключено. Соответственно выставить
`ENABLE_EMAIL_AUTOCONFIRM` (`true` = не требовать подтверждения). Расхождение
здесь ломает регистрацию новых репетиторов, и это заметно не сразу.

Запуск:

```bash
cd /opt/precettore-db
docker compose pull
docker compose up -d
docker compose ps        # все сервисы должны быть healthy
```

---

## 2.3 TLS и обратный прокси

Caddy сам выпускает и продлевает сертификат Let's Encrypt.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
db.precettore.ru {
	encode gzip
	reverse_proxy 127.0.0.1:8000
}
```

```bash
sudo systemctl reload caddy
curl -I https://db.precettore.ru/rest/v1/    # ожидаем 401 — значит Kong отвечает
```

401 без ключа — правильный ответ: шлюз живой и требует авторизацию.

---

## 2.4 Панель Studio — не выставлять наружу

Studio (порт 3000 внутри стека) закрыта только логином из `.env`. Наружу её не
публикуем; заходим SSH-туннелем с ноутбука:

```bash
ssh -N -L 8000:127.0.0.1:8000 root@<IP сервера>
```

и открываем `http://localhost:8000` — там же доступен SQL Editor для миграций.

К самому Postgres из локальных инструментов — тем же приёмом:

```bash
ssh -N -L 5432:127.0.0.1:5432 root@<IP сервера>
```

---

## 2.5 Бэкапы

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
docker compose -f /opt/precettore-db/docker-compose.yml exec -T db \
  pg_dump -U postgres -d postgres --clean --if-exists \
  | gzip > "$DIR/db-$STAMP.sql.gz"
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
sudo crontab -e
# 0 4 * * *  /opt/precettore-db/backup.sh >> /var/log/precettore-backup.log 2>&1
```

**Бэкап без проверенного восстановления бэкапом не является.** Один раз
восстановить дамп в пустую тестовую базу и убедиться, что данные на месте —
обязательный пункт приёмки ([03-acceptance.md](03-acceptance.md)).

Копию бэкапов держать вне этого сервера (объектное хранилище того же
российского провайдера) — иначе потеря ВМ означает потерю и данных, и бэкапов.
