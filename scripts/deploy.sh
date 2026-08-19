#!/usr/bin/env bash
# Ручная раскатка на боевой сервер. Нужна, пока автодеплой GitHub Actions
# выключен (переменная DEPLOY_ENABLED не выставлена, см. docs/hosting.md).
#
# Состав ровно тот же, что собирает .github/workflows/deploy.yml. Это важнее,
# чем кажется: раскатка идёт rsync --delete, и «просто dist/» стирает с сервера
# личную страницу репетитора /me, которая живёт внутри dist. Один раз так уже
# случилось (19.08.2026) — поэтому раскатывать руками только через этот скрипт.
#
# node_modules НЕ трогаем: они меняются лишь вместе с package-lock.json, и
# копировать 160 МБ на каждую правку незачем. Если менялись зависимости —
# раскатать их отдельно, см. docs/hosting.md.
set -euo pipefail

cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-precettore-db}"
ROOT=/opt/precettore-web/current

echo "→ сборка"
npm run build

echo "→ бандл (dist + личная страница /me)"
rm -rf .deploy
mkdir -p .deploy/dist/me
cp -r dist/. .deploy/dist/
cp portfolio/index.html portfolio/arman.webp .deploy/dist/me/

echo "→ статика"
rsync -az --delete -e ssh .deploy/dist/ "$HOST:$ROOT/dist/"

echo "→ функции и общий код"
rsync -az --delete -e ssh api/ "$HOST:$ROOT/api/"
rsync -az --delete -e ssh src/ "$HOST:$ROOT/src/"
rsync -az -e ssh server/ "$HOST:$ROOT/server/"
rsync -az -e ssh package.json "$HOST:$ROOT/package.json"

# Статику Caddy подхватывает сразу, а Node держит модули в памяти.
echo "→ перезапуск функций"
ssh "$HOST" 'docker restart precettore-web' >/dev/null

echo "→ проверка"
curl -fsS -o /dev/null -w "  /api/healthz  %{http_code}\n" https://precettore.ru/api/healthz || true
curl -fsS -o /dev/null -w "  /me/          %{http_code}\n" https://precettore.ru/me/
curl -fsS -o /dev/null -w "  /             %{http_code}\n" https://precettore.ru/
echo "готово"
