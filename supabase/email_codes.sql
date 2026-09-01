-- Подтверждение почты кодом при регистрации репетитора (второй фактор).
--
-- До этого аккаунт заводился по одному нажатию: адрес не проверялся вовсе,
-- поэтому зарегистрироваться можно было на чужую или несуществующую почту.
-- Второе означало ещё и потерю доступа: сброс пароля идёт письмом.
--
-- Код живёт только здесь и только в виде хэша — сам он существует в письме и в
-- памяти обработчика. Хэш считает сервер (sha256 от кода с серверным секретом),
-- поэтому база не знает ни кода, ни способа его восстановить.
--
-- Таблицу читает и пишет ТОЛЬКО service_role из api/auth-signup.js: политик нет,
-- гранты остальным ролям сняты. Аноним, увидевший эту таблицу, увидел бы список
-- адресов, которые сейчас регистрируются.
create table if not exists public.email_codes (
  email      text primary key,
  code_hash  text        not null,
  expires_at timestamptz not null,
  tries      integer     not null default 0,
  created_at timestamptz not null default now()
);

alter table public.email_codes enable row level security;
revoke all on public.email_codes from anon, authenticated, app_user;

comment on table public.email_codes is
  'Коды подтверждения почты при регистрации. Только хэш; пишет api/auth-signup.js.';
