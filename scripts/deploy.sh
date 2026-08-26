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

# --exclude /crm/ — панель владельца (репозиторий ~/precettore-crm) лежит в
# dist/crm и раскатывается своим скриптом. Без исключения rsync --delete снёс
# бы её первым же деплоем сайта: ровно так 19.08.2026 погибла страница /me.
# Правка парная с .github/workflows/deploy.yml — состав должен совпадать.
# --exclude .DS_Store — служебному файлу macOS не место в веб-корне.
# --chown здесь НЕ применить: macOS поставляет openrsync (совместимый с rsync
# 2.6.9), а --chown появился в rsync 3.1. Владельца поэтому правим на сервере
# отдельным шагом ниже — см. комментарий там.
RS=(-az --delete --exclude '.DS_Store' -e ssh)

echo "→ статика"
rsync "${RS[@]}" --exclude '/crm/' .deploy/dist/ "$HOST:$ROOT/dist/"

echo "→ функции и общий код"
rsync "${RS[@]}" api/ "$HOST:$ROOT/api/"
rsync "${RS[@]}" src/ "$HOST:$ROOT/src/"
rsync -az --exclude '.DS_Store' -e ssh server/ "$HOST:$ROOT/server/"
rsync -az -e ssh package.json "$HOST:$ROOT/package.json"

# Ходим мы root'ом, и `rsync -a` от root переносит на сервер ЛОКАЛЬНОГО
# владельца (uid 501 с макбука): каталоги current/{api,dist,src,server}
# становились чужими для пользователя deploy. А автодеплой GitHub Actions ходит
# именно им — и падал бы на записи в них. Возвращаем владельца после каждой
# ручной раскатки, иначе следующий автодеплой снова сломается.
echo "→ владелец файлов"
ssh "$HOST" 'chown -R deploy:deploy /opt/precettore-web/current'

# Статику Caddy подхватывает сразу, а Node держит модули в памяти.
echo "→ перезапуск функций"
ssh "$HOST" 'docker restart precettore-web' >/dev/null

echo "→ проверка"
curl -fsS -o /dev/null -w "  /api/healthz  %{http_code}\n" https://precettore.ru/api/healthz || true
curl -fsS -o /dev/null -w "  /me/          %{http_code}\n" https://precettore.ru/me/
curl -fsS -o /dev/null -w "  /             %{http_code}\n" https://precettore.ru/
echo "готово"
