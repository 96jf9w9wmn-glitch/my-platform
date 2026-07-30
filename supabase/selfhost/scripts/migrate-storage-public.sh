#!/usr/bin/env bash
# Перенос файлов Storage БЕЗ service_role-ключа облачного проекта.
#
#   bash scripts/migrate-storage-public.sh
#
# Работает, пока бакеты публичные (у нас `homework` и `variants` такие —
# см. долги в CLAUDE.md): список объектов берём из облачной базы по SQL, сами
# файлы скачиваем по публичному URL, загружаем в новый Storage под локальным
# SERVICE_ROLE_KEY из .env.
#
# Если бакеты закроют (перевод на подписанные URL) — этот путь перестанет
# работать, тогда нужен scripts/migrate-storage.mjs с ключом старого проекта.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"
# shellcheck disable=SC1091
set -a; . ./migrate.env; . ./.env; set +a

[ -n "${CLOUD_DB_URL:-}" ] || { echo "В migrate.env не задан CLOUD_DB_URL"; exit 1; }
[ -n "${SERVICE_ROLE_KEY:-}" ] || { echo "В .env не найден SERVICE_ROLE_KEY"; exit 1; }

# Публичный адрес облачного Storage выводим из строки подключения:
# db.<ref>.supabase.co -> https://<ref>.supabase.co
REF=$(printf '%s' "$CLOUD_DB_URL" | sed -n 's|.*@db\.\([a-z0-9]*\)\.supabase\.co.*|\1|p')
[ -n "$REF" ] || { echo "Не удалось определить ref проекта из CLOUD_DB_URL"; exit 1; }
CLOUD_PUBLIC="https://$REF.supabase.co/storage/v1/object/public"
LOCAL_API="http://127.0.0.1:8000/storage/v1"
PG_IMAGE=$(docker inspect --format '{{.Config.Image}}' supabase-db)

sql() { docker run --rm --network host "$PG_IMAGE" psql "$CLOUD_DB_URL" -tA -F $'\t' -c "$1" < /dev/null; }

echo "Источник: $CLOUD_PUBLIC"
echo

# 1. Бакеты — с теми же настройками публичности.
echo "=== бакеты ==="
while IFS=$'\t' read -r id is_public; do
  [ -n "$id" ] || continue
  body=$(curl -s -w '\n%{http_code}' -X POST "$LOCAL_API/bucket" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"$id\",\"name\":\"$id\",\"public\":$is_public}")
  code=$(printf '%s' "$body" | tail -1)
  case "$code" in
    200|201) echo "  $id — создан (public=$is_public)" ;;
    409)     echo "  $id — уже существует" ;;
    *)       echo "  $id — ОШИБКА $code: $(printf '%s' "$body" | head -1)"; exit 1 ;;
  esac
  # public::text даёт true/false; без приведения psql выводит t/f и JSON ломается
done < <(sql "select id, public::text from storage.buckets order by id")

# 2. Файлы.
echo
echo "=== файлы ==="
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
copied=0; skipped=0; failed=0; failures=()

while IFS=$'\t' read -r bucket name mime; do
  [ -n "$bucket" ] || continue
  # Уже на месте? HEAD по публичному адресу нового Storage.
  if [ "$(curl -s -o /dev/null -w '%{http_code}' -I "$LOCAL_API/object/public/$bucket/$name")" = "200" ]; then
    skipped=$((skipped + 1)); continue
  fi
  f="$TMP/f"
  if ! curl -fsS "$CLOUD_PUBLIC/$bucket/$name" -o "$f" 2>/dev/null; then
    failed=$((failed + 1)); failures+=("скачивание: $bucket/$name"); continue
  fi
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$LOCAL_API/object/$bucket/$name" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: ${mime:-application/octet-stream}" \
    -H "x-upsert: true" \
    --data-binary "@$f")
  if [ "$code" = "200" ]; then
    copied=$((copied + 1))
    printf '\r  скопировано: %s' "$copied"
  else
    failed=$((failed + 1)); failures+=("загрузка $code: $bucket/$name")
  fi
  rm -f "$f"
done < <(sql "select bucket_id, name, metadata->>'mimetype' from storage.objects order by bucket_id, name")

echo
echo
echo "Итог: скопировано $copied, пропущено как уже перенесённые $skipped, ошибок $failed"
if [ ${#failures[@]} -gt 0 ]; then
  printf '  %s\n' "${failures[@]}"
  exit 1
fi

# 3. Сверка количества.
echo
echo "=== сверка ==="
sql "select bucket_id || ': ' || count(*) from storage.objects group by bucket_id order by 1" | sed 's/^/  облако  /'
docker compose exec -T db psql -U postgres -d postgres -tAc \
  "select bucket_id || ': ' || count(*) from storage.objects group by bucket_id order by 1" < /dev/null | sed 's/^/  новая   /'
