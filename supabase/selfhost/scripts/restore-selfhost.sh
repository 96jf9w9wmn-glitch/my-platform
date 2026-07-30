#!/usr/bin/env bash
# Залить дамп в новую (self-hosted) базу. Запускать НА СЕРВЕРЕ из /opt/precettore-db
# после scripts/dump-cloud.sh.
#
#   bash scripts/restore-selfhost.sh
#
# Каждый файл заливается одной транзакцией с ON_ERROR_STOP=1: при первой ошибке
# всё откатывается — лучше пустая база, чем залитая наполовину.
#
# Здесь, в отличие от dump-cloud.sh, сеть хоста не нужна: psql работает внутри
# контейнера с локальной базой.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$HERE/dump"

for f in schema.sql data.sql auth_users.sql; do
  [ -s "$OUT/$f" ] || { echo "Нет или пуст $OUT/$f — сначала dump-cloud.sh"; exit 1; }
done

cd "$HERE"
psql() { docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

echo "→ проверяю, что целевая база пустая"
EXISTING=$(psql -tAc "select count(*) from information_schema.tables where table_schema='public'" | tr -d '[:space:]')
if [ "$EXISTING" != "0" ]; then
  echo "В public уже $EXISTING таблиц. Заливка поверх даст мусор."
  echo "Либо это повторный запуск (тогда сначала: drop schema public cascade; create schema public;),"
  echo "либо адрес базы не тот. Останавливаюсь."
  exit 1
fi

echo "→ расширения"
psql -q -c "create extension if not exists pgcrypto with schema extensions" \
        -c 'create extension if not exists "uuid-ossp" with schema extensions'

echo "→ схема public"
# Две правки дампа, без которых транзакция откатывается целиком:
#
# 1. «CREATE SCHEMA public;» — в свежей базе Supabase схема уже есть вместе с
#    грантами для anon/authenticated/service_role.
# 2. «ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin» — сменить дефолтные
#    привилегии чужой роли может только она сама или суперюзер, а заливаем мы
#    под postgres (в self-hosted Supabase он НЕ суперюзер, суперюзер только
#    supabase_admin). Заливать под supabase_admin — плохая идея: он стал бы
#    владельцем SECURITY DEFINER функций (student_login и прочие), то есть они
#    исполнялись бы с правами суперюзера. Эти 12 строк не нужны: базовый стек
#    настраивает дефолтные привилегии supabase_admin сам.
sed -e 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' \
    -e '/^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/d' \
    "$OUT/schema.sql" \
  | psql -q --single-transaction -f -

echo "→ данные public"
# session_replication_role=replica отключает триггеры и проверку внешних ключей
# на время заливки: иначе порядок таблиц в дампе ломает вставку по FK.
psql -q --single-transaction -c "set session_replication_role = replica" -f - < "$OUT/data.sql"

echo "→ пользователи auth (репетиторы)"
psql -q --single-transaction -c "set session_replication_role = replica" -f - < "$OUT/auth_users.sql"

echo "→ Realtime: публикация для живого чата"
psql -q -c "alter publication supabase_realtime add table public.chat_messages" \
  || echo "  (уже добавлена — это нормально)"

echo
echo "Контрольные числа в новой базе:"
for t in students homework chat_messages student_accounts variants variant_submissions notifications tasks boards lesson_reports; do
  printf "  %-20s %s\n" "$t" "$(psql -tAc "select count(*) from public.$t" 2>/dev/null | tr -d '[:space:]' || echo 'нет таблицы')"
done
printf "  %-20s %s\n" "auth.users" "$(psql -tAc 'select count(*) from auth.users' | tr -d '[:space:]')"
echo
echo "Сверьте эти числа со старой базой ДО переключения фронтенда."
