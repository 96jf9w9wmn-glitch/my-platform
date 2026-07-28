#!/usr/bin/env bash
# Снять дамп с облачного Supabase. Запускать НА НОВОМ СЕРВЕРЕ из /opt/precettore-db —
# pg_dump берётся из контейнера db, поэтому его версия совпадает с версией базы.
#
#   bash scripts/dump-cloud.sh
#
# Требует /opt/precettore-db/migrate.env с CLOUD_DB_URL (прямое подключение, порт 5432).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$HERE/migrate.env"
OUT="$HERE/dump"

[ -f "$ENV_FILE" ] || { echo "Нет $ENV_FILE — см. 02-migrate-data.md, п. 3.1"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
[ -n "${CLOUD_DB_URL:-}" ] || { echo "В migrate.env не задан CLOUD_DB_URL"; exit 1; }

case "$CLOUD_DB_URL" in
  *:6543/*) echo "CLOUD_DB_URL указывает на пулер (6543). Нужно прямое подключение, порт 5432."; exit 1 ;;
esac

mkdir -p "$OUT"
cd "$HERE"

# pg_dump внутри контейнера db; строка подключения передаётся как аргумент.
dump() {
  local out="$1"; shift
  echo "→ $out"
  docker compose exec -T db pg_dump "$CLOUD_DB_URL" "$@" > "$OUT/$out"
}

# 1. Схема public: таблицы, вьюхи, функции (RPC), триггеры, гранты.
#    --no-owner: владельцы ролей в облаке и на self-host не совпадают.
#    Гранты СОХРАНЯЕМ: на них держится доступ anon к SECURITY DEFINER функциям.
dump schema.sql --schema-only --schema public --no-owner

# 2. Данные public.
dump data.sql --data-only --schema public --no-owner

# 3. Пользователи GoTrue (репетиторы). Сессии и refresh-токены НЕ переносим:
#    JWT_SECRET на новом сервере другой, старые сессии всё равно недействительны.
dump auth_users.sql --data-only --no-owner \
  --table auth.users --table auth.identities

echo
echo "Готово. Размеры (пустой файл = что-то не выгрузилось, разбираться до заливки):"
ls -lh "$OUT"
echo
echo "Быстрая сверка содержимого:"
for t in students homework chat_messages student_accounts variants notifications; do
  printf "  %-18s строк COPY: %s\n" "$t" \
    "$(awk "/^COPY public.$t /{f=1;next} f&&/^\\\\\\.$/{f=0} f" "$OUT/data.sql" | wc -l)"
done
