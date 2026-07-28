#!/usr/bin/env bash
# Залить дамп в новую (self-hosted) базу. Запускать НА СЕРВЕРЕ из /opt/precettore-db
# после scripts/dump-cloud.sh.
#
#   bash scripts/restore-selfhost.sh
#
# Каждый файл заливается одной транзакцией с ON_ERROR_STOP=1: при первой ошибке
# всё откатывается — лучше пустая база, чем залитая наполовину.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$HERE/migrate.env"
OUT="$HERE/dump"

[ -f "$ENV_FILE" ] || { echo "Нет $ENV_FILE — см. 02-migrate-data.md, п. 3.1"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
[ -n "${LOCAL_DB_URL:-}" ] || { echo "В migrate.env не задан LOCAL_DB_URL"; exit 1; }

for f in schema.sql data.sql auth_users.sql; do
  [ -s "$OUT/$f" ] || { echo "Нет или пуст $OUT/$f — сначала dump-cloud.sh"; exit 1; }
done

cd "$HERE"
psql() { docker compose exec -T db psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 "$@"; }

echo "→ проверяю, что целевая база пустая"
EXISTING=$(psql -tAc "select count(*) from information_schema.tables where table_schema='public'")
if [ "$EXISTING" != "0" ]; then
  echo "В public уже $EXISTING таблиц. Заливка поверх даст мусор."
  echo "Либо это повторный запуск (тогда сначала: drop schema public cascade; create schema public;),"
  echo "либо адрес базы не тот. Останавливаюсь."
  exit 1
fi

echo "→ расширения"
psql -c "create extension if not exists pgcrypto with schema extensions" \
     -c "create extension if not exists \"uuid-ossp\" with schema extensions"

echo "→ схема public"
psql --single-transaction -f - < "$OUT/schema.sql"

echo "→ данные public"
# session_replication_role=replica отключает триггеры и проверку внешних ключей
# на время заливки: иначе порядок таблиц в дампе ломает вставку по FK.
psql --single-transaction -c "set session_replication_role = replica" -f - < "$OUT/data.sql"

echo "→ пользователи auth (репетиторы)"
psql --single-transaction -c "set session_replication_role = replica" -f - < "$OUT/auth_users.sql"

echo "→ Realtime: публикация для живого чата"
psql -c "alter publication supabase_realtime add table public.chat_messages" \
  || echo "  (уже добавлена — это нормально)"

echo
echo "Контрольные числа в новой базе:"
for t in students homework chat_messages student_accounts variants notifications tasks; do
  printf "  %-18s %s\n" "$t" "$(psql -tAc "select count(*) from public.$t" 2>/dev/null || echo 'нет таблицы')"
done
printf "  %-18s %s\n" "auth.users" "$(psql -tAc 'select count(*) from auth.users')"
echo
echo "Сверьте эти числа со старой базой ДО переключения фронтенда."
